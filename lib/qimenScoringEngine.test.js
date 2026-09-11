const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateQimenScore,
  evaluateNamedFormation,
  evaluateMasterClient,
  moveScoreTowardNeutral
} = require('./qimenScoringEngine');

const baseIntent = { category: 'career_business', subcategory: 'job_search' };

function palace(overrides = {}) {
  return {
    index: 8,
    name: '乾6宫',
    element: '金',
    door: '开门',
    star: '天心',
    god: '值符',
    sky: '壬',
    earth: '戊',
    isKong: false,
    hasMa: false,
    isZhiShi: false,
    isDayStem: false,
    isHourStem: false,
    ...overrides
  };
}

test('moveScoreTowardNeutral pulls both good and bad scores toward the 60-point center line', () => {
  assert.equal(moveScoreTowardNeutral(90, 0.5), 75);
  assert.equal(moveScoreTowardNeutral(20, 0.5), 40);
  assert.equal(moveScoreTowardNeutral(60, 0.5), 60);
});

test('calculateQimenScore keeps a neutral chart at 60 and returns auditable v4 structure', () => {
  const result = calculateQimenScore({
    intent: baseIntent,
    palaces: [
      palace({ door: '景门', star: '天英', god: '九地', sky: '丁', earth: '己' }),
      palace({ index: 0, name: '巽4宫', element: '木', door: '杜门', star: '天英', god: '九地', sky: '壬', earth: '己' })
    ],
    yongshenRule: {
      outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: [] }
    }
  });

  assert.equal(result.version, 'qimen-score-v4.2');
  assert.equal(result.ruleset_version, 'dunjia-yanyi-siku-v1');
  assert.equal(result.score_kind, 'engineering_index');
  assert.equal(result.base_score, 60);
  assert.equal(result.summary.score, result.final_score);
  assert.ok(Array.isArray(result.adjustments));
  assert.equal(result.deltas.macro, 0);
  assert.ok('master_client' in result.deltas);
  assert.ok('role' in result);
});

test('evaluateNamedFormation reduces stacked warning formations into grouped v4.1 delta', () => {
  const result = evaluateNamedFormation(
    [
      palace({ sky: '辛', earth: '乙' }), // 白虎猖狂
      palace({ index: 0, name: '巽4宫', sky: '丁', earth: '癸' }), // 朱雀投江
      palace({ index: 3, name: '震3宫', sky: '庚', earth: '丁' }) // 奇格
    ],
    { category: 'career_business' },
    'client'
  );

  assert.ok(result.hits.some((h) => h.signal === '白虎猖狂'));
  assert.ok(result.hits.some((h) => h.signal === '朱雀投江'));
  assert.ok(result.hits.some((h) => h.signal === '奇格'));
  assert.equal(result.namedFormationDelta, -12);
});

test('job_search waiting questions do not treat yin hour as active-client penalty by default', () => {
  const result = evaluateMasterClient(
    [palace({ isHourStem: true, earth: '庚' })],
    { category: 'career_business', subcategory: 'job_search' }
  );

  assert.equal(result.role, 'observer');
  assert.equal(result.masterClientDelta, 0);
});

test('job_search success timing and value-decision movement offset empty-process drag without repeated context penalties', () => {
  const result = calculateQimenScore({
    intent: { category: 'career_business', subcategory: 'job_search', hourStem: '庚' },
    palaces: [
      palace({ index: 2, name: '坤2宫', element: '土', isDayStem: true, god: '值符', hasMa: true, door: '景门', star: '天柱', sky: '戊', earth: '己' }),
      palace({ index: 8, name: '乾6宫', element: '金', isHourStem: true, isZhiShi: true, isKong: true, door: '惊门', star: '天蓬', god: '太阴', sky: '辛', earth: '乙' }),
      palace({ index: 0, name: '巽4宫', element: '木', door: '伤门', star: '天英', god: '九地', sky: '庚', earth: '丁' }),
      palace({ index: 1, name: '离9宫', element: '火', door: '杜门', star: '天芮', god: '六合', sky: '丁', earth: '癸' }),
      palace({ index: 3, name: '震3宫', element: '木', door: '开门', star: '天心', god: '白虎', sky: '乙', earth: '壬' })
    ],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '开门', '时干', '值使门', '值符'] } },
    polarityOverrides: [
      { signal: '庚格', domain_polarity: 'warning', score_effect_hint: '-4 to -10', palace: '巽4宫', door: '伤门' },
      { signal: '空亡', domain_polarity: 'warning', score_effect_hint: '-5 to -12 when the desired core yongshen falls empty', palace: '乾6宫', door: '惊门' }
    ],
    timingAnalysis: {
      p1_candidates: [
        { event_mode: 'success', timing_type: 'horse_star_activated', target_symbol: '值符' },
        { event_mode: 'success', timing_type: 'kongwang_fill_or_clash', target_symbol: '值使门' }
      ]
    }
  });

  assert.equal(result.role, 'observer');
  assert.equal(result.deltas.master_client, 0);
  assert.equal(result.deltas.named_formation, -12);
  assert.equal(result.deltas.context, 0);
  assert.equal(result.deltas.timing_recovery, 12);
  assert.ok(result.final_score >= 55);
  assert.ok(result.adjustments.some((item) => item.layer === 'timing_recovery' && item.signal === '值符马星动'));
  assert.ok(result.adjustments.some((item) => item.layer === 'timing_recovery' && item.signal === '空亡冲填'));
});

test('calculateQimenScore clamps extreme charts into the 0-100 scope', () => {
  const strong = calculateQimenScore({
    intent: baseIntent,
    palaces: [
      palace({ isDayStem: true, isZhiShi: true }),
      palace({ index: 6, name: '艮8宫', element: '土', isHourStem: true, door: '生门', star: '天任', god: '六合', sky: '乙', earth: '丙' })
    ],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '开门'] } },
    polarityOverrides: [
      { signal: '开门', domain_polarity: 'mixed_or_positive', score_effect_hint: '+8', palace: '乾6宫' }
    ]
  });

  const weak = calculateQimenScore({
    intent: { category: 'relationship', subcategory: 'online_romance' },
    palaces: [
      palace({ isDayStem: true, door: '死门', star: '天芮', god: '玄武', sky: '庚', earth: '辛' }),
      palace({ index: 1, name: '离9宫', element: '火', isHourStem: true, door: '伤门', star: '天蓬', god: '白虎', sky: '辛', earth: '庚' })
    ],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干'] } }
  });

  assert.ok(strong.final_score <= 100);
  assert.ok(strong.final_score >= 0);
  assert.ok(weak.final_score <= 100);
  assert.ok(weak.final_score >= 0);
});

test('core desired yongshen in void discounts a favorable score toward 60 instead of hard subtracting', () => {
  const result = calculateQimenScore({
    intent: baseIntent,
    palaces: [
      palace({ isDayStem: true, isZhiShi: true }),
      palace({ index: 6, name: '艮8宫', element: '土', isHourStem: true, door: '生门', star: '天任', god: '六合', sky: '乙', earth: '丙', isKong: true })
    ],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '开门'] } }
  });

  assert.ok(result.raw_score_before_modifiers > result.final_score);
  assert.ok(result.final_score > 60);
  assert.ok(result.state_tags.includes('needs_fill_void'));
  assert.equal(result.deltas.void_modifier_applied, true);
});

test('三奇得使只按《遁甲演义》六组奇仪配对判定，不按值使宫字面误判', () => {
  const withSanQi = evaluateNamedFormation(
    [palace({ index: 3, name: '震3宫', isZhiShi: false, sky: '乙', earth: '己' })],
    { category: 'career_business' }
  );
  const withoutSanQi = evaluateNamedFormation(
    [palace({ index: 3, name: '震3宫', isZhiShi: true, sky: '乙', earth: '壬' })],
    { category: 'career_business' }
  );
  assert.ok(withSanQi.hits.some((h) => h.signal === '三奇得使'));
  assert.ok(!withoutSanQi.hits.some((h) => h.signal === '三奇得使'));
  assert.ok(withSanQi.namedFormationDelta > withoutSanQi.namedFormationDelta);
});

test('天遁 fires only when sky=丙 earth=丁 door=生门 are all in the same palace', () => {
  const hit = evaluateNamedFormation(
    [palace({ sky: '丙', earth: '丁', door: '生门' })],
    { category: 'career_business' }
  );
  const miss = evaluateNamedFormation(
    [palace({ sky: '丙', earth: '丁', door: '开门' })],
    { category: 'career_business' }
  );
  assert.ok(hit.hits.some((h) => h.signal === '天遁'));
  assert.ok(!miss.hits.some((h) => h.signal === '天遁'));
});

test('五不遇时须同时满足时干克日干与阴阳同性', () => {
  // 庚(金) 克 甲(木) → 五不遇时
  const fired = evaluateNamedFormation(
    [palace({ isDayStem: true }), palace({ index: 0, name: '巽4宫', element: '木', isHourStem: true })],
    { category: 'career_business', dayStem: '甲', hourStem: '庚' }
  );
  // 壬(水) 生 甲(木)，非克 → 不触发
  const notFired = evaluateNamedFormation(
    [palace({ isDayStem: true }), palace({ index: 0, name: '巽4宫', element: '木', isHourStem: true })],
    { category: 'career_business', dayStem: '甲', hourStem: '壬' }
  );
  assert.ok(fired.hits.some((h) => h.signal === '五不遇时'));
  assert.ok(!notFired.hits.some((h) => h.signal === '五不遇时'));

  // 辛阴金虽克甲阳木，但阴阳异性，不是五不遇时。
  const oppositePolarity = evaluateNamedFormation(
    [palace({ isDayStem: true }), palace({ index: 0, name: '巽4宫', isHourStem: true })],
    { category: 'career_business', dayStem: '甲', hourStem: '辛' }
  );
  assert.ok(!oppositePolarity.hits.some((h) => h.signal === '五不遇时'));
});

test('六仪击刑由旬首值符落刑宫判定，不读取固定地盘六仪', () => {
  const hit = evaluateNamedFormation(
    [palace({ index: 3, name: '震3宫', isZhiFu: true, sky: '戊', earth: '乙' })],
    { category: 'career_business', xunHead: '甲子' }
  );
  const falsePositive = evaluateNamedFormation(
    [palace({ index: 3, name: '震3宫', isZhiFu: false, sky: '乙', earth: '戊' })],
    { category: 'career_business', xunHead: '甲子' }
  );
  assert.ok(hit.hits.some((h) => h.signal === '六仪击刑'));
  assert.ok(!falsePositive.hits.some((h) => h.signal === '六仪击刑'));
});

test('玉女守门按值使加地盘丁判定', () => {
  const hit = evaluateNamedFormation(
    [palace({ isZhiShi: true, sky: '乙', earth: '丁' })],
    { category: 'relationship' }
  );
  const falsePositive = evaluateNamedFormation(
    [palace({ isZhiShi: true, sky: '丁', earth: '乙' })],
    { category: 'relationship' }
  );
  assert.ok(hit.hits.some((h) => h.signal === '玉女守门'));
  assert.ok(!falsePositive.hits.some((h) => h.signal === '玉女守门'));
});

test('伏干格 fires when 庚 on sky board is in the same palace as dayStem on earth board', () => {
  // 庚 on sky, 壬 on earth, intent.dayStem = 壬
  const fired = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '壬' })],
    { category: 'finance_wealth', dayStem: '壬' }
  );
  const notFired = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '壬' })],
    { category: 'finance_wealth', dayStem: '甲' }
  );
  assert.ok(fired.hits.some((h) => h.signal === '伏干格'));
  assert.ok(!notFired.hits.some((h) => h.signal === '伏干格'));
});

test('飞干格 fires when dayStem on sky board is above 庚 on earth board', () => {
  // sky=丙(dayStem), earth=庚
  const fired = evaluateNamedFormation(
    [palace({ sky: '丙', earth: '庚' })],
    { category: 'lawsuit_legal', dayStem: '丙' }
  );
  assert.ok(fired.hits.some((h) => h.signal === '飞干格'));
});

test('九遁格 domain deltas: 天遁 in relationship gets +9 (PRD v3)', () => {
  const career = evaluateNamedFormation(
    [palace({ sky: '丙', earth: '丁', door: '生门' })],
    { category: 'career_business' }
  );
  const relationship = evaluateNamedFormation(
    [palace({ sky: '丙', earth: '丁', door: '生门' })],
    { category: 'relationship' }
  );
  const careerHit = career.hits.find((h) => h.signal === '天遁');
  const relHit = relationship.hits.find((h) => h.signal === '天遁');
  assert.equal(careerHit.effect, '+10');
  assert.equal(relHit.effect, '+9');
});

test('horse star creates timing tags without direct score delta', () => {
  const noHorse = calculateQimenScore({
    intent: baseIntent,
    palaces: [palace({ isDayStem: true }), palace({ index: 0, name: '巽4宫', element: '木', isHourStem: true })],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干'] } }
  });
  const withHorse = calculateQimenScore({
    intent: baseIntent,
    palaces: [palace({ isDayStem: true }), palace({ index: 0, name: '巽4宫', element: '木', isHourStem: true, hasMa: true })],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干'] } }
  });

  assert.equal(withHorse.final_score, noHorse.final_score);
  assert.ok(withHorse.timing.tags.includes('moving'));
});

test('奇格 does not double-count with 太白入荧 when sky=庚 earth=丙', () => {
  // sky=庚 earth=丙 should fire 太白入荧 only, NOT 奇格
  const result = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '丙' })],
    { category: 'career_business' }
  );
  assert.ok(result.hits.some((h) => h.signal === '太白入荧'));
  assert.ok(!result.hits.some((h) => h.signal === '奇格'));
  // sky=庚 earth=乙 or earth=丁 should fire 奇格
  const qiGe = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '乙' })],
    { category: 'career_business' }
  );
  assert.ok(qiGe.hits.some((h) => h.signal === '奇格'));
});

test('evaluateMasterClient returns client role for 阳时 and scores +4 when questioner is client', () => {
  // 甲/乙/丙/丁/戊 are yang stems → favors client
  const yangHour = evaluateMasterClient(
    [palace({ isHourStem: true, earth: '甲' })],
    { category: 'career_business' }
  );
  assert.equal(yangHour.role, 'client');
  assert.equal(yangHour.masterClientDelta, 4);
  assert.ok(yangHour.hits[0].effect === '+4');
});

test('evaluateMasterClient scores -4 for 阳时 when role override is master', () => {
  const result = evaluateMasterClient(
    [palace({ isHourStem: true, earth: '丙' })],
    { category: 'career_business', role: 'master' }
  );
  assert.equal(result.role, 'master');
  assert.equal(result.masterClientDelta, -4);
});

test('evaluateMasterClient returns 0 delta and defaults to client when no hourStem is available', () => {
  const result = evaluateMasterClient([], { category: 'career_business' });
  assert.equal(result.masterClientDelta, 0);
  assert.equal(result.role, 'client');
  assert.equal(result.hits.length, 0);
});

test('evaluateMasterClient: 阴时（庚辛壬癸）favors master, so client gets -4', () => {
  const yinHour = evaluateMasterClient(
    [palace({ isHourStem: true, earth: '庚' })],
    { category: 'finance_wealth' }
  );
  // 庚 is yin (not in YANG_STEMS) → favors master; questioner defaults to client → mismatch
  assert.equal(yinHour.masterClientDelta, -4);
  assert.equal(yinHour.role, 'client');
});

test('role from evaluateMasterClient is passed to evaluateNamedFormation and changes 太白入荧 score', () => {
  // 太白入荧 (sky=庚, earth=丙): roleDeltas = { client: +8, master: -10 }
  const asClient = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '丙' })],
    { category: 'career_business' },
    'client'
  );
  const asMaster = evaluateNamedFormation(
    [palace({ sky: '庚', earth: '丙' })],
    { category: 'career_business' },
    'master'
  );
  const clientHit = asClient.hits.find((h) => h.signal === '太白入荧');
  const masterHit = asMaster.hits.find((h) => h.signal === '太白入荧');
  assert.equal(clientHit.effect, '+8');
  assert.equal(masterHit.effect, '-10');
  assert.ok(asClient.namedFormationDelta > asMaster.namedFormationDelta);
});

test('calculateQimenScore integrates master_client delta into final score and deltas output', () => {
  // 甲时 (yang) + career_business (client) → master_client = +4
  const result = calculateQimenScore({
    intent: { category: 'career_business', hourStem: '甲' },
    palaces: [
      palace({ isDayStem: true }),
      palace({ index: 0, name: '巽4宫', element: '木', isHourStem: true, earth: '甲' })
    ],
    yongshenRule: { outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干'] } }
  });

  assert.equal(result.deltas.master_client, 4);
  assert.equal(result.role, 'client');
  assert.ok(result.adjustments.some((a) => a.layer === 'master_client'));
});
