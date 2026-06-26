'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assessCareer } = require('./baziCareer');

const P = (a) => ({ year: a[0], month: a[1], day: a[2], hour: a[3] });

test('顶层入口：A 命例 一次调用产出 运限/方向/指标', () => {
  const r = assessCareer({
    pillars: P(['壬寅', '辛亥', '戊辰', '癸丑']),
    transitGz: '丁巳',
    layer: 'dayun',
    age: 55,
  });
  assert.equal(r.direction.direction, '吉');
  assert.equal(r.yunxian.pillar, '时');            // 55 岁→时柱运限
  assert.ok(r.metrics.state_score > r.metrics.base_capacity);
  assert.ok(Array.isArray(r.inducements) && r.inducements.length > 0);
  assert.ok(r.evidence.length > 0);
});

test('顶层入口：D 命例 凶 + 指标完整 + 波动(带 prevScore)', () => {
  const r = assessCareer({
    pillars: P(['丙申', '甲午', '庚戌', '乙酉']),
    transitGz: '庚子',
    age: 58,
    hints: { structural_collapse: true },
    prevScore: 62,
  });
  assert.equal(r.direction.direction, '凶');
  assert.ok(r.metrics.state_score < r.metrics.base_capacity);
  assert.ok(r.metrics.volatility > 0);
  for (const k of ['base_capacity', 'state_score', 'activation', 'volatility', 'confidence']) {
    assert.ok(r.metrics[k] >= 0 && r.metrics[k] <= 100);
  }
});

test('无 age 时 yunxian 为 null（不强制要求年龄）', () => {
  const r = assessCareer({ pillars: P(['庚申', '庚辰', '甲戌', '丙寅']), transitGz: '丙戌' });
  assert.equal(r.yunxian, null);
  assert.equal(r.direction.direction, '吉');
});
