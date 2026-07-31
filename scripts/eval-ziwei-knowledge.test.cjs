'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  evaluateZiweiKnowledge,
} = require('./eval-ziwei-knowledge.cjs');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');
const FIXTURE_PATH = path.join(
  KNOWLEDGE_ROOT,
  'fixtures',
  'regression-cases',
  'baseline-v1.json',
);
const EVAL_CLI = path.join(__dirname, 'eval-ziwei-knowledge.cjs');

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('回归命例明确声明为虚构资料，且不包含用户身份字段', () => {
  const fixture = loadFixture();

  assert.equal(fixture.schema_version, 'ziwei-knowledge-regression-cases/v1');
  assert.equal(fixture.privacy.origin, 'synthetic');
  assert.equal(fixture.privacy.contains_real_identity, false);
  assert.ok(fixture.report_cases.length >= 3);
  fixture.report_cases.forEach((fixtureCase) => {
    assert.match(fixtureCase.id, /^synthetic-/);
    assert.equal(fixtureCase.profile.profile_id, fixtureCase.id);
    ['name', 'email', 'phone', 'birthplace', 'address'].forEach((field) => {
      assert.equal(Object.hasOwn(fixtureCase.profile, field), false, `${fixtureCase.id}.${field}`);
    });
  });
});

test('知识评估稳定复现首个 P0、P1 与报告证据基线', () => {
  const fixture = loadFixture();
  const first = evaluateZiweiKnowledge({
    knowledgeRoot: KNOWLEDGE_ROOT,
    fixturePath: FIXTURE_PATH,
  });
  const second = evaluateZiweiKnowledge({
    knowledgeRoot: KNOWLEDGE_ROOT,
    fixturePath: FIXTURE_PATH,
  });

  assert.deepEqual(second, first);
  assert.equal(first.schema_version, 'ziwei-knowledge-evaluation/v1');
  assert.equal(first.baseline_id, fixture.baseline_id);
  assert.deepEqual(first.metrics, fixture.expected_baseline);
  assert.ok(Object.values(first.checks).every(Boolean));
  assert.equal(first.passed, true);
});

test('知识评估 CLI 可执行并在基线满足时通过发布门禁', () => {
  const output = JSON.parse(execFileSync('node', [EVAL_CLI, '--assert-baseline'], {
    encoding: 'utf8',
  }));

  assert.equal(output.ok, true);
  assert.equal(output.result.passed, true);
  assert.equal(output.result.metrics.reports.no_evidence_conclusion_count, 0);
  assert.equal(output.result.metrics.p0.conflict_rate, 0);
});

test('知识评估 CLI 在基线漂移时返回非零退出码', () => {
  const fixture = loadFixture();
  fixture.expected_baseline.reports.conclusion_count -= 1;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziwei-eval-'));
  const driftedFixturePath = path.join(tempDir, 'drifted-baseline.json');
  fs.writeFileSync(driftedFixturePath, JSON.stringify(fixture), 'utf8');

  let failure;
  try {
    execFileSync(
      'node',
      [EVAL_CLI, '--assert-baseline', '--fixture', driftedFixturePath],
      { encoding: 'utf8' },
    );
  } catch (error) {
    failure = error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  assert.ok(failure, '基线漂移时 CLI 应以非零状态退出');
  assert.equal(failure.status, 1);
  const output = JSON.parse(failure.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.result.passed, false);
  assert.equal(output.result.checks.baseline_exact_match, false);
});
