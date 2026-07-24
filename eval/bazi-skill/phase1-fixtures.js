'use strict';

/**
 * Phase 1 忠实度检测器的确定性自证 fixtures。
 * 每例给定 (static, reading)，标注期望的硬矛盾数与类型集。
 * 覆盖：忠实(block/prose) · 身强弱翻转 · 用神=忌神 · 格局软不一致 · 从格不硬翻 · prose 兜底抽取。
 * 用于 `node run-phase1.mjs --selftest`，不依赖 API。
 */

// 复用一个典型 static：正印格 / 身强 / 用神七杀 / 忌神偏印
const STATIC_A = {
  geju: '正印格',
  strong_weak: '身强',
  five_shens: { yong: '七杀', xi: [], ji: ['偏印'], unfavorable: ['偏印'], favorable: ['七杀'] },
  unfavorable_gods: ['偏印'],
};
// 一个身弱盘
const STATIC_B = {
  geju: '七杀格',
  strong_weak: '身弱',
  five_shens: { yong: '食神', ji: ['七杀'], unfavorable: ['七杀'], favorable: ['食神'] },
  unfavorable_gods: ['七杀'],
};

const CASES = [
  {
    id: 'fx1_faithful_block', static: STATIC_A,
    reading: '……综合判断如上。\n<CLAIMS>{"geju":"正印格","strength":"身强","yong":["七杀"]}</CLAIMS>',
    expect: { hard: 0, types: [] },
  },
  {
    id: 'fx2_strength_flip_block', static: STATIC_A,
    reading: '<CLAIMS>{"geju":"正印格","strength":"身弱","yong":["七杀"]}</CLAIMS>',
    expect: { hard: 1, types: ['strength_flip'] },
  },
  {
    id: 'fx3_yong_is_ji_block', static: STATIC_A,
    reading: '<CLAIMS>{"geju":"正印格","strength":"身强","yong":["偏印"]}</CLAIMS>',
    expect: { hard: 1, types: ['yong_is_ji'] },
  },
  {
    id: 'fx4_geju_mismatch_soft', static: STATIC_A,
    reading: '<CLAIMS>{"geju":"正官格","strength":"身强","yong":["七杀"]}</CLAIMS>',
    expect: { hard: 0, types: ['geju_mismatch'] },
  },
  {
    id: 'fx5_prose_strength_flip', static: STATIC_A,
    reading: '综合来看，日主身弱，印星虽多但难任其重，用神宜取七杀以制身。',
    expect: { hard: 1, types: ['strength_flip'] },
  },
  {
    id: 'fx6_prose_faithful', static: STATIC_A,
    reading: '日主身强，成正印格，用神取七杀，调和印比之旺。',
    expect: { hard: 0, types: [] },
  },
  {
    id: 'fx7_follow_no_flip', static: STATIC_B,
    reading: '<CLAIMS>{"geju":"七杀格","strength":"从弱","yong":["食神"]}</CLAIMS>',
    expect: { hard: 0, types: [] },
  },
  {
    id: 'fx8_double_hard', static: STATIC_B,
    reading: '<CLAIMS>{"geju":"七杀格","strength":"身强","yong":["七杀"]}</CLAIMS>',
    expect: { hard: 2, types: ['strength_flip', 'yong_is_ji'] },
  },
];

module.exports = { CASES };
