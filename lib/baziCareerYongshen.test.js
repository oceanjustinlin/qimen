'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { correctCareerYongshen } = require('./baziCareerYongshen');

const has = (arr, w) => arr.includes(w);

test('J 七杀透：金水(含杀金) → 去金补火(食制)，命中教材火', () => {
  // 甲木日主：食伤=火，印=水，财=土，官杀=金
  const r = correctCareerYongshen({ dayMaster: '甲', transparentShishen: ['杀', '食'], engine: { favorable: ['金', '水'], unfavorable: ['土'] } });
  assert.ok(r.corrected);
  assert.ok(!has(r.favorable, '金'), '应去掉病神金(七杀)');
  assert.ok(has(r.favorable, '火'), '应补食伤火(制杀)');
});

test('SS 七杀透：土火(杀+财,全错) → 木金(食制+印化)，命中教材木', () => {
  // 壬水日主：食伤=木，印=金，财=火，官杀=土
  const r = correctCareerYongshen({ dayMaster: '壬', transparentShishen: ['杀', '食'], engine: { favorable: ['土', '火'], unfavorable: [] } });
  assert.ok(!has(r.favorable, '土'), '去病神土(七杀)');
  assert.ok(!has(r.favorable, '火'), '去财火(生杀)');
  assert.ok(has(r.favorable, '木'), '补食伤木(制杀)');
});

test('Z2 七杀透：水金(杀+财) → 土木，命中教材土', () => {
  // 丙火日主：食伤=土，印=木，财=金，官杀=水
  const r = correctCareerYongshen({ dayMaster: '丙', transparentShishen: ['杀', '食'], engine: { favorable: ['水', '金'], unfavorable: [] } });
  assert.ok(has(r.favorable, '土'), '补食伤土(制杀)');
  assert.ok(!has(r.favorable, '水'), '去病神水(七杀)');
});

test('阳刃驾杀护栏：身强+阳刃 七杀为用，不去杀（I 喜水保持）', () => {
  // 丙火日主，七杀=水。身强阳刃驾杀时七杀为用神，不可去。
  const r = correctCareerYongshen({ dayMaster: '丙', transparentShishen: ['杀'], engine: { favorable: ['水'], unfavorable: [] }, hasYangRen: true, strongWeak: '身强' });
  assert.equal(r.corrected, false, '身强阳刃驾杀不触发去杀校正');
  assert.ok(has(r.favorable, '水'), '七杀(水)作为用神保留');
});

test('身弱+阳刃+七杀透：七杀仍是病，照常去杀（D 庚金弱）', () => {
  // 庚金日主带酉刃但身弱，七杀=火(丙)。火是攻身之病，应去掉。
  const r = correctCareerYongshen({ dayMaster: '庚', transparentShishen: ['杀'], engine: { favorable: ['水', '火'], unfavorable: [] }, hasYangRen: true, strongWeak: '身弱' });
  assert.equal(r.corrected, true, '身弱阳刃不豁免，照常校正');
  assert.ok(!has(r.favorable, '火'), '去掉病神火(七杀攻身)');
});

test('非七杀/伤官透：保留引擎喜忌不动', () => {
  const r = correctCareerYongshen({ dayMaster: '戊', transparentShishen: ['印', '比'], engine: { favorable: ['火', '土'], unfavorable: ['水'] } });
  assert.equal(r.corrected, false);
  assert.deepEqual(r.favorable.sort(), ['土', '火']);
});

test('喜忌不重叠（喜优先）', () => {
  const r = correctCareerYongshen({ dayMaster: '甲', transparentShishen: ['杀'], engine: { favorable: ['水'], unfavorable: ['火'] } });
  // 火被补进喜，则不应再留在忌
  assert.ok(has(r.favorable, '火'));
  assert.ok(!has(r.unfavorable, '火'));
});
