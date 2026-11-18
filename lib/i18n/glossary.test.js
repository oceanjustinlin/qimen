'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const glossary = require('./glossary.js');
const core = require('../constants/core.js');
const qimen = require('../QimenConstants.js');
const shensha = require('../constants/shensha.js');
const patterns = require('../baziPatternStatements.js');
const categories = require('../divinationCategories.js');

function assertAllLookup(names, label) {
  const missing = [...new Set(names)].filter((n) => n && !glossary.lookup(n));
  assert.deepEqual(missing, [], `${label} 缺术语：${missing.join('、')}`);
}

test('覆盖：天干、地支、五行、十神、十二长生', () => {
  assertAllLookup(core.GAN, '天干');
  assertAllLookup(core.ZHI, '地支');
  assertAllLookup(Object.values(core.GAN5), '五行');
  assertAllLookup(Object.values(core.ZHI_WUHANGS), '五行');
  assertAllLookup(Object.values(core.SHISHEN).flatMap((row) => Object.values(row)), '十神简称');
  assertAllLookup(['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'], '十神');
  assertAllLookup(core.SHI_ER, '十二长生');
});

test('覆盖：八门、九星、八神、九宫名、三元', () => {
  assertAllLookup(qimen.EIGHT_DOORS_ORIGINAL, '八门');
  assertAllLookup(qimen.EIGHT_DOORS_SEQUENCE, '八门');
  assertAllLookup(qimen.QIMEN_STARS, '九星');
  assertAllLookup(qimen.EIGHT_GODS_YANG, '八神');
  assertAllLookup(qimen.EIGHT_GODS_YIN, '八神');
  assertAllLookup(qimen.HETU_BAGUA, '九宫');
  assertAllLookup(qimen.LUOSHU_BAGUA, '九宫');
  assertAllLookup(qimen.YUAN_NAMES, '三元');
});

test('覆盖：全部神煞名', () => {
  const names = [];
  for (const key of ['YEAR_SHENS', 'YEAR_GAN_SHENS', 'MONTH_SHENS', 'DAY_SHENS', 'G_SHENS', 'SPECIAL_DAYS', 'SHENS_INFOS']) {
    names.push(...Object.keys(shensha[key] || {}));
  }
  assertAllLookup(names, '神煞');
});

test('覆盖：全部格局名', () => {
  assertAllLookup(Object.keys(patterns.PATTERN_STATEMENT_LIBRARY), '格局');
});

test('覆盖：全部一级分类 label', () => {
  assertAllLookup(Object.values(categories.DIVINATION_CATEGORIES).map((c) => c.label), '分类');
});

test('zh 与 variants 无重复，group 合法，en 非空且不含汉字', () => {
  const seen = new Map();
  for (const e of glossary.entries) {
    assert.ok(glossary.GROUPS.includes(e.group), `${e.zh} group=${e.group}`);
    assert.ok(e.en && !/[\u3400-\u9fff]/.test(e.en), `${e.zh} en=${e.en}`);
    for (const key of [e.zh, ...(e.variants || [])]) {
      assert.ok(!seen.has(key), `重复键 ${key}（${seen.get(key)} / ${e.zh}）`);
      seen.set(key, e.zh);
    }
  }
});

test('formatBilingual / toEnglish', () => {
  assert.equal(glossary.formatBilingual('开门'), 'Open Door (开门)');
  assert.equal(glossary.formatBilingual('開門'), 'Open Door (開門)');
  assert.equal(glossary.formatBilingual('不存在'), '不存在');
  assert.equal(glossary.toEnglish('日主'), 'Day Master');
  assert.equal(glossary.toEnglish('不存在'), undefined);
  assert.equal(glossary.formatBilingual(''), '');
  assert.equal(glossary.lookup(undefined), undefined);
});

test('buildPromptGlossaryBlock 稳定且包含 spec §5.5 的译名', () => {
  const a = glossary.buildPromptGlossaryBlock();
  const b = glossary.buildPromptGlossaryBlock();
  assert.equal(a, b);
  assert.ok(!a.includes('${'));
  for (const en of ['Jia', 'Gui', 'Chou', 'Hai', 'Wood', 'Water', 'Seven Killings', 'Open Door', 'Tian Chong', 'White Tiger', 'Center 5', 'Day Master', 'Envoy Door', 'Highly Favorable', 'Below Average']) {
    assert.ok(a.includes(en), en);
  }
});

test('spec §5.5 核心译名', () => {
  const expected = {
    甲: 'Jia', 乙: 'Yi', 丙: 'Bing', 丁: 'Ding', 戊: 'Wu', 己: 'Ji', 庚: 'Geng', 辛: 'Xin', 壬: 'Ren', 癸: 'Gui',
    子: 'Zi', 丑: 'Chou', 寅: 'Yin', 卯: 'Mao', 辰: 'Chen', 巳: 'Si', 午: 'Wu', 未: 'Wei', 申: 'Shen', 酉: 'You', 戌: 'Xu', 亥: 'Hai',
    木: 'Wood', 火: 'Fire', 土: 'Earth', 金: 'Metal', 水: 'Water',
    比肩: 'Friend', 劫财: 'Rob Wealth', 食神: 'Eating God', 伤官: 'Hurting Officer', 偏财: 'Indirect Wealth',
    正财: 'Direct Wealth', 七杀: 'Seven Killings', 正官: 'Direct Officer', 偏印: 'Indirect Resource', 正印: 'Direct Resource',
    休门: 'Rest Door', 生门: 'Life Door', 伤门: 'Harm Door', 杜门: 'Block Door', 景门: 'Scenery Door', 死门: 'Death Door', 惊门: 'Fear Door', 开门: 'Open Door',
    天蓬: 'Tian Peng', 天芮: 'Tian Rui', 天冲: 'Tian Chong', 天辅: 'Tian Fu', 天禽: 'Tian Qin', 天心: 'Tian Xin', 天柱: 'Tian Zhu', 天任: 'Tian Ren', 天英: 'Tian Ying',
    值符: 'Chief', 螣蛇: 'Serpent', 太阴: 'Moon', 六合: 'Harmony', 白虎: 'White Tiger', 玄武: 'Black Tortoise', 九地: 'Nine Earth', 九天: 'Nine Heaven', 勾陈: 'Hook', 朱雀: 'Red Phoenix',
    坎一宫: 'Kan 1', 坤二宫: 'Kun 2', 震三宫: 'Zhen 3', 巽四宫: 'Xun 4', 中五宫: 'Center 5', 乾六宫: 'Qian 6', 兑七宫: 'Dui 7', 艮八宫: 'Gen 8', 离九宫: 'Li 9',
    日主: 'Day Master', 用神: 'Useful God', 喜神: 'Favorable God', 忌神: 'Unfavorable God', 格局: 'Structure', 大运: 'Luck Pillar',
    流年: 'Annual Pillar', 流月: 'Monthly Pillar', 身强: 'Strong Day Master', 身弱: 'Weak Day Master', 调候: 'Climate Balance', 神煞: 'Symbolic Stars', 藏干: 'Hidden Stems',
    值使: 'Envoy Door', 空亡: 'Void', 驿马: 'Travelling Horse', 伏吟: 'Fu Yin', 反吟: 'Fan Yin', 应期: 'Timing Window', 旬首: 'Xun Leader',
    阳遁: 'Yang Dun', 阴遁: 'Yin Dun', 入墓: 'Entering the Tomb', 击刑: 'Punishment',
    大吉: 'Highly Favorable', 小吉: 'Favorable', 平: 'Neutral', 凶: 'Unfavorable', 中上吉: 'Above Average', 中平: 'Average', 偏凶: 'Below Average',
  };
  for (const [zh, en] of Object.entries(expected)) {
    assert.equal(glossary.lookup(zh)?.zh, zh, `${zh} 应为条目主键`);
    assert.equal(glossary.toEnglish(zh), en, zh);
  }
});
