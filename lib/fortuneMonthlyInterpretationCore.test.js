const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MONTHLY_INTERPRETATION_PROMPT_VERSION,
  normalizeDimension,
  buildMonthlyInterpretationPrompt,
  buildMonthlyInterpretationPeriodKey,
  parseModelJson,
  pickMonthlyInterpretationFields,
  mergeMonthlyInterpretation,
  hasReadyMonthlyInterpretation,
} = require('./fortuneMonthlyInterpretationCore');

const profile = {
  gender: 'M',
  ri_zhu: '甲午',
  favorable_elements: ['印星', '比劫'],
  unfavorable_elements: ['食伤'],
};

const monthlyData = {
  period_key: '2026-05-05',
  flow_month_label: '癸巳月',
  flow_month_range_label: '5月5日 - 6月4日',
  flow_month_start_date: '2026-05-05',
  flow_month_end_date: '2026-06-04',
  context_month_key: '2026-05',
  monthly_score: 83,
  layer1_score: 18,
  layer2_score: -3,
  layer3_score: 10,
  transit_support_score: 2,
  month_gz: '壬辰',
  dayun_gz: '己未',
  liunian_gz: '丙午',
  month_gan_shishen: '偏印',
  month_relations: '流月地支[辰]与命主日支[戌]六冲（冲忌仇，冲罚减半）',
  month_wuxing: '土',
  month_wuxing_relation: '闲',
  shishen_signals: {
    tianyi_active: false,
    wenchang_active: true,
    lu_active: false,
    yima_active: false,
    yima_favorable: false,
  },
  yuede_active: true,
  is_kongwang: false,
  has_sanxing: false,
  avg_daily_score: 62.4,
  high_score_days: 2,
  high_score_dates: ['2026-05-08', '2026-05-16'],
  low_score_days: 1,
  low_score_dates: ['2026-05-22'],
  best_date: '2026-05-16',
  best_score: 88,
  worst_date: '2026-05-22',
  worst_score: 52,
  trough_period: '',
  jieqi_list: ['立夏[5月5日]', '小满[5月21日]'],
};

const contextNotes = {
  profile_context: {
    career_profile: {
      current_status: '在职观望',
      industry: '互联网产品',
      level: '骨干',
      years: '3-5',
      goal: '转岗',
      pressure: '方向不明',
      note: '最近在评估是否离开当前团队。',
    },
    wealth_profile: {
      income_structure: '固定工资',
      stage: '收支平衡',
      style: '稳健',
      focus: '储蓄',
      risk: '冲动消费',
      note: '',
    },
    love_profile: {
      current_status: '单身',
      orientation: '同性',
      experience_stage: '1-2段',
      goal: '稳定关系',
      pattern: '慢热',
      note: '这一项当前只存档，不进 prompt。',
    },
    health_profile: {
      rhythm: '高压',
      body_state: '睡眠问题',
      focus: '作息调整',
      drain_source: '工作',
      note: '',
    },
  },
  current_monthly_context: {
    month_key: '2026-05',
    overall_note: '这个月正在同步推进求职和搬家。',
    career_monthly: { status: '面试中', summary: '已经进入终面阶段', goal: '拿到 offer', worry: '流程拖延' },
    wealth_monthly: { status: '花销增多', summary: '', goal: '', worry: '' },
    love_monthly: { status: '暂不关注', summary: '', goal: '', worry: '' },
    health_monthly: { status: '睡眠差', summary: '', goal: '', worry: '' },
  },
  recent_monthly_contexts: [
    {
      month_key: '2026-05',
      overall_note: '这个月正在同步推进求职和搬家。',
      career_monthly: { status: '面试中', summary: '已经进入终面阶段', goal: '拿到 offer', worry: '流程拖延' },
      wealth_monthly: { status: '花销增多', summary: '', goal: '', worry: '' },
      love_monthly: { status: '暂不关注', summary: '', goal: '', worry: '' },
      health_monthly: { status: '睡眠差', summary: '', goal: '', worry: '' },
      updated_at: '2026-05-05T12:00:00.000Z',
    },
    {
      month_key: '2026-04',
      overall_note: '',
      career_monthly: { status: '在职想走', summary: '', goal: '', worry: '' },
      wealth_monthly: { status: '收入平稳', summary: '', goal: '', worry: '' },
      love_monthly: { status: '单身想认识人', summary: '', goal: '', worry: '' },
      health_monthly: { status: '', summary: '', goal: '', worry: '' },
      updated_at: '2026-04-01T08:00:00.000Z',
    },
  ],
};

test('normalizeDimension accepts only monthly interpretation dimensions', () => {
  assert.equal(normalizeDimension('career'), 'career');
  assert.equal(normalizeDimension(''), 'overall');
  assert.throws(() => normalizeDimension('health'), /不支持/);
});

test('buildMonthlyInterpretationPrompt uses current layer ranges and selected dimension only', () => {
  const prompt = buildMonthlyInterpretationPrompt(profile, monthlyData, 'career', contextNotes);

  assert.match(prompt, /-30~\+30，占60%/);
  assert.match(prompt, /常规±5，结构性触发可至±10/);
  assert.match(prompt, /不把六十甲子自然轮动均分当作本月大势/);
  assert.match(prompt, /-15~\+15，占30%/);
  assert.match(prompt, /岁运承接分（transit_support_score）：2/);
  assert.match(prompt, /当前大运：己未/);
  assert.match(prompt, /当前流年：丙午/);
  assert.match(prompt, /流月范围：5月5日 - 6月4日/);
  assert.match(prompt, /判断依据融入规则/);
  assert.match(prompt, /few-shot 风格示例/);
  assert.match(prompt, /#### career（事业运）/);
  assert.match(prompt, /被看见、易推进的月份/);
  assert.match(prompt, /这个月在职场上是一个可以往前走的月份/);
  assert.match(prompt, /顺势而为就更容易有回响/);
  assert.match(prompt, /## 断事笔记/);
  assert.match(prompt, /长期基调（事业）：/);
  assert.match(prompt, /当前状态：在职观望/);
  assert.match(prompt, /当前月现状：/);
  assert.match(prompt, /本月总说明：这个月正在同步推进求职和搬家。/);
  assert.match(prompt, /事业：状态：面试中；现状：已经进入终面阶段；本月目标：拿到 offer；本月担心：流程拖延/);
  assert.match(prompt, /财务：状态：花销增多/);
  assert.match(prompt, /近3个月背景：/);
  assert.doesNotMatch(prompt, /orientation/);
  assert.doesNotMatch(prompt, /同性/);
  assert.doesNotMatch(prompt, /"basis":/);
  assert.match(prompt, /## 当前解读维度：career/);
  assert.match(prompt, /事业维度白话/);
  assert.doesNotMatch(prompt, /#### wealth（财运）/);
  assert.doesNotMatch(prompt, /#### love（爱情运）/);
  assert.doesNotMatch(prompt, /偏财驿马月份/);
  assert.doesNotMatch(prompt, /女命正官喜用月份/);
});

test('dimension-specific fewshots swap with dimension', () => {
  const wealthPrompt = buildMonthlyInterpretationPrompt(profile, monthlyData, 'wealth', contextNotes);
  const lovePrompt = buildMonthlyInterpretationPrompt({ ...profile, gender: 'F' }, monthlyData, 'love', contextNotes);

  assert.match(wealthPrompt, /#### wealth（财运）/);
  assert.match(wealthPrompt, /流动收益更顺的月份/);
  assert.doesNotMatch(wealthPrompt, /#### career（事业运）/);
  assert.doesNotMatch(wealthPrompt, /#### love（爱情运）/);

  assert.match(lovePrompt, /#### love（爱情运）/);
  assert.match(lovePrompt, /稳定关系更容易推进的月份/);
  assert.doesNotMatch(lovePrompt, /#### wealth（财运）/);
  assert.doesNotMatch(lovePrompt, /#### overall（综合运势）/);
});

test('buildMonthlyInterpretationPeriodKey is dimension and prompt-version specific', () => {
  assert.equal(
    buildMonthlyInterpretationPeriodKey('2026-05-05', 'profile-1', 'wealth', 'ctx:abc'),
    `2026-05-05::${MONTHLY_INTERPRETATION_PROMPT_VERSION}::wealth::ctx:abc::profile-1`
  );
});

test('parse and pick monthly interpretation fields', () => {
  const parsed = parseModelJson('```json\n{"dimension":"love","title":"标题","highlight":"重点","details":"正文","tags":["A","B","C","D"],"advice":[{"action":"约会","description":"5月8日前后安排轻松见面。"}]}\n```');
  const picked = pickMonthlyInterpretationFields(parsed);

  assert.equal(picked.dimension, 'love');
  assert.equal(picked.tags.length, 3);
  assert.equal(picked.advice.length, 1);
  assert.equal(picked.interpretation_status, 'ready');
  assert.equal(picked.interpretation_version, MONTHLY_INTERPRETATION_PROMPT_VERSION);
  assert.equal(hasReadyMonthlyInterpretation(picked), true);
});

test('mergeMonthlyInterpretation preserves engine score authority', () => {
  const merged = mergeMonthlyInterpretation(monthlyData, {
    monthly_score: 1,
    layer1_score: -99,
    title: '事业标题',
    highlight: '事业重点',
    details: '事业正文',
    tags: ['事业'],
    advice: [{ action: '汇报', description: '5月16日前后安排汇报。' }],
  }, 'career');

  assert.equal(merged.dimension, 'career');
  assert.equal(merged.monthly_score, 83);
  assert.equal(merged.layer1_score, 18);
  assert.equal(merged.title, '事业标题');
  assert.equal(merged.interpretation_version, MONTHLY_INTERPRETATION_PROMPT_VERSION);
});
