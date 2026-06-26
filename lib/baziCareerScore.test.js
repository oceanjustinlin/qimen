'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeBaseCapacity,
  computeStateScore,
  computeVolatility,
  scoreCareerNode,
} = require('./baziCareerScore');
const { buildCareerPicture } = require('./baziCareerPicture');
const { assessCareerNode } = require('./baziCareerTransit');

function nodeScore(pillars, gz, hints, prev) {
  const r = assessCareerNode({ pillars, transitGz: gz, hints: hints || {} });
  return scoreCareerNode({ picture: r.picture, transitResult: r.transit, direction: r.direction, prevScore: prev });
}
const P = (a) => ({ year: a[0], month: a[1], day: a[2], hour: a[3] });

test('方向单调性：吉 > base > 凶，中性 = base', () => {
  const base = 60;
  const ji = computeStateScore({ base_capacity: base, direction: '吉', rule: 'R3', activation: 60 });
  const xiong = computeStateScore({ base_capacity: base, direction: '凶', rule: 'R3', activation: 60 });
  const neutral = computeStateScore({ base_capacity: base, direction: '中性', rule: 'R4', activation: 60 });
  assert.ok(ji.score > base, '吉应高于 base');
  assert.ok(xiong.score < base, '凶应低于 base');
  assert.equal(neutral.score, base, '中性应等于 base');
  assert.equal(ji.delta, -xiong.delta, '同激活下吉/凶摆幅对称');
});

test('激活独立于方向：翻转方向不改 activation，只改 delta 符号', () => {
  // 同一情形，方向是 decideDirection 决定；这里直接验 computeStateScore 的对称
  const a = computeStateScore({ base_capacity: 50, direction: '吉', rule: 'R3', activation: 80 });
  const b = computeStateScore({ base_capacity: 50, direction: '凶', rule: 'R3', activation: 80 });
  assert.equal(a.swing, b.swing, '激活幅度与方向无关');
  assert.ok(a.delta > 0 && b.delta < 0);
});

test('规则幅度：R1 坍塌摆幅 > R3 > R4（同激活）', () => {
  const r1 = computeStateScore({ base_capacity: 60, direction: '凶', rule: 'R1', activation: 70 });
  const r3 = computeStateScore({ base_capacity: 60, direction: '凶', rule: 'R3', activation: 70 });
  const r4 = computeStateScore({ base_capacity: 60, direction: '凶', rule: 'R4', activation: 70 });
  assert.ok(Math.abs(r1.delta) > Math.abs(r3.delta), 'R1 摆幅 > R3');
  assert.ok(Math.abs(r3.delta) > Math.abs(r4.delta), 'R3 摆幅 > R4');
});

test('限幅：极端输入仍落在 [2,98]', () => {
  const hi = computeStateScore({ base_capacity: 90, direction: '吉', rule: 'R1', activation: 100 });
  const lo = computeStateScore({ base_capacity: 12, direction: '凶', rule: 'R1', activation: 100 });
  assert.ok(hi.score <= 98 && lo.score >= 2);
});

test('base_capacity：七杀有制(J) 高于 七杀无制(K)', () => {
  const j = computeBaseCapacity(buildCareerPicture({ pillars: P(['庚申', '庚辰', '甲戌', '丙寅']) }));
  const k = computeBaseCapacity(buildCareerPicture({ pillars: P(['甲申', '甲戌', '甲寅', '甲戌']) }));
  assert.ok(j.value > k.value, `J(${j.value}) 应高于 K(${k.value})`);
});

test('波动度：相邻年落差大 → 波动高', () => {
  const small = computeVolatility({ state_score: 62, prevScore: 60, activation: 40 });
  const big = computeVolatility({ state_score: 80, prevScore: 40, activation: 40 });
  assert.ok(big > small);
});

test('端到端 sanity：A 吉分>base、D 凶分<base，且三指标齐全', () => {
  const a = nodeScore(P(['壬寅', '辛亥', '戊辰', '癸丑']), '丁巳');
  assert.ok(a.state_score > a.base_capacity);
  const d = nodeScore(P(['丙申', '甲午', '庚戌', '乙酉']), '庚子', { structural_collapse: true }, 60);
  assert.ok(d.state_score < d.base_capacity);
  for (const key of ['base_capacity', 'state_score', 'activation', 'volatility', 'confidence']) {
    assert.equal(typeof a[key], 'number', `${key} 应为数字`);
    assert.ok(a[key] >= 0 && a[key] <= 100);
  }
});
