'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shishenOf,
  branchMainStem,
  buildCareerAnchors,
  scanInducements,
} = require('./baziInducement');

const channels = (list) => list.map((x) => x.channel);
const find = (list, ch) => list.find((x) => x.channel === ch);

test('基础查表：本气与十神', () => {
  assert.equal(branchMainStem('寅'), '甲');
  assert.equal(branchMainStem('午'), '丁');
  assert.equal(branchMainStem('巳'), '丙');
  assert.equal(shishenOf('戊', '甲'), '杀'); // 甲木克戊土同性=七杀
  assert.equal(shishenOf('戊', '丁'), '印'); // 丁火生戊土=正印
});

test('A 壬寅辛亥戊辰癸丑：大运丁巳 → 禄引动(日主戊·巳禄) + 透干正印', () => {
  const ctx = buildCareerAnchors({
    pillars: { year: '壬寅', month: '辛亥', day: '戊辰', hour: '癸丑' },
    dayMaster: '戊',
  });
  const ind = scanInducements({ context: ctx, transitGz: '丁巳', layer: 'dayun' });
  const chs = channels(ind);
  assert.ok(chs.includes('禄引动'), '应有禄引动');
  assert.ok(chs.includes('透干引动'), '应有透干引动');
  const lu = find(ind, '禄引动');
  assert.equal(lu.value, '巳');
  assert.equal(lu.target.role, '日主');
  assert.equal(lu.target.stem, '戊'); // 巳=戊禄，自身到位
  const tg = find(ind, '透干引动');
  assert.equal(tg.target.shishen, '正印'); // 丁=正印
});

test('A：流年丁酉 应大运丁 → 应局_同干(正印)', () => {
  const ctx = buildCareerAnchors({
    pillars: { year: '壬寅', month: '辛亥', day: '戊辰', hour: '癸丑' },
    dayMaster: '戊',
  });
  // 流年扫描时把大运干支并入 reference，使流年可"应"大运
  const ind = scanInducements({
    context: ctx,
    transitGz: '丁酉',
    layer: 'liunian',
    referenceStems: ['丁'],
    referenceBranches: ['巳'],
  });
  const yj = find(ind, '应局_同干');
  assert.ok(yj, '应有应局_同干');
  assert.equal(yj.value, '丁');
  assert.equal(yj.target.shishen, '正印');
});

test('B 甲午癸酉戊寅丁巳：大运戊寅 → 禄引动(事业星甲·七杀) + 日主到位', () => {
  const ctx = buildCareerAnchors({
    pillars: { year: '甲午', month: '癸酉', day: '戊寅', hour: '丁巳' },
    dayMaster: '戊',
  });
  const ind = scanInducements({ context: ctx, transitGz: '戊寅', layer: 'dayun' });
  const chs = channels(ind);
  assert.ok(chs.includes('禄引动'), '应有禄引动');
  assert.ok(chs.includes('日主到位'), '应有日主到位(戊=比)');
  assert.ok(chs.includes('应局_同支'), '寅在原局日支→应局_同支');
  const lu = find(ind, '禄引动');
  assert.equal(lu.value, '寅');
  assert.equal(lu.target.role, '事业星');
  assert.equal(lu.target.stem, '甲'); // 寅=甲(七杀)之禄
  assert.equal(lu.target.shishen, '七杀');
});

test('anchors 只收事业星与日主/比劫，财才不作锚点', () => {
  const ctx = buildCareerAnchors({
    pillars: { year: '甲午', month: '癸酉', day: '戊寅', hour: '丁巳' },
    dayMaster: '戊',
  });
  const roles = Object.fromEntries(ctx.anchors.map((a) => [a.stem, a.role]));
  assert.equal(roles['甲'], '事业星'); // 七杀
  assert.equal(roles['戊'], '日主');
  assert.ok(!('壬' in roles)); // 偏财不入锚点
});

test('原身引动：岁运天干为原局某支本气透出（且为事业星）', () => {
  // 日主戊，原局日支寅(本气甲=七杀)；岁运甲X → 甲为寅之原身透出，显化七杀
  const ctx = buildCareerAnchors({
    pillars: { year: '甲午', month: '癸酉', day: '戊寅', hour: '丁巳' },
    dayMaster: '戊',
  });
  const ind = scanInducements({ context: ctx, transitGz: '甲子', layer: 'liunian' });
  const ys = find(ind, '原身引动');
  assert.ok(ys, '应有原身引动');
  assert.equal(ys.target.stem, '甲');
  assert.equal(ys.target.shishen, '七杀');
});

test('财才类岁运天干不误判为引动', () => {
  // 日主戊，岁运壬X：壬=偏财，非事业星、非比劫 → 不应有透干/原身引动
  const ctx = buildCareerAnchors({
    pillars: { year: '甲午', month: '癸酉', day: '戊寅', hour: '丁巳' },
    dayMaster: '戊',
  });
  const ind = scanInducements({ context: ctx, transitGz: '壬戌', layer: 'liunian' });
  const chs = channels(ind);
  assert.ok(!chs.includes('透干引动'));
  assert.ok(!chs.includes('原身引动'));
});

test('引阳刃：岁运地支为日主阳刃', () => {
  // 丙日主阳刃在午
  const ctx = buildCareerAnchors({
    pillars: { year: '癸巳', month: '戊午', day: '丙午', hour: '壬辰' },
    dayMaster: '丙',
  });
  const ind = scanInducements({ context: ctx, transitGz: '甲午', layer: 'dayun' });
  assert.ok(channels(ind).includes('引阳刃'), '午为丙之阳刃');
});
