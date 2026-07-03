const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  IMAGE_CATEGORY,
  CONFIG_VERSION,
  DOMINANT_MIN_RATIO,
  OVERRIDE_MIN_SCORE,
  PURE_MIN_SCORE,
  assessBaziImage,
  finalizeCandidate,
  getDmSupport,
  getMatchMeta,
  getWuxingScores,
  resolvePatternOverride,
  serializeCandidate,
} = require('./baziImageAssessor');

const WIRE_STATUSES = new Set(['PURE', 'FORMED', 'SUSPECTED', 'NOT_FORMED']);

function getCandidates(result) {
  return [result.primary_candidate, ...result.alternatives];
}

function getDimension(candidate, key) {
  if (Array.isArray(candidate.dimensions)) {
    return candidate.dimensions.find((dimension) => dimension.key === key)?.score;
  }

  return candidate.dimensions[key];
}

function hasPenalty(candidate, key) {
  return candidate.penalties.some((penalty) =>
    typeof penalty === 'string' ? penalty === key : penalty.key === key,
  );
}

function assertWireCandidate(candidate) {
  assert.ok(candidate);
  assert.ok(WIRE_STATUSES.has(candidate.status));
  assert.equal(Object.hasOwn(candidate, 'match_level'), false);
  assert.equal(typeof candidate.match_score, 'number');
  assert.equal(typeof candidate.match_label, 'string');
  assert.equal(typeof candidate.override_normal_pattern, 'boolean');
  assert.ok(Array.isArray(candidate.reason_codes));
  assert.ok(Array.isArray(candidate.dimensions));
  assert.ok(Array.isArray(candidate.penalties));

  for (const dimension of candidate.dimensions) {
    assert.deepEqual(Object.keys(dimension).sort(), ['key', 'max', 'score', 'text']);
    assert.equal(typeof dimension.key, 'string');
    assert.ok(typeof dimension.max === 'number' || dimension.max === null);
    assert.ok(['number', 'boolean'].includes(typeof dimension.score));
    assert.equal(typeof dimension.text, 'string');
  }

  for (const penalty of candidate.penalties) {
    assert.deepEqual(Object.keys(penalty).sort(), ['key', 'score', 'text']);
    assert.equal(typeof penalty.key, 'string');
    assert.equal(typeof penalty.score, 'number');
    assert.equal(typeof penalty.text, 'string');
  }
}

function loadFixture(fileName) {
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'bazi-image-cases', fileName);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function chartFromFixture(fixture) {
  const pillars = fixture.pillars.map((pillar) => Array.from(pillar));
  return {
    dayGan: pillars[2][0],
    gans: pillars.map(([gan]) => gan),
    zhis: pillars.map(([, zhi]) => zhi),
    monthZhi: pillars[1][1],
  };
}

test('serializes image analysis into the frozen wire contract', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '己'],
    zhis: ['戌', '戌', '戌', '戌'],
    monthZhi: '戌',
  });

  assertWireCandidate(result.primary_candidate);
  assertWireCandidate(result.override_candidate);
  result.alternatives.forEach(assertWireCandidate);
  assert.equal(result.status, result.primary_candidate.status);
  assert.deepEqual(result.dimensions, result.primary_candidate.dimensions);
  assert.deepEqual(result.penalties, result.primary_candidate.penalties);
});

test('serializes unknown dimensions and penalties with explainable fallbacks', () => {
  const candidate = serializeCandidate(finalizeCandidate({
    category: IMAGE_CATEGORY.FOLLOW_IMAGE,
    subtype: '测试格',
    match_score: 72,
    dimensions: { mystery_signal: 3 },
    penalties: ['UNKNOWN_PENALTY'],
  }));

  assert.deepEqual(candidate.dimensions, [
    { key: 'mystery_signal', score: 3, max: null, text: '未定义指标：mystery_signal' },
  ]);
  assert.deepEqual(candidate.penalties, [
    { key: 'UNKNOWN_PENALTY', score: 0, text: '未定义扣分项：UNKNOWN_PENALTY' },
  ]);
});

test('runs reviewed fixture cases against the wire contract and numeric score bands', () => {
  const fixture = loadFixture('follow-wealth-formed.json');

  assert.deepEqual(
    Object.keys(fixture).sort(),
    [
      'expected_category',
      'expected_override',
      'expected_score_band',
      'expected_subtype',
      'notes',
      'pillars',
    ],
  );
  assert.equal(fixture.pillars.length, 4);
  assert.ok(fixture.pillars.every((pillar) => Array.from(pillar).length === 2));
  assert.match(fixture.expected_score_band, /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/);

  const [minimumScore, maximumScore] = fixture.expected_score_band
    .split('-')
    .map(Number);
  const result = assessBaziImage(chartFromFixture(fixture));

  assertWireCandidate(result.primary_candidate);
  assert.equal(result.primary_candidate.category, fixture.expected_category);
  assert.equal(result.primary_candidate.subtype, fixture.expected_subtype);
  assert.ok(result.primary_candidate.match_score >= minimumScore);
  assert.ok(result.primary_candidate.match_score <= maximumScore);
  assert.equal(result.primary_candidate.override_normal_pattern, fixture.expected_override);
});

test('assesses rootless Jia day with dominant wealth qi as follow-wealth image', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '己'],
    zhis: ['戌', '戌', '戌', '戌'],
    monthZhi: '戌',
  });

  assert.equal(result.config_version, CONFIG_VERSION);
  assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.FOLLOW_IMAGE);
  assert.equal(result.primary_candidate.subtype, '从财格');
  assert.ok(result.primary_candidate.match_score >= OVERRIDE_MIN_SCORE);
  assert.equal(result.primary_candidate.override_normal_pattern, true);
  assert.ok(result.primary_candidate.reason_codes.includes('DM_ROOTLESS'));
  assert.ok(result.primary_candidate.reason_codes.includes('WEALTH_QI_DOMINANT'));

  assert.deepEqual(
    resolvePatternOverride({ basePattern: '正财格', imageAnalysis: result }),
    {
      basis: 'SPECIAL_IMAGE_OVERRIDE',
      base_pattern: '正财格',
      final_pattern: '从财格',
      overridden: true,
      yongshen_strategy: 'FOLLOW_FORCE',
    },
  );
});

test('selects the highest eligible override candidate without changing the display primary candidate', () => {
  const result = assessBaziImage({
    dayGan: '戊',
    gans: ['癸', '乙', '戊', '癸'],
    zhis: ['卯', '卯', '子', '亥'],
    monthZhi: '卯',
  });

  assert.equal(result.primary_candidate.subtype, '从官杀格');
  assert.equal(result.primary_candidate.match_score, 83.73);
  assert.equal(result.primary_candidate.override_normal_pattern, false);
  assert.equal(result.override_candidate.subtype, '从财格');
  assert.equal(result.override_candidate.match_score, 82.08);
  assert.equal(result.override_candidate.override_normal_pattern, true);
  assert.deepEqual(
    resolvePatternOverride({ basePattern: '正官格', imageAnalysis: result }),
    {
      basis: 'SPECIAL_IMAGE_OVERRIDE',
      base_pattern: '正官格',
      final_pattern: '从财格',
      overridden: true,
      yongshen_strategy: 'FOLLOW_FORCE',
    },
  );
});

test('keeps normal pattern when follow-image candidate score is below override threshold', () => {
  const imageAnalysis = {
    primary_candidate: finalizeCandidate({
      category: IMAGE_CATEGORY.FOLLOW_IMAGE,
      subtype: '从财格',
      match_score: 72,
      yongshen_strategy: 'FOLLOW_FORCE',
    }),
  };

  assert.deepEqual(
    resolvePatternOverride({ basePattern: '正财格', imageAnalysis }),
    {
      basis: 'MONTH_PATTERN',
      base_pattern: '正财格',
      final_pattern: '正财格',
      overridden: false,
      yongshen_strategy: 'NORMAL',
    },
  );
});

test('keeps legacy month-pattern fallback when image analysis is absent', () => {
  assert.deepEqual(
    resolvePatternOverride({ basePattern: '正财格', imageAnalysis: null }),
    {
      basis: 'MONTH_PATTERN',
      base_pattern: '正财格',
      final_pattern: '正财格',
      overridden: false,
      yongshen_strategy: 'NORMAL',
    },
  );
});

test('keeps normal pattern when override flag is truthy but not boolean true', () => {
  for (const overrideFlag of ['false', 1]) {
    const imageAnalysis = {
      primary_candidate: {
        subtype: '从财格',
        override_normal_pattern: overrideFlag,
        yongshen_strategy: 'FOLLOW_FORCE',
      },
    };

    assert.deepEqual(
      resolvePatternOverride({ basePattern: '正财格', imageAnalysis }),
      {
        basis: 'MONTH_PATTERN',
        base_pattern: '正财格',
        final_pattern: '正财格',
        overridden: false,
        yongshen_strategy: 'NORMAL',
      },
    );
  }
});

test('visible peer or seal support prevents follow-wealth override', () => {
  const unsupportedResult = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '己'],
    zhis: ['戌', '戌', '戌', '戌'],
    monthZhi: '戌',
  });

  for (const visibleSupportGan of ['乙', '壬']) {
    const result = assessBaziImage({
      dayGan: '甲',
      gans: [visibleSupportGan, '戊', '甲', '己'],
      zhis: ['戌', '戌', '戌', '戌'],
      monthZhi: '戌',
    });
    const unsupportedFollow = getCandidates(unsupportedResult)
      .find((candidate) => candidate.subtype === '从财格');
    const follow = getCandidates(result)
      .find((candidate) => candidate.subtype === '从财格');

    assert.ok(follow.match_score < unsupportedFollow.match_score);
    assert.equal(follow.override_normal_pattern, false);
    assert.ok(follow.reason_codes.includes('DM_HAS_VISIBLE_SUPPORT'));
  }
});

// 《滴天髓·顺局》"从儿不管身强弱，只要吾儿又得儿"；任注"天干三透辛金而地支临绝，格取从儿"。
// 从儿格中天干透出的无根比劫属虚浮顺势，不构成有效明扶，不阻止成格——与从财/从杀的严格真从底线区分。
test('rootless peer transparency does not block follow-child override (从儿格例外)', () => {
  // 三毛盘 癸日 癸乙癸甲 / 未卯未寅：满盘食伤(木)，天干透年干癸(比劫)但地支无水根。
  const result = assessBaziImage({
    dayGan: '癸',
    gans: ['癸', '乙', '癸', '甲'],
    zhis: ['未', '卯', '未', '寅'],
    monthZhi: '卯',
  });
  const follow = getCandidates(result).find((c) => c.subtype === '从儿格');
  assert.ok(follow, '应识别从儿格候选');
  assert.equal(follow.override_normal_pattern, true);
  assert.ok(follow.match_score >= OVERRIDE_MIN_SCORE);
  assert.ok(!follow.reason_codes.includes('DM_HAS_VISIBLE_SUPPORT'));
  assert.equal(result.override_candidate?.subtype, '从儿格');
});

// 反向守护：从儿格中天干透出的"有根"比劫仍按破格论（仅无根虚浮才豁免）。
test('rooted peer support still blocks follow-child override', () => {
  // 癸日 癸乙癸甲 / 子卯未寅：年支子水给比劫坐根，明扶有效，不作真从。
  const result = assessBaziImage({
    dayGan: '癸',
    gans: ['癸', '乙', '癸', '甲'],
    zhis: ['子', '卯', '未', '寅'],
    monthZhi: '卯',
  });
  const follow = getCandidates(result).find((c) => c.subtype === '从儿格');
  if (follow) {
    assert.equal(follow.override_normal_pattern, false);
    assert.ok(follow.reason_codes.includes('DM_HAS_VISIBLE_SUPPORT'));
  }
});

test('follow-wealth candidate cannot override when wealth qi is not globally dominant', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['戊', '己', '甲', '庚'],
    zhis: ['酉', '戌', '酉', '酉'],
    monthZhi: '戌',
  });
  const wealthCandidate = getCandidates(result)
    .find((candidate) => candidate.subtype === '从财格');

  assert.ok(wealthCandidate.match_score >= OVERRIDE_MIN_SCORE);
  assert.ok(getDimension(wealthCandidate, 'target_qi_ratio') >= 0.35);
  assert.equal(getDimension(wealthCandidate, 'is_global_dominant'), false);
  assert.equal(wealthCandidate.allow_override, false);
  assert.equal(wealthCandidate.override_normal_pattern, false);
});

test('P3-c2 treats a rootless exposed seal as false aid when output feeds dominant wealth（黄堂型）', () => {
  const result = assessBaziImage({
    dayGan: '庚',
    gans: ['壬', '壬', '庚', '戊'],
    zhis: ['寅', '寅', '寅', '寅'],
    monthZhi: '寅',
  });
  const follow = getCandidates(result).find((candidate) => candidate.subtype === '从财格');

  assert.equal(result.primary_candidate.subtype, '从财格');
  assert.equal(follow.override_normal_pattern, true);
  assert.ok(follow.reason_codes.includes('DM_SUPPORT_INEFFECTIVE'));
  assert.ok(follow.reason_codes.includes('FOLLOW_CHAIN_DOMINANT'));
});

test('P3-c2 lets a formed output-to-wealth chain outrank descriptive two-qi（侍郎型）', () => {
  const result = assessBaziImage({
    dayGan: '壬',
    gans: ['丙', '庚', '壬', '乙'],
    zhis: ['寅', '寅', '午', '巳'],
    monthZhi: '寅',
  });

  assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.FOLLOW_IMAGE);
  assert.equal(result.primary_candidate.subtype, '从财格');
  assert.equal(result.override_candidate.subtype, '从财格');
});

test('P3-c2 names a dominant exposed killing force 从杀格 and allows it to override（知县型）', () => {
  const result = assessBaziImage({
    dayGan: '庚',
    gans: ['丁', '壬', '庚', '丙'],
    zhis: ['卯', '寅', '午', '戌'],
    monthZhi: '寅',
  });

  assert.equal(result.primary_candidate.subtype, '从杀格');
  assert.equal(result.primary_candidate.override_normal_pattern, true);
  assert.deepEqual(result.primary_candidate.target_elements, ['木', '火']);
});

test('P3-c2 does not treat remote cold wet earth roots as an effective day-master root（白手型）', () => {
  const result = assessBaziImage({
    dayGan: '戊',
    gans: ['壬', '辛', '戊', '癸'],
    zhis: ['辰', '亥', '子', '丑'],
    monthZhi: '亥',
  });

  assert.equal(result.primary_candidate.subtype, '从财格');
  assert.equal(result.primary_candidate.override_normal_pattern, true);
  assert.ok(result.primary_candidate.reason_codes.includes('DM_SUPPORT_INEFFECTIVE'));
});

test('P3-c2 relaxed follow scoring is feature-flagged and keeps the legacy shadow result', () => {
  const chart = {
    dayGan: '庚',
    gans: ['壬', '壬', '庚', '戊'],
    zhis: ['寅', '寅', '寅', '寅'],
    monthZhi: '寅',
  };
  const enabled = assessBaziImage(chart);
  const legacy = assessBaziImage(chart, { followWeakV2: false });

  assert.equal(enabled.override_candidate.subtype, '从财格');
  assert.equal(legacy.override_candidate, null);
  assert.equal(legacy.primary_candidate.category, IMAGE_CATEGORY.TWO_QI_IMAGE);
});

test('P3-c2 keeps a primary rooted seal as effective aid and refuses false follow', () => {
  const result = assessBaziImage({
    dayGan: '壬',
    gans: ['丙', '庚', '壬', '乙'],
    zhis: ['寅', '寅', '午', '酉'],
    monthZhi: '寅',
  });
  const follow = getCandidates(result).find((candidate) => candidate.subtype === '从财格');

  assert.equal(follow.override_normal_pattern, false);
  assert.ok(follow.reason_codes.includes('DM_HAS_VISIBLE_SUPPORT'));
});

test('P3-c2 keeps independent peer and seal primary roots out of follow-wealth（伍朝枢型）', () => {
  const result = assessBaziImage({
    dayGan: '壬',
    gans: ['丁', '丙', '壬', '己'],
    zhis: ['亥', '午', '寅', '酉'],
    monthZhi: '午',
  });
  const follow = getCandidates(result).find((candidate) => candidate.subtype === '从财格');

  assert.equal(follow.override_normal_pattern, false);
  assert.equal(getDimension(follow, 'anchored_support'), true);
});

test('finalizeCandidate respects explicit display-only override prohibition', () => {
  const candidate = finalizeCandidate({
    category: IMAGE_CATEGORY.TWO_QI_IMAGE,
    subtype: '木火通明',
    match_score: 90,
    allow_override: false,
  });

  assert.equal(candidate.match_score, 90);
  assert.equal(candidate.override_normal_pattern, false);
});

test('invalid chart input degrades to NONE candidate without overriding', () => {
  const validChart = {
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '己'],
    zhis: ['戌', '戌', '戌', '戌'],
    monthZhi: '戌',
  };
  const invalidCharts = [
    { ...validChart, dayGan: 'A' },
    { ...validChart, gans: ['丙', '戊', '甲', 'A'] },
    { ...validChart, zhis: ['戌'] },
    { ...validChart, zhis: ['戌', '戌', '戌', 'A'] },
    { ...validChart, dayGan: '乙' },
    { ...validChart, monthZhi: '辰' },
    { ...validChart, zhis: ['戌', '戌', '戌', 'toString'] },
    { ...validChart, monthZhi: 'A' },
  ];

  for (const chart of invalidCharts) {
    const result = assessBaziImage(chart);

    assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.NONE);
    assert.equal(result.primary_candidate.match_score, 0);
    assert.equal(result.primary_candidate.override_normal_pattern, false);
    assert.deepEqual(result.reason_codes, ['INVALID_CHART_INPUT']);
  }
});

test('missing chart input degrades to NONE candidate without throwing', () => {
  for (const input of [undefined, null]) {
    const result = assessBaziImage(input);

    assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.NONE);
    assert.equal(result.primary_candidate.override_normal_pattern, false);
    assert.deepEqual(result.reason_codes, ['INVALID_CHART_INPUT']);
  }
});

test('exposes score thresholds and match metadata', () => {
  assert.deepEqual(IMAGE_CATEGORY, {
    NONE: 'NONE',
    SINGLE_IMAGE: 'SINGLE_IMAGE',
    TWO_QI_IMAGE: 'TWO_QI_IMAGE',
    FOLLOW_IMAGE: 'FOLLOW_IMAGE',
    TRANSFORMATION_IMAGE: 'TRANSFORMATION_IMAGE',
  });
  assert.equal(CONFIG_VERSION, 'image-score-v2');
  assert.equal(OVERRIDE_MIN_SCORE, 80);
  assert.equal(PURE_MIN_SCORE, 95);
  assert.deepEqual(getMatchMeta(95), { label: '高纯度成象', level: 'PURE' });
  assert.deepEqual(getMatchMeta(80), { label: '成象', level: 'FORMED' });
  assert.deepEqual(getMatchMeta(60), { label: '疑似成象', level: 'SUSPECTED' });
  assert.deepEqual(getMatchMeta(59), { label: '未成象', level: 'NOT_FORMED' });
});

test('scores hidden stems by branch order and recognizes seal through sheng-by mapping', () => {
  assert.deepEqual(
    getWuxingScores({ gans: [], zhis: ['戌'] }),
    { 木: 0, 火: 0.3, 土: 0.8, 金: 0.5, 水: 0 },
  );

  assert.deepEqual(
    getDmSupport({
      dayGan: '甲',
      gans: ['壬', '庚', '甲', '乙'],
      zhis: ['亥', '申', '寅', '辰'],
    }),
    {
      dm_element: '木',
      seal_element: '水',
      exposed_same: 1,
      exposed_seal: 1,
      branch_same_roots: 3,
      branch_seal_roots: 3,
      is_rootless: false,
    },
  );
});

test('dominant wood image does not require the day master to be rootless', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['甲', '乙', '甲', '癸'],
    zhis: ['寅', '卯', '亥', '寅'],
    monthZhi: '卯',
  });

  assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.SINGLE_IMAGE);
  assert.equal(result.primary_candidate.subtype, '曲直格');
  assert.equal(result.primary_candidate.target_element, '木');
  assert.equal(result.primary_candidate.yongshen_strategy, 'FOLLOW_FORCE');
  assert.ok(result.primary_candidate.match_score >= OVERRIDE_MIN_SCORE);
  assert.equal(result.primary_candidate.override_normal_pattern, true);
});

test('完整木局 gives a borderline 曲直格 structural evidence to override（李鸿章型）', () => {
  const result = assessBaziImage({
    dayGan: '乙',
    gans: ['癸', '甲', '乙', '己'],
    zhis: ['未', '寅', '亥', '卯'],
    monthZhi: '寅',
  });
  const single = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.SINGLE_IMAGE);

  assert.equal(single.subtype, '曲直格');
  assert.equal(getDimension(single, 'complete_single_image_frame_points'), 15);
  assert.ok(single.reason_codes.includes('SINGLE_IMAGE_COMPLETE_WOOD_FRAME'));
  assert.ok(single.match_score >= 73);
  assert.equal(single.override_normal_pattern, true);
});

test('incomplete wood frame does not receive complete-frame points', () => {
  const result = assessBaziImage({
    dayGan: '乙',
    gans: ['癸', '甲', '乙', '己'],
    zhis: ['丑', '寅', '亥', '卯'],
    monthZhi: '寅',
  });
  const single = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.SINGLE_IMAGE);

  assert.equal(getDimension(single, 'complete_single_image_frame_points') ?? 0, 0);
  assert.equal(single.override_normal_pattern, false);
});

test('炎上失时 with unrooted wealth still promotes single fire image', () => {
  const result = assessBaziImage({
    dayGan: '丙',
    gans: ['丙', '庚', '丙', '庚'],
    zhis: ['午', '寅', '午', '寅'],
    monthZhi: '寅',
  });
  const single = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.SINGLE_IMAGE);

  assert.equal(single.subtype, '炎上格');
  assert.ok(single.reason_codes.includes('SINGLE_IMAGE_ALL_BRANCHES_SUPPORT_FORCE'));
  assert.equal(getDimension(single, 'same_camp_branch_frame_points'), 25);
  assert.equal(getDimension(single, 'wealth_drain_penalty'), 0);
  assert.ok(single.match_score >= 73);
  assert.equal(single.override_normal_pattern, true);
});

test('rooted water counter still blocks fire single-image override', () => {
  const result = assessBaziImage({
    dayGan: '丙',
    gans: ['壬', '丙', '丙', '壬'],
    zhis: ['子', '午', '午', '子'],
    monthZhi: '午',
  });
  const single = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.SINGLE_IMAGE);

  assert.equal(single.subtype, '炎上格');
  assert.equal(getDimension(single, 'same_camp_branch_frame_points'), 0);
  assert.equal(single.override_normal_pattern, false);
  assert.ok(single.reason_codes.includes('SINGLE_IMAGE_COUNTERED'));
});

test('maps dominant single images for every element', () => {
  const charts = [
    ['甲', ['甲', '乙', '甲', '癸'], ['寅', '卯', '亥', '寅'], '卯', '曲直格', '木'],
    ['丙', ['丙', '丁', '丙', '甲'], ['巳', '午', '寅', '巳'], '午', '炎上格', '火'],
    ['戊', ['戊', '己', '戊', '丙'], ['辰', '戌', '未', '丑'], '戌', '稼穑格', '土'],
    ['庚', ['庚', '辛', '庚', '戊'], ['申', '酉', '丑', '申'], '酉', '从革格', '金'],
    ['壬', ['壬', '癸', '壬', '庚'], ['亥', '子', '申', '亥'], '子', '润下格', '水'],
  ];

  for (const [dayGan, gans, zhis, monthZhi, subtype, targetElement] of charts) {
    const result = assessBaziImage({ dayGan, gans, zhis, monthZhi });
    const candidate = getCandidates(result)
      .find((item) => item.category === IMAGE_CATEGORY.SINGLE_IMAGE);

    assert.equal(candidate.subtype, subtype);
    assert.equal(candidate.target_element, targetElement);
  }
});

test('transformation image recognizes adjacent day-stem combine and becomes primary', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['戊', '己', '甲', '丙'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });

  assert.equal(result.primary_candidate.category, IMAGE_CATEGORY.TRANSFORMATION_IMAGE);
  assert.equal(result.primary_candidate.subtype, '甲己化土');
  assert.equal(result.primary_candidate.target_element, '土');
  assert.equal(result.primary_candidate.yongshen_strategy, 'TRANSFORM_FORCE');
  assert.ok(result.primary_candidate.match_score >= OVERRIDE_MIN_SCORE);
  assert.equal(result.primary_candidate.override_normal_pattern, true);
  assert.ok(result.primary_candidate.reason_codes.includes('ADJACENT_STEM_COMBINE'));
});

test('transformation image recognizes adjacent hour-stem combine', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['戊', '丙', '甲', '己'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(transform.subtype, '甲己化土');
  assert.ok(transform.reason_codes.includes('ADJACENT_STEM_COMBINE'));
});

test('supports bidirectional five-combine transformation mappings', () => {
  const combinations = [
    ['甲', '己', '土', ['戌', '丑', '辰', '未']],
    ['己', '甲', '土', ['戌', '丑', '辰', '未']],
    ['乙', '庚', '金', ['申', '酉', '丑', '申']],
    ['庚', '乙', '金', ['申', '酉', '丑', '申']],
    ['丙', '辛', '水', ['亥', '子', '申', '亥']],
    ['辛', '丙', '水', ['亥', '子', '申', '亥']],
    ['丁', '壬', '木', ['寅', '卯', '亥', '寅']],
    ['壬', '丁', '木', ['寅', '卯', '亥', '寅']],
    ['戊', '癸', '火', ['巳', '午', '寅', '巳']],
    ['癸', '戊', '火', ['巳', '午', '寅', '巳']],
  ];

  for (const [dayGan, partner, targetElement, zhis] of combinations) {
    const result = assessBaziImage({
      dayGan,
      gans: [dayGan, partner, dayGan, dayGan],
      zhis,
      monthZhi: zhis[1],
    });
    const candidate = getCandidates(result)
      .find((item) => item.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

    assert.equal(candidate.subtype, `${dayGan}${partner}化${targetElement}`);
    assert.equal(candidate.target_element, targetElement);
  }
});

test('does not create transformation image for a non-adjacent five-combine stem', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['己', '戊', '甲', '丙'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });

  assert.equal(
    getCandidates(result)
      .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE),
    undefined,
  );
});

test('serious jealous combine caps transformation image below override threshold', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['己', '己', '甲', '戊'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.ok(transform.match_score <= 79);
  assert.equal(transform.override_normal_pattern, false);
  assert.ok(transform.reason_codes.includes('JEALOUS_COMBINE'));
});

test('duplicate day stem competing for one combine stem caps transformation image', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['甲', '己', '甲', '丙'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.ok(transform.match_score <= 79);
  assert.equal(transform.override_normal_pattern, false);
  assert.ok(transform.reason_codes.includes('JEALOUS_COMBINE'));
});

test('deduplicates identical transformation image from month and hour stems', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['戊', '己', '甲', '己'],
    zhis: ['戌', '丑', '辰', '未'],
    monthZhi: '丑',
  });
  const transforms = getCandidates(result)
    .filter((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(transforms.length, 1);
  assert.equal(transforms[0].subtype, '甲己化土');
});

test('strong day-master roots prevent transformation image override', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['戊', '己', '甲', '丙'],
    zhis: ['辰', '丑', '辰', '未'],
    monthZhi: '丑',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.ok(getDimension(transform, 'original_qi_root_count') > 0);
  assert.ok(transform.match_score <= 79);
  assert.equal(transform.override_normal_pattern, false);
  assert.ok(transform.reason_codes.includes('DM_HAS_STRONG_ROOT'));
  assert.ok(hasPenalty(transform, 'DM_HAS_STRONG_ROOT_CAP_79'));
});

test('single primary day-master root prevents transformation image override', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '己', '甲', '丙'],
    zhis: ['寅', '丑', '戌', '戌'],
    monthZhi: '丑',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(getDimension(transform, 'original_qi_primary_root_count'), 1);
  assert.ok(transform.match_score <= 79);
  assert.equal(transform.override_normal_pattern, false);
  assert.ok(transform.reason_codes.includes('DM_HAS_STRONG_ROOT'));
  assert.ok(hasPenalty(transform, 'DM_HAS_STRONG_ROOT_CAP_79'));
});

test('transparent seal generating the day master prevents transformation image override (杜月笙 乙庚化金·壬印透干)', () => {
  // 戊子·庚申·乙丑·壬午：乙日与月干庚合、申月金旺，看似乙庚化金；
  // 但时干壬水（正印）透出生身，日主恋印不化，至多假化，不取真化 override。
  // 陆致极《八字命理学进阶教程》p.112-113 判为正官佩印（取壬水化杀生身），非化金。
  const result = assessBaziImage({
    dayGan: '乙',
    gans: ['戊', '庚', '乙', '壬'],
    zhis: ['子', '申', '丑', '午'],
    monthZhi: '申',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(transform.subtype, '乙庚化金');
  assert.ok(transform.match_score <= 79);
  assert.equal(transform.override_normal_pattern, false);
  assert.ok(transform.reason_codes.includes('DM_HAS_SEAL'));
  assert.ok(hasPenalty(transform, 'DM_HAS_SEAL_CAP_79'));
});

test('seal hidden in branches but not transparent does not block transformation override', () => {
  // 印仅藏支（不透干）力弱，难夺化，与"日主强根"封顶逻辑对称：藏支微印不封顶。
  // 乙庚化金，地支金势成、乙木无根、天干无印透出 → 仍取真化 override。
  const result = assessBaziImage({
    dayGan: '乙',
    gans: ['戊', '庚', '乙', '戊'],
    zhis: ['申', '申', '酉', '戌'],
    monthZhi: '申',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(transform.subtype, '乙庚化金');
  assert.equal(getDimension(transform, 'original_qi_root_count'), 0);
  assert.ok(transform.match_score >= OVERRIDE_MIN_SCORE);
  assert.equal(transform.override_normal_pattern, true);
  assert.ok(!transform.reason_codes.includes('DM_HAS_SEAL'));
});

test('damaged transformation qi records counter-force penalty', () => {
  const result = assessBaziImage({
    dayGan: '丁',
    gans: ['庚', '壬', '丁', '辛'],
    zhis: ['申', '酉', '丑', '申'],
    monthZhi: '酉',
  });
  const transform = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TRANSFORMATION_IMAGE);

  assert.equal(transform.subtype, '丁壬化木');
  assert.ok(getDimension(transform, 'transform_qi_counter_ratio') >= DOMINANT_MIN_RATIO);
  assert.ok(transform.reason_codes.includes('TRANSFORM_QI_DAMAGED'));
  assert.ok(hasPenalty(transform, 'TRANSFORM_QI_DAMAGED'));
});

test('two qi image remains descriptive even above override threshold', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['甲', '丙', '甲', '丁'],
    zhis: ['寅', '午', '卯', '巳'],
    monthZhi: '午',
  });
  const twoQi = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.ok(twoQi.match_score >= OVERRIDE_MIN_SCORE);
  assert.deepEqual(twoQi.target_elements, ['火', '木']);
  assert.equal(twoQi.yongshen_strategy, 'DESCRIPTIVE_ONLY');
  assert.equal(twoQi.allow_override, false);
  assert.equal(twoQi.override_normal_pattern, false);
});

test('two qi image does not claim balance when one element is overwhelmingly dominant', () => {
  const result = assessBaziImage({
    dayGan: '壬',
    gans: ['壬', '癸', '壬', '癸'],
    zhis: ['子', '子', '子', '子'],
    monthZhi: '子',
  });
  const twoQi = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.ok(getDimension(twoQi, 'two_qi_ratio_difference') > 0.3);
  assert.equal(twoQi.reason_codes.includes('TWO_QI_BALANCED'), false);
});

test('creates mixed follow-force candidate only for rootless unsupported mixed force', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '庚'],
    zhis: ['巳', '午', '戌', '酉'],
    monthZhi: '午',
  });
  const mixedFollow = getCandidates(result)
    .find((candidate) => candidate.subtype === '从势格');

  assert.equal(mixedFollow.category, IMAGE_CATEGORY.FOLLOW_IMAGE);
  assert.deepEqual(mixedFollow.target_elements, ['火', '土', '金']);
  assert.equal(mixedFollow.yongshen_strategy, 'FOLLOW_FORCE');
  assert.ok(mixedFollow.reason_codes.includes('TARGET_QI_MIXED'));
  assert.ok(mixedFollow.reason_codes.includes('DM_ROOTLESS'));
});

test('does not create mixed follow-force candidate with roots, visible aid, or one dominant camp', () => {
  const charts = [
    {
      dayGan: '甲',
      gans: ['丙', '戊', '甲', '庚'],
      zhis: ['巳', '午', '寅', '酉'],
      monthZhi: '午',
    },
    {
      dayGan: '甲',
      gans: ['壬', '戊', '甲', '庚'],
      zhis: ['巳', '午', '戌', '酉'],
      monthZhi: '午',
    },
    {
      dayGan: '甲',
      gans: ['丙', '戊', '甲', '己'],
      zhis: ['戌', '戌', '戌', '戌'],
      monthZhi: '戌',
    },
  ];

  for (const chart of charts) {
    assert.equal(
      getCandidates(assessBaziImage(chart))
        .find((candidate) => candidate.subtype === '从势格'),
      undefined,
    );
  }
});

test('hidden seal root prevents mixed follow-force candidate', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '戊', '甲', '庚'],
    zhis: ['巳', '午', '子', '酉'],
    monthZhi: '午',
  });

  assert.equal(
    getCandidates(result).find((candidate) => candidate.subtype === '从势格'),
    undefined,
  );
});

test('mixed follow-force yields to a clear output-force candidate', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['丙', '丙', '甲', '丙'],
    zhis: ['巳', '戌', '戌', '戌'],
    monthZhi: '戌',
  });

  assert.equal(
    getCandidates(result).find((candidate) => candidate.subtype === '从势格'),
    undefined,
  );
  assert.equal(result.primary_candidate.subtype, '从儿格');
});

test('powerful officer-kill counter force prevents dominant single-image override', () => {
  const result = assessBaziImage({
    dayGan: '甲',
    gans: ['甲', '甲', '甲', '庚'],
    zhis: ['卯', '卯', '卯', '酉'],
    monthZhi: '卯',
  });
  const single = getCandidates(result)
    .find((candidate) => candidate.category === IMAGE_CATEGORY.SINGLE_IMAGE);

  assert.equal(single.subtype, '曲直格');
  assert.equal(single.override_normal_pattern, false);
  assert.ok(single.reason_codes.includes('SINGLE_IMAGE_COUNTERED'));
  assert.ok(hasPenalty(single, 'POWERFUL_COUNTER_QI'));
});

test('recognizes 金白水清 as named two-qi image with reviewed override threshold', () => {
  const result = assessBaziImage({
    dayGan: '辛',
    gans: ['庚', '乙', '辛', '壬'],
    zhis: ['子', '酉', '酉', '辰'],
    monthZhi: '酉',
  });

  const twoQi = getCandidates(result)
    .find(candidate => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.equal(twoQi.subtype, '金白水清');
  assert.equal(twoQi.yongshen_strategy, 'TWO_QI_CLEAR_FLOW');
  assert.ok(twoQi.match_score < OVERRIDE_MIN_SCORE);
  assert.equal(twoQi.override_normal_pattern, true);
  assert.equal(twoQi.override_scope, 'xiji_yongshen');
  assert.deepEqual(twoQi.affected_dimensions, ['yongshen', 'xiji']);
  assert.equal(twoQi.formation_level, 'FORMED');
  assert.equal(twoQi.formation_relation, 'GENERATING');
  assert.equal(twoQi.treatment, 'LEAK_EXCESS');
  assert.deepEqual(twoQi.target_elements, ['金', '水']);
  assert.equal(Object.hasOwn(twoQi, 'reviewed_override_min_score'), false);
});

test('recognizes 火土成势 as named two-qi force image with reviewed override threshold', () => {
  const result = assessBaziImage({
    dayGan: '丁',
    gans: ['戊', '戊', '丁', '丁'],
    zhis: ['辰', '戌', '丑', '未'],
    monthZhi: '戌',
  });

  const twoQi = getCandidates(result)
    .find(candidate => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.equal(twoQi.subtype, '火土成势');
  assert.equal(twoQi.yongshen_strategy, 'TWO_QI_FOLLOW_FORCE');
  assert.ok(twoQi.match_score < OVERRIDE_MIN_SCORE);
  assert.equal(twoQi.override_normal_pattern, true);
  assert.equal(twoQi.override_scope, 'xiji_yongshen');
  assert.equal(twoQi.formation_level, 'FORMED');
  assert.equal(twoQi.treatment, 'FOLLOW_CLEAR_BODY');
  assert.deepEqual(twoQi.target_elements, ['土', '火']);
  assert.equal(Object.hasOwn(twoQi, 'reviewed_override_min_score'), false);
});

test('recognizes 强众敌寡 and records the weak enemy element（张謇）', () => {
  const result = assessBaziImage({
    dayGan: '己',
    gans: ['癸', '戊', '己', '丁'],
    zhis: ['丑', '午', '巳', '卯'],
    monthZhi: '午',
  });

  const twoQi = getCandidates(result)
    .find(candidate => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.equal(twoQi.subtype, '强众敌寡');
  assert.equal(twoQi.yongshen_strategy, 'TWO_QI_HUNT_WEAK_ENEMY');
  assert.deepEqual(twoQi.target_elements, ['土', '火']);
  assert.deepEqual(twoQi.weak_enemy_elements, ['水']);
  assert.equal(twoQi.override_normal_pattern, true);
  assert.equal(twoQi.override_scope, 'xiji_yongshen');
  assert.equal(twoQi.treatment, 'REMOVE_ROOTLESS_WEAK');
  assert.equal(twoQi.formation_relation, 'GENERATING');
});

test('火土成势 candidate is vetoed when rooted 壬水 is a counter-use（任铁樵）', () => {
  const result = assessBaziImage({
    dayGan: '丙',
    gans: ['癸', '戊', '丙', '壬'],
    zhis: ['巳', '午', '午', '辰'],
    monthZhi: '午',
  });

  const twoQi = getCandidates(result)
    .find(candidate => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.equal(twoQi.subtype, '火土成势');
  assert.equal(twoQi.override_normal_pattern, false);
  assert.equal(twoQi.override_scope, 'display_only');
  assert.equal(twoQi.effective_counter_element, '水');
  assert.ok(twoQi.veto_basis.includes('ROOTED_COUNTER_USE'));
  assert.ok(twoQi.veto_basis.includes('TIAOHOU_TRUE_USE'));
  assert.match(twoQi.override_veto_reason, /壬水|制刃|调候/);
});

test('强众敌寡 candidate is vetoed when weak enemy is rooted and useful（康熙）', () => {
  const result = assessBaziImage({
    dayGan: '戊',
    gans: ['甲', '戊', '戊', '丁'],
    zhis: ['午', '辰', '申', '巳'],
    monthZhi: '辰',
  });

  const twoQi = getCandidates(result)
    .find(candidate => candidate.category === IMAGE_CATEGORY.TWO_QI_IMAGE);

  assert.equal(twoQi.subtype, '强众敌寡');
  assert.equal(twoQi.override_normal_pattern, false);
  assert.equal(twoQi.override_scope, 'display_only');
  assert.equal(twoQi.effective_counter_element, '木');
  assert.ok(twoQi.veto_basis.includes('ROOTED_COUNTER_USE'));
  assert.ok(twoQi.veto_basis.includes('TIAOHOU_TRUE_USE'));
  assert.match(twoQi.override_veto_reason, /甲木|有根|调候/);
});
