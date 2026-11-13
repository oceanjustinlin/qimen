const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBaziQuestionPrompt,
  buildBaziAuditSnapshot,
  extractBaziAnalysisParams,
  extractBaziQuestionContext,
  normalizeBaziSemanticRoute,
  inferBaziRouteFromQuestion,
  parseCalendarYearScope,
  migrateLegacyRoute,
  FRAMEWORK,
  TARGET_SOURCE,
  resolveTarget,
  resolveBackendTargetSpec,
  runStatusPipeline,
  runTimingPipeline,
  runStaticPipeline,
  normalizeBaziQuestionOutput,
  resolveConcreteTimeScope,
  resolveCandidateYears,
  resolveDayunForYear,
  deriveQuality,
  deriveStrengthTier
} = require('./baziQuestionCore');

const IMAGE_ANALYSIS = {
  primary_candidate: {
    category: 'FOLLOW_IMAGE',
    subtype: '从财格',
    match_score: 86,
    match_label: '成象',
    override_normal_pattern: true,
    override_scope: 'xiji_yongshen'
  }
};

const OVERRIDE_IMAGE_ANALYSIS = {
  primary_candidate: {
    category: 'FOLLOW_IMAGE',
    subtype: '从官杀格',
    match_score: 88,
    match_label: '近象',
    override_normal_pattern: false
  },
  override_candidate: {
    category: 'FOLLOW_IMAGE',
    subtype: '从财格',
    match_score: 86,
    match_label: '成象',
    override_normal_pattern: true,
    override_scope: 'xiji_yongshen'
  }
};

const profile = {
  id: 'profile-1',
  name: '命主',
  gender: 'M',
  bazi_str: '甲子 丙寅 戊辰 庚申',
  geju: '食神格',
  strong_weak: '身弱',
  favorable_elements: ['火', '土'],
  unfavorable_elements: ['水', '木'],
  shensha: '{"day":["天乙贵人"]}',
  bazi_detail: {
    matrix: {
      pillars: [
        { name: '年', gan: '甲', zhi: '子', star: '七杀' },
        { name: '月', gan: '丙', zhi: '寅', star: '偏印' },
        { name: '日', gan: '戊', zhi: '辰', star: '元男' },
        { name: '时', gan: '庚', zhi: '申', star: '食神' }
      ],
      current_dayun: { gan: '丁', zhi: '卯', shi_shen: '正印' },
      current_liunian: { gan: '丙', zhi: '午', shi_shen: '偏印' },
      liuyue_list: [{ month_name: '正月', gan: '庚', zhi: '寅', shi_shen: '食神' }],
      dayun_list: [{ gan: '丁', zhi: '卯', start_age: 32 }]
    },
    strength_detail: { summary: '日主偏弱，喜火土扶身。' },
    five_shens: {
      favorable: ['正印', '偏印', '比肩'],
      unfavorable: ['正财', '偏财']
    },
    wuxing: {
      favorable: ['火', '土'],
      unfavorable: ['水', '木']
    },
    decision_chain: [
      { layer: 'L1 调候', reason: '初春余寒，先取丙火暖局' },
      { layer: 'L2 扶抑', reason: '日主偏弱，取印比扶身' }
    ],
    tiaohou_detail: {
      climate_state: '初春余寒',
      urgency: '偏急',
      primary_gods: [{ gan: '丙', shen: '偏印', wuxing: '火', priority: 1, role: '第一调候' }],
      explanation: '初春余寒未退，先要丙火向阳。',
      special_pattern_warning: ''
    },
    chengge_detail: { chengGe: '食神生财格', chengGeResult: '成格' },
    interactions: { stems: ['丙辛合'] },
    favorable_verdict: '此局喜印比扶身，财官不宜过重。',
    classic_verdict: { summary: '食神有气。' }
  }
};

test('extractBaziQuestionContext cites existing profile fields without recomputing pillars', () => {
  const context = extractBaziQuestionContext(profile);

  assert.equal(context.name, '命主');
  assert.equal(context.gender, '男');
  assert.equal(context.year_gz, '甲子');
  assert.equal(context.day_stem, '戊');
  assert.equal(context.strong_weak, '身弱');
  assert.equal(context.geju, '食神格');
  assert.equal(context.current_dayun, '丁卯');
  assert.equal(context.dayun_stem_shen, '正印');
  assert.equal(context.dayun_start_age, 32);
  assert.equal(context.current_year_gz, '丙午');
  assert.equal(context.current_month_gz, '庚寅');
  assert.match(context.tiaohou_detail, /初春余寒/);
  assert.match(context.tiaohou_detail, /丙/);
  assert.equal(context.favorable_shishen, '正印、偏印、比肩');
  assert.equal(context.unfavorable_shishen, '正财、偏财');
  assert.match(context.tiaohou_summary, /初春余寒|丙火/);
  assert.match(context.pattern_summary, /食神生财格/);
  assert.match(context.decision_chain_summary, /L1 调候/);
});

test('buildBaziQuestionPrompt includes strict non-recalculation guard and requested schema', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile,
    question: '我未来五年适合创业还是打工？',
    route: { category: 'career_business', subcategory: 'entrepreneurship_vs_job' }
  });

  assert.match(prompt, /你是一位精通子平八字推演的命理大师/);
  assert.match(prompt, /不得重新排盘/);
  assert.match(prompt, /八字：甲子 丙寅 戊辰 庚申/);
  assert.match(prompt, /用户问题/);
  assert.match(prompt, /调候诊断/);
  assert.match(prompt, /初春余寒/);
  // 兜底 prompt 与正常链路共用 v2 输出 Schema（worker 统一按 analysis_mode 套哨兵格式）
  assert.match(prompt, /"readings"/);
  assert.match(prompt, /"base_foundation"/);
  assert.doesNotMatch(prompt, /"ming_ju_analysis"|"score": 72|✅/);
  assert.match(prompt, /排盘口径 → 日主旺衰 → 寒暖燥湿调候 → 月令格局 → 十神组合 → 喜用忌神 → 刑冲合害 → 神煞辅助 → 大运流年应期 → 事件校验/);
});

test('normalizeBaziQuestionOutput maps bazi schema to existing result card analysis fields', () => {
  const output = normalizeBaziQuestionOutput({
    summary: { title: '事业分析', conclusion: '平稳', score: 70, keyword: '官印相生' },
    ming_ju_analysis: {
      ge_ju: '食神格',
      core_shishen: '官星',
      shensha_note: '天乙可用'
    },
    dayun_liunian: {
      current_climate: '平运',
      turning_point: '2027年',
      liuyue_trigger: '午月'
    },
    question_analysis: {
      timing: { best_period: '午月', avoid_period: '子月' }
    },
    advice: {
      strategy: ['先稳后动'],
      risk: '忌冒进',
      leverage: '借火土',
      lucky_tips: { direction: '南方', industry: '教育', timing: '午月' }
    }
  }, {
    question: '事业如何',
    route: { branch: 'bazi', category: 'career_business', subcategory: 'career_direction' }
  });

  assert.equal(output.branch, 'bazi');
  assert.equal(output.category, 'career_business');
  assert.equal(output.analysis.pattern, '食神格');
  assert.equal(output.analysis.yong_shen, '官星');
  assert.equal(output.analysis.dynamic_timing, '2027年');
  assert.equal(output.advice.lucky_tips.time, '午月');
  assert.equal(output.advice.lucky_tips.action, '借火土');
});

test('unified bazi prompt asks for an elaborated basis logic report', () => {
  const prompt = buildBaziQuestionPrompt({
    profile,
    question: '今年感情怎么样',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_status',
      analysis_mode: 'status'
    }
  }).prompt;

  assert.match(prompt, /不要出现任何数字形式的强度、分数、百分比/);
  assert.doesNotMatch(prompt, /summary\.basis\.logic|chart_foundation|mode_analysis/);
  assert.doesNotMatch(prompt, /interaction_summary/);
});

test('unified bazi schema removes duplicated dynamic and pattern fields', () => {
  const prompt = buildBaziQuestionPrompt({
    profile,
    question: '今年事业状态怎么样',
    route: {
      branch: 'bazi',
      category: 'career_business',
      subcategory: 'career_status',
      analysis_mode: 'status'
    }
  }).prompt;

  assert.doesNotMatch(prompt, /interaction_summary/);
  assert.doesNotMatch(prompt, /"dynamic_context": \{"current_climate": ""\}/);
  assert.doesNotMatch(prompt, /"opportunities"/);
  assert.doesNotMatch(prompt, /"pressure_points"/);
  assert.doesNotMatch(prompt, /"near_term_trend"/);
  // v2 schema: old fields replaced by v2 equivalents
  assert.doesNotMatch(prompt, /"dayun_reading"/);          // → dayun_field.text
  assert.doesNotMatch(prompt, /"liunian_reading"/);        // → liunian_trigger.text
  assert.doesNotMatch(prompt, /"target_state_reading"/);  // → target_state[]
  assert.match(prompt, /"dayun_field"/);
  assert.match(prompt, /"liunian_trigger"/);
  assert.match(prompt, /"target_state"/);
  assert.match(prompt, /"base_foundation"/);
  assert.match(prompt, /summary\.basis/);
});

test('normalizeBaziSemanticRoute corrects timing unknown scope and partner profile mode conflicts', () => {
  const route = normalizeBaziSemanticRoute({
    branch: 'bazi',
    category: 'relationship',
    subcategory: 'partner_profile',
    analysis_mode: 'timing',
    needs_time_scan: false,
    time_scope: { type: 'unknown' },
    confidence: 'high'
  });

  assert.equal(route.analysis_mode, 'character');
  assert.equal(route.needs_time_scan, false);
  assert.equal(route.confidence, 'medium');
  assert.match(route.reason, /partner_profile/);
});

test('resolveConcreteTimeScope expands semantic ranges from current liunian year inclusively', () => {
  assert.deepEqual(resolveConcreteTimeScope({ type: 'next_3_years' }, 2026), {
    type: 'next_3_years',
    start_year: 2026,
    end_year: 2028
  });

  const fallback = resolveConcreteTimeScope({ type: 'unknown' }, 0, { analysisMode: 'status', nowYear: 2030 });
  assert.equal(fallback.type, 'current_year');
  assert.equal(fallback.start_year, 2030);
  assert.equal(fallback.end_year, 2030);
  assert.equal(fallback.source, 'system_year_fallback');
  assert.ok(fallback.limitations.length > 0);
});

test('resolveConcreteTimeScope falls back to ten years when an age range resolves before current year', () => {
  const scope = resolveConcreteTimeScope(
    { type: 'specified_range', end_age: 35, source: 'age_before' },
    2026,
    { analysisMode: 'timing', birthYear: 1990 }
  );

  assert.equal(scope.type, 'next_10_years');
  assert.equal(scope.start_year, 2026);
  assert.equal(scope.end_year, 2035);
  assert.equal(scope.source, 'age_range_fallback');
  assert.match(scope.limitations.join('；'), /年龄区间/);
});

test('parseCalendarYearScope extracts two-digit calendar year ranges with 年 marker', () => {
  assert.deepEqual(parseCalendarYearScope('我22-28年之间，哪一年会结婚'), {
    type: 'specified_range',
    start_year: 2022,
    end_year: 2028,
    source: 'year_range'
  });
  assert.deepEqual(parseCalendarYearScope('2022年到2028年哪年最好'), {
    type: 'specified_range',
    start_year: 2022,
    end_year: 2028,
    source: 'year_range'
  });
  // "岁"龄区间不带"年"标记，不应被误判为日历年
  assert.equal(parseCalendarYearScope('我22到28岁会结婚吗'), null);
});

test('inferBaziRouteFromQuestion prefers calendar-year range over age range for "22-28年"', () => {
  const route = inferBaziRouteFromQuestion('我22-28年之间，哪一年会结婚', { branch: 'bazi' });
  assert.equal(route.analysis_mode, 'timing');
  assert.equal(route.time_scope.type, 'specified_range');
  assert.equal(route.time_scope.start_year, 2022);
  assert.equal(route.time_scope.end_year, 2028);
  // 不得被"岁"龄分支吃掉
  assert.equal(route.time_scope.start_age, undefined);
});

test('resolveConcreteTimeScope keeps historical specified_range instead of degrading to ten years', () => {
  const scope = resolveConcreteTimeScope(
    { type: 'specified_range', start_year: 2022, end_year: 2028, source: 'year_range' },
    2026,
    { analysisMode: 'timing' }
  );
  assert.equal(scope.type, 'specified_range');
  assert.equal(scope.start_year, 2022);
  assert.equal(scope.end_year, 2028);
});

test('resolveConcreteTimeScope keeps a fully-past specified_range (allow history)', () => {
  const scope = resolveConcreteTimeScope(
    { type: 'specified_range', start_year: 2015, end_year: 2018 },
    2026,
    { analysisMode: 'timing' }
  );
  assert.equal(scope.start_year, 2015);
  assert.equal(scope.end_year, 2018);
  assert.notEqual(scope.type, 'next_10_years');
});

test('extractBaziAnalysisParams maps profile matrix into pipeline params including birth year', () => {
  const result = extractBaziAnalysisParams({
    ...profile,
    birth_date: '1990-03-01',
    bazi_detail: {
      ...profile.bazi_detail,
      image_analysis: IMAGE_ANALYSIS,
      matrix: {
        ...profile.bazi_detail.matrix,
        current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
        liunian_list: [{ year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' }]
      }
    }
  }, { analysis_mode: 'status' });

  assert.equal(result.ok, true);
  assert.equal(result.params.dayStem, '戊');
  assert.equal(result.params.gender, 'male');
  assert.equal(result.params.birthYear, 1990);
  assert.equal(result.params.currentLiunian.year, 2026);
  assert.deepEqual([...result.params.favorableWuxing], ['火', '土']);
  assert.equal(result.params.imageAnalysis, IMAGE_ANALYSIS);
});

test('buildBaziQuestionPrompt forwards upstream image analysis through status static and timing pipelines', () => {
  const imageProfile = {
    ...profile,
    birth_year: 1990,
    bazi_detail: {
      ...profile.bazi_detail,
      image_analysis: IMAGE_ANALYSIS,
      matrix: {
        ...profile.bazi_detail.matrix,
        current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
        liunian_list: [{ year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' }]
      }
    }
  };
  const routes = [
    { category: 'relationship', subcategory: 'relationship_status', analysis_mode: 'status' },
    { category: 'relationship', subcategory: 'marriage_pattern', analysis_mode: 'pattern' },
    { category: 'relationship', subcategory: 'relationship_timing', analysis_mode: 'timing', time_scope: { type: 'current_year' } }
  ];

  for (const route of routes) {
    const result = buildBaziQuestionPrompt({
      profile: imageProfile,
      question: '测试上游形象透传',
      route: { branch: 'bazi', ...route }
    });

    assert.equal(result.pipelineResult.stateReport.image_context, IMAGE_ANALYSIS.primary_candidate);
    assert.match(result.prompt, /形象判断：从财格，匹配度较高（成象），已主导取用。/);
  }
});

test('buildBaziQuestionPrompt uses image override candidate as decision context', () => {
  const result = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        image_analysis: OVERRIDE_IMAGE_ANALYSIS
      }
    },
    question: '测试覆盖形象透传',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_status',
      analysis_mode: 'status'
    }
  });

  assert.equal(result.pipelineResult.stateReport.image_context, OVERRIDE_IMAGE_ANALYSIS.override_candidate);
  assert.equal(result.pipelineResult.stateReport.image_display_context, OVERRIDE_IMAGE_ANALYSIS.primary_candidate);
  assert.match(result.prompt, /形象判断：从财格，匹配度较高（成象），已主导取用。/);
});

test('buildBaziQuestionPrompt includes veto reason for display-only image candidates', () => {
  const result = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        image_analysis: {
          primary_candidate: {
            category: 'TWO_QI_IMAGE',
            subtype: '火土成势',
            match_score: 77,
            match_label: '疑似成象',
            override_normal_pattern: false,
            override_scope: 'display_only',
            override_veto_reason: '壬水透干有根，承担制刃与调候，不按火土顺势覆盖。',
          }
        }
      }
    },
    question: '测试 veto 形象透传',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_status',
      analysis_mode: 'status'
    }
  });

  assert.match(result.prompt, /形象判断：火土成势，匹配度较高（疑似成象），候选被挡下。/);
  assert.match(result.prompt, /未主导原因：壬水透干有根/);
  assert.doesNotMatch(result.prompt, /已覆盖常规喜忌/);
});

test('legacy prompt compact sizhu matrix includes upstream image analysis', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        image_analysis: IMAGE_ANALYSIS
      }
    },
    question: '测试 legacy 形象上下文',
    route: { category: 'general' }
  });

  assert.match(prompt, /"image_analysis":\{"primary_candidate":\{"category":"FOLLOW_IMAGE","subtype":"从财格"/);
});

test('resolveCandidateYears filters scoped liunian list and annotates dayun hints', () => {
  const result = resolveCandidateYears({
    timeScope: { type: 'next_3_years', start_year: 2026, end_year: 2028 },
    currentYear: 2026,
    birthYear: 1990,
    liunianList: [
      { year: 2025, gan: '乙', zhi: '巳' },
      { year: 2026, gan: '丙', zhi: '午' },
      { year: 2027, gan: '丁', zhi: '未' },
      { year: 2028, gan: '戊', zhi: '申' },
      { year: 2029, gan: '己', zhi: '酉' }
    ],
    dayunList: [
      { gan: '丁', zhi: '卯', start_year: 2020, end_year: 2029, start_age: 30 }
    ]
  });

  assert.deepEqual(result.years.map((item) => item.year), [2026, 2027, 2028]);
  assert.deepEqual(result.years[0].dayun_hint, { gan: '丁', zhi: '卯' });
  assert.deepEqual(result.limitations, []);
});

test('resolveCandidateYears includes historical years for a backward-looking range', () => {
  const result = resolveCandidateYears({
    timeScope: { type: 'specified_range', start_year: 2022, end_year: 2028 },
    currentYear: 2026,
    birthYear: 1996,
    liunianList: [
      { year: 2021, gan: '辛', zhi: '丑' },
      { year: 2022, gan: '壬', zhi: '寅' },
      { year: 2023, gan: '癸', zhi: '卯' },
      { year: 2024, gan: '甲', zhi: '辰' },
      { year: 2025, gan: '乙', zhi: '巳' },
      { year: 2026, gan: '丙', zhi: '午' },
      { year: 2027, gan: '丁', zhi: '未' },
      { year: 2028, gan: '戊', zhi: '申' },
      { year: 2029, gan: '己', zhi: '酉' }
    ],
    dayunList: [
      { gan: '辛', zhi: '丑', start_year: 2018, end_year: 2027, start_age: 22 }
    ]
  });

  // 历史年 2022-2025 必须被纳入，而不是被裁剪掉
  assert.deepEqual(result.years.map((item) => item.year), [2022, 2023, 2024, 2025, 2026, 2027, 2028]);
});

test('resolveDayunForYear estimates year range from birth year and start age', () => {
  const dayun = resolveDayunForYear({
    dayunList: [{ gan: '辛', zhi: '酉', start_age: 35 }],
    year: 2026,
    birthYear: 1990
  });

  assert.equal(dayun.gan, '辛');
  assert.equal(dayun.zhi, '酉');
  assert.equal(dayun.start_year, 2025);
  assert.equal(dayun.end_year, 2034);
  assert.equal(dayun.source, 'estimated');
  assert.ok(dayun.limitations.length > 0);
});

test('deriveQuality follows PRD timing strength buckets', () => {
  assert.equal(deriveQuality({
    isMajorWindow: true,
    isActivated: true,
    topStrength: 65,
    isEffective: true,
    newStability: 'stable'
  }), 'strong');
  assert.equal(deriveQuality({
    isMajorWindow: false,
    isActivated: true,
    topStrength: 45,
    isEffective: true,
    newStability: 'dynamic'
  }), 'medium');
  assert.equal(deriveQuality({
    isMajorWindow: false,
    isActivated: false,
    topStrength: 20,
    isEffective: false,
    newStability: 'dynamic'
  }), 'weak');
});

test('deriveStrengthTier prioritizes mechanism strength over subject vigor', () => {
  assert.equal(deriveStrengthTier({
    subjectVigor: 0.26,
    major: false,
    mechanismStrength: 75
  }), '次强');

  assert.equal(deriveStrengthTier({
    subjectVigor: 0.8,
    major: false,
    mechanismStrength: 20
  }), '一般');

  assert.equal(deriveStrengthTier({
    subjectVigor: 0.28,
    major: true,
    mechanismStrength: 48
  }), '较强');
});

test('buildBaziQuestionPrompt explains trigger_vigor as subject state and effective_strength as mechanism strength', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      birth_year: 1990,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '丁', zhi: '卯', shi_shen: '正印', start_year: 2020, end_year: 2029 },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
          dayun_list: [{ gan: '丁', zhi: '卯', start_year: 2020, end_year: 2029, start_age: 30 }],
          liunian_list: [
            { year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' },
            { year: 2027, gan: '丁', zhi: '未', shi_shen: '正印' }
          ]
        }
      }
    },
    question: '近五年的财富水平分析',
    route: {
      branch: 'bazi',
      category: 'finance_wealth',
      subcategory: 'wealth_timing',
      analysis_mode: 'timing',
      time_scope: { type: 'next_3_years' }
    }
  });

  // 内部数值已改成定性档位：只说“机制力度/命主承接”，不出现数字
  assert.match(prompt, /命主承接/)
  assert.match(prompt, /机制力度/)
  assert.match(prompt, /“机制力度”[\s\S]{0,80}“命主承接”/)
  assert.doesNotMatch(prompt, /机制强度\s*\d|命主状态\s*\d/)
  assert.doesNotMatch(prompt, /流年旺衰系数/)
  assert.doesNotMatch(prompt, /触发者强于目标/)
});

test('timing normalization only keeps LLM selected candidate windows', () => {
  const pipelineResult = {
    timingCandidates: [
      {
        year: 2027,
        ganzhi: '丁未',
        dayun_ganzhi: '甲寅',
        quality: 'strong',
        is_major_window: true,
        event_type: '落定',
        supporting_evidence: ['双引动'],
        blocking_evidence: [],
        _pipeline: { rank_score: 88 }
      },
      {
        year: 2028,
        ganzhi: '戊申',
        dayun_ganzhi: '甲寅',
        quality: 'medium',
        is_major_window: false,
        event_type: '波动',
        supporting_evidence: ['单引动'],
        blocking_evidence: [],
        _pipeline: { rank_score: 61 }
      }
    ],
    scanned_years: [2027, 2028]
  };
  const output = normalizeBaziQuestionOutput({
    meta: { analysis_mode: 'timing', limitations: [] },
    summary: { basis: { positive_signals: [], negative_signals: [], logic: '2027年被模型选为主窗口。' } },
    mode_analysis: {
      trigger_windows: [
        {
          year: 2027,
          verdict: '2027年大运流年同时引动，适合作为重点窗口。',
          mechanisms_text: '大运和流年同时触发目标宫位。'
        }
      ]
    }
  }, { pipelineResult });

  assert.equal(output.mode_analysis.trigger_windows.length, 1);
  assert.equal(output.mode_analysis.trigger_windows[0].year, 2027);
  assert.equal(output.mode_analysis.trigger_windows[0].quality, 'strong');
});

test('buildBaziQuestionPrompt assembles status mode with natural language reports and no raw dynamic JSON block', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '辛', zhi: '酉', shi_shen: '伤官' },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' }
        }
      }
    },
    question: '我今年能不能结婚？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_timing',
      analysis_mode: 'status',
      time_scope: { type: 'current_year' }
    }
  });

  assert.match(prompt, /analysis_mode: status/);
  assert.match(prompt, /【上游命局分析摘要】/);
  assert.match(prompt, /调候判断：初春余寒未退，先要丙火向阳。/);
  assert.match(prompt, /喜用十神：正印、偏印、比肩；忌仇十神：正财、偏财/);
  assert.match(prompt, /取用链路：L1 调候：初春余寒，先取丙火暖局/);
  assert.match(prompt, /【目标元素定位 Step 1】/);
  assert.match(prompt, /【原局状态评估】/);
  assert.match(prompt, /【当前大运流年动态评估 Step 3】/);
  assert.match(prompt, /机制强度|命主状态/);
  assert.doesNotMatch(prompt, /引动强度|旺衰系数/);
  assert.doesNotMatch(prompt, /"dayun_impact"\s*:/);
  assert.doesNotMatch(prompt, /"dynamicReport"\s*:/);
});

test('buildBaziQuestionPrompt assembles timing mode with scanned year candidates and no raw dynamic JSON block', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      birth_year: 1990,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '丁', zhi: '卯', shi_shen: '正印', start_year: 2020, end_year: 2029 },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
          dayun_list: [{ gan: '丁', zhi: '卯', start_year: 2020, end_year: 2029, start_age: 30 }],
          liunian_list: [
            { year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' },
            { year: 2027, gan: '丁', zhi: '未', shi_shen: '正印' },
            { year: 2028, gan: '戊', zhi: '申', shi_shen: '比肩' }
          ]
        }
      }
    },
    question: '我未来几年什么时候容易结婚？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_timing',
      analysis_mode: 'timing',
      time_scope: { type: 'next_3_years' }
    }
  });

  assert.match(prompt, /analysis_mode: timing/);
  assert.match(prompt, /scanned_years: 2026、2027、2028/);
  assert.match(prompt, /候选年份动态断语包 Step 3/);
  assert.match(prompt, /候选强度/);
  assert.doesNotMatch(prompt, /"dynamicReport"\s*:/);
  assert.doesNotMatch(prompt, /"dayun_impact"\s*:/);
});

test('buildBaziQuestionPrompt treats age-before questions as timing and falls back to ten-year scan when range is invalid', () => {
  const { prompt, pipelineResult } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      birth_year: 1990,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '辛', zhi: '酉', shi_shen: '伤官', start_age: 35 },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
          dayun_list: [
            { gan: '辛', zhi: '酉', start_age: 35 },
            { gan: '壬', zhi: '戌', start_age: 45 }
          ],
          liunian_list: [
            { year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' },
            { year: 2027, gan: '丁', zhi: '未', shi_shen: '正印' },
            { year: 2028, gan: '戊', zhi: '申', shi_shen: '比肩' },
            { year: 2029, gan: '己', zhi: '酉', shi_shen: '劫财' },
            { year: 2030, gan: '庚', zhi: '戌', shi_shen: '食神' }
          ]
        }
      }
    },
    question: '我35岁前可以年薪百万吗',
    route: {
      branch: 'bazi',
      category: 'finance_wealth',
      subcategory: 'wealth_capacity'
    }
  });

  assert.match(prompt, /analysis_mode: timing/);
  assert.match(prompt, /time_scope: next_10_years，2026-2035/);
  assert.match(prompt, /scanned_years: 2026、2027、2028、2029、2030/);
  assert.equal(pipelineResult.time_scope.type, 'next_10_years');
  assert.equal(pipelineResult.time_scope.source, 'age_range_fallback');
});

test('buildBaziQuestionPrompt frames male pregnancy timing as paternal child timing, not the native conceiving', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
          liunian_list: [
            { year: 2026, gan: '丙', zhi: '午', shi_shen: '偏印' },
            { year: 2027, gan: '丁', zhi: '未', shi_shen: '正印' },
            { year: 2028, gan: '戊', zhi: '申', shi_shen: '比肩' }
          ]
        }
      }
    },
    question: '命主什么时候会有孩子，孩子性别和特征',
    route: {
      branch: 'bazi',
      category: 'pregnancy_birth',
      subcategory: 'conception',
      analysis_mode: 'timing'
    }
  });

  assert.match(prompt, /性别：男/);
  assert.match(prompt, /男命添丁\/得子应期/);
  assert.doesNotMatch(prompt, /男命受孕时机/);
});

test('normalizeBaziQuestionOutput drops LLM-invented timing data-gap limitations when pipeline has no limitations', () => {
  const normalized = normalizeBaziQuestionOutput({
    meta: {
      analysis_mode: 'timing',
      limitations: [
        '2031-2035年详细断语缺失',
        '流年丙午具体交互数据未完全展开'
      ]
    },
    mode_analysis: {
      trigger_windows: [{ year: 2028, verdict: '候选年', mechanisms_text: '透干引动' }]
    }
  }, {
    question: '命主什么时候会有孩子',
    route: { category: 'pregnancy_birth', subcategory: 'conception' },
    pipelineResult: {
      limitations: [],
      scanned_years: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035],
      timingCandidates: [
        {
          year: 2028,
          ganzhi: '戊申',
          dayun_ganzhi: '丁未',
          quality: 'strong',
          is_major_window: true,
          supporting_evidence: ['透干引动'],
          blocking_evidence: [],
          _pipeline: {}
        }
      ]
    }
  });

  assert.deepEqual(normalized.meta.limitations, []);
  assert.deepEqual(normalized.mode_analysis.scanned_years, [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
});

test('buildBaziQuestionPrompt assembles pattern mode from Step 1 and Step 2 without timing scan', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile,
    question: '我适合创业还是打工？',
    route: {
      branch: 'bazi',
      category: 'career_business',
      subcategory: 'entrepreneurship_vs_job',
      analysis_mode: 'pattern'
    }
  });

  assert.match(prompt, /analysis_mode: pattern/);
  assert.match(prompt, /先天结构、容量、适配度/);
  assert.match(prompt, /【目标元素定位 Step 1】/);
  assert.match(prompt, /【原局状态评估】/);
  assert.doesNotMatch(prompt, /候选年份动态断语包/);
  assert.doesNotMatch(prompt, /【当前大运流年动态评估 Step 3/);
});

test('buildBaziQuestionPrompt assembles pattern plus secondary status dynamic block', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '辛', zhi: '酉', shi_shen: '伤官' },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' }
        }
      }
    },
    question: '我适合创业吗，现在能不能做？',
    route: {
      branch: 'bazi',
      category: 'career_business',
      subcategory: 'entrepreneurship_vs_job',
      analysis_mode: 'pattern',
      secondary_mode: 'status',
      time_scope: { type: 'current_year' }
    }
  });

  assert.match(prompt, /analysis_mode: pattern/);
  assert.match(prompt, /secondary_mode: status/);
  assert.match(prompt, /当前大运流年动态评估 Step 3（secondary=status）/);
  assert.match(prompt, /"readings"/);
  assert.doesNotMatch(prompt, /"dynamicReport"\s*:/);
});

test('buildBaziQuestionPrompt assembles character mode as tendency portrait', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile,
    question: '我未来对象是什么样的人？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'partner_profile',
      analysis_mode: 'character'
    }
  });

  assert.match(prompt, /analysis_mode: character/);
  assert.match(prompt, /倾向画像/);
  assert.match(prompt, /portrait_subject/);
  assert.match(prompt, /每个画像点必须给 evidence/);
  assert.doesNotMatch(prompt, /【当前大运流年动态评估 Step 3/);
});

test('buildBaziQuestionPrompt assembles character plus secondary status for current partner state', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '辛', zhi: '酉', shi_shen: '伤官' },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' }
        }
      }
    },
    question: '我今年老婆的状态怎么样？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'partner_profile',
      analysis_mode: 'character',
      secondary_mode: 'status',
      time_scope: { type: 'current_year' }
    }
  });

  assert.match(prompt, /analysis_mode: character/);
  assert.match(prompt, /secondary_mode: status/);
  assert.match(prompt, /当前大运流年动态评估 Step 3（secondary=status）/);
  assert.match(prompt, /不要扩展成未来应期/);
});

test('buildBaziQuestionPrompt uses llm derived target prompt without backend Step 2 or Step 3', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile,
    question: '这个人是不是同性恋？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: '',
      analysis_mode: 'character',
      target_resolution: 'llm_derived',
      confidence: 'low',
      llm_derived_target: {
        label: '亲密关系表达方式与关系边界',
        observation_scope: ['亲密关系表达方式', '吸引模式', '关系边界'],
        limitations: ['八字无法可靠判定性取向身份', '不得输出确定身份标签']
      }
    }
  });

  assert.match(prompt, /target_resolution: llm_derived/);
  assert.match(prompt, /LLM 自拟目标元素框架/);
  assert.match(prompt, /不调用 Step 2\/3 的后端目标元素分析/);
  assert.match(prompt, /meta.target.fallback_level 必须为 llm_derived/);
  assert.doesNotMatch(prompt, /【原局状态评估】/);
  assert.doesNotMatch(prompt, /【当前大运流年动态评估 Step 3/);
});

test('buildBaziQuestionPrompt infers bazi status mode from branch route when mode is absent', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile: {
      ...profile,
      bazi_detail: {
        ...profile.bazi_detail,
        matrix: {
          ...profile.bazi_detail.matrix,
          current_dayun: { gan: '辛', zhi: '酉', shi_shen: '伤官' },
          current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' }
        }
      }
    },
    question: '我今年能不能结婚？',
    route: {
      branch: 'bazi',
      category: 'relationship',
      subcategory: 'relationship_timing'
    }
  });

  assert.match(prompt, /analysis_mode: status/);
  assert.match(prompt, /【当前大运流年动态评估 Step 3】/);
});

test('buildBaziQuestionPrompt keeps non-branch legacy route backward compatible', () => {
  const { prompt } = buildBaziQuestionPrompt({
    profile,
    question: '我未来五年适合创业还是打工？',
    route: { category: 'career_business', subcategory: 'entrepreneurship_vs_job' }
  });

  assert.doesNotMatch(prompt, /analysis_mode: status/);
  assert.match(prompt, /"base_foundation"/);
});

test('buildBaziAuditSnapshot captures intermediate engineering outputs without full profile', () => {
  const snapshot = buildBaziAuditSnapshot({
    requestId: 'req-1',
    userId: 'user-1',
    question: '我今年能不能结婚？',
    profile,
    routeHint: { branch_hint: 'bazi' },
    semanticRouteRaw: { analysis_mode: 'status' },
    semanticRouteNormalized: { analysis_mode: 'status' },
    pipelineResult: {
      targetSpec: { primary_shishen: ['正官'], primary_gongwei: ['日支'] },
      stateReport: { overall_stability: 'dynamic' },
      dynamicReport: { target_trigger: { is_activated: true } }
    },
    promptBlocks: ['【原局状态评估】...'],
    llmOutputRaw: { summary: { title: '婚恋状态' } },
    llmOutputNormalized: { summary: { title: '婚恋状态' } }
  });

  assert.equal(snapshot.request_id, 'req-1');
  assert.equal(snapshot.user_id, 'user-1');
  assert.equal(snapshot.analysis_params_snapshot.bazi_str, profile.bazi_str);
  assert.equal(snapshot.analysis_params_snapshot.name, undefined);
  assert.deepEqual(snapshot.prompt_blocks, ['【原局状态评估】...']);
});

// ── Phase 1：双轴派生映射（零行为变化，下游暂不消费）──────────────────────
test('migrateLegacyRoute maps every legacy mode to the framework ⟂ target_source axes', () => {
  const cases = [
    [{ analysis_mode: 'status' },                                          FRAMEWORK.DYNAMIC_CURRENT,  TARGET_SOURCE.BACKEND_SHISHEN],
    [{ analysis_mode: 'timing' },                                          FRAMEWORK.DYNAMIC_SCAN,     TARGET_SOURCE.BACKEND_SHISHEN],
    [{ analysis_mode: 'pattern' },                                         FRAMEWORK.STATIC_STRUCTURE, TARGET_SOURCE.BACKEND_SHISHEN],
    [{ analysis_mode: 'character' },                                       FRAMEWORK.PORTRAIT,         TARGET_SOURCE.BACKEND_SHISHEN],
    [{ analysis_mode: 'character', target_resolution: 'llm_derived' },     FRAMEWORK.PORTRAIT,         TARGET_SOURCE.LLM_DERIVED],
    [{ analysis_mode: 'profile_driven' },                                  FRAMEWORK.OPEN_STRATEGY,    TARGET_SOURCE.YONGSHEN],
    [{ analysis_mode: 'timing', target_resolution: 'llm_derived' },        FRAMEWORK.DYNAMIC_SCAN,     TARGET_SOURCE.LLM_DERIVED],
  ];
  for (const [route, framework, target_source] of cases) {
    const axes = migrateLegacyRoute(route);
    assert.equal(axes.framework, framework, `framework for ${JSON.stringify(route)}`);
    assert.equal(axes.target_source, target_source, `target_source for ${JSON.stringify(route)}`);
  }
  // unsupported / 未知 mode → framework=null, target_source=null
  assert.deepEqual(migrateLegacyRoute({ analysis_mode: 'unsupported' }), { framework: null, target_source: null, secondary_framework: null });
});

test('migrateLegacyRoute derives secondary_framework from secondary_mode', () => {
  const axes = migrateLegacyRoute({ analysis_mode: 'pattern', secondary_mode: 'status' });
  assert.equal(axes.framework, FRAMEWORK.STATIC_STRUCTURE);
  assert.equal(axes.secondary_framework, FRAMEWORK.DYNAMIC_CURRENT);
});

test('normalizeBaziSemanticRoute attaches axis fields without disturbing legacy fields', () => {
  const route = normalizeBaziSemanticRoute({ analysis_mode: 'profile_driven' });
  // 新增字段
  assert.equal(route.framework, FRAMEWORK.OPEN_STRATEGY);
  assert.equal(route.target_source, TARGET_SOURCE.YONGSHEN);
  // 旧字段原样保留（零行为变化）
  assert.equal(route.analysis_mode, 'profile_driven');
  assert.equal(route.target_resolution, 'backend_mapped');
});

// ── Phase 2：resolveTarget 三分支 + 用神 targetSpec 引擎兼容（实测未知点）──────
test('resolveTarget routes backend_shishen and llm_derived correctly', () => {
  const { params } = extractBaziAnalysisParams(profile, {});
  assert.equal(resolveTarget(TARGET_SOURCE.LLM_DERIVED, params, {}), null);
  const backend = resolveTarget(TARGET_SOURCE.BACKEND_SHISHEN, params,
    { category: 'career_business', subcategory: 'career_status' });
  assert.ok(Array.isArray(backend.primary_shishen));
});

test('resolveTarget yongshen builds a 用神-anchored targetSpec the engine can assess', () => {
  const { assessOriginalChartState } = require('./baziStateAssessor');
  const { assessDynamicTriggers } = require('./baziDynamicAssessor');

  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'profile_driven' });
  const targetSpec = resolveTarget(TARGET_SOURCE.YONGSHEN, params, {});

  // 用神十神（从 five_shens.favorable 取，过滤掉混入的五行）填进 primary_shishen，宫位置空
  assert.deepEqual(targetSpec.primary_shishen, ['正印', '偏印', '比肩']);
  assert.deepEqual(targetSpec.primary_gongwei, []);
  assert.equal(targetSpec.anchor_kind, 'yongshen');

  // 关键实测：空宫位 / 无 subcategory 的用神 targetSpec 喂引擎不报错，且产出对象
  let stateReport, dynamicReport;
  assert.doesNotThrow(() => {
    stateReport = assessOriginalChartState({
      matrix: params.matrix, targetSpec, dayStem: params.dayStem, gender: params.gender,
      imageAnalysis: params.imageAnalysis, geju: params.rawContext?.geju || null, tiaohou: null,
    });
    dynamicReport = assessDynamicTriggers({
      matrix: params.matrix, targetSpec, stateReport, dayStem: params.dayStem,
      dayunGan: params.currentDayun.gan, dayunZhi: params.currentDayun.zhi,
      liunianGan: params.currentLiunian.gan, liunianZhi: params.currentLiunian.zhi,
      favorableWuxing: params.favorableWuxing, unfavorableWuxing: params.unfavorableWuxing,
    });
  });
  assert.ok(stateReport && typeof stateReport === 'object', 'stateReport produced');
  assert.ok(dynamicReport && typeof dynamicReport === 'object', 'dynamicReport produced');
});

// ── Phase 3：runFramework 参数化吃 targetSpec（行为不变 + null 跳 Tier3）────────
test('runStatusPipeline accepts an injected targetSpec, defaults to backend, and skips on null', () => {
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'status' });
  const route = { category: 'career_business', subcategory: 'career_status' };

  // 默认（不传）= 内部 backend 解析，与现状一致
  const internal = runStatusPipeline(params, route);
  assert.ok(internal.targetSpec && internal.stateReport && internal.dynamicReport, 'internal resolve produces full report');

  // 注入显式 targetSpec：原样使用（身份相同），照常产出
  const injected = resolveTarget(TARGET_SOURCE.YONGSHEN, params, route);
  const withInjected = runStatusPipeline(params, route, injected);
  assert.equal(withInjected.targetSpec, injected, 'uses injected targetSpec verbatim');
  assert.ok(withInjected.stateReport && withInjected.dynamicReport, 'engine runs on injected 用神 target');

  // null（llm_derived）→ 跳 Tier3
  assert.deepEqual(runStatusPipeline(params, route, null), { targetSpec: null, stateReport: null, dynamicReport: null });
});

test('runStaticPipeline and runTimingPipeline honor injected/null targetSpec', () => {
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'timing' });
  const route = { category: 'career_business', subcategory: 'career_status', analysis_mode: 'timing', time_scope: { type: 'next_5_years' } };

  // static：默认产出 + null 跳过
  assert.ok(runStaticPipeline(params, route).targetSpec);
  assert.deepEqual(runStaticPipeline(params, route, { targetSpec: null }), { targetSpec: null, stateReport: null });

  // timing：默认产出候选 + null 跳过（返回空候选）
  const timing = runTimingPipeline(params, route);
  assert.ok(timing.targetSpec && Array.isArray(timing.timingCandidates));
  const timingNull = runTimingPipeline(params, route, { targetSpec: null });
  assert.equal(timingNull.targetSpec, null);
  assert.deepEqual(timingNull.timingCandidates, []);
});

// ── Phase 4：dispatch 重写 — profile_driven 跑用神引擎；llm_derived 仍跳引擎 ──────
test('Phase 4: profile_driven now runs the 用神 engine instead of bypassing', () => {
  const { prompt, pipelineResult } = buildBaziQuestionPrompt({
    profile,
    question: '我这辈子适合自己创业还是在大平台深耕？',
    route: { branch: 'bazi', category: 'career_business', analysis_mode: 'profile_driven' }
  });
  // 行为变化：不再 pipelineResult=null，引擎以用神为目标跑出底盘
  assert.ok(pipelineResult, 'profile_driven now returns a pipelineResult');
  assert.ok(pipelineResult.stateReport, 'state_report produced');
  assert.ok(pipelineResult.dynamicReport, 'dynamic_report produced');
  assert.equal(pipelineResult.targetSpec.anchor_kind, 'yongshen');
  assert.deepEqual(pipelineResult.targetSpec.primary_shishen, ['正印', '偏印', '比肩']);
  // prompt 注入了用神底盘
  assert.match(prompt, /用神综合底盘/);
});

test('Phase 4: llm_derived still skips the engine (targetSpec null)', () => {
  const { pipelineResult } = buildBaziQuestionPrompt({
    profile,
    question: '随便帮我看看',
    route: { branch: 'bazi', category: 'general', analysis_mode: 'character', target_resolution: 'llm_derived' }
  });
  assert.equal(pipelineResult, null);
});

// ── 用神锚定：忌神也做完整状态评估（is_avoid 卡）──────────────────────────
test('yongshen 锚定时忌神与用神同样产出状态评估卡（is_avoid 标记）', () => {
  const { assessOriginalChartState } = require('./baziStateAssessor')
  // 林俊彦 戊寅 己未 甲戌 癸酉，日主甲；用神正印(癸)、忌神偏财(戊在年干)
  const matrix = { pillars: [
    { name: '年', gan: '戊', zhi: '寅' }, { name: '月', gan: '己', zhi: '未' },
    { name: '日', gan: '甲', zhi: '戌' }, { name: '时', gan: '癸', zhi: '酉' }
  ], current_dayun: { gan: '壬', zhi: '戌' }, current_liunian: { gan: '丙', zhi: '午' } }
  const params = { matrix, dayStem: '甲', gender: 'M', favorableShishen: ['正印'], unfavorableShishen: ['偏财'] }
  const targetSpec = resolveTarget(TARGET_SOURCE.YONGSHEN, params, {})
  const sr = assessOriginalChartState({ matrix, targetSpec, dayStem: '甲', gender: 'M' })
  const avoid = sr.shishen_assessments.filter(a => a.is_avoid)
  assert.ok(avoid.length >= 1, '忌神至少产出一张状态卡')
  // 忌神卡与用神卡结构一致（有旺衰/柱位等字段）
  assert.ok(avoid[0].pillar && avoid[0].shishen, '忌神卡含柱位与十神')
  assert.ok(sr.shishen_assessments.some(a => !a.is_avoid), '用神卡仍在')
})

// ── 忌神动态引动：动态报告 avoid_impact + LLM 注入 ─────────────────────────
test('yongshen 锚定产出忌神动态引动(avoid_impact)并注入 LLM', () => {
  const profile = { gender:'M', bazi_str:'戊寅 己未 甲戌 癸酉', bazi_detail:{ matrix:{ pillars:[
    {name:'年',gan:'戊',zhi:'寅'},{name:'月',gan:'己',zhi:'未'},{name:'日',gan:'甲',zhi:'戌'},{name:'时',gan:'癸',zhi:'酉'}
  ], current_dayun:{gan:'壬',zhi:'戌'}, current_liunian:{gan:'丙',zhi:'午'} }, favorable_gods:['正印'], unfavorable_gods:['偏财'] } }
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode:'profile_driven' })
  const ts = resolveTarget(TARGET_SOURCE.YONGSHEN, params, {})
  const r = runStatusPipeline(params, {}, ts)
  // 引擎：忌神动态挂在 dynamicReport.avoid_impact
  assert.ok(r.dynamicReport.avoid_impact, 'avoid_impact 存在')
  assert.ok(r.dynamicReport.avoid_impact.target_trigger, '忌神 target_trigger 存在')
  assert.equal(r.dynamicReport.avoid_impact.shishen, '偏财')
  // LLM：忌神动态引动断语注入
  const { prompt } = buildBaziQuestionPrompt({ profile, question:'创业还是大平台？', route:{ branch:'bazi', category:'career_business', analysis_mode:'profile_driven' } })
  assert.match(prompt, /忌神动态引动/)
  assert.match(prompt, /用神是否得力.*忌神是否被岁运引动/)
  // backend 模式不产生 avoid_impact（不污染）
  const { params: p2 } = extractBaziAnalysisParams(profile, { analysis_mode:'status' })
  const r2 = runStatusPipeline(p2, { category:'career_business', subcategory:'career_status' })
  assert.equal(r2.dynamicReport.avoid_impact, undefined)
})

// ── 流年数据传参路径测试：liunian_list 嵌套 vs 顶层 ──────────────────────────
// 真实 baziLocalMatrix.mjs 生成的 matrix 结构：
//   matrix.dayun_list[i].liunian_list  ← 存在（每个大运嵌套10个流年）
//   matrix.liunian_list                ← 不存在（baziLocalMatrix.mjs 从未写此字段）
// 下列测试验证：当 matrix 缺顶层 liunian_list 时，params.liunianList 是否为空，
// 以及各 time_scope 枚举值下 resolveCandidateYears 的行为。

// 60岁命主fixture（生于1966，当前流年2026），模拟真实 matrix 结构：
// dayun_list 每个大运含嵌套 liunian_list，无顶层 liunian_list。
const GANZHI_60 = [
  '丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑','甲寅','乙卯',
  '丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥','甲子','乙丑',
  '丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉','甲戌','乙亥'
]
function makeLiunianList(startYear, count = 10, startOffset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const gz = GANZHI_60[(startOffset + i) % GANZHI_60.length]
    return { year: startYear + i, gan: gz[0], zhi: gz[1], shi_shen: '比肩' }
  })
}
const DAYUN_LIST_60 = [
  { gan: '丁', zhi: '亥', start_age: 3,  end_age: 12,  start_year: 1969, end_year: 1978, liunian_list: makeLiunianList(1969, 10, 3) },
  { gan: '丙', zhi: '戌', start_age: 13, end_age: 22,  start_year: 1979, end_year: 1988, liunian_list: makeLiunianList(1979, 10, 13) },
  { gan: '乙', zhi: '酉', start_age: 23, end_age: 32,  start_year: 1989, end_year: 1998, liunian_list: makeLiunianList(1989, 10, 23) },
  { gan: '甲', zhi: '申', start_age: 33, end_age: 42,  start_year: 1999, end_year: 2008, liunian_list: makeLiunianList(1999, 10, 33) },
  { gan: '癸', zhi: '未', start_age: 43, end_age: 52,  start_year: 2009, end_year: 2018, liunian_list: makeLiunianList(2009, 10, 43) },
  { gan: '壬', zhi: '午', start_age: 53, end_age: 62,  start_year: 2019, end_year: 2028, liunian_list: makeLiunianList(2019, 10, 53) },
  { gan: '辛', zhi: '巳', start_age: 63, end_age: 72,  start_year: 2029, end_year: 2038, liunian_list: makeLiunianList(2029, 10, 3) },
  { gan: '庚', zhi: '辰', start_age: 73, end_age: 82,  start_year: 2039, end_year: 2048, liunian_list: makeLiunianList(2039, 10, 13) },
  { gan: '己', zhi: '卯', start_age: 83, end_age: 92,  start_year: 2049, end_year: 2058, liunian_list: makeLiunianList(2049, 10, 23) },
  { gan: '戊', zhi: '寅', start_age: 93, end_age: 102, start_year: 2059, end_year: 2068, liunian_list: makeLiunianList(2059, 10, 33) },
]
const profile60 = {
  ...profile,
  birth_date: '1966-05-15',
  bazi_detail: {
    ...profile.bazi_detail,
    matrix: {
      ...profile.bazi_detail.matrix,
      current_dayun: { gan: '壬', zhi: '午', shi_shen: '比肩', start_age: 53, end_age: 62, start_year: 2019, end_year: 2028 },
      current_liunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '偏印' },
      dayun_list: DAYUN_LIST_60,
      // 注意：故意不设顶层 liunian_list，模拟 baziLocalMatrix.mjs 真实输出
    }
  }
}

test('liunian传参：顶层matrix.liunian_list不存在时，自动从dayun_list嵌套展平', () => {
  const result = extractBaziAnalysisParams(profile60, { analysis_mode: 'timing' })
  assert.equal(result.ok, true)
  // 修复后：从 dayun_list[i].liunian_list 展平，总数 = DAYUN_LIST_60 各项 liunian_list 之和
  const expectedCount = DAYUN_LIST_60.reduce((sum, d) => sum + (d.liunian_list?.length || 0), 0)
  assert.equal(result.params.liunianList.length, expectedCount,
    `应展平得到 ${expectedCount} 个流年，实际 ${result.params.liunianList.length}`)
  assert.ok(result.params.liunianList.every(l => Number.isFinite(l.year)), '每个流年应有 year 字段')
  assert.equal(result.params.dayunList.length, DAYUN_LIST_60.length)
  assert.equal(result.params.birthYear, 1966)
})

test('liunian传参：liunianList为空时resolveCandidateYears按年份推算干支兜底（历史年/无列表也能算刑冲）', () => {
  const { yearToGanZhi } = require('./baziQuestionCore')
  const baseArgs = { currentYear: 2026, liunianList: [], dayunList: DAYUN_LIST_60, birthYear: 1966 }

  const scopes = [
    { type: 'current_year',   start_year: 2026, end_year: 2026 },
    { type: 'next_3_years',   start_year: 2026, end_year: 2028 },
    { type: 'next_5_years',   start_year: 2026, end_year: 2030 },
    { type: 'next_10_years',  start_year: 2026, end_year: 2035 },
    { type: 'specified_range', start_year: 2015, end_year: 2015 }, // 历史单年（如"2015高考"）
    { type: 'specified_range', start_year: 2026, end_year: 2046 }, // 60-80岁展开结果
  ]

  for (const scope of scopes) {
    const result = resolveCandidateYears({ ...baseArgs, timeScope: scope })
    const expectedLen = scope.end_year - scope.start_year + 1
    assert.equal(result.years.length, expectedLen,
      `time_scope.type=${scope.type} 应返回 ${expectedLen} 个候选年，但得到 ${JSON.stringify(result.years)}`)
    for (const item of result.years) {
      const gz = yearToGanZhi(item.year)
      assert.equal(item.source, 'computed')
      assert.equal(item.gan, gz.gan)
      assert.equal(item.zhi, gz.zhi)
    }
    assert.ok(result.limitations.some(l => l.includes('推算')),
      `time_scope.type=${scope.type} 应标注按年份推算的 limitation，但得到 ${JSON.stringify(result.limitations)}`)
  }
})

test('liunian传参：晚年60-80岁 specified_range resolveConcreteTimeScope 正确展开年份', () => {
  const { resolveConcreteTimeScope } = require('./baziQuestionCore')
  // LLM路由识别到"60-80岁"后生成 specified_range，birthYear=1966，currentLiunian.year=2026
  const scope = resolveConcreteTimeScope(
    { type: 'specified_range', start_age: 60, end_age: 80 },
    2026,
    { analysisMode: 'timing', birthYear: 1966 }
  )
  assert.equal(scope.type, 'specified_range')
  assert.equal(scope.start_year, 2026)  // max(2026, 1966+60=2026) = 2026
  assert.equal(scope.end_year, 2046)    // 1966+80 = 2046
  assert.equal(scope.source, 'age_range')
  // 正常展开时 limitations 字段不存在（undefined）或为空
  assert.ok(!scope.limitations?.length, `不应有 limitations，实际: ${JSON.stringify(scope.limitations)}`)
})

test('liunian传参：修复后晚年timing pipeline正确扫描60-80岁候选年', () => {
  const params = {
    ...extractBaziAnalysisParams(profile60, { analysis_mode: 'timing' }).params,
    currentLiunian: { gan: '丙', zhi: '午', year: 2026, shi_shen: '食神' }
  }
  const result = runTimingPipeline(
    params,
    {
      branch: 'bazi',
      category: 'health_aging',
      subcategory: 'life_longevity',
      analysis_mode: 'timing',
      time_scope: { type: 'specified_range', start_age: 60, end_age: 80 }
    }
  )
  // 修复后应有候选年（2026-2046 共21年）
  assert.ok(result.scanned_years.length > 0, `应有扫描年份，实际: ${JSON.stringify(result.scanned_years)}`)
  assert.ok(result.scanned_years.includes(2026), '应包含2026')
  assert.ok(result.scanned_years.includes(2039), '应包含2039（庚辰大运起始年）')
  assert.ok(result.scanned_years.includes(2046), '应包含2046（80岁）')
  assert.ok(!result.limitations.some(l => l.includes('流年列表不足')), '不应再有流年不足 limitation')
})

test('liunian传参：从嵌套dayun_list[i].liunian_list展平后，resolveCandidateYears正确返回60-80岁候选年', () => {
  // 模拟修复后行为：将 dayun_list 中嵌套的 liunian_list 展平为顶层列表
  const flatLiunianList = DAYUN_LIST_60.flatMap(d => d.liunian_list || [])

  const scope = { type: 'specified_range', start_year: 2026, end_year: 2046 }
  const result = resolveCandidateYears({
    timeScope: scope,
    currentYear: 2026,
    liunianList: flatLiunianList,
    dayunList: DAYUN_LIST_60,
    birthYear: 1966
  })

  const years = result.years.map(y => y.year)
  assert.ok(years.length > 0, '展平后应有候选年份')
  assert.ok(years.every(y => y >= 2026 && y <= 2046), `年份应在2026-2046范围，实际: ${years}`)
  assert.equal(years[0], 2026)
  assert.equal(years[years.length - 1], 2046)
  assert.equal(years.length, 21, `应有21个年份(2026-2046)，实际: ${years.length}`)
  // 每个年份有大运关联
  assert.ok(result.years.every(y => y.dayun_hint?.gan), '每个候选年应有大运干关联')
  // 大运边界正确
  const y2029 = result.years.find(y => y.year === 2029)
  assert.equal(y2029?.dayun_hint?.gan, '辛', '2029年应在辛巳大运')
  const y2039 = result.years.find(y => y.year === 2039)
  assert.equal(y2039?.dayun_hint?.gan, '庚', '2039年应在庚辰大运')
})

test('liunian传参：修复后profile_driven晚年prompt大运序列中流年明细正确出现', () => {
  // 问题中不含具体年龄数字，保持 profile_driven 不被覆盖
  const { prompt } = buildBaziQuestionPrompt({
    profile: profile60,
    question: '我进入晚年之后整体运势怎么样，有没有什么值得期待的人生阶段？',
    route: {
      branch: 'bazi',
      category: 'health_aging',
      subcategory: 'life_longevity',
      analysis_mode: 'profile_driven'
    }
  })

  assert.match(prompt, /profile_driven/)
  assert.match(prompt, /大运序列/)
  // 有岁数区间
  assert.match(prompt, /63[–\-]72岁|63.{0,3}72岁/)
  assert.match(prompt, /73[–\-]82岁|73.{0,3}82岁/)
  // 修复后：流年年份明细应出现（从嵌套 liunian_list 展平）
  assert.match(prompt, /2029/, '修复后2029流年应出现在prompt中')
  assert.match(prompt, /2039/, '修复后2039流年应出现在prompt中')
})

test('liunian传参：修复后"60岁后...80岁前"被正确识别为60-80岁范围并扫描完整候选年', () => {
  // Bug1修复：ageAfterMatch("60岁后") + ageBeforeMatch("80岁前") 合并为 start_age:60, end_age:80
  // Bug2修复：liunianList 从嵌套展平，有候选年
  const { prompt, pipelineResult } = buildBaziQuestionPrompt({
    profile: profile60,
    question: '我60岁后的晚年状态怎么样，80岁前有没有什么值得期待的时机？',
    route: {
      branch: 'bazi',
      category: 'health_aging',
      subcategory: 'life_longevity',
      analysis_mode: 'profile_driven'
    }
  })

  // 路由到 timing
  assert.match(prompt, /analysis_mode: timing/)
  // time_scope 展开为 2026-2046（1966+60=2026, 1966+80=2046）
  assert.match(prompt, /time_scope:.*specified_range.*2026.*2046|time_scope:.*2026-2046/)
  // scanned_years 覆盖到 80 岁区间
  assert.ok(pipelineResult?.scanned_years?.includes(2039), `2039应在scanned_years，实际: ${JSON.stringify(pipelineResult?.scanned_years)}`)
  assert.ok(pipelineResult?.scanned_years?.includes(2046), `2046应在scanned_years，实际: ${JSON.stringify(pipelineResult?.scanned_years)}`)
  assert.ok(!pipelineResult?.limitations?.some(l => l.includes('流年列表不足')), '不应有流年不足limitation')
})

// ── resolveBackendTargetSpec 用神升级：无靶 + 置信不高 ──────────────────
test('resolveBackendTargetSpec: category-level empty primary_shishen 自动升级为 yongshen', () => {
  // health_action 在 category 级 primary_shishen=[]，同样会导致引擎 damaged
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'timing' });
  const route = { category: 'health_action', subcategory: '', confidence: 'medium' };
  const spec = resolveBackendTargetSpec(params, route);
  assert.equal(spec.anchor_kind, 'yongshen', 'empty primary_shishen at category level → yongshen');
  assert.equal(spec.fallback_level, 'yongshen');
  assert.ok(spec.primary_shishen.length > 0, '用神十神填入 primary_shishen');
});

test('resolveBackendTargetSpec: 路由置信度 low 且未匹配 subcategory 时升级为 yongshen', () => {
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'timing' });
  // career_business 在 category 级有 primary_shishen（非空），但置信度低时也应升级
  const route = { category: 'career_business', subcategory: '', confidence: 'low' };
  const spec = resolveBackendTargetSpec(params, route);
  assert.equal(spec.anchor_kind, 'yongshen', 'low confidence non-subcategory → yongshen');
  assert.equal(spec.fallback_level, 'yongshen');
});

test('resolveBackendTargetSpec: 置信度 low 但已匹配到 subcategory 时保留 subcategory 目标', () => {
  const { params } = extractBaziAnalysisParams(profile, { analysis_mode: 'timing' });
  // subcategory 匹配是最可靠的结果，即使 confidence=low 也保留（稀有情况，不能更差了）
  // career_direction 是真实 subcategory，会返回 fallback_level='subcategory'
  const route = { category: 'career_business', subcategory: 'career_direction', confidence: 'low' };
  const spec = resolveBackendTargetSpec(params, route);
  assert.equal(spec.fallback_level, 'subcategory', 'subcategory match retained even with low confidence');
  assert.notEqual(spec.anchor_kind, 'yongshen');
});

// ── Phase 7：路由原生双轴 — normalize 优先显式 target_source ──────────────
test('Phase 7: 路由显式 target_source 被采用,任意 framework 可锚用神', () => {
  const { buildBaziSemanticRoutePrompt } = require('./divinationRouter')
  // 路由 prompt 声明了 B 轴
  const p = buildBaziSemanticRoutePrompt('x', {})
  assert.match(p, /目标来源 target_source/)
  assert.match(p, /"target_source": "backend_shishen\|yongshen\|llm_derived"/)
  // 显式 yongshen 优先于 migrate（status 默认本会推 backend_shishen）
  const r = normalizeBaziSemanticRoute({ analysis_mode: 'status', target_source: 'yongshen' })
  assert.equal(r.target_source, TARGET_SOURCE.YONGSHEN)
  assert.equal(r.framework, FRAMEWORK.DYNAMIC_CURRENT)
  // 无显式 target_source → 旧 migrate 兜底
  assert.equal(normalizeBaziSemanticRoute({ analysis_mode: 'profile_driven' }).target_source, TARGET_SOURCE.YONGSHEN)
  assert.equal(normalizeBaziSemanticRoute({ analysis_mode: 'status' }).target_source, TARGET_SOURCE.BACKEND_SHISHEN)
})
