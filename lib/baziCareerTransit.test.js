'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assessCareerNode, buildTransitSituation } = require('./baziCareerTransit');
const { buildCareerPicture } = require('./baziCareerPicture');

// ── 19 例 gold-case 端到端回归（裸四柱 → 画像 → 岁运情形 → 方向）──
// auto=true：纯引擎自动判定（R3 制化），不给任何 hint
// hint：结构坍塌/特殊格顺逆/用神被破/去病顺逆 由原文判断提供（见框架"用原文用神先验框架"决定）
const E2E = [
  { id: 'A',  p: ['壬寅', '辛亥', '戊辰', '癸丑'], gz: '丁巳', dir: '吉', auto: true },
  { id: 'B',  p: ['甲午', '癸酉', '戊寅', '丁巳'], gz: '戊寅', dir: '吉', auto: true },
  { id: 'C',  p: ['癸丑', '戊午', '己巳', '丁卯'], gz: '壬子', dir: '吉', hints: { disease: 'remove' } },
  { id: 'D',  p: ['丙申', '甲午', '庚戌', '乙酉'], gz: '庚子', dir: '凶', hints: { structural_collapse: true } },
  { id: 'E',  p: ['乙亥', '丁亥', '甲寅', '丁卯'], gz: '甲申', dir: '凶', hints: { structural_collapse: true } },
  { id: 'F',  p: ['癸未', '辛酉', '乙酉', '丁亥'], gz: '丁巳', dir: '吉', auto: true },
  { id: 'I',  p: ['癸巳', '戊午', '丙午', '壬辰'], gz: '乙卯', dir: '凶', hints: { structural_collapse: true } },
  { id: 'J',  p: ['庚申', '庚辰', '甲戌', '丙寅'], gz: '丙戌', dir: '吉', auto: true },
  { id: 'K',  p: ['甲申', '甲戌', '甲寅', '甲戌'], gz: '庚辰', dir: '凶', auto: true }, // 七杀无制 R3
  { id: 'SS吉', p: ['戊辰', '戊午', '壬辰', '甲辰'], gz: '癸亥', dir: '吉', hints: { flow: 'follow' } },
  { id: 'SS凶', p: ['戊辰', '戊午', '壬辰', '甲辰'], gz: '甲子', dir: '凶', hints: { structural_collapse: true } },
  { id: 'Q',  p: ['壬子', '辛亥', '癸丑', '壬子'], gz: '丙辰', dir: '凶', auto: true }, // 专旺顺逆自动
  { id: 'Q吉', p: ['壬子', '辛亥', '癸丑', '壬子'], gz: '甲寅', dir: '吉', auto: true }, // 顺水泄秀自动
  { id: 'T',  p: ['庚申', '庚辰', '戊辰', '戊午'], gz: '壬子', dir: '凶', hints: { yongshen_broken: true } },
  { id: 'U',  p: ['癸亥', '癸亥', '戊午', '甲寅'], gz: '甲寅', dir: '吉', auto: true },
  { id: 'V',  p: ['癸酉', '乙卯', '丁未', '辛亥'], gz: '辛酉', dir: '凶', hints: { yongshen_broken: true } },
  { id: 'Y',  p: ['甲戌', '丙寅', '甲戌', '乙亥'], gz: '壬申', dir: '凶', hints: { structural_collapse: true } },
  { id: 'Z1', p: ['癸亥', '癸亥', '丁卯', '癸卯'], gz: '己未', dir: '吉', auto: true },
  { id: 'Z2', p: ['壬子', '壬子', '丙戌', '戊戌'], gz: '乙卯', dir: '吉', auto: true },
  { id: 'Z3', p: ['壬申', '丙午', '庚午', '丙戌'], gz: '戊申', dir: '吉', auto: true },
];

function pillarsOf(arr) {
  return { year: arr[0], month: arr[1], day: arr[2], hour: arr[3] };
}

test('19 例端到端回归：裸四柱 → 方向 0 反例', () => {
  for (const c of E2E) {
    const r = assessCareerNode({ pillars: pillarsOf(c.p), transitGz: c.gz, hints: c.hints || {} });
    assert.equal(r.direction.direction, c.dir, `${c.id} ${c.gz} 期望 ${c.dir}，实得 ${r.direction.direction}（${r.direction.rule}）`);
  }
});

test('纯引擎自动（零 hint）方向正确——R3 制化 / R2 专旺顺逆 均不依赖原文用神', () => {
  const autoCases = E2E.filter((c) => c.auto);
  assert.ok(autoCases.length >= 11, `应有≥11 例纯自动，实得 ${autoCases.length}`);
  for (const c of autoCases) {
    const r = assessCareerNode({ pillars: pillarsOf(c.p), transitGz: c.gz }); // 不传 hints
    assert.equal(r.direction.direction, c.dir, `${c.id}(auto) 期望 ${c.dir}，实得 ${r.direction.direction}`);
    assert.ok(['R3', 'R2'].includes(r.direction.rule), `${c.id} 应走 R3 制化 或 R2 专旺顺逆，实得 ${r.direction.rule}`);
  }
});

test('transit builder：A 自动识别"引动正印(喜性)→得制化"', () => {
  const picture = buildCareerPicture({ pillars: pillarsOf(['壬寅', '辛亥', '戊辰', '癸丑']) });
  const t = buildTransitSituation({ picture, pillars: pillarsOf(['壬寅', '辛亥', '戊辰', '癸丑']), transitGz: '丁巳' });
  assert.equal(t.flags.star_induced, true);
  assert.equal(t.flags.star_controlled, true);
  assert.equal(t.flags.structural_collapse, false); // 反吟提纲≠坍塌
});

test('transit builder：K 自动识别"引动七杀但无制"', () => {
  const pil = pillarsOf(['甲申', '甲戌', '甲寅', '甲戌']);
  const picture = buildCareerPicture({ pillars: pil });
  const t = buildTransitSituation({ picture, pillars: pil, transitGz: '庚辰' });
  assert.equal(t.flags.star_induced, true);
  assert.equal(t.flags.star_controlled, false); // 七杀无制
});

test('冲提运不自动判凶（A 丁巳反吟月柱辛亥仍吉）', () => {
  const pil = pillarsOf(['壬寅', '辛亥', '戊辰', '癸丑']);
  const r = assessCareerNode({ pillars: pil, transitGz: '丁巳' });
  assert.equal(r.direction.direction, '吉');
  assert.ok(r.transit.evidence.some((e) => e.includes('冲提运')), '应记录冲提运为转折信号');
});

// ── 自动凶向识别（拔根坍塌 / 枭神夺食）──
test('拔根坍塌自动：E 甲木 申冲寅+酉冲卯 冲净强根 → 凶 R1', () => {
  const pil = pillarsOf(['乙亥', '丁亥', '甲寅', '丁卯']);
  const r = assessCareerNode({ pillars: pil, transitGz: '癸酉', layer: 'liunian', referenceStems: ['甲'], referenceBranches: ['申'] });
  assert.equal(r.direction.direction, '凶');
  assert.ok(r.transit.evidence.some((e) => e.includes('拔根')), '应识别拔根坍塌');
});

test('拔根多根护栏：C 己土多根，冲一午根 不坍塌（不误判凶）', () => {
  const pil = pillarsOf(['癸丑', '戊午', '己巳', '丁卯']);
  const r = assessCareerNode({ pillars: pil, transitGz: '壬子', layer: 'dayun' });
  assert.notEqual(r.direction.rule, 'R1'); // 丑巳尚存，非坍塌
});

test('枭神夺食自动：Y 身强透丙食，壬申运壬克丙 → 凶 R1', () => {
  const pil = pillarsOf(['甲戌', '丙寅', '甲戌', '乙亥']);
  const r = assessCareerNode({ pillars: pil, transitGz: '壬申', layer: 'dayun' });
  assert.equal(r.direction.direction, '凶');
  assert.equal(r.direction.rule, 'R1');
});

test('零假阳性：9 个吉案在其关键运不被新规则翻成凶', () => {
  const JI = [
    [['壬寅','辛亥','戊辰','癸丑'],'丁巳'], [['甲午','癸酉','戊寅','丁巳'],'戊寅'],
    [['癸未','辛酉','乙酉','丁亥'],'丁巳'], [['庚申','庚辰','甲戌','丙寅'],'丙戌'],
    [['己巳','庚午','乙卯','庚辰'],'庚辰'], [['癸亥','癸亥','戊午','甲寅'],'甲寅'],
    [['癸亥','癸亥','丁卯','癸卯'],'己未'], [['壬子','壬子','丙戌','戊戌'],'乙卯'],
    [['壬申','丙午','庚午','丙戌'],'戊申'],
  ];
  for (const [p, gz] of JI) {
    const r = assessCareerNode({ pillars: pillarsOf(p), transitGz: gz });
    assert.notEqual(r.direction.direction, '凶', `${p.join('')} ${gz} 不应被翻成凶`);
  }
});
