const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildScoreEvidenceNarrative,
  buildScoreEvidenceSection,
  buildQimenSystemPrompt,
  QIMEN_SENTINEL_KEYS,
  layerWord,
  componentWord,
  overallTone
} = require('./qimenPromptSections');

const SAMPLE_AUDIT = {
  version: 'qimen-score-v1',
  base_score: 60,
  final_score: 56,
  level: 'medium',
  role: 'master',
  deltas: {
    master_client: -4,
    macro: 0,
    palace: -4,
    named_formation: -12,
    relation: 8,
    context: 3,
    risk: 0,
    void_modifier_applied: true
  },
  adjustments: [
    { layer: 'master_client', signal: '庚时（阴时）', effect: '-4', reason: '阴时利守待方，但当前站位仍需催动。' },
    { layer: 'named_formation', signal: '六仪击刑', effect: '-12', palace_index: 0, reason: '命中有名格「六仪击刑」，领域「finance_wealth」下评分 -12' },
    { layer: 'relation', signal: '日干/时干主客生克', effect: '+8', reason: '本人仍能主动制事。' },
    { layer: 'context', signal: '伤门催收', effect: '+3', reason: '催收场景中压力可转为催动力，通常应作为扣分或风险信号。' },
    { layer: 'context', signal: '伤门催收', effect: '+3', reason: '催收场景中压力可转为催动力，通常应作为扣分或风险信号。' },
    { layer: 'palace', signal: '坤2宫单宫能量', effect: '-4', reason: 'x' },
    { layer: 'modifier', signal: '核心用神空亡', effect: 'toward-60', reason: '钱款未落到实处。' }
  ],
  yongshen_nodes: [
    {
      palace: '坤2宫',
      palace_index: 2,
      delta: -4,
      components: { ground: -5, door: 4, star: -5, god: 2 },
      isKong: true,
      hasHorse: false
    }
  ],
  relations: [{ effect: 8, reason: '本人仍能主动制事。' }]
};

const SAMPLE_OPTIONS = {
  scoreInput: {
    palaces: [
      { index: 2, name: '坤2宫', prosperity: '囚', door: '生門', star: '天芮', god: '六合', isKong: true }
    ]
  },
  yongshenRule: {
    yongshen: { primary: [{ symbol: '生门', role: '钱款/收益' }] },
    outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['生门'] }
  }
};

test('定性档位：分值换成助力/阻力和有利/不利', () => {
  assert.equal(layerWord(9), '明显助力');
  assert.equal(layerWord(4), '小有助力');
  assert.equal(layerWord(0), '影响不大');
  assert.equal(layerWord('-4'), '小有阻力');
  assert.equal(layerWord(-12), '明显阻力');
  assert.equal(componentWord(0), '中性');
  assert.equal(componentWord(-5), '明显不利');
  assert.equal(componentWord(2), '偏有利');
  assert.equal(overallTone(56).label, '中等可观察');
  assert.equal(overallTone(30).label, '明显不利');
});

test('盘面评估只给定性结论，不出现任何分值和内部标签', () => {
  const section = buildScoreEvidenceNarrative(SAMPLE_AUDIT, SAMPLE_OPTIONS);

  assert.match(section, /【盘面评估】/);
  assert.match(section, /整体基调：中等可观察/);
  assert.match(section, /求测人站位：守待方/);
  assert.match(section, /主客动静：小有阻力/);
  assert.match(section, /大局提纲（值符、值使门）：影响不大/);
  assert.match(section, /主客生克：明显助力。本人仍能主动制事/);
  assert.match(section, /有名格：明显阻力/);
  assert.match(section, /六仪击刑：明显阻力。落巽4宫。/);
  assert.match(section, /坤2宫：生门（钱款\/收益）。本宫整体：小有阻力/);
  assert.match(section, /旺衰\/地利：明显不利（囚）；八门：偏有利（生门）；九星：明显不利（天芮）；八神：偏有利（六合）/);
  assert.match(section, /核心用神逢空/);
  assert.match(section, /坤2宫用神整体状态/);
  assert.match(section, /日干与事项一方的生克/);
  // 同一理由不重复
  assert.equal(section.match(/催收场景中压力可转为催动力/g).length, 1);

  assert.doesNotMatch(section, /[+-]\d|\d+ ?点|评分|扣分|加分|工程指标|后端|单宫能量|主客生克$/m);
  assert.doesNotMatch(section, /生門/);
});

test('buildScoreEvidenceSection 接受 { scoreAudit, scoreInput, yongshenRule }', () => {
  const section = buildScoreEvidenceSection({ scoreAudit: SAMPLE_AUDIT, ...SAMPLE_OPTIONS });
  assert.match(section, /【盘面评估】/);
  assert.match(section, /生门（钱款\/收益）/);
});

test('system prompt 固定不变、只说一次输出格式、不再要求复核块', () => {
  const system = buildQimenSystemPrompt();
  assert.equal(system, buildQimenSystemPrompt());
  assert.doesNotMatch(system, /\$\{/);

  QIMEN_SENTINEL_KEYS.forEach((key) => {
    assert.equal(system.split(`<<<SEC:${key}>>>`).length - 1, 1, key);
    assert.equal(system.split(`<<<END:${key}>>>`).length - 1, 1, key);
  });
  assert.match(system, /actions/);
  assert.match(system, /每条 45-95 字/);
  assert.match(system, /yongshen_cards/);
  assert.match(system, /m4_guidance/);
  assert.match(system, /timing_behavior/);
  assert.match(system, /映期要符合现实常理/);
  assert.match(system, /一律忽略/);

  assert.doesNotMatch(system, /score_review|intent_audit|timing_review|audit_delta/);
  assert.doesNotMatch(system, /覆盖前文|不要输出 summary|display_blocks|domain_view/);
  // 吉格凶格长名单已删，程序已识别命中哪些格
  assert.doesNotMatch(system, /飞鸟跌穴|天网四张|九遁/);
});
