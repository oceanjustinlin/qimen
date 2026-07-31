'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const YAML = require('yaml');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');
const PROPOSITION_FILES = [
  'interpretations/palaces/core-palaces.yaml',
  'interpretations/stars/major-stars.yaml',
  'interpretations/transformations/core-mutagens.yaml',
];
const SAFETY_FILE = 'policies/safety.yaml';
const FIXTURE_FILE = 'fixtures/report-cases/core-interpretations.json';
const MAJOR_STARS = [
  '紫微',
  '天机',
  '太阳',
  '武曲',
  '天同',
  '廉贞',
  '天府',
  '太阴',
  '贪狼',
  '巨门',
  '天相',
  '天梁',
  '七杀',
  '破军',
];

function absolutePath(relativePath) {
  return path.join(KNOWLEDGE_ROOT, relativePath);
}

function loadYaml(relativePath) {
  return YAML.parse(fs.readFileSync(absolutePath(relativePath), 'utf8'));
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolutePath(relativePath), 'utf8'));
}

function loadJsonLines(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function loadPropositions() {
  return PROPOSITION_FILES.flatMap((relativePath) => {
    const document = loadYaml(relativePath);
    assert.equal(document.schema_version, 'ziwei-interpretations/v1');
    assert.ok(Array.isArray(document.propositions));
    return document.propositions;
  });
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function predicateMatches(predicate, facts) {
  return facts.some((fact) => Object.entries(predicate).every(([key, value]) => (
    valuesEqual(fact[key], value)
  )));
}

function conditionMatches(condition, facts) {
  if (condition.all) return condition.all.every((item) => conditionMatches(item, facts));
  if (condition.any) return condition.any.some((item) => conditionMatches(item, facts));
  if (condition.not) return !conditionMatches(condition.not, facts);
  return predicateMatches(condition, facts);
}

test('Task 5 所需解释、安全策略与报告 fixture 文件已创建', () => {
  [...PROPOSITION_FILES, SAFETY_FILE, FIXTURE_FILE].forEach((relativePath) => {
    assert.equal(fs.existsSync(absolutePath(relativePath)), true, `缺少 ${relativePath}`);
  });
});

test('23 条解释命题通过 Schema，证据可追溯且不使用确定性语言', () => {
  const schema = loadJson('schemas/interpretation.schema.json');
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const propositions = loadPropositions();
  const sources = [
    ...loadJsonLines('sources/mingli-tianji/excerpts.jsonl'),
    ...loadJsonLines('sources/feixing-ziwei/excerpts.jsonl'),
  ];
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.equal(propositions.length, 23);
  assert.equal(new Set(propositions.map((item) => item.id)).size, 23);
  propositions.forEach((proposition) => {
    assert.equal(
      validate(proposition),
      true,
      `${proposition.id}\n${JSON.stringify(validate.errors, null, 2)}`,
    );
    assert.equal(proposition.status, 'reviewed');
    assert.equal(proposition.language_policy.deterministic, false);
    assert.ok(proposition.modifiers.strengthen.length > 0);
    assert.ok(proposition.modifiers.weaken.length > 0);
    proposition.evidence.forEach((evidenceId) => {
      const source = sourceById.get(evidenceId);
      assert.ok(source, `${proposition.id} 引用了不存在的证据 ${evidenceId}`);
      assert.equal(source.ocr_status, 'visually_verified');
    });
  });
});

test('十四主星各有一条中性基础语义，并声明增强与减弱条件', () => {
  const starDocument = loadYaml('interpretations/stars/major-stars.yaml');
  const starPropositions = starDocument.propositions;

  assert.equal(starPropositions.length, 14);
  assert.deepEqual(
    starPropositions.map((item) => item.subject.stars[0]),
    MAJOR_STARS,
  );
  starPropositions.forEach((proposition) => {
    assert.deepEqual(proposition.topics, ['overall']);
    assert.equal(proposition.claim.strength, 'medium');
    assert.equal(proposition.risk, 'low');
    assert.ok(!/[男女]命|克夫|克妻|淫乱|短寿|牢狱/.test(proposition.claim.tendency));
  });
});

test('安全策略阻止确定性、高风险与性别刻板断语', () => {
  const safety = loadYaml(SAFETY_FILE);
  const policyById = new Map(safety.policies.map((policy) => [policy.id, policy]));
  const blockedPhrases = new Set(safety.blocked_phrases);

  assert.equal(safety.schema_version, 'ziwei-safety/v1');
  assert.equal(safety.default_action, 'conditional_language');
  [
    'policy.deterministic-outcome.v1',
    'policy.high-risk-event.v1',
    'policy.gender-stereotype.v1',
  ].forEach((id) => {
    assert.equal(policyById.get(id)?.action, 'block');
  });
  ['注定', '短寿', '淫乱', '克夫', '克妻', '牢狱', '犯罪'].forEach((phrase) => {
    assert.equal(blockedPhrases.has(phrase), true, `缺少禁止词：${phrase}`);
  });
});

test('命宫、官禄、财帛、主星与四化 fixture 命中和排除均符合预期', () => {
  const propositions = loadPropositions();
  const fixture = loadJson(FIXTURE_FILE);

  assert.equal(fixture.schema_version, 'ziwei-interpretation-cases/v1');
  fixture.cases.forEach((fixtureCase) => {
    const matchedIds = propositions
      .filter((proposition) => conditionMatches(proposition.conditions, fixtureCase.facts))
      .map((proposition) => proposition.id);

    assert.deepEqual(matchedIds, fixtureCase.expected_matches, fixtureCase.id);
    fixtureCase.expected_non_matches.forEach((id) => {
      assert.equal(matchedIds.includes(id), false, `${fixtureCase.id} 不应命中 ${id}`);
    });
  });
});
