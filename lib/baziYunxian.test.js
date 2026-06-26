'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getYunxian,
  isTianKeDiChong,
  isChongTiYun,
  annotateYunxian,
} = require('./baziYunxian');

test('getYunxian 按 16 年一柱映射，含边界', () => {
  assert.equal(getYunxian(1).pillar, '年');
  assert.equal(getYunxian(16).pillar, '年');
  assert.equal(getYunxian(17).pillar, '月');
  assert.equal(getYunxian(32).pillar, '月');
  assert.equal(getYunxian(33).pillar, '日');
  assert.equal(getYunxian(48).pillar, '日');
  assert.equal(getYunxian(49).pillar, '时');
  assert.equal(getYunxian(64).pillar, '时');
});

test('getYunxian 65+ 为时柱延伸，权重衰减且显式标注', () => {
  const y = getYunxian(70);
  assert.equal(y.pillar, '时');
  assert.equal(y.weight_status, 'extended');
  assert.equal(y.age_range, '65+');
  assert.match(y.topic_career, /延伸/);
});

test('月柱运限标记为事业窗口（事业宫）', () => {
  assert.equal(getYunxian(25).is_career_window, true);
  assert.equal(getYunxian(25).weight_status, 'primary');
  assert.equal(getYunxian(40).is_career_window, false);
});

test('age<1 钳到 1；非数字抛错', () => {
  assert.equal(getYunxian(0).pillar, '年');
  assert.equal(getYunxian(-5).pillar, '年');
  assert.throws(() => getYunxian('x'), TypeError);
});

test('isTianKeDiChong：干差6 且 支差6（反吟）', () => {
  assert.equal(isTianKeDiChong('甲子', '庚午'), true); // 甲↔庚, 子↔午
  assert.equal(isTianKeDiChong('甲午', '庚子'), true); // 顺序无关
  assert.equal(isTianKeDiChong('乙丑', '辛未'), true);
  // 仅地支冲、天干不克 → 否
  assert.equal(isTianKeDiChong('甲子', '丙午'), false);
  // 仅天干克、地支不冲 → 否
  assert.equal(isTianKeDiChong('甲子', '庚子'), false);
  // 非法输入 → 否
  assert.equal(isTianKeDiChong('甲', '庚午'), false);
  assert.equal(isTianKeDiChong(null, '庚午'), false);
});

test('isChongTiYun：D 案 庚子大运 天克地冲 月柱甲午（冲提运）', () => {
  // D 丙申 甲午 庚戌 乙酉，58 岁庚子大运落马
  assert.equal(isChongTiYun('甲午', '庚子'), true);
  // 同盘若大运为乙未则非冲提
  assert.equal(isChongTiYun('甲午', '乙未'), false);
});

test('annotateYunxian：D 案 58 岁 + 庚子大运 → 时柱延伸? 否(58 在时柱段)且冲提风险', () => {
  const a = annotateYunxian({ age: 58, monthGz: '甲午', dayunGz: '庚子' });
  assert.equal(a.pillar, '时');
  assert.equal(a.chong_ti_yun, true);
  assert.equal(a.career_structural_risk, true);
  assert.match(a.note, /冲提运/);
});

test('annotateYunxian：无大运信息时不误报冲提', () => {
  const a = annotateYunxian({ age: 25 });
  assert.equal(a.chong_ti_yun, false);
  assert.equal(a.career_structural_risk, false);
  assert.equal(a.note, null);
  assert.equal(a.is_career_window, true);
});
