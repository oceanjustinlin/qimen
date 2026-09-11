'use strict';

/**
 * 《遁甲演义》（四库全书本）固定规则。
 *
 * 本模块只放可以从所选底本直接落成判定条件的盘面事实。数值权重属于产品排序，
 * 不放在这里，也不得把权重描述成古籍原有分数。
 */
const QIMEN_RULESET_VERSION = 'dunjia-yanyi-siku-v1';
const QIMEN_PRIMARY_SOURCE = Object.freeze({
  title: '《遁甲演义》（四库全书本）',
  url: 'https://zh.wikisource.org/zh-hant/遁甲演義_(四庫全書本)/全覽',
  locator: '卷一《烟波钓叟赋》'
});

const STEM_ELEMENTS = Object.freeze({
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水'
});
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const CONTROLS = Object.freeze({ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });

// “甲子直符愁向东，戌刑在未，申刑虎，寅巳辰辰午刑午。”
// 数组索引顺序：巽4、离9、坤2、震3、中5、兑7、艮8、坎1、乾6。
const XUN_HEAD_PUNISHMENT_PALACE = Object.freeze({
  甲子: 3,
  甲戌: 2,
  甲申: 6,
  甲午: 1,
  甲辰: 0,
  甲寅: 0
});

// “甲日那堪相见未，丙奇属火火墓戌……六乙来临二，月奇临六亦同论。”
const SAN_QI_TOMB_PALACE = Object.freeze({ 乙: 2, 丙: 8, 丁: 6 });
const SAN_QI_TOMB_BRANCH = Object.freeze({ 乙: '未', 丙: '戌', 丁: '丑' });

// “时干入墓……戊戌、壬辰兼丙戌、癸未、丁丑。”
// 只编码底本明确列出的干；未列者不以这一条强行类推。
const EXPLICIT_STEM_TOMB_BRANCH = Object.freeze({ 戊: '戌', 壬: '辰', 丙: '戌', 癸: '未', 丁: '丑' });
const EXPLICIT_STEM_TOMB_PALACE = Object.freeze({ 戊: 8, 壬: 0, 丙: 8, 癸: 2, 丁: 6 });

// “乙逢犬马，丙鼠猴，六丁玉女骑龙虎。”犬马=甲戌己/甲午辛，依次类推。
const SAN_QI_DE_SHI_EARTH_STEMS = Object.freeze({
  乙: new Set(['己', '辛']),
  丙: new Set(['戊', '庚']),
  丁: new Set(['壬', '癸'])
});

function normalizeStem(value) {
  const stem = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(STEM_ELEMENTS, stem) ? stem : '';
}

function getPalaceSkyStems(palace = {}) {
  const values = Array.isArray(palace.sky_stems)
    ? palace.sky_stems
    : [palace.sky, palace.ji_sky];
  return [...new Set(values.map(normalizeStem).filter(Boolean))];
}

function getPalaceEarthStems(palace = {}) {
  return [...new Set([palace.earth, palace.ji_earth].map(normalizeStem).filter(Boolean))];
}

function samePolarity(stemA, stemB) {
  const a = normalizeStem(stemA);
  const b = normalizeStem(stemB);
  return Boolean(a && b && YANG_STEMS.has(a) === YANG_STEMS.has(b));
}

// “时干来克日干上”；同书释例按阳克阳、阴克阴取五不遇时。
function isWuBuYuShi(dayStem, hourStem) {
  const day = normalizeStem(dayStem);
  const hour = normalizeStem(hourStem);
  return Boolean(day && hour && samePolarity(day, hour)
    && CONTROLS[STEM_ELEMENTS[hour]] === STEM_ELEMENTS[day]);
}

function findLiuYiJiXingPalace(palaces = [], xunHead = '') {
  const punishmentIndex = XUN_HEAD_PUNISHMENT_PALACE[xunHead];
  if (punishmentIndex === undefined) return null;
  const palace = palaces.find((item) => item && item.index === punishmentIndex && (item.isZhiFu || item.is_zhifu_effective_palace));
  return palace || null;
}

function findSanQiDeShiPalace(palaces = []) {
  return palaces.find((palace) => {
    const earthStems = getPalaceEarthStems(palace);
    return getPalaceSkyStems(palace).some((sky) => (
      earthStems.some((earth) => SAN_QI_DE_SHI_EARTH_STEMS[sky]?.has(earth))
    ));
  }) || null;
}

// 《阴符经》同篇作“使加六丁为守户”，《遁甲演义》排例取值使加地盘丁。
function findYuNvShouMenPalace(palaces = []) {
  return palaces.find((palace) => palace && palace.isZhiShi && getPalaceEarthStems(palace).includes('丁')) || null;
}

module.exports = {
  QIMEN_RULESET_VERSION,
  QIMEN_PRIMARY_SOURCE,
  STEM_ELEMENTS,
  YANG_STEMS,
  CONTROLS,
  XUN_HEAD_PUNISHMENT_PALACE,
  SAN_QI_TOMB_PALACE,
  SAN_QI_TOMB_BRANCH,
  EXPLICIT_STEM_TOMB_BRANCH,
  EXPLICIT_STEM_TOMB_PALACE,
  SAN_QI_DE_SHI_EARTH_STEMS,
  getPalaceSkyStems,
  getPalaceEarthStems,
  samePolarity,
  isWuBuYuShi,
  findLiuYiJiXingPalace,
  findSanQiDeShiPalace,
  findYuNvShouMenPalace
};
