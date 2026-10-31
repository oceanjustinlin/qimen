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
