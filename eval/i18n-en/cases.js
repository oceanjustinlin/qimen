'use strict';

/**
 * i18n T3.7 英文输出质量评测：20 个固定用例（奇门 8、八字问事 5、八字档案 3、日运 2、月运 2）。
 * 奇门用固定起局时间（panTime），结果可复现；八字 / 运势用测试档案（EVAL_PROFILE_ID）。
 * zhLimits：各段中文字数上限（取自 lib/qimenPromptSections.js 与 lib/baziQuestionCore.js），长度检查用。
 */
const QIMEN_LIMITS = {
  conclusion: 80, subject_reading: 140, target_reading: 140, environment_reading: 150,
  support_summary: 90, constraint_summary: 90, decision_reading: 140,
};

const qimen = (id, question, panTime) => ({ id, kind: 'qimen', question, panTime, zhLimits: QIMEN_LIMITS });
const baziQ = (id, question) => ({ id, kind: 'bazi_question', question, zhLimits: {} });

const CASES = [
  qimen('q01', 'Will I pass tomorrow\'s job interview?', '2026-03-12 10:20'),
  qimen('q02', 'Should I accept the offer from Company A or Company B?', '2026-04-03 15:05'),
  qimen('q03', 'Will my friend pay back the money he owes me this month?', '2026-05-21 09:40'),
  qimen('q04', 'If I confess my feelings to her this weekend, will she say yes?', '2026-06-08 20:15'),
  qimen('q05', 'Someone sued me. Will I win the case?', '2026-07-17 11:30'),
  qimen('q06', 'I lost my wallet yesterday. Can I find it?', '2026-08-02 18:45'),
  qimen('q07', 'Will my surgery next week go smoothly?', '2026-09-14 07:50'),
  qimen('q08', 'Is this a good month to move into my new apartment?', '2026-10-25 13:10'),
  baziQ('b01', 'How will my career develop over the next three years?'),
  baziQ('b02', 'Which year in the next five years is best for buying a home?'),
  baziQ('b03', 'What is my current state in love and relationships?'),
  baziQ('b04', 'What kind of person am I, according to my chart?'),
  baziQ('b05', 'What is the overall structure of my chart, and what does it favour?'),
  { id: 'p01', kind: 'bazi_profile', zhLimits: {} },
  { id: 'p02', kind: 'bazi_profile', zhLimits: {} },
  { id: 'p03', kind: 'bazi_profile', zhLimits: {} },
  { id: 'd01', kind: 'fortune_daily', target_date: '2026-11-20', zhLimits: {} },
  { id: 'd02', kind: 'fortune_daily', target_date: '2026-11-21', zhLimits: {} },
  { id: 'm01', kind: 'fortune_monthly', dimension: 'career', zhLimits: {} },
  { id: 'm02', kind: 'fortune_monthly', dimension: 'love', zhLimits: {} },
];

module.exports = { CASES, QIMEN_LIMITS };
