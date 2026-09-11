'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./constants/core');
const { assessGanContext } = require('./baziElementState');
const { scanZhiRelations, scanGanRelations } = require('./baziRelationScanner');
const { assessOriginalChartState } = require('./baziStateAssessor');
const { assessDynamicTriggers } = require('./baziDynamicAssessor');

const pillarsOf = pairs => pairs.map(([gan, zhi], i) => ({
  name: ['年', '月', '日', '时'][i], gan, zhi,
  hidden_stems: C.ZHI5_LIST[zhi], is_kong: false,
}));
const spec = { primary_shishen: ['正印'], primary_gongwei: ['日支'], extra_static_checks: [] };
function reportFor(pillars, targetSpec = spec, dayStem = '甲') {
  return assessOriginalChartState({ matrix: { pillars }, targetSpec, dayStem, gender: 'male' });
}

test('B2：甲临子沐浴与子中癸印临官分开保存，癸以藏干通根', () => {
  const pillars = pillarsOf([['癸', '酉'], ['乙', '卯'], ['甲', '子'], ['丙', '寅']]);
  const assessment = reportFor(pillars).shishen_assessments.find(a => a.pillar === '日');
  assert.equal(assessment.twelve_phase, '临官');
  assert.equal(assessment.twelve_phase_for_dayStem, '沐浴');
  assert.equal(assessment.month_element_state, '休');
  assert.ok(assessment.has_root);
  assert.ok(assessment.roots.some(root => root.zhi === '子' && root.gan === '癸'));
  assert.match(assessment.model_note, /非古籍定量/);
});

test('截脚不能推出无根：乙酉仍可通根他柱卯，移去木根才报告无根', () => {
  const rooted = pillarsOf([['乙', '酉'], ['辛', '卯'], ['甲', '子'], ['庚', '午']]);
  const targetSpec = { ...spec, primary_shishen: ['劫财'] };
  const a = reportFor(rooted, targetSpec).shishen_assessments.find(a => a.position === 'gan');
  assert.equal(a.gaitou_jiejiao, 'jiejiao');
  assert.ok(a.status_tags.includes('有根'));
  assert.ok(!a.status_tags.includes('无根'));
  assert.equal(a.vigor, assessGanContext('乙', '酉', rooted, '卯').vigor);
  assert.match(a.verdict, /月支卯藏乙/);
  const rootless = pillarsOf([['乙', '酉'], ['辛', '酉'], ['甲', '子'], ['庚', '午']]);
  const b = reportFor(rootless, targetSpec).shishen_assessments.find(a => a.position === 'gan');
  assert.equal(b.has_root, false);
  assert.ok(b.status_tags.includes('无根'));
});

test('庚午截脚自坐沐浴指标保留，不能封顶 0.08，也不能按指标决定有无根', () => {
  const pillars = pillarsOf([['庚', '午'], ['辛', '酉'], ['甲', '子'], ['戊', '寅']]);
  const a = reportFor(pillars, { ...spec, primary_shishen: ['七杀'] }).shishen_assessments.find(a => a.position === 'gan');
  assert.equal(a.gaitou_jiejiao, 'jiejiao');
  assert.equal(a.vigor, 0.5);
  assert.ok(a.has_root);
});

test('乙坐亥十二长生为死，但亥藏甲是木根；不得按阶段断无根或力量极弱', () => {
  const pillars = pillarsOf([['乙', '亥'], ['辛', '酉'], ['甲', '子'], ['庚', '午']]);
  const targetSpec = { ...spec, primary_shishen: ['劫财'] };
  const a = reportFor(pillars, targetSpec).shishen_assessments.find(a => a.position === 'gan');
  assert.equal(a.twelve_phase, '死');
  assert.ok(a.has_root);
  assert.doesNotMatch(a.verdict, /力量极弱/);
});

test('墓库藏根不能因墓阶段低分被抹去，癸在辰仍有藏癸根', () => {
  const pillars = pillarsOf([['癸', '辰'], ['辛', '酉'], ['甲', '子'], ['庚', '午']]);
  assert.ok(assessGanContext('癸', '辰', pillars, '酉').roots.some(r => r.zhi === '辰'));
});

test('地支关系以月令五行代理计算，改变日主不会改变同一子午冲力量', () => {
  const pillars = pillarsOf([['甲', '子'], ['丙', '午'], ['戊', '寅'], ['庚', '申']]);
  const args = { targetZhi: '子', targetPillar: '年', targetIsKong: false, pillars, monthZhi: '午' };
  const a = scanZhiRelations({ ...args, dayStem: '甲' }).find(r => r.type === '六冲');
  const b = scanZhiRelations({ ...args, dayStem: '庚' }).find(r => r.type === '六冲');
  assert.deepEqual(a, b);
  assert.ok(a.target_vigor < a.partner_vigor);
});

test('天干关系旺衰属于各自的干，受克也不能交换 target / partner', () => {
  const pillars = pillarsOf([['乙', '亥'], ['庚', '申'], ['甲', '子'], ['戊', '午']]);
  const args = { targetGan: '乙', targetPillar: '年', pillars, monthZhi: '申' };
  const a = scanGanRelations({ ...args, dayStem: '甲' }).find(r => r.type === '天干相克' && r.partner_gan === '庚');
  const b = scanGanRelations({ ...args, dayStem: '丁' }).find(r => r.type === '天干相克' && r.partner_gan === '庚');
  assert.deepEqual(a, b);
  assert.equal(a.target_vigor, 0.15); // 乙临亥为死；工程自坐指标，不代表无根。
  assert.equal(a.partner_vigor, 0.9); // 庚临申为临官。
});

test('岁运干传入真实坐支；盖头截脚不篡改日主临岁运支状态', () => {
  const pillars = pillarsOf([['癸', '酉'], ['乙', '卯'], ['甲', '子'], ['丙', '寅']]);
  const run = dayunGan => assessDynamicTriggers({ matrix: { pillars }, targetSpec: spec,
    stateReport: reportFor(pillars), dayStem: '甲', dayunGan, dayunZhi: '酉',
    liunianGan: '丙', liunianZhi: '午' });
  const a = run('乙').dayun_impact;
  const b = run('癸').dayun_impact;
  assert.equal(a.gaitou_jiejiao, 'jiejiao');
  assert.equal(a.trigger_vigor, b.trigger_vigor);
  assert.equal(a.incoming_stem_state.twelve_phase, '绝');
  // 癸酉对丙寅相克，癸在酉为病，应取 0.25，不再因传入柱不在 pillars 中回退为 0.5。
  assert.equal(b.gan_relations.find(r => r.partner_gan === '丙').target_vigor, 0.25);
});
