'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');
const RULE_FILES = [
  'rules/relation/palace-relations.yaml',
  'rules/calculation/doujun.yaml',
  'rules/calculation/flow-periods.yaml',
  'rules/activation/period-scopes.yaml',
];

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_ROOT, relativePath), 'utf8'));
}

function loadJsonLines(relativePath) {
  return fs.readFileSync(path.join(KNOWLEDGE_ROOT, relativePath), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function loadRules() {
  return RULE_FILES.flatMap((relativePath) => {
    const document = loadJson(relativePath);
    assert.equal(document.schema_version, 'ziwei-rules/v1');
    return document.rules;
  });
}

function positiveMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function resolveTerm(term, input) {
  if (typeof term === 'number') return term;
  if (typeof term === 'string') return input[term];
  const raw = input[term.input];
  const subtracted = raw - (term.subtract || 0);
  return term.modulo ? positiveMod(subtracted, term.modulo) : subtracted;
}

function evaluateDerivation(rule, input) {
  const { operator, arguments: args } = rule.derive;
  if (operator === 'assign') return args.value;

  const start = resolveTerm(args.start, input);
  const modulus = args.modulus || 12;
  if (operator === 'opposite') return positiveMod(start + 6, modulus);
  if (operator === 'trine') return args.offsets.map((offset) => positiveMod(start + offset, modulus));
  if (operator === 'palace_offset') {
    const forward = (args.forward || []).reduce((sum, term) => sum + resolveTerm(term, input), 0);
    const reverse = (args.reverse || []).reduce((sum, term) => sum + resolveTerm(term, input), 0);
    return positiveMod(start + forward - reverse, modulus);
  }
  throw new Error(`测试执行器不支持操作符：${operator}`);
}

test('P0 规则文件全部通过 Rule Schema，且只发布已复核规则', () => {
  const schema = loadJson('schemas/rule.schema.json');
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const rules = loadRules();

  assert.equal(rules.length, 12);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  rules.forEach((rule) => {
    assert.equal(validate(rule), true, `${rule.id}\n${JSON.stringify(validate.errors, null, 2)}`);
    assert.equal(rule.status, 'reviewed');
    assert.equal(rule.risk, 'low');
  });
});

test('每条 P0 规则的证据都存在于已视觉复核的来源摘录', () => {
  const sourceRows = [
    ...loadJsonLines('sources/mingli-tianji/excerpts.jsonl'),
    ...loadJsonLines('sources/feixing-ziwei/excerpts.jsonl'),
  ];
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));

  loadRules().forEach((rule) => {
    assert.ok(rule.evidence.length > 0);
    rule.evidence.forEach((evidenceId) => {
      const source = sourceById.get(evidenceId);
      assert.ok(source, `${rule.id} 引用了不存在的来源 ${evidenceId}`);
      assert.equal(source.ocr_status, 'visually_verified');
    });
  });
});

test('P0 合成命例覆盖全部规则，并得到固定宫位或作用域', () => {
  const fixture = loadJson('fixtures/rule-cases/p0-rules.json');
  const ruleById = new Map(loadRules().map((rule) => [rule.id, rule]));

  assert.equal(fixture.schema_version, 'ziwei-rule-cases/v1');
  assert.deepEqual(
    [...fixture.expected_rule_ids].sort(),
    [...ruleById.keys()].sort(),
  );
  assert.equal(new Set(fixture.cases.map((item) => item.rule_id)).size, ruleById.size);

  fixture.cases.forEach((item) => {
    const rule = ruleById.get(item.rule_id);
    assert.ok(rule, `fixture 引用了不存在的规则 ${item.rule_id}`);
    assert.deepEqual(
      evaluateDerivation(rule, item.input),
      item.expected,
      item.id,
    );
  });
});

test('斗君规则由现代资料与古籍双来源交叉支持', () => {
  const doujun = loadRules().find((rule) => rule.id === 'rule.flow.doujun.v1');

  assert.deepEqual(doujun.evidence, [
    'source.mingli-tianji.p408.doujun',
    'source.feixing-ziwei.p127.doujun',
  ]);
  assert.equal(doujun.confidence, 'high');
});
