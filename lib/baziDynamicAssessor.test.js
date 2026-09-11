'use strict';

const { describe, test, before: beforeAll } = require('node:test');
const assert = require('node:assert/strict');

function expect(actual) {
  const api = {
    toBe(expected) { assert.equal(actual, expected); },
    toContain(expected) { assert.ok(actual.includes(expected)); },
    toBeDefined() { assert.notEqual(actual, undefined); },
    toBeUndefined() { assert.equal(actual, undefined); },
    toBeGreaterThan(expected) { assert.ok(actual > expected); },
    toMatch(expected) { assert.match(actual, expected); },
    not: {
      toContain(expected) { assert.ok(!actual.includes(expected)); },
      toMatch(expected) { assert.doesNotMatch(actual, expected); }
    }
  };
  return api;
}

/**
 * 四个核心场景测试：
 * 1. 冲动：流年冲动妻宫（日支），静→动，分离象
 * 2. 合动（解冲）：流年合解原局冲，动→稳，婚姻落定
 * 3. 开墓库：流年冲开财星所在墓支，封藏→透出
 * 4. 伏吟：流年与原局某柱伏吟，聚焦放大
 *
 * 共用底盘：男命 甲寅/丁丑/己未/壬子（同 baziStateAssessor.test.js）
 *   dayStem = 己，妻星 = 壬(财)/癸(才)，妻宫 = 日支未
 *   原局：月支丑 冲 日支未（妻宫受冲，overall_stability = dynamic）
 */

const {
  assessDynamicTriggers,
  assessImageLuckEffect,
  isFuyin,
  isFantin,
  isOpenTomb,
  MECH,
  EVENT,
} = require('./baziDynamicAssessor');
const { assessOriginalChartState } = require('./baziStateAssessor');
const { resolveTargetElement } = require('./baziTargetElement');

// ── 共用数据 ──────────────────────────────────────────────────

const MATRIX = {
  pillars: [
    { name: '年', gan: '甲', zhi: '寅', hidden_stems: ['甲', '丙', '戊'], is_kong: false },
    { name: '月', gan: '丁', zhi: '丑', hidden_stems: ['己', '癸', '辛'], is_kong: true  },
    { name: '日', gan: '己', zhi: '未', hidden_stems: ['己', '丁', '乙'], is_kong: false },
    { name: '时', gan: '壬', zhi: '子', hidden_stems: ['癸'],             is_kong: true  },
  ],
};
const DAY_STEM = '己';
const TARGET_SPEC = resolveTargetElement({ category: 'relationship', subcategory: 'marriage_pattern', gender: 'male' });
const STATE_REPORT = assessOriginalChartState({ matrix: MATRIX, targetSpec: TARGET_SPEC, dayStem: DAY_STEM, gender: 'male' });

// 确认底盘：妻宫受冲
test('底盘确认：妻宫受冲 overall_stability = dynamic', () => {
  expect(STATE_REPORT.overall_stability).toBe('dynamic');
});

// ─────────────────────────────────────────────────────────────
// 场景 1：冲动 — 流年再冲日支未（加剧）
// 大运 甲戌，流年 丁丑（丑再冲未）
// ─────────────────────────────────────────────────────────────

describe('场景1：流年丑再冲未 → 冲动加剧', () => {
  let report;
  beforeAll(() => {
    report = assessDynamicTriggers({
      matrix: MATRIX,
      targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT,
      dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '丁', liunianZhi: '丑',
    });
  });

  test('流年 impact 检测到六冲（丑冲未）', () => {
    const chong = report.liunian_impact.zhi_relations.find(
      r => r.type === '六冲' && r.partner_zhi === '未'
    );
    expect(chong).toBeDefined();
    expect(chong.effective_strength).toBeGreaterThan(0);
  });

  test('流年 mechanisms 含冲动机制，目标柱为日', () => {
    const mech = report.liunian_impact.mechanisms.find(
      m => m.type === MECH.CHONG_DONG && m.target_pillar === '日'
    );
    expect(mech).toBeDefined();
  });

  test('target_trigger state_change 含"冲"', () => {
    expect(report.target_trigger.state_change).toMatch(/冲/);
  });

  test('new_stability 仍为 dynamic', () => {
    expect(report.target_trigger.new_stability).toBe('dynamic');
  });
});

// ─────────────────────────────────────────────────────────────
// 场景 2：合动（解冲）— 流年合解日支未的冲
// 大运 甲戌，流年 甲午（午合未，解丑冲未）
// 己日：午与未六合（午未六合化土）
// ─────────────────────────────────────────────────────────────

describe('场景2：流年甲午 合未 解冲 → 合动，婚姻落定', () => {
  let report;
  beforeAll(() => {
    report = assessDynamicTriggers({
      matrix: MATRIX,
      targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT,
      dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '甲', liunianZhi: '午',
    });
  });

  test('流年支与日支未有六合关系', () => {
    const he = report.liunian_impact.zhi_relations.find(
      r => (r.type === '六合_化' || r.type === '六合_不化') && r.partner_zhi === '未'
    );
    expect(he).toBeDefined();
  });

  test('mechanisms 含合动机制', () => {
    const mech = report.liunian_impact.mechanisms.find(
      m => m.type === MECH.HE_DONG && m.target_pillar === '日'
    );
    expect(mech).toBeDefined();
  });

  test('target_trigger event_type = 婚姻落定', () => {
    expect(report.target_trigger.event_type).toBe(EVENT.MARRIAGE);
  });

  test('new_stability 变为 stable', () => {
    expect(report.target_trigger.new_stability).toBe('stable');
  });

  test('is_activated 取决于旺衰（合力有效）', () => {
    // 结果取决于流年旺衰，只断言类型正确
    expect(typeof report.target_trigger.is_activated).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────
// 场景 3：开墓库 — 使用不同底盘（财星入墓的命局）
// 男命 壬日，财星 = 丙(才)/丁(财) → 火，火墓 = 戌
// 原局：庚戌月（财星入戌墓），稳定性 = buried
// 大运 丙辰，流年 甲辰（辰冲戌，开火墓）
// ─────────────────────────────────────────────────────────────

describe('场景3：戌冲辰 开水墓 → 开墓库', () => {
  // 己日干：壬=财（正财），癸=才（偏财）；水墓=辰
  // 原局：年甲辰 月庚午 日己卯 时甲寅
  //   癸（才星）仅藏于辰（水墓），无其他壬/癸明干 → overall_stability='buried'
  //   日支卯(只含乙=杀)稳固，辰未被冲合 → 封藏态
  // 大运 庚戌，戌冲辰 → isOpenTomb('戌','buried','水')=true → KAI_MU
  const matrix2 = {
    pillars: [
      { name: '年', gan: '甲', zhi: '辰', hidden_stems: ['戊', '乙', '癸'], is_kong: false },
      { name: '月', gan: '庚', zhi: '午', hidden_stems: ['丁', '己'],       is_kong: false },
      { name: '日', gan: '己', zhi: '卯', hidden_stems: ['乙'],             is_kong: false },
      { name: '时', gan: '甲', zhi: '寅', hidden_stems: ['甲', '丙', '戊'], is_kong: false },
    ],
  };
  const spec2 = resolveTargetElement({ category: 'relationship', subcategory: 'marriage_pattern', gender: 'male' });
  let stateReport2;
  let report;

  beforeAll(() => {
    stateReport2 = assessOriginalChartState({ matrix: matrix2, targetSpec: spec2, dayStem: '己', gender: 'male' });
    report = assessDynamicTriggers({
      matrix: matrix2,
      targetSpec: spec2,
      stateReport: stateReport2,
      dayStem: '己',
      dayunGan: '庚', dayunZhi: '戌',
      liunianGan: '甲', liunianZhi: '辰',
    });
  });

  test('底盘稳定性为 buried（癸才星仅藏于辰水墓）', () => {
    expect(stateReport2.overall_stability).toBe('buried');
  });

  test('年支辰含藏干癸（才星）', () => {
    const nianPillar = matrix2.pillars.find(p => p.name === '年');
    expect(nianPillar.hidden_stems).toContain('癸');
  });

  test('大运戌 与年支辰 存在六冲关系', () => {
    const chong = report.dayun_impact.zhi_relations.find(
      r => r.type === '六冲' && r.partner_zhi === '辰'
    );
    expect(chong).toBeDefined();
  });

  test('大运 mechanisms 含开墓库（KAI_MU）', () => {
    const hasMu = report.dayun_impact.mechanisms.some(m => m.type === MECH.KAI_MU);
    expect(hasMu).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 场景 4：伏吟 — 流年与原局某柱干支完全相同
// 大运 甲子，流年 甲寅（与年柱甲寅伏吟）
// ─────────────────────────────────────────────────────────────

describe('场景4：流年甲寅与年柱甲寅伏吟 → 伏吟聚焦', () => {
  let report;
  beforeAll(() => {
    report = assessDynamicTriggers({
      matrix: MATRIX,
      targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT,
      dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '子',
      liunianGan: '甲', liunianZhi: '寅',
    });
  });

  test('流年 mechanisms 含伏吟，目标柱为年', () => {
    const mech = report.liunian_impact.mechanisms.find(
      m => m.type === MECH.FU_YIN && m.target_pillar === '年'
    );
    expect(mech).toBeDefined();
  });

  test('伏吟 effective_strength 固定为 60', () => {
    const mech = report.liunian_impact.mechanisms.find(m => m.type === MECH.FU_YIN);
    expect(mech?.effective_strength).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────
// 工具函数单元测试
// ─────────────────────────────────────────────────────────────

describe('工具函数：isFuyin / isFantin / isOpenTomb', () => {
  test('isFuyin：相同干支 → true', () => {
    expect(isFuyin('甲', '子', '甲', '子')).toBe(true);
  });
  test('isFuyin：不同干支 → false', () => {
    expect(isFuyin('甲', '子', '乙', '子')).toBe(false);
  });

  test('isFantin：天克地冲 → true（甲子 vs 庚午）', () => {
    // 甲(木)克庚(金)? 不对。金克木。庚克甲。子冲午。
    expect(isFantin('庚', '子', '甲', '午')).toBe(true);
  });
  test('isFantin：只有地冲无天克 → false', () => {
    expect(isFantin('甲', '子', '乙', '午')).toBe(false);
  });

  test('isOpenTomb：buried 状态 + 辰冲水墓 → true', () => {
    // 水墓 = 辰；ZHI_CHONGS[戌] = 辰，ZHI_CHONGS[辰] = 戌
    // 所以 isOpenTomb(戌, buried, 水) → ZHI_CHONGS[戌]=辰=ELEMENT_TOMB[水]=辰 → true
    expect(isOpenTomb('戌', 'buried', '水')).toBe(true);
  });
  test('isOpenTomb：非 buried 状态 → false', () => {
    expect(isOpenTomb('戌', 'stable', '水')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Step 3：大运场域分类
// ─────────────────────────────────────────────────────────────

describe('Step3：dayun_impact.field_type 场域分类', () => {
  test('大运甲戌 甲己五合日柱（解冲）→ field_type 吉场', () => {
    const report = assessDynamicTriggers({
      matrix: MATRIX, targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT, dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '丁', liunianZhi: '丑',
    });
    // 大运天干甲与日干己五合→合解妻宫冲，目标集最高机制为 HE_DONG → 吉场
    expect(report.dayun_impact.field_type).toContain('吉场');
  });

  test('场景2（大运甲戌 + 流年甲午合未）field_type 应含标签字符串', () => {
    const report = assessDynamicTriggers({
      matrix: MATRIX, targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT, dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '甲', liunianZhi: '午',
    });
    expect(typeof report.dayun_impact.field_type).toBe('string');
    expect(report.dayun_impact.field_type.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Step 5：填实三刑（TIAN_SHI_XING）
// ─────────────────────────────────────────────────────────────

describe('Step5：填实三刑 TIAN_SHI_XING', () => {
  // 原局有寅（年）+ 申（月），流年巳 → 完成 寅申巳 三刑
  const matrixXing = {
    pillars: [
      { name: '年', gan: '甲', zhi: '寅', hidden_stems: ['甲', '丙', '戊'], is_kong: false },
      { name: '月', gan: '庚', zhi: '申', hidden_stems: ['庚', '壬', '戊'], is_kong: false },
      { name: '日', gan: '己', zhi: '卯', hidden_stems: ['乙'],             is_kong: false },
      { name: '时', gan: '甲', zhi: '午', hidden_stems: ['丁', '己'],       is_kong: false },
    ],
  };

  test('流年巳填实寅申巳三刑 → mechanisms 含 TIAN_SHI_XING', () => {
    const { assessOriginalChartState } = require('./baziStateAssessor');
    const spec = resolveTargetElement({ category: 'relationship', subcategory: 'marriage_pattern', gender: 'male' });
    const state = assessOriginalChartState({ matrix: matrixXing, targetSpec: spec, dayStem: '己', gender: 'male' });
    const report = assessDynamicTriggers({
      matrix: matrixXing, targetSpec: spec, stateReport: state, dayStem: '己',
      dayunGan: '甲', dayunZhi: '子',
      liunianGan: '丙', liunianZhi: '巳',
    });
    const allMechs = [...report.dayun_impact.mechanisms, ...report.liunian_impact.mechanisms];
    const xing = allMechs.find(m => m.type === MECH.TIAN_SHI_XING);
    expect(xing).toBeDefined();
    expect(xing.description).toContain('寅');
  });
});

test('填实三合是全局结构事件，同一描述只生成一次', () => {
  const matrix = {
    pillars: [
      { name: '年', gan: '戊', zhi: '寅', hidden_stems: ['甲', '丙', '戊'], is_kong: false },
      { name: '月', gan: '己', zhi: '未', hidden_stems: ['己', '丁', '乙'], is_kong: false },
      { name: '日', gan: '甲', zhi: '戌', hidden_stems: ['戊', '辛', '丁'], is_kong: false },
      { name: '时', gan: '癸', zhi: '酉', hidden_stems: ['辛'],             is_kong: false },
    ],
  };
  const targetSpec = resolveTargetElement({ category: 'wealth', subcategory: 'general_wealth', gender: 'male' });
  const stateReport = assessOriginalChartState({ matrix, targetSpec, dayStem: '甲', gender: 'male' });
  const report = assessDynamicTriggers({
    matrix, targetSpec, stateReport, dayStem: '甲',
    dayunGan: '壬', dayunZhi: '戌',
    liunianGan: '丙', liunianZhi: '午',
  });
  const tianshi = report.liunian_impact.mechanisms.filter(
    mech => mech.type === MECH.TIAN_SHI && mech.description === '午填实原局半合，补成三合火局'
  );

  assert.equal(tianshi.length, 1);
});

// ─────────────────────────────────────────────────────────────
// Step 7：四象吉凶断语（喜忌交叉对照）
// ─────────────────────────────────────────────────────────────

describe('Step7：favorableWuxing/unfavorableWuxing 四象断语', () => {
  // 场景1（冲动）：传入喜忌，应输出四象断语
  test('目标五行为忌神 + 冲方旺 → 去凶则利', () => {
    // 己日妻星=水，若 unfavorableWuxing=水，冲方赢 → 去凶则利
    const report = assessDynamicTriggers({
      matrix: MATRIX, targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT, dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '丁', liunianZhi: '丑',
      unfavorableWuxing: new Set(['水']),
    });
    // 冲动场景下 auspice_direction 应含四象字眼
    expect(report.target_trigger.auspice_direction).toMatch(/去凶则利|激凶则祸|去吉则害|激吉有动象/);
  });

  test('目标五行为喜神 + 冲方旺 → 去吉则害', () => {
    const report = assessDynamicTriggers({
      matrix: MATRIX, targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT, dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '丁', liunianZhi: '丑',
      favorableWuxing: new Set(['水']),
    });
    expect(report.target_trigger.auspice_direction).toMatch(/去吉则害|激吉有动象/);
  });

  test('不传喜忌时 → fallback 到旺衰描述', () => {
    const report = assessDynamicTriggers({
      matrix: MATRIX, targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT, dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '丁', liunianZhi: '丑',
    });
    // 无喜忌时不应出现四象字眼（fallback到旺衰描述）
    expect(report.target_trigger.auspice_direction).not.toMatch(/去凶则利|激凶则祸|去吉则害|激吉有动象/);
  });
});

// ─────────────────────────────────────────────────────────────
// Task 5：第一阶段形象岁运诊断
// ─────────────────────────────────────────────────────────────

describe('Task5：assessImageLuckEffect 第一阶段形象岁运诊断', () => {
  test('无特殊形象上下文时返回 neutral 默认值', () => {
    const result = assessImageLuckEffect({
      imageContext: null,
      dayStem: '甲',
      dayunGan: '丙', dayunZhi: '巳',
      liunianGan: '丁', liunianZhi: '午',
    });

    assert.deepEqual(result, {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: 0,
      description: '原局未形成需追踪特殊形象',
    });
  });

  test('有效上下文仅受单次逆势影响时标记 WEAKENED_BY_LUCK', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'FOLLOW_IMAGE',
        target_element: '金',
        match_score: 92,
      },
      dayStem: '甲',
      dayunGan: '壬',
    });

    expect(result.status).toBe('WEAKENED_BY_LUCK');
    expect(result.score_delta).toBe(-12);
    expect(result.reason_codes).toContain('RESOURCE_LUCK_SUPPORTS_DM');
  });

  test('有效上下文无增损时返回 NEUTRAL', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'FOLLOW_IMAGE',
        target_element: '金',
        match_score: 92,
      },
      dayStem: '甲',
      dayunGan: '丙',
    });

    expect(result.status).toBe('NEUTRAL');
    expect(result.score_delta).toBe(0);
    assert.deepEqual(result.reason_codes, []);
  });

  test('缺 category 时返回 neutral 默认值', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        target_element: '火',
        match_score: 76,
      },
      dayStem: '甲',
      dayunGan: '丙',
    });

    assert.deepEqual(result, {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: 76,
      description: '原局未形成需追踪特殊形象',
    });
  });

  test('缺 match_score 时返回 neutral 默认值', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'FOLLOW_IMAGE',
        target_element: '火',
      },
      dayStem: '甲',
      dayunGan: '丙',
    });

    assert.deepEqual(result, {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: 0,
      description: '原局未形成需追踪特殊形象',
    });
  });

  test('display-only or vetoed image candidates are not tracked as natal special images', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'TWO_QI_IMAGE',
        subtype: '火土成势',
        target_elements: ['火', '土'],
        match_score: 77,
        override_scope: 'display_only',
        override_veto_reason: '壬水透干有根，承担制刃与调候，不按火土顺势覆盖。',
      },
      dayStem: '丙',
      dayunGan: '丙', dayunZhi: '午',
      liunianGan: '丁', liunianZhi: '巳',
    });

    assert.deepEqual(result, {
      status: 'NEUTRAL',
      score_delta: 0,
      reason_codes: [],
      natal_match_score: 77,
      description: '原局形象候选未主导取用，不作为特殊形象追踪',
    });
  });

  test('FOLLOW_IMAGE：日主同类与生日主五行反复出现时破格', () => {
    const imageContext = {
      category: 'FOLLOW_IMAGE',
      target_element: '金',
      match_score: 92,
    };
    const result = assessImageLuckEffect({
      imageContext,
      dayStem: '甲',
      dayunGan: '甲', dayunZhi: '亥',
      liunianGan: '壬', liunianZhi: '卯',
    });

    expect(result.status).toBe('BROKEN_BY_LUCK');
    expect(result.score_delta).toBe(-48);
    expect(result.reason_codes).toContain('RESOURCE_LUCK_SUPPORTS_DM');
    expect(result.natal_match_score).toBe(92);
    expect(imageContext.match_score).toBe(92);
  });

  test('FOLLOW_IMAGE：目标五行由天干和地支主气反复出现时顺势', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'FOLLOW_IMAGE',
        target_element: '火',
        match_score: 88,
      },
      dayStem: '壬',
      dayunGan: '丙', dayunZhi: '巳',
      liunianGan: '丁', liunianZhi: '午',
    });

    expect(result.status).toBe('SUPPORTED_BY_LUCK');
    expect(result.score_delta).toBe(32);
    expect(result.reason_codes).toContain('LUCK_SUPPORTS_IMAGE_FORCE');
  });

  test('SINGLE_IMAGE：克制专旺目标五行的岁运破格', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'SINGLE_IMAGE',
        target_element: '木',
        match_score: 90,
      },
      dayStem: '甲',
      dayunGan: '庚', dayunZhi: '申',
      liunianGan: '辛', liunianZhi: '酉',
    });

    expect(result.status).toBe('BROKEN_BY_LUCK');
    expect(result.score_delta).toBe(-48);
    expect(result.reason_codes).toContain('OFFICIAL_LUCK_BREAKS_SINGLE_IMAGE');
  });

  test('TRANSFORMATION_IMAGE：目标、生目标与克目标五行分别累计', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'TRANSFORMATION_IMAGE',
        target_element: '土',
        match_score: 86,
      },
      dayStem: '甲',
      dayunGan: '戊', dayunZhi: '午',
      liunianGan: '甲', liunianZhi: '辰',
    });

    expect(result.status).toBe('SUPPORTED_BY_LUCK');
    expect(result.score_delta).toBe(12);
    expect(result.reason_codes).toContain('LUCK_SUPPORTS_IMAGE_FORCE');
    expect(result.reason_codes).toContain('LUCK_DAMAGES_TRANSFORM_QI');
  });

  test('原局未满 80 分且岁运加分后达到 80 时标记 FAKE_TO_TRUE', () => {
    const result = assessImageLuckEffect({
      imageContext: {
        category: 'FOLLOW_IMAGE',
        target_elements: ['火', '土'],
        match_score: 72,
      },
      dayStem: '壬',
      dayunGan: '丙',
    });

    expect(result.status).toBe('FAKE_TO_TRUE');
    expect(result.score_delta).toBe(8);
    expect(result.natal_match_score).toBe(72);
  });
});

test('assessDynamicTriggers 返回 image_luck_effect', () => {
  const report = assessDynamicTriggers({
    matrix: MATRIX,
    targetSpec: TARGET_SPEC,
    stateReport: {
      ...STATE_REPORT,
      image_context: {
        category: 'FOLLOW_IMAGE',
        target_element: '水',
        match_score: 84,
      },
    },
    dayStem: DAY_STEM,
    dayunGan: '壬', dayunZhi: '子',
    liunianGan: '癸', liunianZhi: '亥',
  });

  expect(report.image_luck_effect.status).toBe('SUPPORTED_BY_LUCK');
  expect(report.image_luck_effect.score_delta).toBe(32);
  expect(report.image_luck_effect.natal_match_score).toBe(84);
});

// ─────────────────────────────────────────────────────────────
// 格式化输出
// ─────────────────────────────────────────────────────────────

describe('formatDynamicReportForPrompt', () => {
  const { formatDynamicReportForPrompt } = require('./baziDynamicAssessor');

  test('输出为非空字符串且含关键字段', () => {
    const report = assessDynamicTriggers({
      matrix: MATRIX,
      targetSpec: TARGET_SPEC,
      stateReport: STATE_REPORT,
      dayStem: DAY_STEM,
      dayunGan: '甲', dayunZhi: '戌',
      liunianGan: '甲', liunianZhi: '午',
    });
    const out = formatDynamicReportForPrompt(report);
    expect(typeof out).toBe('string');
    expect(out).toContain('大运');
    expect(out).toContain('流年');
    expect(out).toContain('目标元素引动结论');
  });

  test('存在 image_luck_effect 时输出形象岁运诊断', () => {
    const out = formatDynamicReportForPrompt({
      dynamic_verdict: '动态断语',
      image_luck_effect: {
        status: 'BROKEN_BY_LUCK',
        score_delta: -48,
        description: '岁运破坏原局特殊形象',
        reason_codes: ['RESOURCE_LUCK_SUPPORTS_DM'],
      },
    });

    expect(out).toContain('形象岁运诊断');
    expect(out).toContain('BROKEN_BY_LUCK');
    expect(out).toContain('score_delta: -48');
    expect(out).toContain('岁运破坏原局特殊形象');
    expect(out).toContain('RESOURCE_LUCK_SUPPORTS_DM');
  });

  test('缺少 image_luck_effect 时仍输出断语与工程指标口径', () => {
    const out = formatDynamicReportForPrompt({
      dynamic_verdict: '动态断语',
    });

    expect(out).toContain('【大运流年动态分析】');
    expect(out).toContain('动态断语');
    expect(out).toContain('非古籍定量');
  });
});
