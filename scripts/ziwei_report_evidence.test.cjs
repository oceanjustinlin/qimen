'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { run: runZiweiCli } = require('./ziwei_cli.cjs');
const {
  composeEvidenceReport,
  loadReportTemplates,
  projectChartFacts,
  validateReportOutput,
} = require('./ziwei_report_evidence.cjs');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');
const EXPECTED_PRIORITIES = {
  overall: ['命宫', '福德宫', '迁移宫', '官禄宫', '财帛宫'],
  career: ['官禄宫', '命宫', '迁移宫', '财帛宫', '福德宫'],
  wealth: ['财帛宫', '福德宫', '田宅宫', '官禄宫', '命宫'],
  relationship: ['夫妻宫', '命宫', '福德宫', '迁移宫', '子女宫'],
  annual: [
    '命宫',
    '官禄宫',
    '财帛宫',
    '迁移宫',
    '福德宫',
    '夫妻宫',
    '疾厄宫',
    '田宅宫',
    '交友宫',
    '父母宫',
    '兄弟宫',
    '子女宫',
  ],
};

function profile() {
  return {
    profile_id: 'fictional-report-case',
    gender: '男',
    birth_date: '1998-07-26 18:35:00',
    adjusted_birth_date: '1998-07-26 18:29:00',
    solar_time_mode: 'apparent',
    solar_time_adjustment_minutes: -6,
  };
}

function buildChart() {
  return runZiweiCli({
    mode: 'natal',
    profile_snapshot: profile(),
    target_datetime: '2026-07-31 12:00:00',
    options: { include_horoscope: true },
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('五类报告模板声明宫位优先级、阅读顺序和证据发布门禁', () => {
  const templates = loadReportTemplates({ knowledgeRoot: KNOWLEDGE_ROOT });

  assert.deepEqual([...templates.keys()].sort(), Object.keys(EXPECTED_PRIORITIES).sort());
  Object.entries(EXPECTED_PRIORITIES).forEach(([topic, palacePriority]) => {
    const template = templates.get(topic);
    assert.deepEqual(template.palace_priority, palacePriority);
    assert.deepEqual(template.school_order, ['sanhe-core', 'feixing-aux']);
    assert.ok(template.reading_order.includes('palace'));
    assert.ok(template.reading_order.includes('star'));
    assert.ok(template.reading_order.includes('mutagen'));
    assert.equal(template.evidence_policy.require_matched_fact, true);
    assert.equal(template.evidence_policy.require_reviewed_proposition, true);
    assert.equal(template.evidence_policy.require_reviewed_claim_text, true);
    assert.equal(template.evidence_policy.require_visually_verified_source, true);
  });
});

test('命盘事实统一仆役宫别名，并仅把运限命宫落点记为焦点激活', () => {
  const chart = buildChart();
  const facts = projectChartFacts(chart);
  const palaceFacts = facts.filter((fact) => fact.feature === 'chart_has_palace');
  const yearlyActivations = facts.filter((fact) => (
    fact.feature === 'period_activates' && fact.period === 'yearly'
  ));
  const yearlyFocus = chart.natal.palaces[chart.horoscope.yearly.index];
  const expectedPalace = yearlyFocus.palace_key === '仆役宫'
    ? '交友宫'
    : yearlyFocus.palace_key;

  assert.equal(palaceFacts.some((fact) => fact.palace === '仆役宫'), false);
  assert.equal(palaceFacts.some((fact) => fact.palace === '交友宫'), true);
  assert.deepEqual(yearlyActivations, [{
    feature: 'period_activates',
    palace: expectedPalace,
    period: 'yearly',
    value: '命宫',
  }]);
});

test('报告只输出实际命中的结论，并为每条结论附盘面事实和来源 ID', () => {
  const chart = buildChart();
  const chartBefore = clone(chart);
  const first = composeEvidenceReport({
    chart,
    topic: 'overall',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });
  const second = composeEvidenceReport({
    chart,
    topic: 'overall',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });

  assert.deepEqual(second, first);
  assert.deepEqual(chart, chartBefore);
  assert.equal(first.schema_version, 'ziwei-report-output/v1');
  assert.equal(first.topic, 'overall');
  assert.ok(first.conclusions.length > 0);
  first.conclusions.forEach((conclusion) => {
    assert.match(conclusion.proposition_id, /^interp\./);
    assert.ok(['exact_topic', 'overall_context'].includes(conclusion.context_role));
    assert.ok(conclusion.matched_facts.length > 0);
    assert.ok(conclusion.evidence_ids.length > 0);
    assert.ok(conclusion.matched_facts.every((fact) => fact.palace));
    assert.ok(conclusion.evidence_ids.every((sourceId) => sourceId.startsWith('source.')));
  });
  assert.deepEqual(
    validateReportOutput(first, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    { valid: true, conclusion_count: first.conclusions.length },
  );
});

test('关系报告明确区分通用背景，流年报告不以本命命题冒充年度结论', () => {
  const chart = buildChart();
  const relationship = composeEvidenceReport({
    chart,
    topic: 'relationship',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });
  const annual = composeEvidenceReport({
    chart,
    topic: 'annual',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });

  assert.ok(relationship.conclusions.length > 0);
  assert.ok(relationship.conclusions.every((item) => item.context_role === 'overall_context'));
  assert.deepEqual(annual.conclusions, []);
  assert.ok(annual.warnings.includes('ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED'));
});

test('报告校验拒绝缺少命中事实、缺少来源和伪造盘面事实的结论', () => {
  const chart = buildChart();
  const report = composeEvidenceReport({
    chart,
    topic: 'career',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });
  assert.ok(report.conclusions.length > 0);

  const withoutFacts = clone(report);
  withoutFacts.conclusions[0].matched_facts = [];
  assert.throws(
    () => validateReportOutput(withoutFacts, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_FACTS_MISSING',
  );

  const withoutEvidence = clone(report);
  withoutEvidence.conclusions[0].evidence_ids = [];
  assert.throws(
    () => validateReportOutput(withoutEvidence, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_EVIDENCE_MISSING',
  );

  const fabricatedFact = clone(report);
  fabricatedFact.conclusions[0].matched_facts[0].palace = '不存在宫';
  assert.throws(
    () => validateReportOutput(fabricatedFact, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_FACT_NOT_IN_CHART',
  );
});

test('报告校验拒绝未知来源和安全策略禁止的高风险文案', () => {
  const chart = buildChart();
  const report = composeEvidenceReport({
    chart,
    topic: 'wealth',
    knowledgeRoot: KNOWLEDGE_ROOT,
  });
  assert.ok(report.conclusions.length > 0);

  const unknownSource = clone(report);
  unknownSource.conclusions[0].evidence_ids = ['source.unknown.p1.fake'];
  assert.throws(
    () => validateReportOutput(unknownSource, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_SOURCE_UNKNOWN',
  );

  const unsafeCopy = clone(report);
  unsafeCopy.conclusions[0].text = '此人注定必然发财，现实选择不会改变结果。';
  assert.throws(
    () => validateReportOutput(unsafeCopy, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_SAFETY_BLOCKED',
  );

  const unsupportedCopy = clone(report);
  unsupportedCopy.conclusions[0].text = '今天适合购买彩票。';
  assert.throws(
    () => validateReportOutput(unsupportedCopy, { chart, knowledgeRoot: KNOWLEDGE_ROOT }),
    (error) => error.code === 'REPORT_TEXT_NOT_REVIEWED',
  );
});
