const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBaziSemanticRoutePrompt,
  classifyDivinationQuestion,
  classifyByRules,
  ruleRouteHint,
  buildLlmRoutePrompt
} = require('./divinationRouter');

test('classifyByRules routes long-term career fit to bazi with shared category tree', () => {
  const result = classifyByRules('我未来五年适合创业还是打工，适合什么行业？');

  assert.equal(result.branch, 'bazi');
  assert.equal(result.category, 'career_business');
  assert.equal(result.subcategory, 'entrepreneurship_vs_job');
  assert.equal(result.confidence, 'high');
  assert.equal(result.needsBaziProfile, true);
});

test('classifyByRules routes concrete offer choice to qimen and qimen-compatible subcategory', () => {
  const result = classifyByRules('A公司和B公司的offer我该选哪个？');

  assert.equal(result.branch, 'qimen');
  assert.equal(result.category, 'career_business');
  assert.equal(result.subcategory, 'job_search');
  assert.equal(result.confidence, 'high');
});

test('classifyByRules routes macro context plus concrete event to hybrid', () => {
  const result = classifyByRules('我今年事业运不好，这个offer要不要接？');

  assert.equal(result.branch, 'hybrid');
  assert.equal(result.category, 'career_business');
  assert.equal(result.subcategory, 'current_job_change');
  assert.equal(result.needsBaziProfile, true);
  assert.equal(result.canFallbackToQimenOnly, true);
});

test('classifyByRules asks for clarification on vague questions', () => {
  const result = classifyByRules('帮我看看最近怎么样');

  assert.equal(result.branch, 'clarify');
  assert.equal(result.category, 'general');
  assert.equal(result.confidence, 'low');
  assert.match(result.followupQuestion, /长期趋势|具体事情/);
});

test('ruleRouteHint augments classifyByRules without replacing branch/category result', () => {
  const result = ruleRouteHint('我未来五年婚姻应期如何？');

  assert.equal(result.branch, 'bazi');
  assert.equal(result.branch_hint, result.branch);
  assert.equal(result.category, 'relationship');
  assert.equal(result.analysis_mode_hint, 'timing');
  assert.equal(result.needs_time_scan_hint, true);
  assert.equal(result.time_scope_hint.type, 'next_5_years');
});

test('classifyDivinationQuestion uses injected llm fallback when rules are low confidence', async () => {
  const result = await classifyDivinationQuestion({
    question: '事业如何',
    llmFallback: true,
    llmClassifier: async () => ({
      branch: 'bazi',
      category: 'career_business',
      subcategory: 'career_direction',
      confidence: 'medium',
      source: 'llm',
      reason: '询问事业趋势'
    })
  });

  assert.equal(result.branch, 'bazi');
  assert.equal(result.category, 'career_business');
  assert.equal(result.subcategory, 'career_direction');
  assert.equal(result.source, 'llm');
});

test('classifyDivinationQuestion can force qimen branch for legacy qimen endpoint fallback', async () => {
  const result = await classifyDivinationQuestion({
    question: '我未来五年事业如何？',
    forceBranch: 'qimen',
    llmFallback: false
  });

  assert.equal(result.branch, 'qimen');
  assert.equal(result.category, 'career_business');
});

test('buildLlmRoutePrompt constrains model to classification JSON only', () => {
  const prompt = buildLlmRoutePrompt('A和B选哪个？', { branch: 'qimen' });

  assert.match(prompt, /只做分类/);
  assert.match(prompt, /严格 JSON/);
  assert.match(prompt, /branch/);
  assert.match(prompt, /category/);
  assert.match(prompt, /subcategory/);
  assert.match(prompt, /career_business/);
});

test('buildBaziSemanticRoutePrompt constrains model to bazi analysis mode routing', () => {
  const prompt = buildBaziSemanticRoutePrompt('这个人是不是同性恋？', {
    branch: 'bazi',
    category: 'relationship',
    subcategory: '',
    analysis_mode_hint: 'character'
  });

  assert.match(prompt, /八字问答语义路由器/);
  assert.match(prompt, /analysis_mode/);
  assert.match(prompt, /target_resolution/);
  assert.match(prompt, /llm_derived/);
  assert.match(prompt, /性取向不能由八字可靠判定/);
  assert.match(prompt, /只返回 JSON/);
});

// ── i18n T3.6：英文提问的路由 ──
test('英文提问：一次快模型分类，结果经 normalize 后合法', async () => {
  const { classifyDivinationQuestion: classify } = require('./divinationRouter.js');
  const { isValidCategory } = require('./divinationCategories.js');
  let calls = 0;
  const route = await classify({
    question: 'Will I get the job offer from Acme this month?',
    llmClassifier: async () => { calls += 1; return { branch: 'qimen', category: 'career_business', subcategory: 'job_search', role: 'client', confidence: 'high', reason: '求职短期事件' }; },
  });
  assert.equal(calls, 1);
  assert.equal(route.source, 'llm');
  assert.equal(route.branch, 'qimen');
  assert.ok(isValidCategory(route.category));
});

test('英文提问：模型返回非法 code 时被 normalize 收回合法值', async () => {
  const { classifyDivinationQuestion: classify } = require('./divinationRouter.js');
  const { isValidCategory } = require('./divinationCategories.js');
  const route = await classify({ question: 'How is my love life going?', llmClassifier: async () => ({ branch: 'oracle', category: 'romance', subcategory: 'x' }) });
  assert.ok(['bazi', 'qimen', 'hybrid', 'clarify'].includes(route.branch));
  assert.ok(isValidCategory(route.category));
});

test('英文里明说 bazi / four pillars / qimen：大小写不敏感，且以明说为准', async () => {
  const { classifyDivinationQuestion: classify } = require('./divinationRouter.js');
  const stub = async () => ({ branch: 'qimen', category: 'career_business', subcategory: '', confidence: 'high' });
  assert.equal((await classify({ question: 'Read my BaZi for career next year', llmClassifier: stub })).branch, 'bazi');
  assert.equal((await classify({ question: 'What do my Four Pillars say about money?', llmClassifier: stub })).branch, 'bazi');
  const q = await classify({ question: 'Use QIMEN: should I sign tomorrow?', llmClassifier: async () => ({ branch: 'bazi', category: 'career_business' }) });
  assert.equal(q.branch, 'qimen');
});

test('含汉字的问题不受英文分支影响（规则高置信时不调模型）', async () => {
  const { classifyDivinationQuestion: classify } = require('./divinationRouter.js');
  let calls = 0;
  await classify({ question: '用八字看看我未来五年的事业发展', llmClassifier: async () => { calls += 1; return {}; } });
  assert.equal(calls, 0);
});

test('分类 prompt 说明问题可能是英文或繁体', () => {
  const { buildLlmRoutePrompt: build } = require('./divinationRouter.js');
  assert.match(build('Should I take the offer?', {}), /问题可能是英文或繁体中文，分类标准不变，reason 用中文写/);
});
