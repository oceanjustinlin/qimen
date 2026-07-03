const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';

const baziModule = require('../api/bazi');
const { buildCompleteBaziDetail, hasLatestEngineCache } = require('./baziCore');
const { Solar } = require('lunar-javascript');

const tenGodMapJia = {
  '甲': '比',
  '乙': '劫',
  '丙': '食',
  '丁': '伤',
  '戊': '才',
  '己': '财',
  '庚': '杀',
  '辛': '官',
  '壬': '枭',
  '癸': '印'
};

const tenGodMapYi = {
  '甲': '劫',
  '乙': '比',
  '丙': '伤',
  '丁': '食',
  '戊': '财',
  '己': '才',
  '庚': '官',
  '辛': '杀',
  '壬': '印',
  '癸': '枭'
};

const tenGodMapBing = {
  '甲': '枭',
  '乙': '印',
  '丙': '比',
  '丁': '劫',
  '戊': '食',
  '己': '伤',
  '庚': '才',
  '辛': '财',
  '壬': '杀',
  '癸': '官'
};

const tenGodMapDing = {
  '甲': '印',
  '乙': '枭',
  '丙': '劫',
  '丁': '比',
  '戊': '伤',
  '己': '食',
  '庚': '财',
  '辛': '才',
  '壬': '官',
  '癸': '杀'
};

const tenGodMapRen = {
  '甲': '食',
  '乙': '伤',
  '丙': '才',
  '丁': '财',
  '戊': '杀',
  '己': '官',
  '庚': '枭',
  '辛': '印',
  '壬': '比',
  '癸': '劫'
};

const tenGodMapGui = {
  '甲': '伤',
  '乙': '食',
  '丙': '财',
  '丁': '才',
  '戊': '官',
  '己': '杀',
  '庚': '印',
  '辛': '枭',
  '壬': '劫',
  '癸': '比'
};

const tenGodMapJi = {
  '甲': '官',
  '乙': '杀',
  '丙': '印',
  '丁': '枭',
  '戊': '劫',
  '己': '比',
  '庚': '伤',
  '辛': '食',
  '壬': '财',
  '癸': '才'
};

const tenGodMapWu = {
  '甲': '杀',
  '乙': '官',
  '丙': '枭',
  '丁': '印',
  '戊': '比',
  '己': '劫',
  '庚': '食',
  '辛': '伤',
  '壬': '才',
  '癸': '财'
};

const tenGodMapXin = {
  '甲': '财',
  '乙': '才',
  '丙': '官',
  '丁': '杀',
  '戊': '印',
  '己': '枭',
  '庚': '劫',
  '辛': '比',
  '壬': '伤',
  '癸': '食'
};

test('getGeJu keeps yangren special case ahead of month merge', () => {
  const result = baziModule.getGeJu({
    year: ['丁', '亥'],
    month: ['乙', '卯'],
    day: ['甲', '子'],
    time: ['己', '未']
  });

  assert.equal(result.geju, '羊刃格');
  assert.equal(result.basis, '羊刃特判');
  assert.equal(result.tenGod, '劫');
  assert.equal(result.monthMergeInfo.mergeType, '三合');
});

test('getGeJu keeps month main qi as primary when month merge is only a candidate', () => {
  const result = baziModule.getGeJu({
    year: ['甲', '子'],
    month: ['庚', '申'],
    day: ['戊', '辰'],
    time: ['丙', '辰']
  });

  assert.equal(result.geju, '食神格');
  assert.equal(result.basis, '月支本气');
  assert.equal(result.monthMainGan, '庚');
  assert.equal(result.tenGod, '食');
  assert.equal(result.monthMergeInfo.mergeType, '三合');
  assert.equal(result.monthMergeInfo.resultGan, '壬');
});

test('getGeJu does not let 巳申合水 override 申月庚官 primary pattern（薛相公型）', () => {
  const result = baziModule.getGeJu({
    year: ['甲', '申'],
    month: ['壬', '申'],
    day: ['乙', '巳'],
    time: ['戊', '寅']
  });

  assert.equal(result.geju, '正官格');
  assert.equal(result.basis, '月支本气');
  assert.equal(result.monthMainGan, '庚');
  assert.equal(result.tenGod, '官');
  assert.equal(result.monthMergeInfo.mergeType, '六合');
  assert.equal(result.monthMergeInfo.resultGan, '壬');
});

test('getGeJu promotes exposed rooted killing with food-control over graveyard wealth（知县型）', () => {
  const result = baziModule.getGeJu({
    year: ['庚', '辰'],
    month: ['庚', '辰'],
    day: ['甲', '戌'],
    time: ['丙', '寅']
  });

  assert.equal(result.geju, '七杀格');
  assert.equal(result.basis, '主格候选');
  assert.equal(result.tenGod, '杀');
  assert.equal(result.patternCandidates[0].type, 'exposed_killing_controlled');
  assert.equal(result.patternCandidates[0].name, '七杀格');
  assert.equal(result.patternCandidates.some(item => item.type === 'base_month' && item.name === '偏财格'), true);
});

test('getGeJu promotes mixed official cleanup over month wealth（府判型）', () => {
  const result = baziModule.getGeJu({
    year: ['丙', '申'],
    month: ['辛', '卯'],
    day: ['庚', '戌'],
    time: ['丁', '亥']
  });

  assert.equal(result.geju, '正官格');
  assert.equal(result.basis, '主格候选');
  assert.equal(result.tenGod, '官');
  assert.equal(result.patternCandidates[0].type, 'mixed_official_cleanup');
  assert.equal(result.patternCandidates[0].name, '正官格');
  assert.equal(result.patternCandidates.some(item => item.type === 'base_month' && item.name === '正财格'), true);
});

test('getGeJu promotes revealed graveyard official once loss-of-use gates are available（杂气正官型）', () => {
  const result = baziModule.getGeJu({
    year: ['壬', '戌'],
    month: ['丁', '未'],
    day: ['戊', '申'],
    time: ['乙', '卯']
  });

  assert.equal(result.geju, '正官格');
  assert.equal(result.basis, '主格候选');
  assert.equal(result.tenGod, '官');
  assert.equal(result.monthMainGan, '乙');
  assert.equal(result.patternCandidates[0].type, 'graveyard_revealed_supported');
  assert.equal(result.patternCandidates[0].name, '正官格');
  assert.equal(result.patternCandidates.some(item => item.type === 'revealed_hidden' && item.name === '正印格'), true);
});

test('getGeJu promotes exposed killing when a graveyard month has only peer main qi（康熙型）', () => {
  const result = baziModule.getGeJu({
    year: ['甲', '午'],
    month: ['戊', '辰'],
    day: ['戊', '申'],
    time: ['丁', '巳']
  });

  assert.equal(result.geju, '七杀格');
  assert.equal(result.basis, '主格候选');
  assert.equal(result.tenGod, '杀');
  assert.equal(result.monthMainGan, '甲');
  assert.equal(result.patternCandidates[0].type, 'graveyard_peer_official_axis');
  assert.equal(result.patternCandidates.some(
    item => item.type === 'base_month' && item.name === '建禄格'
  ), true);
});

test('getGeJu keeps a true non-graveyard lu month ahead of exposed killing', () => {
  const result = baziModule.getGeJu({
    year: ['庚', '午'],
    month: ['甲', '寅'],
    day: ['甲', '辰'],
    time: ['丁', '巳']
  });

  assert.equal(result.geju, '建禄格');
  assert.equal(result.basis, '建禄特判');
});

test('getChengGe rejects zhengguan charts with guansha mixed', () => {
  const result = baziModule.getChengGe({
    geju: '正官格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '酉',
    allStems: ['辛', '庚', '甲', '丁'],
    allBranches: ['酉', '申', '午', '戌'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapJia,
    dayStrength: '身强'
  });

  assert.equal(result.chengGeResult, '败格');
  assert.equal(result.chengGeReason, '官杀混杂');
});

test('getChengGe applies QiongTong 甲申专用丙火 before normal killing cleanup', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '申',
    allStems: ['辛', '丙', '甲', '丙'],
    allBranches: ['未', '申', '申', '寅'],
    monthHiddenGans: ['庚', '壬', '戊'],
    tenGodMap: tenGodMapJia,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '穷通甲申用丙格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '食');
  assert.equal(result.yongShen, '丙');
  assert.equal(result.patternEffects.qiongTongPriority, true);
  assert.deepEqual(result.patternEffects.promotedShens, ['食']);
});

test('getChengGe applies QiongTong 丁巳无壬用癸 before blade special pattern', () => {
  const result = baziModule.getChengGe({
    geju: '羊刃格',
    basis: '羊刃特判',
    dayGan: '丁',
    monthZhi: '巳',
    allStems: ['癸', '丁', '丁', '丙'],
    allBranches: ['巳', '巳', '卯', '午'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapDing,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '穷通丁巳无壬用癸格');
  assert.equal(result.yongShenTenGod, '杀');
  assert.equal(result.yongShen, '癸');
  assert.deepEqual(result.patternEffects.demotedShens, ['食', '伤']);
});

test('getChengGe applies QiongTong 辛丑财旺生杀 with 丁 as true killing use', () => {
  const result = baziModule.getChengGe({
    geju: '偏印格',
    basis: '月令本气',
    dayGan: '辛',
    monthZhi: '丑',
    allStems: ['甲', '丁', '辛', '己'],
    allBranches: ['申', '丑', '卯', '亥'],
    monthHiddenGans: ['己', '辛', '癸'],
    tenGodMap: tenGodMapXin,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财旺生杀格');
  assert.equal(result.yongShenTenGod, '杀');
  assert.equal(result.yongShen, '丁');
  assert.deepEqual(result.patternEffects.assistantShens, ['财', '才']);
});

test('getChengGe does not apply QiongTong 丁巳 branch without water, metal, or Hai official evidence', () => {
  const result = baziModule.getChengGe({
    geju: '羊刃格',
    basis: '羊刃特判',
    dayGan: '丁',
    monthZhi: '巳',
    allStems: ['乙', '己', '丁', '丙'],
    allBranches: ['丑', '巳', '卯', '午'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapDing,
    dayStrength: '身强'
  });

  assert.notEqual(result.patternEffects.qiongTongPriority, true);
  assert.doesNotMatch(result.chengGe, /^穷通/);
});

test('getChengGe forms sha-yin-xiang-sheng when qi sha rooted and seal is strong', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '申',
    allStems: ['庚', '丙', '甲', '癸'],
    allBranches: ['申', '酉', '亥', '子'],
    monthHiddenGans: ['庚', '壬', '戊'],
    tenGodMap: tenGodMapJia,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '杀印相生格');
  assert.equal(result.chengGeResult, '成格');
  // 杀印相生以印化杀生身，印为用神、杀为相神
  assert.equal(result.yongShenTenGod, '印');
  assert.equal(result.xianShen, '杀');
});

test('getChengGe uses a primary hidden seal when rooted killing has no food control（赵员外型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '寅',
    allStems: ['戊', '甲', '戊', '戊'],
    allBranches: ['辰', '寅', '寅', '午'],
    monthHiddenGans: ['甲', '丙', '戊'],
    tenGodMap: tenGodMapWu,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '杀印相生格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '印');
  assert.equal(result.yongShen, '丁');
  assert.match(result.chengGeReason, /无食制.*藏印/);
  assert.deepEqual(result.patternEffects.assistantShens, ['比', '劫']);
});

test('getChengGe does not add peer assistants to a weak hidden-seal killing chart', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '寅',
    allStems: ['戊', '甲', '戊', '戊'],
    allBranches: ['辰', '寅', '寅', '午'],
    monthHiddenGans: ['甲', '丙', '戊'],
    tenGodMap: tenGodMapWu,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '杀印相生格');
  assert.deepEqual(result.patternEffects.assistantShens, []);
});

test('getChengGe keeps day-seated blade ahead of hidden seal in a weak killing chart（左宗棠型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '丙',
    monthZhi: '亥',
    allStems: ['壬', '辛', '丙', '庚'],
    allBranches: ['申', '亥', '午', '寅'],
    monthHiddenGans: ['壬', '甲', null],
    tenGodMap: tenGodMapBing,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '七杀格');
  assert.equal(result.yongShenTenGod, '杀');
  assert.doesNotMatch(result.chengGeReason, /藏印/);
});

test('getChengGe uses finance to remove exposed seal and preserve rooted output（周丞相型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令本气',
    dayGan: '丁',
    monthZhi: '子',
    allStems: ['戊', '甲', '丁', '庚'],
    allBranches: ['戌', '子', '未', '戌'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: tenGodMapDing,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '七杀用财格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '财');
  assert.equal(result.yongShen, '庚');
  assert.equal(result.xianShen, '伤');
  assert.deepEqual(result.patternEffects.invalidatedShens, ['印']);
  assert.deepEqual(result.patternEffects.assistantShens, ['伤']);
  assert.match(result.chengGeReason, /去印存食/);
});

test('getChengGe treats sha-yao-shi-zhi as taking 食神 to制杀（袁树珊型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令透干',
    dayGan: '乙',
    monthZhi: '酉',
    allStems: ['辛', '丁', '乙', '戊'],
    allBranches: ['巳', '酉', '巳', '寅'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapYi,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '杀邀食制格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '食');
  assert.equal(result.yongShen, '丁');
  // 杀邀食制：七杀是被制之病神，不作相神/喜（否则误入喜方与 gold 忌金相反）
  assert.equal(result.xianShen, '');
  assert.deepEqual(result.patternEffects.assistantShens, ['印', '枭']);
  assert.ok(!result.patternEffects.demotedShens.includes('印'));
});

test('getChengGe demotes seal that steals food control when the killing chart is not weak（极等贵命型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '月令透干',
    dayGan: '乙',
    monthZhi: '酉',
    allStems: ['乙', '乙', '乙', '丁'],
    allBranches: ['亥', '酉', '卯', '丑'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapYi,
    dayStrength: '身中'
  });

  assert.equal(result.chengGe, '杀邀食制格');
  assert.equal(result.yongShenTenGod, '食');
  assert.deepEqual(result.patternEffects.assistantShens, []);
  assert.deepEqual(result.patternEffects.demotedShens, ['财', '才', '印', '枭']);
});

test('getChengGe treats repeated exposed killing with rooted food as 食神制杀（知县型）', () => {
  const result = baziModule.getChengGe({
    geju: '七杀格',
    basis: '主格候选',
    dayGan: '甲',
    monthZhi: '辰',
    allStems: ['庚', '庚', '甲', '丙'],
    allBranches: ['辰', '辰', '戌', '寅'],
    monthHiddenGans: ['戊', '乙', '癸'],
    tenGodMap: tenGodMapJia,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '食神制杀格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '食');
  assert.equal(result.yongShen, '丙');
  assert.equal(result.xianShen, '杀');
});

test('getChengGe uses double-exposed owl seal to restrain over-rooted food（章士钊灵枭型）', () => {
  const result = baziModule.getChengGe({
    geju: '食神格',
    basis: '月令本气',
    dayGan: '癸',
    monthZhi: '卯',
    allStems: ['辛', '辛', '癸', '乙'],
    allBranches: ['巳', '卯', '丑', '卯'],
    monthHiddenGans: ['乙', null, null],
    tenGodMap: tenGodMapGui,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '灵枭得用格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '枭');
  assert.equal(result.yongShen, '辛');
  assert.deepEqual(result.patternEffects.protectedShens, ['枭']);
  assert.deepEqual(result.patternEffects.demotedShens, ['食', '伤']);
});

test('getChengGe does not call one food root 灵枭得用', () => {
  const result = baziModule.getChengGe({
    geju: '食神格',
    basis: '月令本气',
    dayGan: '癸',
    monthZhi: '卯',
    allStems: ['辛', '辛', '癸', '乙'],
    allBranches: ['巳', '卯', '丑', '子'],
    monthHiddenGans: ['乙', null, null],
    tenGodMap: tenGodMapGui,
    dayStrength: '身弱'
  });

  assert.notEqual(result.chengGe, '灵枭得用格');
  assert.notEqual(result.yongShenTenGod, '枭');
});

test('getChengGe keeps graveyard official isolated when wealth and seal combine away（杂气正官型）', () => {
  const result = baziModule.getChengGe({
    geju: '正官格',
    basis: '主格候选',
    dayGan: '戊',
    monthZhi: '未',
    allStems: ['壬', '丁', '戊', '乙'],
    allBranches: ['戌', '未', '申', '卯'],
    monthHiddenGans: ['己', '丁', '乙'],
    tenGodMap: tenGodMapWu,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '孤官无辅格');
  assert.equal(result.chengGeResult, '待定');
  assert.equal(result.yongShenTenGod, '官');
  assert.equal(result.yongShen, '乙');
  assert.equal(result.xianShen, '');
});

test('getChengGe recognizes 财旺身弱用印 instead of 财旺生官（伍朝枢型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '壬',
    monthZhi: '午',
    allStems: ['丁', '丙', '壬', '己'],
    allBranches: ['亥', '午', '寅', '酉'],
    monthHiddenGans: ['丁', '己', null],
    tenGodMap: tenGodMapRen,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财旺身弱用印格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '印');
  assert.equal(result.yongShen, '辛');
  assert.equal(result.xianShen, '');
});

test('getChengGe lets exposed seal remove rooted food to protect a hidden officer（平江伯型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '癸',
    monthZhi: '巳',
    allStems: ['壬', '乙', '癸', '辛'],
    allBranches: ['辰', '巳', '巳', '酉'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapGui,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财格去食护官格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '官');
  assert.equal(result.yongShen, '戊');
  assert.equal(result.xianShen, '枭');
  assert.deepEqual(result.patternEffects.invalidatedShens, ['食']);
  assert.deepEqual(result.patternEffects.assistantShens, ['枭']);
});

test('getChengGe recognizes separated food and seal as 财格食印不碍（吴榜眼型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '子',
    allStems: ['庚', '戊', '戊', '丙'],
    allBranches: ['戌', '子', '子', '辰'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财格食印不碍格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '食');
  assert.equal(result.yongShen, '庚');
  assert.deepEqual(result.patternEffects.protectedShens, ['食', '枭', '财', '才']);
  assert.deepEqual(result.patternEffects.assistantShens, ['枭']);
});

test('getChengGe does not relabel a separated food-seal 偏财格 as 吴榜眼型', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '亥',
    allStems: ['庚', '丁', '戊', '丙'],
    allBranches: ['午', '亥', '戌', '辰'],
    monthHiddenGans: ['壬', '甲', null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身中'
  });

  assert.notEqual(result.chengGe, '财格食印不碍格');
});

test('getChengGe recognizes 财格佩印 as taking 印 to help weak daymaster（曾参政型）', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '丙',
    monthZhi: '申',
    allStems: ['乙', '甲', '丙', '庚'],
    allBranches: ['未', '申', '申', '寅'],
    monthHiddenGans: ['庚', '壬', '戊'],
    tenGodMap: tenGodMapBing,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财格佩印格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '枭');
  assert.equal(result.yongShen, '甲');
  assert.equal(result.xianShen, '印');
});

test('getChengGe does not turn 财带七杀合杀存财 into 财旺身弱用印（毛状元型）', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '辰',
    allStems: ['乙', '庚', '甲', '戊'],
    allBranches: ['酉', '辰', '午', '辰'],
    monthHiddenGans: ['戊', '乙', '癸'],
    tenGodMap: tenGodMapJia,
    dayStrength: '身弱'
  });

  assert.notEqual(result.chengGe, '财旺身弱用印格');
  assert.notEqual(result.yongShenTenGod, '枭');
});

test('getChengGe recognizes 财带七杀合杀存财 as taking 财（毛状元型）', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '辰',
    allStems: ['乙', '庚', '甲', '戊'],
    allBranches: ['酉', '辰', '午', '辰'],
    monthHiddenGans: ['戊', '乙', '癸'],
    tenGodMap: tenGodMapJia,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '合杀存财格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '才');
  assert.equal(result.yongShen, '戊');
  assert.equal(result.xianShen, '');
  assert.deepEqual(result.patternEffects.demotedShens, []);
});

test('getChengGe lets rooted food control exposed killing and generate wealth（李御史型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '子',
    allStems: ['庚', '戊', '戊', '甲'],
    allBranches: ['辰', '子', '寅', '寅'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '制杀生财格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '食');
  assert.equal(result.yongShen, '庚');
  assert.equal(result.xianShen, '财');
  assert.deepEqual(result.patternEffects.protectedShens, ['食', '财', '才']);
});

test('getChengGe does not relabel a food-controls-killing 偏财格 as 李御史型', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '丁',
    monthZhi: '酉',
    allStems: ['己', '癸', '丁', '丁'],
    allBranches: ['未', '酉', '巳', '未'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapDing,
    dayStrength: '身中'
  });

  assert.notEqual(result.chengGe, '制杀生财格');
});

test('getChengGe requires visible seal for 财格佩印 and keeps 单透财暗官 out（林尚书型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '癸',
    monthZhi: '巳',
    allStems: ['丙', '癸', '癸', '壬'],
    allBranches: ['寅', '巳', '未', '戌'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapGui,
    dayStrength: '身弱'
  });

  assert.notEqual(result.chengGe, '财格佩印格');
  assert.notEqual(result.yongShenTenGod, '印');
});

test('getChengGe recognizes 单透财暗官 as 财带暗官（林尚书型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '癸',
    monthZhi: '巳',
    allStems: ['丙', '癸', '癸', '壬'],
    allBranches: ['寅', '巳', '未', '戌'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapGui,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '财带暗官格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '财');
  assert.equal(result.yongShen, '丙');
  assert.equal(result.xianShen, '官');
});

test('getChengGe recognizes 弃杀就财 when 财透杀藏（王太仆型）', () => {
  const result = baziModule.getChengGe({
    geju: '偏财格',
    basis: '月令本气',
    dayGan: '壬',
    monthZhi: '巳',
    allStems: ['丙', '癸', '壬', '壬'],
    allBranches: ['辰', '巳', '戌', '寅'],
    monthHiddenGans: ['丙', '戊', '庚'],
    tenGodMap: tenGodMapRen,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '弃杀就财格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '才');
  assert.equal(result.yongShen, '丙');
  assert.equal(result.xianShen, '');
  assert.deepEqual(result.patternEffects.demotedShens, ['杀']);
});

test('getChengGe keeps 化伤为财生官 out of root-only印（章丞相型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '己',
    monthZhi: '申',
    allStems: ['甲', '壬', '己', '辛'],
    allBranches: ['子', '申', '亥', '未'],
    monthHiddenGans: ['庚', '壬', '戊'],
    tenGodMap: tenGodMapJi,
    dayStrength: '身弱'
  });

  assert.equal(result.yongShenTenGod, '财');
  assert.notEqual(result.chengGe, '财旺身弱用印格');
  assert.notEqual(result.yongShenTenGod, '枭');
  assert.equal(result.xianShen, '官');
});

test('getChengGe recognizes 化伤为财生官 as a distinct 财格 path（章丞相型）', () => {
  const result = baziModule.getChengGe({
    geju: '正财格',
    basis: '月令本气',
    dayGan: '己',
    monthZhi: '申',
    allStems: ['甲', '壬', '己', '辛'],
    allBranches: ['子', '申', '亥', '未'],
    monthHiddenGans: ['庚', '壬', '戊'],
    tenGodMap: tenGodMapJi,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '化伤为财生官格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '财');
  assert.equal(result.yongShen, '壬');
  assert.equal(result.xianShen, '官');
});

test('getChengGe recognizes double-exposed killing feeding a weak hurt-output seal（蔡贵妃型）', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '庚',
    monthZhi: '子',
    allStems: ['己', '丙', '庚', '丙'],
    allBranches: ['未', '子', '子', '子'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: {
      甲: '才', 乙: '财', 丙: '杀', 丁: '官', 戊: '枭',
      己: '印', 庚: '比', 辛: '劫', 壬: '食', 癸: '伤'
    },
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官用杀印格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '印');
  assert.equal(result.yongShen, '己');
  assert.deepEqual(result.patternEffects.protectedShens, ['印', '杀']);
  assert.deepEqual(result.patternEffects.demotedShens, ['食', '伤']);
  assert.deepEqual(result.patternEffects.assistantShens, ['杀']);
});

test('getChengGe uses a primary or secondary hidden seal when repeated hurt-output overdrains a weak metal day', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '庚',
    monthZhi: '子',
    allStems: ['丁', '壬', '庚', '辛'],
    allBranches: ['亥', '子', '子', '巳'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: {
      甲: '才', 乙: '财', 丙: '杀', 丁: '官', 戊: '枭',
      己: '印', 庚: '比', 辛: '劫', 壬: '食', 癸: '伤'
    },
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官佩印格');
  assert.equal(result.yongShenTenGod, '枭');
  assert.equal(result.yongShen, '戊');
  assert.match(result.chengGeReason, /藏印/);
});

test('getChengGe keeps metal-water hurt-output using officer when output is not repeatedly rooted', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '庚',
    monthZhi: '子',
    allStems: ['丁', '壬', '庚', '辛'],
    allBranches: ['亥', '子', '辰', '巳'],
    monthHiddenGans: ['癸', null, null],
    tenGodMap: {
      甲: '才', 乙: '财', 丙: '杀', 丁: '官', 戊: '枭',
      己: '印', 庚: '比', 辛: '劫', 壬: '食', 癸: '伤'
    },
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官喜官格');
  assert.equal(result.yongShenTenGod, '官');
});

test('getChengGe combines separated finance and seal in a cold hurt-output chart（都统制型）', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '酉',
    allStems: ['丁', '己', '戊', '壬'],
    allBranches: ['酉', '酉', '子', '子'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官兼用财印格');
  assert.equal(result.yongShenTenGod, '才');
  assert.equal(result.yongShen, '壬');
  assert.deepEqual(result.patternEffects.protectedShens, ['伤', '财', '才']);
  assert.deepEqual(result.patternEffects.assistantShens, ['印', '枭']);
});

test('getChengGe keeps ordinary hurt-output finance when no seal is exposed', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '酉',
    allStems: ['戊', '己', '戊', '壬'],
    allBranches: ['酉', '酉', '子', '子'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官生财格');
  assert.deepEqual(result.patternEffects.assistantShens, []);
});

test('getChengGe uses strong hidden finance for hurt-output generates wealth（发财命型）', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '壬',
    monthZhi: '卯',
    allStems: ['癸', '乙', '壬', '乙'],
    allBranches: ['亥', '卯', '申', '巳'],
    monthHiddenGans: ['乙', null, null],
    tenGodMap: tenGodMapRen,
    dayStrength: '身弱'
  });

  assert.equal(result.chengGe, '伤官生财格');
  assert.equal(result.yongShenTenGod, '才');
  assert.equal(result.yongShen, '丙');
  assert.equal(result.xianShen, '伤');
  assert.deepEqual(result.patternEffects.protectedShens, ['伤', '财', '才']);
  assert.deepEqual(result.patternEffects.promotedShens, ['才']);
  assert.deepEqual(result.patternEffects.demotedShens, ['印', '枭']);
  assert.deepEqual(result.patternEffects.assistantShens, ['伤']);
  assert.deepEqual(result.patternEffects.methodTags, ['伤官用财', '伤官生财', '制劫化财']);
});

test('buildCompleteBaziDetail promotes hidden finance in hurt-output wealth generation（发财命型）', () => {
  const baZi = Solar.fromYmdHms(1563, 3, 17, 10, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['癸亥', '乙卯', '壬申', '乙巳']
  );
  assert.equal(result.chengge_detail.chengGe, '伤官生财格');
  assert.equal(result.five_shens.yong, '偏财');
  assert.equal(result.five_shens.xi.includes('伤官'), true);
  assert.equal(result.favorable_gods.includes('偏财'), true);
  assert.equal(result.unfavorable_gods.includes('正印'), true);
});

test('buildCompleteBaziDetail keeps formed hurt-output wealth above strong-many image override（自创命型）', () => {
  const baZi = Solar.fromYmdHms(1528, 9, 2, 10, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['戊子', '辛酉', '戊午', '丁巳']
  );
  assert.equal(result.chengge_detail.chengGe, '伤官生财格');
  assert.equal(result.five_shens.yong, '偏财');
  assert.equal(result.five_shens.xi.includes('伤官'), true);
  assert.equal(result.special_pattern || null, null);
  assert.equal(result.decision_chain.some(item => item.layer === 'L0 特殊气势'), false);
});

test('getChengGe does not call warm-rooted finance-seal hurt-output cold（丞相型）', () => {
  const result = baziModule.getChengGe({
    geju: '伤官格',
    basis: '月令本气',
    dayGan: '戊',
    monthZhi: '酉',
    allStems: ['壬', '己', '戊', '丁'],
    allBranches: ['戌', '酉', '午', '巳'],
    monthHiddenGans: ['辛', null, null],
    tenGodMap: tenGodMapWu,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '伤官生财格');
  assert.deepEqual(result.patternEffects.assistantShens, []);
});

test('getChengGe lets a strong seal pattern release through rooted exposed output when officer-killing is rootless', () => {
  const result = baziModule.getChengGe({
    geju: '偏印格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '亥',
    allStems: ['癸', '癸', '甲', '丁'],
    allBranches: ['未', '亥', '午', '卯'],
    monthHiddenGans: ['壬', '甲', null],
    tenGodMap: tenGodMapJia,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '印旺泄秀格');
  assert.equal(result.yongShenTenGod, '伤');
  assert.equal(result.yongShen, '丁');
  assert.deepEqual(result.patternEffects.demotedShens, ['官', '杀']);
});

test('getChengGe does not force seal-pattern output release when the day is weak', () => {
  const result = baziModule.getChengGe({
    geju: '偏印格',
    basis: '月令本气',
    dayGan: '甲',
    monthZhi: '亥',
    allStems: ['癸', '癸', '甲', '丁'],
    allBranches: ['未', '亥', '午', '卯'],
    monthHiddenGans: ['壬', '甲', null],
    tenGodMap: tenGodMapJia,
    dayStrength: '身弱'
  });

  assert.notEqual(result.chengGe, '印旺泄秀格');
});

test('getChengGe lets an unrestrained strong blade release through rooted exposed output', () => {
  const result = baziModule.getChengGe({
    geju: '羊刃格',
    basis: '羊刃特判',
    dayGan: '甲',
    monthZhi: '卯',
    allStems: ['甲', '丁', '甲', '庚'],
    allBranches: ['寅', '卯', '寅', '午'],
    monthHiddenGans: ['乙', null, null],
    tenGodMap: tenGodMapJia,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '刃旺泄秀格');
  assert.equal(result.yongShenTenGod, '伤');
  assert.equal(result.yongShen, '丁');
});

test('getChengGe keeps blade-killing control when killing has an actual branch root', () => {
  const result = baziModule.getChengGe({
    geju: '羊刃格',
    basis: '羊刃特判',
    dayGan: '甲',
    monthZhi: '卯',
    allStems: ['甲', '丁', '甲', '庚'],
    allBranches: ['寅', '卯', '申', '午'],
    monthHiddenGans: ['乙', null, null],
    tenGodMap: tenGodMapJia,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '刃杀相停格');
  assert.notEqual(result.chengGe, '刃旺泄秀格');
});

test('getChengGe recognizes exposed blade-killing assisted by wealth and seal', () => {
  const result = baziModule.getChengGe({
    geju: '羊刃格',
    basis: '羊刃特判',
    dayGan: '丙',
    monthZhi: '午',
    allStems: ['辛', '甲', '丙', '壬'],
    allBranches: ['酉', '午', '申', '辰'],
    monthHiddenGans: ['丁', '己', null],
    tenGodMap: tenGodMapBing,
    dayStrength: '身强'
  });

  assert.equal(result.chengGe, '阳刃露杀财印助杀格');
  assert.equal(result.chengGeResult, '成格');
  assert.equal(result.yongShenTenGod, '杀');
  assert.equal(result.yongShen, '壬');
  assert.equal(result.xianShen, '印、财');
  assert.deepEqual(result.patternEffects.protectedShens, ['杀', '印', '枭', '财', '才']);
  assert.deepEqual(result.patternEffects.assistantShens, ['印', '枭', '财', '才']);
  assert.deepEqual(result.patternEffects.methodTags, ['阳刃露煞', '透煞根浅', '财印助之']);
});

test('GE_JU_INFO exposes the requested major structures', () => {
  assert.equal(Object.keys(baziModule.GE_JU_INFO).length, 10);
  assert.equal(baziModule.GE_JU_INFO['建禄格'].element, '比');
  assert.ok(baziModule.GE_JU_INFO['七杀格'].chengGeTypes.includes('七杀用财格'));
  assert.ok(baziModule.GE_JU_INFO['正财格'].chengGeTypes.includes('财格去食护官格'));
  assert.ok(baziModule.GE_JU_INFO['伤官格'].chengGeTypes.includes('伤官佩印格'));
  assert.ok(baziModule.GE_JU_INFO['伤官格'].chengGeTypes.includes('伤官兼用财印格'));
  assert.ok(baziModule.GE_JU_INFO['偏印格'].chengGeTypes.includes('印旺泄秀格'));
  assert.ok(baziModule.GE_JU_INFO['羊刃格'].chengGeTypes.includes('刃旺泄秀格'));
  assert.ok(baziModule.GE_JU_INFO['羊刃格'].chengGeTypes.includes('阳刃露杀财印助杀格'));
});

test('hasLatestEngineCache invalidates pre-image-analysis engine caches', () => {
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.7.0' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.0' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.1' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.2' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.3' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.4' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.5' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.6' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.11' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.12' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.13' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.15' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.16' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.17' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.18' } }), false);
  assert.equal(hasLatestEngineCache({ bazi_detail: { engine_version: '1.8.19' } }), true);
});

test('buildQualitativeSections keeps llm fields empty when llm request fails', () => {
  const result = baziModule.buildQualitativeSections({
    llmSucceeded: false,
    llmQualitativeData: null,
    engineQualitativeData: {
      yuanju_core: 'engine-yuanju',
      current_dayun: 'engine-dayun',
      current_liunian: 'engine-liunian'
    }
  });

  assert.deepEqual(result, {
    display: {
      yuanju_core: 'engine-yuanju',
      current_dayun: 'engine-dayun',
      current_liunian: 'engine-liunian'
    },
    llm: {
      yuanju_core: null,
      current_dayun: null,
      current_liunian: null
    },
    engine: {
      yuanju_core: 'engine-yuanju',
      current_dayun: 'engine-dayun',
      current_liunian: 'engine-liunian'
    }
  });
});

test('buildQualitativeSections uses llm fields only when llm request succeeds', () => {
  const result = baziModule.buildQualitativeSections({
    llmSucceeded: true,
    llmQualitativeData: {
      yuanju_core: 'llm-yuanju',
      current_dayun: 'llm-dayun',
      current_liunian: 'llm-liunian'
    },
    engineQualitativeData: {
      yuanju_core: 'engine-yuanju',
      current_dayun: 'engine-dayun',
      current_liunian: 'engine-liunian'
    }
  });

  assert.deepEqual(result, {
    display: {
      yuanju_core: 'llm-yuanju',
      current_dayun: 'llm-dayun',
      current_liunian: 'llm-liunian'
    },
    llm: {
      yuanju_core: 'llm-yuanju',
      current_dayun: 'llm-dayun',
      current_liunian: 'llm-liunian'
    },
    engine: {
      yuanju_core: 'engine-yuanju',
      current_dayun: 'engine-dayun',
      current_liunian: 'engine-liunian'
    }
  });
});

test('buildCompleteBaziDetail exposes the full method chain for frontend and question prompts', () => {
  const baZi = Solar.fromYmdHms(1999, 6, 15, 10, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.ok(result.base_info);
  assert.ok(result.matrix);
  assert.equal(result.matrix.pillars.length, 4);
  assert.ok(result.matrix.xiaoyun_list.length > 0);
  assert.ok(result.matrix.xiaoyun_list.every(item => item.isXiaoyun));
  assert.ok(result.matrix.dayun_list.length >= 9);
  assert.ok(result.matrix.dayun_list.every(dayun => !dayun.isXiaoyun));
  assert.ok(result.matrix.dayun_list.every(dayun => Number.isFinite(dayun.start_year) && Number.isFinite(dayun.end_year)));
  assert.ok(result.matrix.dayun_list.some(dayun => Array.isArray(dayun.liunian_list) && dayun.liunian_list.length > 0));
  assert.ok(result.matrix.liunian_list.length > 80);
  assert.ok(result.matrix.liunian_list.some(item => item.dayun_ganzhi));
  assert.ok(result.matrix.liunian_list.every(item => item.zhi_shi_shen));
  assert.ok(result.matrix.current_dayun?.gan);
  assert.ok(result.matrix.current_liunian?.gan);
  assert.ok(result.strength_detail?.sections?.length >= 5);
  assert.ok(result.geju_detail?.geju);
  assert.ok(result.geju_info);
  assert.ok(result.chengge_detail?.chengGe);
  assert.ok(Array.isArray(result.favorable_gods));
  assert.ok(Array.isArray(result.unfavorable_gods));
  assert.ok(result.dimension_breakdown);
  assert.ok(result.wuxing_ratio);
  assert.ok(result.interactions?.gans);
  assert.ok(result.interactions?.zhis);
  assert.equal(result.classic_verdict.source, '三命通会');
});

test('buildCompleteBaziDetail exposes structured pattern analysis for product display', () => {
  const baZi = Solar.fromYmdHms(1990, 6, 15, 8, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.ok(result.pattern_analysis);
  assert.ok(result.image_analysis);
  assert.ok(result.image_analysis.primary_candidate);
  assert.equal(result.pattern_analysis.extraction.base_pattern, result.geju);
  assert.equal(result.pattern_analysis.extraction.final_pattern.name, result.geju);
  assert.ok(result.pattern_analysis.extraction.steps.length >= 3);
  assert.ok(result.pattern_analysis.extraction.steps.some(step => step.key === 'dominant_force'));
  assert.ok(result.pattern_analysis.evaluation.good_evil_flow.strategy);
  assert.ok(['FORMED', 'BROKEN', 'PARTIAL', 'PENDING', 'DRY_COLD_IMBALANCED'].includes(result.pattern_analysis.evaluation.overall_status));
  assert.ok(result.pattern_analysis.evaluation.climate_adjustment.status);
  assert.ok(result.pattern_analysis.traits.personality.length > 0);
});

test('buildCompleteBaziDetail carries promoted killing candidate into chengge（知县型）', () => {
  const baZi = Solar.fromYmdHms(1580, 4, 18, 4, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['庚辰', '庚辰', '甲戌', '丙寅']
  );
  assert.equal(result.geju, '七杀格');
  assert.equal(result.geju_detail.basis, '主格候选');
  assert.equal(result.chengge_detail.chengGe, '食神制杀格');
  assert.equal(result.chengge_detail.yongShenTenGod, '食');
});

test('buildCompleteBaziDetail keeps finance above climate aid after removing seal（周丞相型）', () => {
  const baZi = Solar.fromYmdHms(1598, 12, 23, 20, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['戊戌', '甲子', '丁未', '庚戌']
  );
  assert.equal(result.chengge_detail.chengGe, '七杀用财格');
  assert.equal(result.five_shens.yong, '正财');
  assert.equal(result.five_shens.xi.includes('伤官'), true);
  assert.equal(result.five_shens.ji.includes('正印'), true);
});

test('buildCompleteBaziDetail protects hidden officer by removing clashing food（平江伯型）', () => {
  const baZi = Solar.fromYmdHms(1532, 5, 19, 18, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['壬辰', '乙巳', '癸巳', '辛酉']
  );
  assert.equal(result.chengge_detail.chengGe, '财格去食护官格');
  assert.equal(result.five_shens.yong, '正官');
  assert.equal(result.five_shens.xi.includes('偏印'), true);
  assert.equal(result.five_shens.ji.includes('食神'), true);
});

test('buildCompleteBaziDetail keeps food above climate seal in 制杀生财（李御史型）', () => {
  const baZi = Solar.fromYmdHms(1580, 12, 18, 4, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['庚辰', '戊子', '戊寅', '甲寅']
  );
  assert.equal(result.chengge_detail.chengGe, '制杀生财格');
  assert.equal(result.five_shens.yong, '食神');
  assert.equal(result.favorable_gods.includes('正财'), true);
});

test('buildCompleteBaziDetail protects 财印并用 so visible 正财 stays favorable（薛相公型）', () => {
  const baZi = Solar.fromYmdHms(1584, 9, 5, 4, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['甲申', '壬申', '乙巳', '戊寅']
  );
  assert.equal(result.geju, '正官格');
  assert.equal(result.five_shens.yong, '正官');
  assert.equal(result.five_shens.xi.includes('正财'), true);
  assert.equal(result.favorable_gods.includes('正财'), true);
  assert.equal(result.five_shens.ji.includes('正财'), false);
  assert.equal(result.five_shens.chou.includes('正财'), false);
});

test('buildCompleteBaziDetail promotes graveyard official and invalidates combined-away wealth/seal（杂气正官型）', () => {
  const baZi = Solar.fromYmdHms(1502, 7, 11, 6, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['壬戌', '丁未', '戊申', '乙卯']
  );
  assert.equal(result.geju, '正官格');
  assert.equal(result.geju_detail.basis, '主格候选');
  assert.equal(result.chengge_detail.chengGe, '孤官无辅格');
  assert.equal(result.five_shens.yong, '正官');
  assert.equal(result.favorable_gods.includes('偏财'), false);
  assert.equal(result.favorable_gods.includes('正印'), false);
  assert.equal(result.unfavorable_gods.includes('偏财'), true);
  assert.equal(result.unfavorable_gods.includes('正印'), true);
});

test('buildCompleteBaziDetail demotes wealth that feeds killing in 食神制杀（谭延闿型）', () => {
  const baZi = Solar.fromYmdHms(1640, 1, 23, 6, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['己卯', '丁丑', '癸丑', '乙卯']
  );
  assert.equal(result.geju, '七杀格');
  assert.equal(result.chengge_detail.chengGe, '杀邀食制格');
  assert.equal(result.five_shens.yong, '食神');
  assert.equal(result.favorable_gods.includes('偏财'), false);
  assert.equal(result.unfavorable_gods.includes('偏财'), true);
});

test('buildCompleteBaziDetail applies QiongTong 甲申专用丙火（张之万型）', () => {
  const baZi = Solar.fromYmdHms(1511, 8, 29, 4, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['辛未', '丙申', '甲申', '丙寅']
  );
  assert.equal(result.chengge_detail.chengGe, '穷通甲申用丙格');
  assert.equal(result.five_shens.yong, '食神');
  assert.equal(result.favorable_gods.includes('食神'), true);
});

test('buildCompleteBaziDetail applies QiongTong 丁巳专用庚金（国公型）', () => {
  const baZi = Solar.fromYmdHms(1520, 5, 26, 10, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['庚辰', '辛巳', '丁酉', '乙巳']
  );
  assert.equal(result.chengge_detail.chengGe, '穷通丁巳专用庚金格');
  assert.equal(result.five_shens.yong, '正财');
});

test('buildCompleteBaziDetail applies QiongTong 丁巳无壬用癸 and bypasses two-qi override（朱家骅型）', () => {
  const baZi = Solar.fromYmdHms(1653, 5, 28, 12, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['癸巳', '丁巳', '丁卯', '丙午']
  );
  assert.equal(result.chengge_detail.chengGe, '穷通丁巳无壬用癸格');
  assert.equal(result.five_shens.yong, '七杀');
  assert.equal(result.special_pattern || null, null);
});

test('buildCompleteBaziDetail applies QiongTong 丁巳亥宫官贵（周佛海型）', () => {
  const baZi = Solar.fromYmdHms(1657, 5, 27, 8, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['丁酉', '乙巳', '丁亥', '甲辰']
  );
  assert.equal(result.chengge_detail.chengGe, '穷通丁巳亥宫官贵格');
  assert.equal(result.five_shens.yong, '正官');
});

test('buildCompleteBaziDetail applies QiongTong 辛丑财旺生杀（辛金丑月型）', () => {
  const baZi = Solar.fromYmdHms(1705, 1, 20, 22, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['甲申', '丁丑', '辛卯', '己亥']
  );
  assert.equal(result.chengge_detail.chengGe, '财旺生杀格');
  assert.equal(result.five_shens.yong, '七杀');
  assert.equal(result.favorable_gods.includes('正财'), true);
});

test('buildCompleteBaziDetail exposes SanMing display-only pattern for 冲禄 cases', () => {
  const baZi = Solar.fromYmdHms(1510, 1, 12, 4, 30, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['己巳', '丁丑', '庚寅', '戊寅']
  );
  assert.equal(result.pattern_analysis.final_pattern.name, '冲禄格');
  assert.equal(result.pattern_analysis.classical_pattern.scoreScope, 'display_only');
  assert.ok(result.decision_chain.some(item => item.layer === 'L2 古法变格' && item.reason.includes('冲禄')));
  assert.equal(result.five_shens.yong, '正印', 'display-only SanMing pattern must not alter five-shen scoring');
});

test('buildCompleteBaziDetail uses an eligible alternative image candidate for L0 override', () => {
  const baZi = Solar.fromYmdHms(2023, 3, 31, 22, 0, 0).getLunar().getEightChar();
  const yun = baZi.getYun(1);
  const result = buildCompleteBaziDetail({
    baZi,
    yun,
    isMale: true,
    currentYear: 2026
  });

  assert.deepEqual(
    [baZi.getYear(), baZi.getMonth(), baZi.getDay(), baZi.getTime()],
    ['癸卯', '乙卯', '戊子', '癸亥']
  );
  assert.equal(result.image_analysis.primary_candidate.subtype, '从官杀格');
  assert.equal(result.image_analysis.primary_candidate.override_normal_pattern, false);
  assert.equal(result.image_analysis.override_candidate.subtype, '从财格');
  assert.equal(result.decision_chain[0].layer, 'L0 特殊气势');
  assert.equal(result.pattern_analysis.extraction.basis, 'SPECIAL_IMAGE_OVERRIDE');
  assert.equal(result.pattern_analysis.extraction.final_pattern.name, '从财格');
  assert.match(result.pattern_analysis.extraction.steps[0].value, /从财格/);
});

test('pattern analysis promotes structured image overrides to the final pattern axis', () => {
  const imageAnalysis = {
    primary_candidate: {
      category: 'FOLLOW_IMAGE',
      subtype: '从财格',
      target_element: '土',
      match_score: 86,
      override_normal_pattern: true,
      yongshen_strategy: 'FOLLOW_FORCE'
    }
  };
  const fakeDetail = baziModule.buildPatternAnalysis({
    geJuInfo: { geju: '正财格', basis: '月支本气', tenGod: '财', monthMainGan: '己', note: '丑以己为月令主气取格。' },
    geJu: '正财格',
    geJuInfoRecord: baziModule.GE_JU_INFO['正财格'],
    chengGeDetail: { chengGe: '财旺生官格', chengGeResult: '成格', chengGeReason: '财星有力，官星得气。', yongShen: '己', yongShenTenGod: '财', xianShen: '官' },
    strengthResult: {
      strongWeak: '疑似从格（从土）',
      dominantElement: '土',
      strengthDetail: {
        structure_exception: {
          final_type: '疑似从格（从土）',
          text: '四支无根，天干亦无实助，而土占比约58%，触发疑似从格。'
        }
      }
    },
    favorableResult: {
      special_pattern: {
        type: '从财',
        favorable: ['正财', '偏财', '正官', '七杀'],
        unfavorable: ['正印', '偏印', '比肩', '劫财']
      },
      tiaohou_detail: { urgency: '普通', explanation: '调候普通。', primary_gods: [], secondary_gods: [], avoid_gods: [] }
    },
    imageAnalysis,
    patternOverride: {
      basis: 'SPECIAL_IMAGE_OVERRIDE',
      base_pattern: '正财格',
      final_pattern: '从财格',
      overridden: true,
      yongshen_strategy: 'FOLLOW_FORCE'
    },
    monthHiddenGans: ['己', '癸', '辛'],
    monthZhi: '丑',
    dayGan: '甲'
  });

  assert.equal(fakeDetail.extraction.final_pattern.name, '从财格');
  assert.equal(fakeDetail.extraction.final_pattern.category, 'SPECIAL_FORCE');
  assert.equal(fakeDetail.extraction.final_pattern.base_pattern, '正财格');
  assert.equal(fakeDetail.extraction.basis, 'SPECIAL_IMAGE_OVERRIDE');
  assert.equal(fakeDetail.extraction.steps[0].key, 'special_force');
  assert.equal(fakeDetail.evaluation.overall_status, 'FORMED');
  assert.equal(fakeDetail.evaluation.special_force.type, '从财');
  assert.equal(fakeDetail.traits.statement_source, '《三命通会》弃命从财 / 《滴天髓》从象');
  assert.equal(fakeDetail.traits.source_backed, true);
  assert.equal(fakeDetail.traits.source_limited, true);
  assert.deepEqual(fakeDetail.traits.personality, []);
  assert.deepEqual(fakeDetail.traits.career_wealth, []);
  assert.match(fakeDetail.traits.source_excerpt, /日干无气满盘财/);
  assert.ok(fakeDetail.traits.unsupported_fields.includes('career_wealth'));
});

test('pattern analysis keeps a legacy special-pattern fallback without losing the base pattern', () => {
  const fakeDetail = baziModule.buildPatternAnalysis({
    geJuInfo: { geju: '正财格', basis: '月支本气', tenGod: '财' },
    geJu: '正财格',
    favorableResult: {
      special_pattern: {
        type: '从财',
        favorable: ['正财', '偏财', '正官', '七杀'],
        unfavorable: ['正印', '偏印', '比肩', '劫财']
      }
    }
  });

  assert.equal(fakeDetail.extraction.base_pattern, '正财格');
  assert.equal(fakeDetail.extraction.final_pattern.name, '从财格');
  assert.equal(fakeDetail.extraction.final_pattern.base_pattern, '正财格');
});

test('pattern analysis uses statement library by pattern and formation status', () => {
  const formed = baziModule.buildPatternAnalysis({
    geJuInfo: { geju: '七杀格', basis: '月支本气', tenGod: '杀', monthMainGan: '庚', note: '申以庚为月令主气取格。' },
    geJu: '七杀格',
    geJuInfoRecord: baziModule.GE_JU_INFO['七杀格'],
    chengGeDetail: { chengGe: '杀印相生格', chengGeResult: '成格', chengGeReason: '七杀有根，印绶有力相化。' },
    favorableResult: { tiaohou_detail: { urgency: '普通' } }
  });
  const broken = baziModule.buildPatternAnalysis({
    geJuInfo: { geju: '正官格', basis: '月支本气', tenGod: '官', monthMainGan: '辛', note: '酉以辛为月令主气取格。' },
    geJu: '正官格',
    geJuInfoRecord: baziModule.GE_JU_INFO['正官格'],
    chengGeDetail: { chengGe: '正官格', chengGeResult: '败格', chengGeReason: '官杀混杂。' },
    favorableResult: { tiaohou_detail: { urgency: '普通' } }
  });

  assert.equal(formed.traits.statement_state, 'FORMED');
  assert.match(formed.traits.career_wealth, /竞争|管理|压力/);
  assert.equal(broken.traits.statement_state, 'BROKEN');
  assert.match(broken.traits.warning, /规则|压力|边界/);
});
