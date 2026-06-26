'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { decideDirection } = require('./baziCareerDirection');

const PU = { pattern_type: '普通' };

// ── 19 例 gold-case 收敛真值表（docs/bazi-career-framework-final.md §7）──
// 每例：在决策性大运/流年节点的真实情形 → 期望(方向, 规则)
const TRUTH = [
  { id: 'A',   picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  { id: 'B',   picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  { id: 'C',   picture: PU, transit: { disease: 'remove' },                                          dir: '吉', rule: 'R3b' },
  { id: 'D',   picture: PU, transit: { structural_collapse: true },                                  dir: '凶', rule: 'R1' },
  { id: 'E',   picture: PU, transit: { structural_collapse: true },                                  dir: '凶', rule: 'R1' }, // 申冲寅禄=拔根
  { id: 'F',   picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' }, // 转格食神制杀
  { id: 'I',   picture: { pattern_type: '特殊', special_kind: '阳刃' }, transit: { special_flow: 'against' }, dir: '凶', rule: 'R2' },
  { id: 'J',   picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  // K：拔禄根(坍塌) 且 引动七杀但无制 —— 验证 R1 压 R3
  { id: 'K',   picture: PU, transit: { structural_collapse: true, star_induced: true, star_controlled: false }, dir: '凶', rule: 'R1' },
  { id: 'SS_子运', picture: PU, transit: { structural_collapse: true },                              dir: '凶', rule: 'R1' },
  { id: 'Q_丙辰', picture: { pattern_type: '特殊', special_kind: '润下' }, transit: { special_flow: 'against' }, dir: '凶', rule: 'R2' },
  { id: 'R',   picture: { pattern_type: '普通', baseline_direction: '吉' }, transit: { none: true },  dir: '吉', rule: 'baseline' },
  // T：子运冲用神午火印；且子水对戊为"喜"——验证 R1' 压 R4(喜)
  { id: 'T',   picture: PU, transit: { yongshen_broken: true, favorable: 'xi' },                     dir: '凶', rule: 'R1prime' },
  { id: 'U',   picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  { id: 'V',   picture: PU, transit: { yongshen_broken: true },                                      dir: '凶', rule: 'R1prime' },
  { id: 'Y_壬申', picture: PU, transit: { structural_collapse: true },                               dir: '凶', rule: 'R1' }, // 申冲寅根+枭夺食断枢纽
  { id: 'Z1',  picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  { id: 'Z2',  picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
  { id: 'Z3',  picture: PU, transit: { star_induced: true, star_controlled: true },                 dir: '吉', rule: 'R3' },
];

test('19 例收敛真值表：方向与触发规则 0 反例', () => {
  for (const c of TRUTH) {
    const r = decideDirection(c.picture, c.transit);
    assert.equal(r.direction, c.dir, `${c.id} 方向应=${c.dir}，实得 ${r.direction}（${r.rule}）`);
    assert.equal(r.rule, c.rule, `${c.id} 规则应=${c.rule}，实得 ${r.rule}`);
  }
});

// ── 转折案：同一原局画像，换运则方向反转 ──
test('转折案：SS 癸亥运(制化)→吉 vs 子运(坍塌)→凶', () => {
  const pic = PU;
  assert.equal(decideDirection(pic, { star_induced: true, star_controlled: true }).direction, '吉');
  assert.equal(decideDirection(pic, { structural_collapse: true }).direction, '凶');
});

test('转折案：Q 甲寅运顺水→吉 vs 丙辰运群劫→凶（特殊格方向反向）', () => {
  const pic = { pattern_type: '特殊', special_kind: '润下' };
  assert.equal(decideDirection(pic, { special_flow: 'follow' }).rule, 'R2');
  assert.equal(decideDirection(pic, { special_flow: 'follow' }).direction, '吉');
  assert.equal(decideDirection(pic, { special_flow: 'against' }).direction, '凶');
});

// ── 优先级铁律单测 ──
test('铁律1：R1 压 R3（坍塌即使引动喜用事业星仍凶）', () => {
  const r = decideDirection(PU, { structural_collapse: true, star_induced: true, star_controlled: true });
  assert.equal(r.direction, '凶');
  assert.equal(r.rule, 'R1');
});

test('铁律1：R1\' 压 R4（用神被破即使引动喜用仍凶）', () => {
  const r = decideDirection(PU, { yongshen_broken: true, favorable: 'xi' });
  assert.equal(r.direction, '凶');
  assert.equal(r.rule, 'R1prime');
});

test('铁律2：事业星无制为凶（R3 反面）', () => {
  const r = decideDirection(PU, { star_induced: true, star_controlled: false });
  assert.equal(r.direction, '凶');
  assert.equal(r.rule, 'R3');
});

test('R4 仅偏置信，不出吉/凶硬判', () => {
  const r = decideDirection(PU, { favorable: 'xi' });
  assert.equal(r.direction, '中性');
  assert.equal(r.lean, '吉');
});
