'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const COMPILE_CLI = path.join(__dirname, 'ziwei_rule_compile.cjs');
const EVAL_CLI = path.join(__dirname, 'ziwei_rule_eval.cjs');
const { run: runZiweiCli } = require(path.join(__dirname, 'ziwei_cli.cjs'));
const {
  compileRuleDocuments,
  compileRules,
  parseRuleDocument,
} = require(COMPILE_CLI);
const {
  evaluateCompiledRules,
} = require(EVAL_CLI);

function profile(overrides = {}) {
  return {
    gender: '女',
    birth_date: '2000-08-16 03:30:00',
    adjusted_birth_date: '2000-08-16 03:18:00',
    solar_time_mode: 'apparent',
    solar_time_adjustment_minutes: -12,
    ...overrides,
  };
}

function evaluationInput() {
  return {
    chart: runZiweiCli({
      mode: 'natal',
      profile_snapshot: profile(),
    }),
    context: {
      focus_palace_key: '命宫',
    },
    facts: {
      yearly_palace_index: 0,
      lunar_birth_month: 7,
      birth_time_index: 2,
      target_lunar_month: 4,
      target_lunar_day: 9,
      target_time_index: 6,
      mutagen_layer: 'yearly',
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('编译器解析 YAML、校验 12 条规则并生成稳定摘要', () => {
  const parsed = parseRuleDocument(`
schema_version: ziwei-rules/v1
rules: []
`, 'memory.yaml');
  assert.deepEqual(parsed, {
    schema_version: 'ziwei-rules/v1',
    rules: [],
  });

  const first = compileRules({ knowledgeRoot: path.join(ROOT, 'knowledge', 'ziwei') });
  const second = compileRules({ knowledgeRoot: path.join(ROOT, 'knowledge', 'ziwei') });

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'ziwei-compiled-rules/v1');
  assert.equal(first.rule_count, 12);
  assert.match(first.source_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(new Set(first.rules.map((rule) => rule.id)).size, 12);
});

test('编译器拒绝未知条件、未知派生操作符和重复规则 ID', () => {
  const compiled = compileRules({ knowledgeRoot: path.join(ROOT, 'knowledge', 'ziwei') });
  const baseRule = compiled.rules.find((rule) => rule.id === 'rule.flow.doujun.v1');
  const unknownPredicate = clone(baseRule);
  unknownPredicate.when.all[0].operator = 'execute_shell';
  const unknownDerivation = clone(baseRule);
  unknownDerivation.derive.operator = 'eval_javascript';

  assert.throws(
    () => compileRuleDocuments([{
      source_path: 'unknown-predicate.yaml',
      document: {
        schema_version: 'ziwei-rules/v1',
        rules: [unknownPredicate],
      },
    }]),
    (error) => error.code === 'RULE_SCHEMA_INVALID',
  );
  assert.throws(
    () => compileRuleDocuments([{
      source_path: 'unknown-derivation.yaml',
      document: {
        schema_version: 'ziwei-rules/v1',
        rules: [unknownDerivation],
      },
    }]),
    (error) => error.code === 'RULE_SCHEMA_INVALID',
  );
  assert.throws(
    () => compileRuleDocuments([{
      source_path: 'duplicate.yaml',
      document: {
        schema_version: 'ziwei-rules/v1',
        rules: [baseRule, clone(baseRule)],
      },
    }]),
    (error) => error.code === 'RULE_ID_DUPLICATE',
  );
});

test('执行器对同一 CLI 命盘和事实输入返回完全一致的派生结果', () => {
  const compiled = compileRules({ knowledgeRoot: path.join(ROOT, 'knowledge', 'ziwei') });
  const input = evaluationInput();
  const originalChart = JSON.stringify(input.chart);
  const first = evaluateCompiledRules(compiled, input);
  const second = evaluateCompiledRules(compiled, input);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input.chart), originalChart);
  assert.equal(first.schema_version, 'ziwei-rule-evaluation/v1');
  assert.equal(first.matches.length, 7);
  assert.deepEqual(
    first.matches.map((match) => match.rule_id),
    [
      'rule.relation.opposite.v1',
      'rule.relation.trine.v1',
      'rule.flow.doujun.v1',
      'rule.activation.yearly-mutagen.v1',
      'rule.flow.month.v1',
      'rule.flow.day.v1',
      'rule.flow.hour.v1',
    ],
  );
  assert.equal(first.derived_facts.yearly_doujun_palace_index, 8);
  assert.equal(first.derived_facts.flow_month_palace_index, 11);
  assert.equal(first.derived_facts.flow_day_palace_index, 7);
  assert.equal(first.derived_facts.flow_hour_palace_index, 1);

  const focus = input.chart.natal.palaces.find((palace) => palace.palace_key === '命宫');
  assert.equal(
    first.derived_facts.opposite_palace_index,
    (focus.index + 6) % 12,
  );
  assert.deepEqual(
    first.derived_facts.trine_palace_indexes,
    [(focus.index + 4) % 12, (focus.index + 8) % 12],
  );
});

test('执行器对绕过编译器注入的未知操作符执行防御性拒绝', () => {
  const compiled = compileRules({ knowledgeRoot: path.join(ROOT, 'knowledge', 'ziwei') });
  const corrupted = clone(compiled);
  corrupted.rules[0].derive.operator = 'eval_javascript';

  assert.throws(
    () => evaluateCompiledRules(corrupted, evaluationInput()),
    (error) => error.code === 'RULE_OPERATOR_UNSUPPORTED',
  );
});

test('编译与执行 CLI 均输出可解析、稳定的 JSON', () => {
  const compiled = JSON.parse(execFileSync('node', [COMPILE_CLI], {
    encoding: 'utf8',
  }));
  const input = evaluationInput();
  const evaluated = JSON.parse(execFileSync('node', [EVAL_CLI], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  }));

  assert.equal(compiled.rule_count, 12);
  assert.equal(evaluated.ok, true);
  assert.equal(evaluated.result.source_digest, compiled.source_digest);
  assert.equal(evaluated.result.matches.length, 7);
});
