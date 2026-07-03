const test = require('node:test');
const assert = require('node:assert/strict');

const { BaziRuleEngine } = require('./BaziRuleEngine');
const { assessBaziImage } = require('./baziImageAssessor');

test('calculateStrength uses updated layered scoring and returns explanation copy', () => {
  const result = BaziRuleEngine.calculateStrength(
    '戊',
    ['丁', '辛', '戊', '庚'],
    ['丑', '亥', '午', '申']
  );

  assert.equal(result.strongWeak, '身弱');
  assert.equal(result.strengthDetail.band, '偏弱');
  // 戊坐午为帝旺(羊刃)旺地，得地计入禄刃相位加成（3.5 -> 3.9）。
  assert.equal(result.strengthDetail.meter.value, 3.9);
  assert.equal(result.strengthDetail.season_detail.max_score, 4);
  assert.equal(result.strengthDetail.root_detail.max_score, 3);
  assert.equal(result.strengthDetail.support_detail.max_score, 2);
  assert.equal(result.dayMasterHasRoot, true);
  assert.equal(result.strengthDetail.summary, '日主身弱，综合强度3.9/10，内部细分为偏弱。');
  assert.equal(result.strengthDetail.sections.length, 5);
  assert.match(result.strengthDetail.sections[1].text, /年支丑藏己/);
  assert.match(result.strengthDetail.sections[2].text, /年干丁为正印/);
  assert.match(result.strengthDetail.sections[4].text, /不作真从或专旺覆盖/);
  assert.match(result.strengthBasis, /月令亥以壬为主气/);
  assert.match(result.strengthBasis, /日主有重根可依/);
  assert.match(result.strengthBasis, /年干丁为正印/);
});

test('calculateStrength returns a user-facing meter with four copy-only dimensions', () => {
  const result = BaziRuleEngine.calculateStrength(
    '甲',
    ['癸', '辛', '甲', '己'],
    ['酉', '酉', '申', '巳']
  );

  assert.equal(result.strongWeak, '身弱');
  assert.equal(result.strengthDetail.meter.min, 0);
  assert.equal(result.strengthDetail.meter.max, 10);
  assert.equal(result.strengthDetail.meter.label, '极弱');
  assert.ok(result.strengthDetail.meter.value >= 0);
  assert.ok(result.strengthDetail.meter.value <= 10);

  assert.equal(result.strengthDetail.user_sections.length, 4);
  assert.deepEqual(result.strengthDetail.user_sections.map(section => section.key), [
    'season',
    'root',
    'support',
    'structure',
  ]);
  for (const section of result.strengthDetail.user_sections) {
    assert.equal(typeof section.title, 'string');
    assert.equal(typeof section.text, 'string');
    assert.ok(section.text.length > 8);
    assert.equal(Object.hasOwn(section, 'score'), false);
    assert.equal(Object.hasOwn(section, 'scoreLabel'), false);
  }

  assert.equal(result.strengthDetail.season_detail.max_score, 4);
  assert.equal(result.strengthDetail.root_detail.max_score, 3);
  assert.equal(result.strengthDetail.support_detail.max_score, 2);
  assert.equal(result.strengthDetail.structure_exception.max_adjustment, 1);
});

test('calculateStrength keeps rootless dominant charts eligible for cong override only when no help exists', () => {
  const result = BaziRuleEngine.calculateStrength(
    '甲',
    ['丙', '丙', '甲', '丙'],
    ['辰', '巳', '巳', '巳']
  );

  assert.equal(result.dayMasterHasRoot, false);
  assert.equal(result.stemHasHelp, false);
  assert.ok(result.strongWeak.includes('疑似从格'));
  assert.match(result.strengthBasis, /四支无根/);
});

test('calculateStrength adds capped hidden seal support without double-counting peer roots', () => {
  const hiddenSeal = BaziRuleEngine.calculateStrength(
    '甲',
    ['庚', '戊', '甲', '辛'],
    ['辰', '子', '寅', '丑']
  );

  assert.ok(hiddenSeal.strengthDetail.support_detail.hidden_support_score > 0);
  assert.ok(hiddenSeal.strengthDetail.support_detail.hidden_supports.length > 0);
  assert.ok(hiddenSeal.strengthDetail.support_detail.hidden_supports.every(
    item => ['正印', '偏印'].includes(item.relation)
  ));
});

test('calculateStrength does not count hidden peer stems again as support', () => {
  const peerRoot = BaziRuleEngine.calculateStrength(
    '甲',
    ['庚', '戊', '甲', '辛'],
    ['卯', '午', '寅', '戌']
  );

  assert.equal(peerRoot.strengthDetail.support_detail.hidden_support_score, 0);
  assert.deepEqual(peerRoot.strengthDetail.support_detail.hidden_supports, []);
});

test('calculateStrength ignores trace hidden seals in the first P3-e support pass', () => {
  const traceSeal = BaziRuleEngine.calculateStrength(
    '甲',
    ['庚', '戊', '甲', '辛'],
    ['辰', '午', '寅', '戌']
  );

  assert.equal(traceSeal.strengthDetail.support_detail.hidden_support_score, 0);
  assert.deepEqual(traceSeal.strengthDetail.support_detail.hidden_supports, []);
});

test('calculateStrength caps hidden support inside the existing support maximum', () => {
  const manySeals = BaziRuleEngine.calculateStrength(
    '甲',
    ['壬', '癸', '甲', '壬'],
    ['子', '亥', '寅', '子']
  );

  assert.ok(manySeals.strengthDetail.support_detail.hidden_support_score <= 0.45);
  assert.ok(
    manySeals.strengthDetail.support_detail.score
      <= manySeals.strengthDetail.support_detail.max_score
  );
});

test('parseTiaohou preserves favorable and unfavorable priority markers', () => {
  const parsed = BaziRuleEngine._test.parseTiaohou('1丙2_癸3庚丁');

  assert.deepEqual(parsed.favorable, [
    { gan: '丙', priority: 1 },
    { gan: '庚', priority: 3 },
    { gan: '丁', priority: 3 },
  ]);
  assert.deepEqual(parsed.unfavorable, [
    { gan: '癸', priority: 2 },
  ]);
});

test('getFavorableUnfavorable scores tiaohou by exact stem priority instead of whole element', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '子',
    '正印格',
    { strongWeak: '身中', totalStrengthScore: 5 },
    ['辰', '子', '辰', '丑'],
    ['戊', '壬', '甲', '己']
  );

  assert.equal(result.dimension_breakdown['伤官'].tiaohou, 50);
  assert.equal(result.dimension_breakdown['食神'].tiaohou, 35);
  assert.equal(result.dimension_breakdown['七杀'].tiaohou, 35);
  assert.equal(result.dimension_breakdown['正官'].tiaohou, 0);
});

// 《滴天髓·寒暖》"冬木不受水者，喜火之解冻也"：寒月且日主印星为水（被冻失效）时，
// 调候之火虽泄身，应豁免其扶抑负分，使调候优先于扶抑。（郁达夫 丙申·庚子·甲午·甲子）
test('getFavorableUnfavorable 冬木不受水：寒月印为水豁免调候泄神扶抑负分（郁达夫型）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '子', '正印格',
    { strongWeak: '身弱', totalStrengthScore: 4 },
    ['申', '子', '午', '子'],
    ['丙', '庚', '甲', '甲']
  );
  // 调候首取火：伤官(丁)+50；身弱食伤本应 fuyi -20，此处被豁免为 0
  assert.equal(r.dimension_breakdown['伤官'].tiaohou, 50);
  assert.equal(r.dimension_breakdown['伤官'].fuyi, 0);
  // 调候之火胜出为用神（而非顺扶抑取比劫）
  assert.equal(r.five_shens.yong, '伤官');
});

// 反例守护：寒月但日主印星非受困之水（庚金之印为土，土不冻仍能生身）→ 不豁免，
// 调候之火(官杀)的扶抑负分照扣，仍走扶抑取印/比。（冼冠生 戊子·癸亥·庚寅·戊寅）
test('getFavorableUnfavorable 反例守护：寒月印非水（庚金土印）不豁免调候泄神', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '庚', '亥', '食神格',
    { strongWeak: '身弱', totalStrengthScore: 4 },
    ['子', '亥', '寅', '寅'],
    ['戊', '癸', '庚', '戊']
  );
  // 七杀(丙火)身弱克泄耗 fuyi 维持 -20，未被调候豁免
  assert.equal(r.dimension_breakdown['七杀'].fuyi, -20);
});

test('getFavorableUnfavorable applies tiaohou unfavorable gradient and restraint downgrade', () => {
  const baseStrength = { strongWeak: '身强', totalStrengthScore: 7 };
  const light = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '寅', '建禄格', baseStrength,
    ['子', '寅', '子', '寅'],
    ['甲', '丙', '甲', '庚']
  );
  const medium = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '寅', '建禄格', baseStrength,
    ['子', '寅', '子', '子'],
    ['甲', '丙', '甲', '庚']
  );
  const heavy = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '寅', '建禄格', baseStrength,
    ['子', '寅', '子', '子'],
    ['壬', '丙', '甲', '庚']
  );
  const restrainedHeavy = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '寅', '建禄格', baseStrength,
    ['子', '寅', '子', '子'],
    ['壬', '丙', '甲', '戊']
  );

  assert.equal(light.dimension_breakdown['正印'].tiaohou, -20);
  assert.equal(medium.dimension_breakdown['正印'].tiaohou, -35);
  assert.equal(heavy.dimension_breakdown['正印'].tiaohou, -50);
  assert.equal(restrainedHeavy.dimension_breakdown['正印'].tiaohou, -35);
});

test('getFavorableUnfavorable returns user-facing tiaohou diagnosis', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '子',
    '正印格',
    { strongWeak: '身中', totalStrengthScore: 5 },
    ['辰', '子', '辰', '丑'],
    ['戊', '壬', '甲', '己']
  );

  assert.equal(result.tiaohou_detail.key, '甲子');
  assert.equal(result.tiaohou_detail.climate_state, '寒湿偏重');
  assert.equal(result.tiaohou_detail.urgency, '偏急');
  assert.deepEqual(result.tiaohou_detail.primary_gods, [
    { gan: '丁', shen: '伤官', wuxing: '火', priority: 1, role: '第一调候' },
  ]);
  assert.deepEqual(result.tiaohou_detail.secondary_gods, [
    { gan: '丙', shen: '食神', wuxing: '火', priority: 2, role: '辅助调候' },
    { gan: '庚', shen: '七杀', wuxing: '金', priority: 2, role: '辅助调候' },
  ]);
  assert.match(result.tiaohou_detail.explanation, /寒湿偏重/);
  assert.match(result.tiaohou_detail.explanation, /丁火/);
});

test('getFavorableUnfavorable adds light and heavy bingyao tiers', () => {
  const light = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '辰', '正财格',
    { strongWeak: '身强', totalStrengthScore: 7 },
    ['子', '丑', '丑', '辰'],
    ['戊', '甲', '甲', '庚']
  );
  const heavy = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '辰', '正财格',
    { strongWeak: '身强', totalStrengthScore: 7 },
    ['辰', '辰', '丑', '丑'],
    ['戊', '戊', '甲', '己']
  );

  assert.equal(light.dimension_breakdown['正财'].bingyao, -20);
  assert.equal(light.dimension_breakdown['比肩'].bingyao, 20);
  assert.equal(light.dimension_breakdown['正官'].bingyao, 10);
  assert.equal(heavy.dimension_breakdown['正财'].bingyao, -40);
  assert.equal(heavy.dimension_breakdown['比肩'].bingyao, 40);
  assert.equal(heavy.dimension_breakdown['正官'].bingyao, 20);
});

test('getFavorableUnfavorable gives neutral-strength charts half-weight fuyi output', () => {
  const weakMiddle = BaziRuleEngine.getFavorableUnfavorable(
    '癸', '寅', '建禄格',
    { strongWeak: '身中', totalStrengthScore: 4 },
    ['未', '寅', '戌', '丑'],
    ['戊', '甲', '癸', '己']
  );
  const strongMiddle = BaziRuleEngine.getFavorableUnfavorable(
    '癸', '寅', '建禄格',
    { strongWeak: '身中', totalStrengthScore: 6 },
    ['未', '寅', '戌', '丑'],
    ['戊', '甲', '癸', '己']
  );

  assert.equal(weakMiddle.dimension_breakdown['正印'].fuyi, 10);
  assert.equal(weakMiddle.dimension_breakdown['正财'].fuyi, -10);
  assert.ok(weakMiddle.core_shens.favorable.length > 0);
  assert.equal(strongMiddle.dimension_breakdown['正财'].fuyi, 10);
  assert.equal(strongMiddle.dimension_breakdown['正印'].fuyi, -10);
  assert.ok(strongMiddle.core_shens.favorable.length > 0);
});

test('getFavorableUnfavorable does not let strength text override ordinary dimensions', () => {
  const strength = BaziRuleEngine.calculateStrength(
    '甲',
    ['丙', '丙', '甲', '丙'],
    ['辰', '巳', '巳', '巳']
  );
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '巳',
    '食神格',
    strength,
    ['辰', '巳', '巳', '巳'],
    ['丙', '丙', '甲', '丙']
  );

  assert.equal(result.special_pattern, null);
  assert.notEqual(result.decision_chain[0].layer, 'L0 特殊气势');
});

test('getFavorableUnfavorable keeps suspected image candidates in ordinary dimensions', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '巳',
    '食神格',
    { strongWeak: '疑似从格（从火）', totalStrengthScore: 1 },
    ['辰', '巳', '巳', '巳'],
    ['丙', '丙', '甲', '丙'],
    null,
    {
      primary_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从儿格',
        target_element: '火',
        match_score: 72,
        override_normal_pattern: false,
        yongshen_strategy: 'FOLLOW_FORCE'
      }
    }
  );

  assert.equal(result.special_pattern, null);
  assert.notEqual(result.decision_chain[0].layer, 'L0 特殊气势');
});

test('getFavorableUnfavorable uses formed image candidates for the L0 special-force override', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '丑',
    '正财格',
    { strongWeak: '身弱', totalStrengthScore: 1 },
    ['丑', '丑', '未', '辰'],
    ['戊', '己', '甲', '戊'],
    null,
    {
      primary_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从财格',
        target_element: '土',
        target_elements: ['火', '土', '金'],
        match_score: 86,
        override_normal_pattern: true,
        yongshen_strategy: 'FOLLOW_FORCE'
      }
    }
  );

  assert.equal(result.special_pattern.type, '从财');
  assert.equal(result.decision_chain[0].layer, 'L0 特殊气势');
  assert.equal(result.tiaohou_detail.key, '甲丑');
  assert.equal(result.tiaohou_detail.special_pattern_warning, '已识别特殊格局，喜忌先顺其成势；调候仍作为气候风险提示，不直接覆盖从格取用。');
  assert.deepEqual(result.core_shens.favorable, ['食神', '伤官', '正财', '偏财']);
  assert.deepEqual(result.core_shens.unfavorable, ['正印', '偏印', '比肩', '劫财', '正官', '七杀']);
  assert.equal(result.dimension_breakdown['正财'].tiaohou, 0);
  assert.equal(result.dimension_breakdown['正财'].cong, 90);
});

test('从财格 without rooted or exposed officer-killing keeps officer-killing out of favorable（状元型）', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '乙',
    '辰',
    '正财格',
    { strongWeak: '身弱', totalStrengthScore: 2.4 },
    ['戌', '辰', '未', '戌'],
    ['戊', '丙', '乙', '丙'],
    null,
    {
      primary_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从财格',
        target_element: '土',
        target_elements: ['火', '土', '金'],
        match_score: 99.81,
        override_normal_pattern: true,
        yongshen_strategy: 'FOLLOW_FORCE'
      }
    }
  );

  assert.equal(result.special_pattern.type, '从财');
  assert.equal(result.five_shens.yong, '伤官');
  assert.ok(result.wuxing.favorable.includes('火'));
  assert.ok(result.wuxing.favorable.includes('土'));
  assert.ok(!result.wuxing.favorable.includes('金'));
  assert.ok(result.wuxing.unfavorable.includes('金'));
  assert.ok(!result.core_shens.favorable.includes('正官'));
  assert.ok(!result.core_shens.favorable.includes('七杀'));
});

test('从财格 keeps repeatedly rooted downstream officer-killing favorable（黄堂型）', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '庚',
    '寅',
    '偏财格',
    { strongWeak: '身弱', totalStrengthScore: 2.4 },
    ['寅', '寅', '寅', '寅'],
    ['壬', '壬', '庚', '戊'],
    null,
    {
      primary_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从财格',
        target_element: '木',
        target_elements: ['水', '木', '火'],
        match_score: 93,
        override_normal_pattern: true,
        yongshen_strategy: 'FOLLOW_FORCE'
      }
    }
  );

  assert.equal(result.special_pattern.type, '从财');
  assert.equal(result.five_shens.yong, '食神');
  assert.ok(result.wuxing.favorable.includes('水'));
  assert.ok(result.wuxing.favorable.includes('木'));
  assert.ok(result.wuxing.favorable.includes('火'));
  assert.ok(!result.wuxing.unfavorable.includes('火'));
});

test('getFavorableUnfavorable prefers an eligible override candidate over the display primary candidate', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '戊',
    '卯',
    '正官格',
    { strongWeak: '身弱', totalStrengthScore: 1 },
    ['卯', '卯', '子', '亥'],
    ['癸', '乙', '戊', '癸'],
    null,
    {
      primary_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从官杀格',
        target_element: '木',
        match_score: 83.73,
        override_normal_pattern: false,
        yongshen_strategy: 'FOLLOW_FORCE'
      },
      override_candidate: {
        category: 'FOLLOW_IMAGE',
        subtype: '从财格',
        target_element: '水',
        match_score: 82.08,
        override_normal_pattern: true,
        yongshen_strategy: 'FOLLOW_FORCE'
      }
    }
  );

  assert.equal(result.special_pattern.type, '从财');
  assert.equal(result.decision_chain[0].layer, 'L0 特殊气势');
});

test('getFavorableUnfavorable maps structured image override categories to special-force shens', () => {
  const baseArgs = [
    '甲',
    '寅',
    '建禄格',
    { strongWeak: '身中', totalStrengthScore: 5 },
    ['寅', '寅', '寅', '寅'],
    ['甲', '甲', '甲', '甲'],
    null
  ];
  const cases = [
    {
      candidate: { category: 'FOLLOW_IMAGE', subtype: '从官杀格', target_element: '金' },
      type: '从官杀',
      favorable: ['正官', '七杀', '正财', '偏财'],
      unfavorable: ['正印', '偏印', '比肩', '劫财', '食神', '伤官']
    },
    {
      candidate: { category: 'FOLLOW_IMAGE', subtype: '从杀格', target_elements: ['土', '金'] },
      type: '从杀',
      favorable: ['正官', '七杀', '正财', '偏财'],
      unfavorable: ['正印', '偏印', '比肩', '劫财', '食神', '伤官']
    },
    {
      candidate: { category: 'FOLLOW_IMAGE', subtype: '从儿格', target_element: '火' },
      type: '从食伤',
      favorable: ['食神', '伤官', '正财', '偏财'],
      unfavorable: ['正印', '偏印', '比肩', '劫财', '正官', '七杀']
    },
    {
      candidate: { category: 'FOLLOW_IMAGE', subtype: '从势格', target_elements: ['火', '土', '火'] },
      type: '从势',
      favorable: ['食神', '伤官', '正财', '偏财'],
      unfavorable: ['比肩', '劫财', '正印', '偏印']
    },
    {
      candidate: { category: 'SINGLE_IMAGE', subtype: '曲直格', target_element: '木' },
      type: '专旺',
      favorable: ['比肩', '劫财', '食神', '伤官'],
      unfavorable: ['正官', '七杀', '正财', '偏财', '正印', '偏印']
    },
    {
      candidate: { category: 'TRANSFORMATION_IMAGE', subtype: '甲己化土', target_element: '土' },
      type: '甲己化土',
      favorable: ['正财', '偏财'],
      unfavorable: ['比肩', '劫财']
    }
  ];

  for (const { candidate, type, favorable, unfavorable } of cases) {
    const result = BaziRuleEngine.getFavorableUnfavorable(...baseArgs, {
      primary_candidate: {
        ...candidate,
        match_score: 86,
        override_normal_pattern: true
      }
    });
    assert.equal(result.special_pattern.type, type);
    assert.deepEqual(result.core_shens.favorable, favorable);
    assert.deepEqual(result.core_shens.unfavorable, unfavorable);
    assert.equal(result.decision_chain[0].layer, 'L0 特殊气势');
  }
});

test('getFavorableUnfavorable never promotes two-qi image candidates to L0', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '寅',
    '建禄格',
    { strongWeak: '身中', totalStrengthScore: 5 },
    ['寅', '寅', '寅', '寅'],
    ['甲', '甲', '甲', '甲'],
    null,
    {
      primary_candidate: {
        category: 'TWO_QI_IMAGE',
        subtype: '木火成象',
        target_elements: ['木', '火'],
        match_score: 96,
        override_normal_pattern: true,
        yongshen_strategy: 'DESCRIPTIVE_ONLY'
      }
    }
  );

  assert.equal(result.special_pattern, null);
  assert.notEqual(result.decision_chain[0].layer, 'L0 特殊气势');
});

test('getFavorableUnfavorable keeps weak excess resource from becoming plain unfavorable', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '甲',
    '辰',
    '正印格',
    { strongWeak: '身弱', totalStrengthScore: 2 },
    ['子', '亥', '子', '丑'],
    ['壬', '癸', '甲', '壬']
  );

  assert.ok(result.favorable_conflicts.some(item => item.type === 'weak_daymaster_excess_resource'));
  assert.ok(result.core_shens.favorable.includes('正印') || result.core_shens.favorable.includes('偏印'));
  assert.ok(!result.core_shens.unfavorable.includes('正印'));
  assert.ok(!result.core_shens.unfavorable.includes('偏印'));
});

test('getFavorableUnfavorable narrows aggregation threshold and prunes divergent paired shens', () => {
  const shens = ['正官', '七杀', '食神', '伤官'];
  const threshold = BaziRuleEngine._test.aggregateShens(shens, {
    '正官': 50,
    '七杀': 44,
    '食神': 10,
    '伤官': 0,
  });
  const pair = BaziRuleEngine._test.aggregateShens(shens, {
    '正官': 0,
    '七杀': 0,
    '食神': 34,
    '伤官': 50,
  });

  assert.deepEqual(threshold.favorable, ['正官']);
  assert.deepEqual(pair.favorable, ['伤官']);
});

// 通关神「有根」闸（《滴天髓·通关》"能胜能补、通根得地"）：通关神在地支无根时为虚浮幻影，
// 不予通关分；有根时照给 +30。成对守护，避免一刀切误伤正常通关盘。
test('getFavorableUnfavorable 通关有根闸：无根通关神不给分、有根照给', () => {
  const base = ['壬', '亥', '建禄格', { strongWeak: '身中', totalStrengthScore: 5 }];
  // 土水交战、金为通关桥。辰(藏戊乙癸)无金根 → 金为虚浮，通关分 0
  const rootless = BaziRuleEngine.getFavorableUnfavorable(
    ...base, ['子', '亥', '辰', '寅'], ['戊', '癸', '壬', '戊']
  );
  assert.equal(rootless.dimension_breakdown['正印'].tongguan, 0);
  assert.equal(rootless.dimension_breakdown['偏印'].tongguan, 0);
  // 同局把辰换成戌(藏辛余气=金根)，金虽<15% 但通根得地 → 通关分恢复 +30
  const rooted = BaziRuleEngine.getFavorableUnfavorable(
    ...base, ['子', '亥', '戌', '寅'], ['戊', '癸', '壬', '戊']
  );
  assert.equal(rooted.dimension_breakdown['正印'].tongguan, 30);
  assert.equal(rooted.dimension_breakdown['偏印'].tongguan, 30);
});

// 印星救主格（无根佩印·弃官就印）——冼冠生 戊子·癸亥·庚寅·戊寅，庚金亥月、地支全无金根。
// 教材判「伤官佩印」取戊土偏印（戊两透坐寅、寅藏戊有根，挡水救主）。引擎须：①通关有根闸
// 灭掉无根比劫的 +30；②识别透干有根之印为救主用神，弃官就印。《滴天髓·衰旺》"干多不如根重"。
test('getFavorableUnfavorable 印星救主格：无根庚金弃比劫就有根之印（冼冠生型）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '庚', '亥', '食神格',
    { strongWeak: '身弱', totalStrengthScore: 3 },
    ['子', '亥', '寅', '寅'],
    ['戊', '癸', '庚', '戊']
  );
  // 通关有根闸：金无根 → 比劫不再获 +30 通关分
  assert.equal(r.dimension_breakdown['比肩'].tongguan, 0);
  assert.equal(r.dimension_breakdown['劫财'].tongguan, 0);
  // 救主结构分落在透干有根之偏印(戊)，正印(己)不透则无分
  assert.equal(r.dimension_breakdown['偏印'].rescue, 40);
  assert.equal(r.dimension_breakdown['正印'].rescue, 0);
  // 弃官就印：旺官调候高分被剥夺
  assert.equal(r.dimension_breakdown['正官'].tiaohou, 0);
  // 用神取有根之印，而非无根之比劫
  assert.equal(r.five_shens.yong, '偏印');
});

// 印星救主格（官多变杀·弃官就印）——杜月笙 戊子·庚申·乙丑·壬午，乙木申月、地支全无木根。
// 庚申官旺变杀压身，教材取时干壬水正印化杀生身（喜水木忌金）。引擎须把救主分落在透干有根之
// 正印(壬)而非藏支不透之偏印(癸)，且剥夺旺官(正官)调候高分。《滴天髓·体用》"日主弱官杀旺则以印绶为用"。
test('getFavorableUnfavorable 印星救主格：官多变杀取透干正印化杀（杜月笙型）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '乙', '申', '正官格',
    { strongWeak: '身弱', totalStrengthScore: 3 },
    ['子', '申', '丑', '午'],
    ['戊', '庚', '乙', '壬'],
    { shunNi: '顺用', xianShenTypical: '印绶、财星', yongShenTypical: '正官' }
  );
  // 救主分落在透干之正印(壬)，藏支不透之偏印(癸)无救主分
  assert.equal(r.dimension_breakdown['正印'].rescue, 40);
  assert.equal(r.dimension_breakdown['偏印'].rescue, 0);
  // 弃官就印：旺官(正官)调候高分被剥夺
  assert.equal(r.dimension_breakdown['正官'].tiaohou, 0);
  // 用神取透干正印化杀，favorable 为印(水)、不含官杀(金)
  assert.equal(r.five_shens.yong, '正印');
  assert.ok(!r.core_shens.favorable.includes('正官'));
  assert.ok(!r.core_shens.favorable.includes('七杀'));
});

// 反例守护：印不透天干 → 无从取用救主，印星救主格不触发，仍走调候/常规取法。
// 郁达夫 丙申·庚子·甲午·甲子，甲木无根、官杀+食伤压身，但印星(水)不透干（无壬癸），
// 故不给救主分，用神仍是「冬木不受水」调候之火(伤官)。守护"无根+被困但印不透"边界。
test('getFavorableUnfavorable 印星救主反例：印不透则不触发救主（郁达夫型）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '子', '正印格',
    { strongWeak: '身弱', totalStrengthScore: 4 },
    ['申', '子', '午', '子'],
    ['丙', '庚', '甲', '甲']
  );
  // 印(水)不透 → 正/偏印均无救主分
  assert.equal(r.dimension_breakdown['正印'].rescue, 0);
  assert.equal(r.dimension_breakdown['偏印'].rescue, 0);
  // 旺官调候分未被剥夺（救主未触发）
  assert.equal(r.dimension_breakdown['七杀'].tiaohou, 35);
  // 用神仍为调候之火(伤官)
  assert.equal(r.five_shens.yong, '伤官');
});

// 羊刃驾杀格（左宗棠 壬申·辛亥·丙午·庚寅）：丙火亥月身弱七杀格，日主自坐午火羊刃，
// 金水汪洋攻身时须以日支羊刃（劫财）敌杀保命为用神；寅木偏印兼调候与生刃化杀，只作喜神。
// 守护调候神（甲木=偏印）不得凭 +50 调候分僭越真用神。
test('getFavorableUnfavorable 羊刃驾杀格：左宗棠型取午火劫财为用、偏印降为喜神', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '丙', '亥', '七杀格',
    { strongWeak: '身弱', totalStrengthScore: 3 },
    ['申', '亥', '午', '寅'],
    ['壬', '辛', '丙', '庚'],
    { name: '七杀格', shunNi: '逆用', yongShenTypical: '食神、印绶、劫财' }
  );

  assert.equal(r.dimension_breakdown['劫财'].rescue, 40);
  assert.equal(r.dimension_breakdown['偏印'].tiaohou, 0);
  assert.equal(r.dimension_breakdown['偏印'].rescue, 20);
  assert.equal(r.five_shens.yong, '劫财');
  assert.ok(r.core_shens.favorable.includes('劫财'));
  assert.ok(r.core_shens.favorable.includes('偏印'));
});

// ── 身中（中和带）偏弱/偏强分界取带中点 5.0（而非旧值 5.5）─────────────────────
// 中和带为 [4.3, 5.7]，中点 5.0。旧界 5.5 把带内 86% 区间都判偏弱，对坐禄/有印却
// 不弱的中和盘偏保守，会把本应「泄秀生财（身能任财）」的盘压成「需扶」，致财被判忌、
// 印比被判喜，与「食神生财、用火喜土忌水木」类盘相反。改取带中点后，恰在中点者归偏强侧。
// 案例：某职业妇女 乙酉·戊子·甲寅·癸酉（甲木子月坐寅禄+水印，综合 5.0）。
test('getFavorableUnfavorable 身中带中点(5.0)按偏强：财得扶抑+10、偏印-10（食神生财类）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '子', '正印格',
    { strongWeak: '身中', totalStrengthScore: 5 },
    ['酉', '子', '寅', '酉'],
    ['乙', '戊', '甲', '癸']
  );
  // 5.0 归偏强侧：克泄耗(财)得 +10、生扶(印)得 -10
  assert.equal(r.dimension_breakdown['正财'].fuyi, 10);
  assert.equal(r.dimension_breakdown['偏财'].fuyi, 10);
  assert.equal(r.dimension_breakdown['偏印'].fuyi, -10);
  assert.equal(r.dimension_breakdown['劫财'].fuyi, -10);
});

// 边界守护：恰低于中点（4.9）仍按偏弱（财 -10、印 +10），确保新界落在 5.0 而非更低。
test('getFavorableUnfavorable 身中略低于中点(4.9)仍按偏弱：财-10、偏印+10', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '子', '正印格',
    { strongWeak: '身中', totalStrengthScore: 4.9 },
    ['酉', '子', '寅', '酉'],
    ['乙', '戊', '甲', '癸']
  );
  assert.equal(r.dimension_breakdown['正财'].fuyi, -10);
  assert.equal(r.dimension_breakdown['偏财'].fuyi, -10);
  assert.equal(r.dimension_breakdown['偏印'].fuyi, 10);
});

// 集成回归（某职业妇女 C09）：用真实四柱与 calculateStrength 驱动，锁定格局变通误判修复。
// 教材（陆致极·进阶 p.54-55 引谢武藤）判格局变通成食神生财，用火喜土、忌水木。
// 修复后：①用神仍取调候之火(伤官)；②财(土)脱离忌神（不再 -10）；③印比落忌神侧
// （偏印·水、劫财·木），与「忌水木」方向一致。
test('getFavorableUnfavorable C09 某职业妇女：财脱忌、印比入忌、用神取火', () => {
  const strength = BaziRuleEngine.calculateStrength(
    '甲',
    ['乙', '戊', '甲', '癸'],
    ['酉', '子', '寅', '酉']
  );
  assert.equal(strength.strongWeak, '身中');
  // 甲坐寅为临官(禄)旺地，得地计入禄刃相位加成（5 -> 5.37），仍属身中。
  assert.equal(Number(strength.totalStrengthScore.toFixed(2)), 5.37);
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '甲', '子', '正印格', strength,
    ['酉', '子', '寅', '酉'],
    ['乙', '戊', '甲', '癸'],
    { name: '正印格', shunNi: '顺用', yongShenTypical: '正印', xianShenTypical: '官星、比劫' }
  );
  // 用神取调候之火（伤官），与教材「用火」一致
  assert.equal(r.five_shens.yong, '伤官');
  // 财不再落忌神（修复前为 unfavorable=[偏财,正财]）
  assert.ok(!r.core_shens.unfavorable.includes('正财'));
  assert.ok(!r.core_shens.unfavorable.includes('偏财'));
  assert.ok(r.dimension_breakdown['正财'].fuyi >= 0);
  // 印比落忌神侧（忌水木）：偏印(水)、劫财(木）
  assert.ok(r.core_shens.unfavorable.includes('偏印'));
  assert.ok(r.core_shens.unfavorable.includes('劫财'));
});

test('金白水清 keeps 金水 favorable and rejects 火土破象（冰心）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '辛',
    gans: ['庚', '乙', '辛', '壬'],
    zhis: ['子', '酉', '酉', '辰'],
    monthZhi: '酉',
  });

  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);
  assert.equal(imageAnalysis.primary_candidate.subtype, '金白水清');

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '辛', '酉', '建禄格',
    { strongWeak: '身强', totalStrengthScore: 8.1 },
    ['子', '酉', '酉', '辰'],
    ['庚', '乙', '辛', '壬'],
    null,
    imageAnalysis,
  );

  assert.equal(r.five_shens.yong, '伤官');
  assert.ok(r.wuxing.favorable.includes('金'));
  assert.ok(r.wuxing.favorable.includes('水'));
  assert.ok(r.wuxing.unfavorable.includes('火'));
  assert.ok(r.wuxing.unfavorable.includes('土'));
});

test('火土成势 follows 火土 force and does not fall back to weak-day 印（朱元璋）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '丁',
    gans: ['戊', '戊', '丁', '丁'],
    zhis: ['辰', '戌', '丑', '未'],
    monthZhi: '戌',
  });

  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);
  assert.equal(imageAnalysis.primary_candidate.subtype, '火土成势');

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '丁', '戌', '伤官格',
    { strongWeak: '身弱', totalStrengthScore: 2.9 },
    ['辰', '戌', '丑', '未'],
    ['戊', '戊', '丁', '丁'],
    null,
    imageAnalysis,
  );

  assert.ok(r.wuxing.favorable.includes('火'));
  assert.ok(r.wuxing.favorable.includes('土'));
  assert.notEqual(r.five_shens.yong, '正印');
});

test('强众敌寡 keeps weak enemy 癸水 as top yong（张謇）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '己',
    gans: ['癸', '戊', '己', '丁'],
    zhis: ['丑', '午', '巳', '卯'],
    monthZhi: '午',
  });

  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);
  assert.equal(imageAnalysis.primary_candidate.subtype, '强众敌寡');

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '己', '午', '建禄格',
    { strongWeak: '身强', totalStrengthScore: 7.4 },
    ['丑', '午', '巳', '卯'],
    ['癸', '戊', '己', '丁'],
    null,
    imageAnalysis,
  );

  assert.equal(r.five_shens.yong, '偏财');
  assert.ok(r.wuxing.favorable.includes('水'));
});

test('display-only image scope does not enter L0 special-pattern override', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '丙', '午', '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 7.1 },
    ['巳', '午', '午', '辰'],
    ['癸', '戊', '丙', '壬'],
    null,
    {
      primary_candidate: {
        category: 'TWO_QI_IMAGE',
        subtype: '火土成势',
        target_elements: ['火', '土'],
        yongshen_strategy: 'TWO_QI_FOLLOW_FORCE',
        override_normal_pattern: true,
        override_scope: 'display_only',
        override_veto_reason: '壬水透干有根，承担制刃与调候，不按火土顺势覆盖。',
      },
    },
  );

  assert.equal(r.special_pattern, null);
  assert.doesNotMatch(r.decision_chain.map(item => item.layer).join('\n'), /L0 特殊气势/);
  assert.ok(!r.core_shens.unfavorable.includes('七杀'));
});

test('润下专旺 prefers 伤官泄秀 as top yong while keeping water favorable（王阳明）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '癸',
    gans: ['壬', '辛', '癸', '癸'],
    zhis: ['辰', '亥', '亥', '亥'],
    monthZhi: '亥',
  });

  assert.equal(imageAnalysis.primary_candidate.category, 'SINGLE_IMAGE');
  assert.equal(imageAnalysis.primary_candidate.subtype, '润下格');
  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '癸', '亥', '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 9.6 },
    ['辰', '亥', '亥', '亥'],
    ['壬', '辛', '癸', '癸'],
    null,
    imageAnalysis,
  );

  assert.equal(r.five_shens.yong, '伤官');
  assert.ok(r.wuxing.favorable.includes('水'));
  assert.ok(r.wuxing.favorable.includes('木'));
  assert.ok(!r.wuxing.favorable.includes('火'));
});

test('从革专旺 lets rooted output generate exposed wealth without changing top yong（秋金型）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '庚',
    gans: ['庚', '乙', '庚', '庚'],
    zhis: ['申', '酉', '戌', '辰'],
    monthZhi: '酉',
  });

  assert.equal(imageAnalysis.primary_candidate.category, 'SINGLE_IMAGE');
  assert.equal(imageAnalysis.primary_candidate.subtype, '从革格');
  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '庚', '酉', '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 8.2 },
    ['申', '酉', '戌', '辰'],
    ['庚', '乙', '庚', '庚'],
    null,
    imageAnalysis,
  );

  assert.equal(r.five_shens.yong, '食神');
  assert.ok(r.wuxing.favorable.includes('木'));
  assert.ok(!r.wuxing.unfavorable.includes('木'));
});

test('炎上同党支势 follows wood-fire force and rejects unrooted metal wealth', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '丙',
    gans: ['甲', '庚', '丙', '甲'],
    zhis: ['午', '午', '午', '午'],
    monthZhi: '午',
  });

  assert.equal(imageAnalysis.primary_candidate.category, 'SINGLE_IMAGE');
  assert.equal(imageAnalysis.primary_candidate.subtype, '炎上格');
  assert.equal(imageAnalysis.primary_candidate.override_normal_pattern, true);
  assert.ok(imageAnalysis.primary_candidate.reason_codes.includes('SINGLE_IMAGE_ALL_BRANCHES_SUPPORT_FORCE'));

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '丙', '午', '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 8.8 },
    ['午', '午', '午', '午'],
    ['甲', '庚', '丙', '甲'],
    null,
    imageAnalysis,
  );

  assert.ok(['正印', '偏印'].includes(r.five_shens.yong));
  assert.ok(r.wuxing.favorable.includes('木'));
  assert.ok(r.wuxing.favorable.includes('火'));
  assert.ok(r.wuxing.unfavorable.includes('金'));
  assert.ok(r.wuxing.unfavorable.includes('水'));
  assert.ok(!r.wuxing.favorable.includes('金'));
});

test('formed pattern method tags are exposed in the decision chain', () => {
  const result = BaziRuleEngine.getFavorableUnfavorable(
    '丙',
    '午',
    '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 6.4 },
    ['酉', '午', '申', '辰'],
    ['辛', '甲', '丙', '壬'],
    { name: '羊刃格', shunNi: '逆用', xianShenTypical: '七杀、正官、食伤' },
    null,
    {
      chengGe: '阳刃露杀财印助杀格',
      chengGeResult: '成格',
      yongShenTenGod: '杀',
      yongShen: '壬',
      xianShen: '印、财',
      patternEffects: {
        protectedShens: ['杀', '印', '枭', '财', '才'],
        assistantShens: ['印', '枭', '财', '才'],
        methodTags: ['阳刃露煞', '透煞根浅', '财印助之']
      }
    }
  );

  const chengGeStep = result.decision_chain.find(item => item.layer === 'L2 成格取用');
  assert.ok(chengGeStep.reason.includes('methodTags：阳刃露煞、透煞根浅、财印助之'));
});

test('完整曲直木局 keeps seal and rejects wealth despite a hidden output-to-wealth trace（李鸿章型）', () => {
  const imageAnalysis = assessBaziImage({
    dayGan: '乙',
    gans: ['癸', '甲', '乙', '己'],
    zhis: ['未', '寅', '亥', '卯'],
    monthZhi: '寅',
  });

  assert.ok(imageAnalysis.primary_candidate.reason_codes.includes('SINGLE_IMAGE_COMPLETE_WOOD_FRAME'));

  const r = BaziRuleEngine.getFavorableUnfavorable(
    '乙', '寅', '羊刃格',
    { strongWeak: '身强', totalStrengthScore: 9.1 },
    ['未', '寅', '亥', '卯'],
    ['癸', '甲', '乙', '己'],
    null,
    imageAnalysis,
  );

  assert.ok(r.wuxing.favorable.includes('水'));
  assert.ok(r.wuxing.unfavorable.includes('土'));
  assert.ok(!r.wuxing.favorable.includes('土'));
  assert.ok(!r.wuxing.unfavorable.includes('水'));
});

test('身弱寒湿己土 keeps 调候首取火印 above auxiliary 戊土（戚继光）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '己', '亥', '正财格',
    { strongWeak: '身弱', totalStrengthScore: 1.5 },
    ['子', '亥', '巳', '亥'],
    ['戊', '癸', '己', '乙']
  );

  assert.equal(r.five_shens.yong, '正印');
  assert.ok(r.five_shens.xi.includes('劫财') || r.core_shens.favorable.includes('劫财'));
});

test('正官格用印 keeps 正官木 favorable even when 七杀 is not useful（刘墉）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '己', '寅', '正官格',
    { strongWeak: '身弱', totalStrengthScore: 2.8 },
    ['子', '寅', '丑', '子'],
    ['甲', '丙', '己', '甲'],
    { name: '正官格', shunNi: '顺用', yongShenTypical: '正官', xianShenTypical: '印绶、财星' }
  );

  assert.equal(r.five_shens.yong, '正印');
  assert.ok(r.five_shens.xi.includes('正官') || r.wuxing.favorable.includes('木'));
  assert.ok(!r.wuxing.unfavorable.includes('木'));
});

test('winter water with 子亥丑 root network is classified as 身强 for relation analysis（苏轼）', () => {
  const strength = BaziRuleEngine.calculateStrength(
    '癸',
    ['丙', '辛', '癸', '乙'],
    ['子', '丑', '亥', '卯']
  );

  assert.equal(strength.strongWeak, '身强');
});

// P0-a：getChengGe 已识别成格取用时，五神评分必须吃到成格用神。
// 袁树珊 辛巳·丁酉·乙巳·戊寅：教材取「七杀格食神制杀」；当前链路已得 chengge=杀邀食制格，
// 但未接入评分时会被调候癸水(偏印)压过，误把偏印作为用神。
test('getFavorableUnfavorable applies formed chengge yongshen as scoring prior（袁树珊型）', () => {
  const r = BaziRuleEngine.getFavorableUnfavorable(
    '乙',
    '酉',
    '七杀格',
    { strongWeak: '身弱', totalStrengthScore: 2.1 },
    ['巳', '酉', '巳', '寅'],
    ['辛', '丁', '乙', '戊'],
    { name: '七杀格', shunNi: '逆用', yongShenTypical: '食神、印绶、劫财' },
    null,
    {
      yongShen: '丁',
      yongShenTenGod: '食',
      chengGe: '杀邀食制格',
      chengGeResult: '成格',
      chengGeReason: '七杀有力，食神透出制杀成格。',
      xianShen: '印',
      basis: '月令本气',
    }
  );

  assert.equal(r.dimension_breakdown['食神'].chengge, 70);
  assert.equal(r.five_shens.yong, '食神');
  assert.ok(r.core_shens.favorable.includes('正印'));
  assert.ok(r.decision_chain.some(item => item.layer === 'L2 成格取用'));
});
