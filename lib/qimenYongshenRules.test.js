const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDomainViewPromptSection,
  buildYongshenPromptSection,
  getYongshenRule
} = require('./qimenYongshenRules');

test('career business rule requires layered core yongshen', () => {
  const rule = getYongshenRule('career_business');

  assert.equal(rule.category, 'career_business');
  assert.equal(rule.ruleset, 'mainline-cn-v1/book-buchuiniu-ch22-v1');

  const primarySymbols = rule.yongshen.primary.map((item) => item.symbol);
  assert.deepEqual(primarySymbols, ['日干', '开门', '值符']);

  assert.match(rule.judgmentOrder.join('\n'), /本人/);
  assert.match(rule.judgmentOrder.join('\n'), /岗位/);
  assert.match(rule.judgmentOrder.join('\n'), /领导/);
});

test('career business prompt injects yongshen protocol and omits year life without bazi', () => {
  const rule = getYongshenRule('career_business');
  const section = buildYongshenPromptSection({
    intent: { category: 'career_business', subcategory: 'job_change', confidence: 'high' },
    rule,
    hasBaziInfo: false
  });

  assert.match(section, /精准定用神：事业职场/);
  assert.match(section, /日干：求测人本人/);
  assert.match(section, /开门：职位、岗位、事业机会、工作平台/);
  assert.match(section, /值符：领导、高层、核心决策人、权力资源/);
  assert.doesNotMatch(section, /年命：求测人长期职业根基/);
  assert.match(section, /核心用神至少覆盖以下之一/);
  assert.doesNotMatch(section, /score_audit\.adjustments|analysis\.yong_shen|评分硬约束/);
});

test('career business prompt includes year life when bazi info is present', () => {
  const rule = getYongshenRule('career_business');
  const section = buildYongshenPromptSection({
    intent: { category: 'career_business' },
    rule,
    hasBaziInfo: true
  });

  assert.match(section, /年命：求测人长期职业根基与关键成败承载点/);
  assert.match(section, /若有年命，必须说明年命落宫对长期职业判断的影响/);
});

test('unknown category falls back to general rule', () => {
  const rule = getYongshenRule('not_a_domain');

  assert.equal(rule.category, 'general');
  assert.match(rule.label, /日常/);
});

test('relationship and finance rules expose domain specific yongshen axes', () => {
  const relationship = getYongshenRule('relationship');
  const finance = getYongshenRule('finance_wealth');

  assert.deepEqual(relationship.yongshen.primary.map((item) => item.symbol), ['乙', '庚', '六合']);
  assert.deepEqual(finance.yongshen.primary.map((item) => item.symbol), ['戊', '生门', '日干', '时干']);
});

test('finance debt repayment subcategory overrides generic wealth yongshen', () => {
  const rule = getYongshenRule('finance_wealth', 'debt_repayment');

  assert.equal(rule.category, 'finance_wealth');
  assert.equal(rule.subcategory, 'debt_repayment');
  assert.match(rule.label, /催收回款/);
  assert.deepEqual(rule.yongshen.primary.map((item) => item.symbol), ['值符', '天乙', '伤门']);
  assert.match(rule.judgmentOrder.join('\n'), /值符克天乙/);

  const section = buildYongshenPromptSection({
    intent: { category: 'finance_wealth', subcategory: 'debt_repayment', confidence: 'high' },
    rule,
    hasBaziInfo: false
  });

  assert.match(section, /精准定用神：借贷讨债\/催收回款/);
  assert.match(section, /值符：债主、银行、放贷人/);
  assert.match(section, /天乙：借款人、欠债人/);
  assert.match(section, /伤门：讨债人、催收动作/);
  assert.match(section, /生门：利息、回款通道/);
});

test('subcategory lookup falls back to main category when unknown', () => {
  const mainRule = getYongshenRule('finance_wealth');
  const fallbackRule = getYongshenRule('finance_wealth', 'unknown_subcategory');

  assert.equal(fallbackRule.label, mainRule.label);
  assert.equal(fallbackRule.subcategory, undefined);
});

test('career and relationship subcategories inject scenario-specific requirements', () => {
  const promotion = getYongshenRule('career_business', 'promotion_title');
  const onlineRomance = getYongshenRule('relationship', 'online_romance');

  assert.equal(promotion.subcategory, 'promotion_title');
  assert.match(promotion.outputRequirements.analysisYongshenMustMention.join('\n'), /天辅星/);

  assert.equal(onlineRomance.subcategory, 'online_romance');
  assert.ok(onlineRomance.yongshen.primary.some((item) => item.symbol === '景门'));
  assert.ok(onlineRomance.yongshen.primary.some((item) => item.symbol === '玄武'));
});

test('domain axes prompt feeds differentiated M2 yongshen cards', () => {
  const careerSection = buildDomainViewPromptSection(getYongshenRule('career_business'));
  const relationshipSection = buildDomainViewPromptSection(getYongshenRule('relationship'));
  const financeSection = buildDomainViewPromptSection(getYongshenRule('finance_wealth'));

  assert.match(careerSection, /M2 领域用神卡片规则/);
  assert.match(careerSection, /每个 axis 一张/);
  assert.doesNotMatch(careerSection, /domain_view|后端/);
  assert.match(careerSection, /本人状态/);
  assert.match(careerSection, /岗位机会/);
  assert.match(careerSection, /领导态度/);

  assert.match(relationshipSection, /女方状态/);
  assert.match(relationshipSection, /男方状态/);
  assert.match(relationshipSection, /婚姻整体/);

  assert.match(financeSection, /本金资金/);
  assert.match(financeSection, /利润收益/);
  assert.match(financeSection, /对方\/货物/);
});
