'use strict';

/**
 * D2 路由预判数据集（假设 skill 已触发，只评问题→analysis_mode/time_scope）。
 * expected.analysis_mode ∈ timing | status | pattern | character
 * expected.time_scope_type：timing/status 才标；取值 current_year / next_3_years /
 *   next_5_years / next_10_years / specific（带具体年份）/ null（不限时间）。
 * 人工标注以「问题最主要诉求」为准；边界用例标 note 说明。
 */

const CASES = [
  // ── timing：问「何时/哪年」──────────────────────────────────────────────
  { id: 'r_tm_01', question: '我什么时候能升职？', expected: { analysis_mode: 'timing', time_scope_type: null } },
  { id: 'r_tm_02', question: '未来五年哪一年最适合创业？', expected: { analysis_mode: 'timing', time_scope_type: 'next_5_years' } },
  { id: 'r_tm_03', question: '我哪一年会结婚？', expected: { analysis_mode: 'timing', time_scope_type: null } },
  { id: 'r_tm_04', question: '近三年财运哪一年最好？', expected: { analysis_mode: 'timing', time_scope_type: 'next_3_years' } },
  { id: 'r_tm_05', question: '2027年我的事业运怎么样？', expected: { analysis_mode: 'timing', time_scope_type: 'specific' } },
  { id: 'r_tm_06', question: '今年下半年换工作能成吗？', expected: { analysis_mode: 'timing', time_scope_type: 'current_year' } },
  { id: 'r_tm_07', question: '未来十年我哪个阶段财运最旺？', expected: { analysis_mode: 'timing', time_scope_type: 'next_10_years' } },
  { id: 'r_tm_08', question: '我什么时候会有一次大的事业机会？', expected: { analysis_mode: 'timing', time_scope_type: null } },
  { id: 'r_tm_09', question: '明年适合买房吗，哪个月比较好？', expected: { analysis_mode: 'timing', time_scope_type: 'specific' } },
  { id: 'r_tm_10', question: '接下来五年感情上哪年最容易脱单？', expected: { analysis_mode: 'timing', time_scope_type: 'next_5_years' } },
  { id: 'r_tm_11', question: '我这几年会不会有官司或者破财，哪年要小心？', expected: { analysis_mode: 'timing', time_scope_type: null } },
  { id: 'r_tm_12', question: '2026到2030这几年事业怎么起伏？', expected: { analysis_mode: 'timing', time_scope_type: 'specific' } },

  // ── status：问「当下/近期这件事怎么样」（不强调具体哪年）──────────────────
  { id: 'r_st_01', question: '我今年整体状态怎么样？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_02', question: '现在这份工作还能不能继续做下去？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_03', question: '我最近适不适合投资？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_04', question: '我当前的事业运势如何？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_05', question: '现在这段感情能走到最后吗？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_06', question: '我今年的财运好不好？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_07', question: '眼下要不要辞职创业，命理上支持吗？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },
  { id: 'r_st_08', question: '我现在的身体健康状态从命盘看有什么要注意的？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' } },

  // ── pattern：问格局/命局结构 ────────────────────────────────────────────
  { id: 'r_pt_01', question: '我是什么格局？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_02', question: '我的命局成格了吗？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_03', question: '帮我分析下我命局的整体结构', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_04', question: '我这个是不是正官格，用神是什么？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_05', question: '我的八字身强身弱，喜忌怎么定？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_06', question: '我命里食神制杀成立吗？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_07', question: '我这个八字算不算从格？', expected: { analysis_mode: 'pattern', time_scope_type: null } },
  { id: 'r_pt_08', question: '帮我看看我命局的核心特点和层次高低', expected: { analysis_mode: 'pattern', time_scope_type: null } },

  // ── character：问性格/才性/适合方向 ─────────────────────────────────────
  { id: 'r_ch_01', question: '我的性格怎么样？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_02', question: '从命理看我适合创业还是打工？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_03', question: '我这个人有什么才性和天赋？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_04', question: '我为人处世上有什么优点和短板？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_05', question: '我适合做管理岗还是做专业技术？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_06', question: '我的思维方式偏理性还是偏感性？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_07', question: '从八字看我在感情里是什么样的人？', expected: { analysis_mode: 'character', time_scope_type: null } },
  { id: 'r_ch_08', question: '我天生适合什么样的行业方向？', expected: { analysis_mode: 'character', time_scope_type: null } },

  // ── 已知易混：status ↔ timing 边界 ─────────────────────────────────────
  { id: 'r_mix_01', question: '今年到明年我换工作能成吗？', expected: { analysis_mode: 'timing', time_scope_type: 'next_3_years' }, note: '跨年+能否成→偏应期；启发式常判 status' },
  { id: 'r_mix_02', question: '我最近这两年运势起伏大吗，哪年是低谷？', expected: { analysis_mode: 'timing', time_scope_type: 'next_3_years' }, note: '「哪年低谷」是应期诉求' },
  { id: 'r_mix_03', question: '我现在适合动还是该稳住？', expected: { analysis_mode: 'status', time_scope_type: 'current_year' }, note: '当下决策，非具体哪年' },
];

module.exports = { CASES };
