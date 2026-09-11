const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildScoreEvidenceNarrative,
  buildScoreAuditPromptSection,
  buildSummaryPromptSection,
  buildReportSchemaPromptSection,
  buildFrontendCopyProtocolSection,
  buildQimenInferenceRulesSection,
  buildQimenOutputContractSection
} = require('./qimenPromptSections');

test('buildScoreEvidenceNarrative explains current scoring layers and palace components', () => {
  const section = buildScoreEvidenceNarrative({
    version: 'qimen-score-v1',
    base_score: 60,
    final_score: 56,
    level: 'medium',
    role: 'master',
    deltas: {
      master_client: -4,
      macro: 0,
      palace: -4,
      named_formation: 0,
      relation: 8,
      context: 3,
      risk: 0,
      void_modifier_applied: true
    },
    adjustments: [
      { layer: 'master_client', signal: '庚时（阴时）', effect: '-4', reason: '阴时利守待方，但当前站位仍需催动。' },
      { layer: 'relation', signal: '日干/时干主客生克', effect: '+8', reason: '本人仍能主动制事。' },
      { layer: 'context', signal: '伤门催收', effect: '+3', reason: '催收场景中压力可转为催动力。' },
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
  }, {
    scoreInput: {
      palaces: [
        { index: 2, name: '坤2宫', prosperity: '囚', door: '生门', star: '天芮', god: '六合', isKong: true }
      ]
    },
    yongshenRule: {
      yongshen: { primary: [{ symbol: '生门', role: '钱款/收益' }] },
      outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['生门'] }
    }
  });

  assert.match(section, /后端工程指标证据摘要/);
  assert.match(section, /主客动静：-4/);
  assert.match(section, /大局提纲：0/);
  assert.match(section, /核心用神宫：-4/);
  assert.match(section, /有名格层：0/);
  assert.match(section, /未命中可计分有名格/);
  assert.match(section, /本领域核心用神：生门（钱款\/收益）/);
  assert.match(section, /命中宫位：坤2宫/);
  assert.match(section, /旺衰\/地利：-5，依据：囚/);
  assert.match(section, /八门：\+4，依据：生门/);
  assert.match(section, /九星：-5，依据：天芮/);
  assert.match(section, /八神：\+2，依据：六合/);
  assert.match(section, /核心用神逢空/);
  assert.match(section, /主客生克：\+8/);
  assert.match(section, /语境修正：\+3/);
  assert.doesNotMatch(section, /"deltas"/);
});

test('buildScoreAuditPromptSection requires auditable scoring and detailed adjustment reasons', () => {
  const section = buildScoreAuditPromptSection({
    scoreAudit: {
      version: 'qimen-score-v4',
      base_score: 60,
      final_score: 72,
      deltas: { master_client: 0, macro: 0, palace: 5, named_formation: 0, relation: 0, context: 0, risk: 0, void_modifier_applied: false },
      adjustments: [
        { layer: 'palace', signal: '开门旺相', effect: '+5', reason: '岗位机会有力' }
      ]
    },
    scoreInput: { palaces: [] }
  });

  assert.match(section, /score_review/);
  assert.match(section, /后端工程指标证据摘要/);
  assert.match(section, /后端工程指标：72 点/);
  assert.match(section, /确定性工程指标 \+ LLM复核要求/);
  assert.match(section, /audit_delta 固定返回 0/);
  assert.match(section, /route\.confidence 为 low/);
  assert.match(section, /取用神/);
  assert.match(section, /后处理阶段拼接/);
  assert.match(section, /开门旺相/);
  assert.doesNotMatch(section, /preliminary_score_audit：\n\{/);
  assert.doesNotMatch(section, /base_score 固定从 50 起步/);
});

test('buildSummaryPromptSection keeps summary as legacy fallback only', () => {
  const section = buildSummaryPromptSection();

  assert.match(section, /title、conclusion、keyword/);
  assert.match(section, /summary\.score_basis/);
  assert.match(section, /欠款还款/);
  assert.match(section, /不宜断为必然到账/);
  assert.match(section, /新 UI 不要求模型输出顶层 summary/);
  assert.match(section, /由后端从 qimen_report 与评分审计结果派生或覆盖/);
  assert.doesNotMatch(section, /"score": 58/);
});

test('frontend copy protocol and output contract avoid large JSON templates', () => {
  const protocol = buildFrontendCopyProtocolSection();
  const contract = buildQimenOutputContractSection({ routeConfidence: 'medium', backendScore: 56 });
  const combined = `${protocol}\n${contract}`;

  assert.match(combined, /前端断语协议/);
  assert.match(combined, /不要展示后端技术词/);
  assert.match(combined, /不再要求输出旧展示字段 summary、analysis、advice、display_blocks、domain_view/);
  assert.match(combined, /优先按后端给出的“ M2 领域用神卡片规则 ”逐项输出/);
  assert.match(combined, /qimen_report\.m3_inference/);
  assert.match(combined, /不要输出 label、key_components、user_implication、verdict、evidence/);
  assert.match(combined, /至少 1 条融合后端时间检索\/应期候选/);
  assert.match(combined, /每条 45-95 字/);
  assert.match(combined, /模型必须包含的顶层字段/);
  assert.match(combined, /score_review 必须包含/);
  assert.match(combined, /后端工程指标为 56/);
  assert.match(combined, /不要输出 backend_score_audit/);
  assert.match(combined, /intent_audit\.route_confidence 必须填 medium/);
  assert.match(combined, /只返回一个 JSON 对象/);
  assert.match(combined, /不要输出 summary、analysis、advice、display_blocks、domain_view/);
  assert.doesNotMatch(combined, /请严格按照以下 JSON 结构返回数据/);
  assert.doesNotMatch(combined, /"summary": \{/);
  assert.doesNotMatch(combined, /"domain_view": \{/);
});

test('report schema uses compact M3 contract with legacy fields removed', () => {
  const section = buildReportSchemaPromptSection();

  assert.match(section, /support_factors：有利因素。只输出 tone、summary、items\[\]/);
  assert.match(section, /constraint_factors：不利因素。只输出 tone、summary、items\[\]/);
  assert.match(section, /只输出 subject_symbol、target_symbol、tone、reading/);
  assert.match(section, /不要单独输出"推进\/观望\/暂缓"这类短 decision 字段/);
  assert.match(section, /翻译层三段只输出：symbol、palace、tone、reading/);
  assert.match(section, /M3 全段不要输出 label、key_components、user_implication、verdict、evidence、reason、decision/);
  assert.doesNotMatch(section, /每段必须包含：label/);
});

test('inference rules section injects the current v4 scoring framework', () => {
  const section = buildQimenInferenceRulesSection();

  assert.match(section, /奇门推断规则总纲/);
  assert.match(section, /主客动静层/);
  assert.match(section, /宏观提纲层/);
  assert.match(section, /核心用神宫层/);
  assert.match(section, /有名格层/);
  assert.match(section, /主客生克层/);
  assert.match(section, /语境极性层/);
  assert.match(section, /高风险校准层/);
  assert.match(section, /空亡回归修正/);
  assert.match(section, /应期层/);
  assert.match(section, /飞鸟跌穴/);
  assert.match(section, /青龙返首/);
  assert.match(section, /五不遇时/);
  assert.match(section, /六仪击刑/);
  assert.match(section, /三奇入墓/);
  assert.match(section, /九遁/);
  assert.match(section, /不得跳过有名格层/);
  assert.doesNotMatch(section, /"deltas"/);
});
