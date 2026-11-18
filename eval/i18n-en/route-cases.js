'use strict';

/**
 * i18n T3.6 英文提问路由评测集：40 条。
 * 每个一级分类（career/finance/relationship/health/item/exam/lawsuit/fengshui/pregnancy）至少 5 条中的大部分
 * 标为 qimen；另含 5 条应路由到八字、5 条应为综合（hybrid）。
 * expected.branch ∈ qimen | bazi | hybrid；expected.category 为一级分类 code。
 */
const CASES = [
  // ── career_business ──
  { id: 'en_c01', question: 'Will I pass tomorrow\'s job interview at the bank?', expected: { branch: 'qimen', category: 'career_business' } },
  { id: 'en_c02', question: 'Should I accept the offer from Company A or Company B?', expected: { branch: 'qimen', category: 'career_business' } },
  { id: 'en_c03', question: 'Will my boss approve my promotion this quarter?', expected: { branch: 'qimen', category: 'career_business' } },
  { id: 'en_c04', question: 'Is it a good idea to sign the partnership contract next Monday?', expected: { branch: 'qimen', category: 'career_business' } },
  { id: 'en_c05', question: 'Will the client renew our project this month?', expected: { branch: 'qimen', category: 'career_business' } },
  // ── finance_wealth ──
  { id: 'en_f01', question: 'Will my friend pay back the money he owes me this month?', expected: { branch: 'qimen', category: 'finance_wealth' } },
  { id: 'en_f02', question: 'Should I buy this stock this week?', expected: { branch: 'qimen', category: 'finance_wealth' } },
  { id: 'en_f03', question: 'Will my bonus come through before the end of the year?', expected: { branch: 'qimen', category: 'finance_wealth' } },
  { id: 'en_f04', question: 'Is now a good time to sell my crypto holdings?', expected: { branch: 'qimen', category: 'finance_wealth' } },
  { id: 'en_f05', question: 'Will the loan application be approved?', expected: { branch: 'qimen', category: 'finance_wealth' } },
  // ── relationship ──
  { id: 'en_r01', question: 'If I confess my feelings to her tomorrow, will she say yes?', expected: { branch: 'qimen', category: 'relationship' } },
  { id: 'en_r02', question: 'Will my ex reach out to me again?', expected: { branch: 'qimen', category: 'relationship' } },
  { id: 'en_r03', question: 'Is the person I met on the dating app serious about me?', expected: { branch: 'qimen', category: 'relationship' } },
  { id: 'en_r04', question: 'We had a big fight last night. Can we make up this week?', expected: { branch: 'qimen', category: 'relationship' } },
  { id: 'en_r05', question: 'Will my boyfriend propose this year?', expected: { branch: 'qimen', category: 'relationship' } },
  // ── health_action ──
  { id: 'en_h01', question: 'Will my surgery next week go smoothly?', expected: { branch: 'qimen', category: 'health_action' } },
  { id: 'en_h02', question: 'Is it safe for me to travel to Japan next month?', expected: { branch: 'qimen', category: 'health_action' } },
  { id: 'en_h03', question: 'Will my mother recover quickly from her illness?', expected: { branch: 'qimen', category: 'health_action' } },
  // ── item_transaction ──
  { id: 'en_i01', question: 'I lost my wallet yesterday. Can I find it?', expected: { branch: 'qimen', category: 'item_transaction' } },
  { id: 'en_i02', question: 'Will the buyer go through with purchasing my car?', expected: { branch: 'qimen', category: 'item_transaction' } },
  // ── exam_study ──
  { id: 'en_e01', question: 'Will I pass the bar exam this July?', expected: { branch: 'qimen', category: 'exam_study' } },
  { id: 'en_e02', question: 'Will I get into the master\'s program I applied to?', expected: { branch: 'qimen', category: 'exam_study' } },
  // ── lawsuit_legal ──
  { id: 'en_l01', question: 'Someone sued me. Will I win the case?', expected: { branch: 'qimen', category: 'lawsuit_legal' } },
  { id: 'en_l02', question: 'Will my visa dispute with the immigration office be resolved in my favor?', expected: { branch: 'qimen', category: 'lawsuit_legal' } },
  // ── fengshui_house ──
  { id: 'en_x01', question: 'Should I sign the lease for the apartment I saw today?', expected: { branch: 'qimen', category: 'fengshui_house' } },
  { id: 'en_x02', question: 'Is this a good month to move into my new house?', expected: { branch: 'qimen', category: 'fengshui_house' } },
  // ── pregnancy_birth ──
  { id: 'en_p01', question: 'Will we conceive a baby this year?', expected: { branch: 'qimen', category: 'pregnancy_birth' } },
  { id: 'en_p02', question: 'Will my wife\'s delivery next month go well?', expected: { branch: 'qimen', category: 'pregnancy_birth' } },
  { id: 'en_p03', question: 'Is the IVF transfer next week likely to succeed?', expected: { branch: 'qimen', category: 'pregnancy_birth' } },
  { id: 'en_p04', question: 'When is the best time this year for us to try for a second child?', expected: { branch: 'qimen', category: 'pregnancy_birth' } },
  // ── bazi（长期、命局）──
  { id: 'en_b01', question: 'What kind of career suits me best over the next ten years?', expected: { branch: 'bazi', category: 'career_business' } },
  { id: 'en_b02', question: 'Looking at my whole life, when will my wealth peak?', expected: { branch: 'bazi', category: 'finance_wealth' } },
  { id: 'en_b03', question: 'Which year in the next five years am I most likely to get married?', expected: { branch: 'bazi', category: 'relationship' } },
  { id: 'en_b04', question: 'What does my Bazi chart say about my health in the long run?', expected: { branch: 'bazi', category: 'health_action' } },
  { id: 'en_b05', question: 'Am I better suited to starting a business or working for a company?', expected: { branch: 'bazi', category: 'career_business' } },
  // ── hybrid（宏观背景 + 眼前事）──
  { id: 'en_y01', question: 'My career luck has been bad this year. Should I take the job offer I got today?', expected: { branch: 'hybrid', category: 'career_business' } },
  { id: 'en_y02', question: 'This year is supposed to be a weak money year for me. Should I invest in this deal now?', expected: { branch: 'hybrid', category: 'finance_wealth' } },
  { id: 'en_y03', question: 'Given my overall love luck this year, will this new relationship last?', expected: { branch: 'hybrid', category: 'relationship' } },
  { id: 'en_y04', question: 'I am in a tough decade of luck. Is now the right time to quit and start my own company?', expected: { branch: 'hybrid', category: 'career_business' } },
  { id: 'en_y05', question: 'My health has been fragile this year. Should I go ahead with the operation next month?', expected: { branch: 'hybrid', category: 'health_action' } },
];

module.exports = { CASES };
