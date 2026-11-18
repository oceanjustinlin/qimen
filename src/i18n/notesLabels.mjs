// 断事笔记与长期 / 月度基调的显示适配器（i18n spec T2.5a）。
// 存储值（事件领域、性质、基调选项）一律保持中文原值，这里只换显示。
// 中文界面返回调用方给的原文（繁体交给展示层转换）；英文界面查下面的显式映射，查不到时回落原文。

const CATEGORY = {
  career: 'Career / study',
  wealth: 'Money / assets',
  relationship: 'Love / marriage',
  health: 'Health / mishaps',
  family_parent: 'Parents',
  family_spouse: 'Spouse',
  family_child: 'Children',
  family_sibling: 'Siblings',
}

const IMPACT = {
  1: 'Smooth / uplift',
  0: 'Steady / change',
  '-1': 'Rough / setback',
}

const PROFILE_SECTION = {
  career: 'Career baseline',
  wealth: 'Money baseline',
  love: 'Love baseline',
  health: 'Health & life baseline',
}

const MONTHLY_SECTION = {
  career: 'Career this month',
  wealth: 'Money this month',
  love: 'Love this month',
  health: 'Health & life this month',
}

const FIELD = {
  'career.current_status': 'Current status',
  'career.industry': 'Industry',
  'career.level': 'Role level',
  'career.years': 'Years working',
  'career.goal': 'Long-term aim',
  'career.pressure': 'Main pressure',
  'career.note': 'Extra notes',
  'wealth.income_structure': 'Income sources',
  'wealth.stage': 'Financial stage',
  'wealth.style': 'Money style',
  'wealth.focus': 'Current focus',
  'wealth.risk': 'Main risk',
  'wealth.note': 'Extra notes',
  'love.current_status': 'Relationship status',
  'love.orientation': 'Orientation (stored only for now)',
  'love.experience_stage': 'Experience',
  'love.goal': 'What you want',
  'love.pattern': 'Relationship pattern',
  'love.note': 'Extra notes',
  'health.rhythm': 'Daily rhythm',
  'health.body_state': 'Current state',
  'health.focus': 'Current focus',
  'health.drain_source': 'Main drain',
  'health.note': 'Extra notes',
}

const PLACEHOLDER = {
  'career.industry': 'e.g. internet products / education / finance',
  'career.note': 'e.g. weighing whether to leave my current team.',
  'wealth.note': 'e.g. this year is about clearing debt and building a cushion.',
  'love.note': 'e.g. long-term stability matters more to me than short-term spark.',
  'health.note': 'e.g. working on my sleep schedule and recovery lately.',
}

// i18n-ignore-start
const OPTION = {
  在职稳定: 'Employed, stable', 在职观望: 'Employed, looking around', 找工作: 'Job hunting', 待业: 'Between jobs',
  自由职业: 'Freelance', 创业: 'Running a startup', 学生: 'Student',
  执行: 'Individual contributor', 骨干: 'Senior / key member', 管理: 'Manager', 创始人: 'Founder', 其他: 'Other',
  求职: 'Find a job', 晋升: 'Promotion', 转岗: 'Change role', 转行: 'Change field', 稳住: 'Hold steady',
  创业扩张: 'Grow the business', 考试上岸: 'Pass an exam',
  上级: 'Boss', 同事: 'Colleagues', 方向不明: 'Unclear direction', 收入: 'Income', 无明显压力: 'No major pressure',
  固定工资: 'Fixed salary', 提成: 'Commission', 项目制: 'Project-based', 副业: 'Side hustle', 投资: 'Investing',
  家庭支持: 'Family support', 多来源: 'Multiple sources',
  刚起步: 'Just starting', 收支平衡: 'Breaking even', 有积蓄: 'Have savings', 现金流紧: 'Cash is tight', 负债中: 'In debt',
  保守: 'Conservative', 稳健: 'Balanced', 激进: 'Aggressive', 随缘: 'Go with the flow',
  开源: 'Earn more', 守财: 'Protect savings', 还债: 'Pay off debt', 储蓄: 'Save', 副业变现: 'Monetize a side hustle',
  冲动消费: 'Impulse spending', 人情支出: 'Social obligations', 现金流不稳: 'Unsteady cash flow', 投资波动: 'Investment swings', 暂无: 'None for now',
  单身: 'Single', 暧昧中: 'Something undefined', 稳定交往: 'Steady relationship', 已婚: 'Married', 分开中: 'Separating',
  离异: 'Divorced', 暂不填写: 'Prefer not to say',
  异性: 'Straight', 同性: 'Gay / lesbian', 双性: 'Bisexual', 泛性恋: 'Pansexual',
  母胎: 'Never dated', '1-2段': '1–2 relationships', '3段以上': '3 or more', 长期关系为主: 'Mostly long-term', 短期关系为主: 'Mostly short-term',
  脱单: 'Find a partner', 稳定关系: 'A stable relationship', 复合: 'Get back together', 看清关系: 'See it clearly', 暂不考虑: 'Not looking now',
  容易上头: 'Fall fast', 慢热: 'Slow to warm', 容易回避: 'Tend to avoid', 容易投入过多: 'Give too much',
  规律: 'Regular', 熬夜: 'Late nights', 高压: 'High pressure', 休整: 'Recovering', 混乱: 'Chaotic',
  稳定: 'Stable', 容易疲劳: 'Tire easily', 睡眠问题: 'Sleep trouble', 情绪波动: 'Mood swings', 慢性问题: 'Chronic issue',
  减压: 'Destress', 休息: 'Rest', 健身: 'Exercise', 作息调整: 'Fix my schedule', 情绪恢复: 'Emotional recovery',
  工作: 'Work', 感情: 'Love life', 家庭: 'Family', 财务: 'Money', 学业: 'Studies',
  面试中: 'Interviewing', 试用期: 'On probation', 在职想走: 'Employed, want out', 创业推进: 'Pushing the startup',
  备考中: 'Studying for an exam', 项目攻坚: 'Crunch on a project',
  收入平稳: 'Steady income', 花销增多: 'Spending more', 资金紧: 'Money is tight', 副业推进: 'Building a side hustle',
  大额支出月: 'Big-expense month', 投资观察期: 'Watching investments', 回款等待中: 'Waiting on payments',
  单身想认识人: 'Single, open to meeting someone', 有暧昧对象: 'Seeing someone', 冷战中: 'In a cold war', 刚分手: 'Just broke up',
  复合拉扯: 'On-and-off', 家庭催婚: 'Family pushing marriage', 暂不关注: 'Not a focus now',
  睡眠差: 'Poor sleep', 情绪恢复期: 'Emotional recovery', 出差奔波: 'Lots of travel', 身体稳定: 'Physically fine', 恢复锻炼: 'Back to exercise',
}
// i18n-ignore-end

const isEnglish = (locale) => locale === 'en-US'
const pick = (map, key, fallback, locale) => (isEnglish(locale) ? map[key] ?? fallback : fallback)

export const noteCategoryLabel = (value, fallback, locale) => pick(CATEGORY, value, fallback, locale)
export const noteImpactLabel = (value, fallback, locale) => pick(IMPACT, String(value), fallback, locale)
export const profileSectionTitle = (key, fallback, locale) => pick(PROFILE_SECTION, key, fallback, locale)
export const monthlySectionTitle = (key, fallback, locale) => pick(MONTHLY_SECTION, key, fallback, locale)
export const contextFieldLabel = (sectionKey, fieldKey, fallback, locale) => pick(FIELD, `${sectionKey}.${fieldKey}`, fallback, locale)
export const contextFieldPlaceholder = (sectionKey, fieldKey, fallback, locale) => pick(PLACEHOLDER, `${sectionKey}.${fieldKey}`, fallback, locale)
export const contextOptionLabel = (option, locale) => pick(OPTION, option, option, locale)

// 测试用：英文映射是否覆盖给定的全部选项
export function missingOptionLabels(options) {
  return options.filter((o) => !OPTION[o])
}
