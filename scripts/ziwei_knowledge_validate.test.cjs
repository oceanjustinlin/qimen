'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_ROOT, relativePath), 'utf8'));
}

function validatorFor(schemaName) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  return ajv.compile(loadJson(path.join('schemas', schemaName)));
}

function assertValid(validate, value) {
  assert.equal(validate(value), true, JSON.stringify(validate.errors, null, 2));
}

function assertInvalid(validate, value) {
  assert.equal(validate(value), false, 'fixture 应被 Schema 拒绝');
}

test('来源 Schema 接受可追溯摘录，并拒绝缺少页码的资料', () => {
  const validate = validatorFor('source.schema.json');
  const validExcerpt = {
    id: 'source.mingli-tianji.p408.doujun',
    source_id: 'mingli-tianji',
    title: '流年斗君法',
    pdf_page: 421,
    printed_page: 408,
    section: '第四章 流年斗君、流月、流日、流时',
    ocr_text: '从流年所在宫起正月',
    corrected_text: '从流年所在宫起正月，逆数至生月，再顺数生时。',
    ocr_status: 'visually_verified',
    content_hash: `sha256:${'a'.repeat(64)}`,
  };

  assertValid(validate, validExcerpt);
  assertInvalid(validate, { ...validExcerpt, pdf_page: undefined });
});

test('规则 Schema 要求正式流派、受限操作符和至少一条证据', () => {
  const validate = validatorFor('rule.schema.json');
  const validRule = {
    id: 'rule.flow.doujun.v1',
    name: '流年斗君定位',
    rule_type: 'calculation',
    school: 'sanhe-core',
    scope: 'yearly',
    status: 'reviewed',
    priority: 100,
    inputs: ['yearly_palace_branch', 'lunar_birth_month', 'birth_time_index'],
    when: {
      all: [
        {
          fact: 'lunar_birth_month',
          operator: 'between',
          value: [1, 12],
        },
      ],
    },
    derive: {
      fact: 'yearly_doujun_palace_branch',
      operator: 'palace_offset',
      arguments: {
        start: 'yearly_palace_branch',
        reverse_steps: 'lunar_birth_month_minus_one',
        forward_steps: 'birth_time_index',
      },
    },
    evidence: ['source.mingli-tianji.p408.doujun'],
    confidence: 'high',
    risk: 'low',
  };

  assertValid(validate, validRule);
  assertInvalid(validate, { ...validRule, school: 'unknown-school' });
  assertInvalid(validate, { ...validRule, evidence: [] });
  assertInvalid(validate, {
    ...validRule,
    derive: { ...validRule.derive, operator: 'eval_javascript' },
  });
});

test('解释命题 Schema 要求命中条件、修正项、证据和非确定性语言策略', () => {
  const validate = validatorFor('interpretation.schema.json');
  const validInterpretation = {
    id: 'interp.career.wuqu.lu.v1',
    title: '武曲化禄与事业资源',
    school: 'sanhe-core',
    scope: 'natal',
    status: 'reviewed',
    topics: ['career', 'wealth'],
    subject: {
      palace: '官禄宫',
      stars: ['武曲'],
    },
    conditions: {
      all: [
        {
          feature: 'palace_has_star',
          palace: '官禄宫',
          star: '武曲',
        },
        {
          feature: 'star_has_mutagen',
          star: '武曲',
          mutagen: '禄',
        },
      ],
    },
    claim: {
      tendency: '资源管理、执行和经营能力更容易成为事业优势。',
      strength: 'medium',
    },
    modifiers: {
      strengthen: ['禄权科会照'],
      weaken: ['煞忌集中且大限重复引动'],
    },
    language_policy: {
      deterministic: false,
      forbidden_phrases: ['必然发财', '注定富贵'],
    },
    evidence: ['source.mingli-tianji.example'],
    confidence: 'medium',
  };

  assertValid(validate, validInterpretation);
  assertInvalid(validate, { ...validInterpretation, conditions: undefined });
  assertInvalid(validate, { ...validInterpretation, evidence: [] });
  assertInvalid(validate, {
    ...validInterpretation,
    language_policy: {
      ...validInterpretation.language_policy,
      deterministic: true,
    },
  });
});

test('宫位与流派本体提供固定、无重复的正式枚举', () => {
  const palaces = loadJson(path.join('ontology', 'palaces.yaml'));
  const schools = loadJson(path.join('ontology', 'schools.yaml'));
  const expectedPalaces = [
    '命宫',
    '兄弟宫',
    '夫妻宫',
    '子女宫',
    '财帛宫',
    '疾厄宫',
    '迁移宫',
    '交友宫',
    '官禄宫',
    '田宅宫',
    '福德宫',
    '父母宫',
  ];

  assert.deepEqual(palaces.palaces.map((palace) => palace.id), expectedPalaces);
  assert.equal(new Set(palaces.palaces.map((palace) => palace.id)).size, 12);
  assert.deepEqual(
    schools.schools.map((school) => school.id),
    ['iztro-default', 'sanhe-core', 'feixing-aux', 'classical-reference'],
  );
  assert.equal(schools.default_interpretation_school, 'sanhe-core');
});
