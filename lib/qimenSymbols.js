'use strict';

// 奇门用神符号的统一归一化与落宫匹配。
// 评分（qimenScoringEngine）、应期（qimenTimingRules）与复核起局共用同一套口径，
// 避免「同一个用神，评分找得到、应期找不到」或繁简字形不一致导致漏判。
//
// 约定：
//  - 门/星/神一律归一化为简体规范字（開門→开门、天沖→天冲、滕蛇/騰蛇/螣蛇→腾蛇、太陰→太阴、勾陳→勾陈）。
//  - 「X星」与「X」等价（天芮星 = 天芮）。
//  - 「A/B」表示任一命中。
//  - 天干类用神只看天盘（含天禽寄坤带来的寄干），不再与地盘同字重复命中。
//  - 「甲」不上盘，按当前旬首所遁六仪取宫。
//  - 中5宫在转盘中不承载门星神，任何符号都不落中宫。

const STEMS = new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

const DOOR_CHAR_MAP = { 門: '门', 開: '开', 傷: '伤', 驚: '惊' };
const STAR_CHAR_MAP = { 輔: '辅', 沖: '冲' };
const GOD_ALIASES = {
  滕蛇: '腾蛇',
  騰蛇: '腾蛇',
  螣蛇: '腾蛇',
  太陰: '太阴',
  勾陳: '勾陈',
  白虎: '白虎',
  玄武: '玄武'
};

function normalizeText(value) {
  return String(value || '').trim();
}

function replaceChars(value, map) {
  return normalizeText(value).replace(/./g, (ch) => map[ch] || ch);
}

function normalizeDoor(value) {
  return replaceChars(value, DOOR_CHAR_MAP);
}

function normalizeStar(value) {
  return replaceChars(value, STAR_CHAR_MAP).replace(/星$/, '');
}

function normalizeGod(value) {
  const text = normalizeText(value);
  return GOD_ALIASES[text] || text;
}

function isCenterPalace(palace = {}) {
  return Boolean(palace.is_center) || palace.index === 4;
}

function getSkyStems(palace = {}) {
  const values = Array.isArray(palace.sky_stems) ? palace.sky_stems : [palace.sky, palace.ji_sky];
  return [...new Set(values.map(normalizeText).filter((stem) => STEMS.has(stem)))];
}

function getStars(palace = {}) {
  return [palace.star, palace.ji_star].map(normalizeStar).filter(Boolean);
}

function splitSymbol(symbol) {
  return normalizeText(symbol).split('/').map(normalizeText).filter(Boolean);
}

// 单个原子符号（不含 /）的落宫判断。context 提供本盘的可见日干/时干/年干与旬首遁仪。
function matchesAtom(palace, atom, context = {}) {
  if (atom === '日干') return Boolean(palace.isDayStem);
  if (atom === '时干') return Boolean(palace.isHourStem);
  if (atom === '年干') return Boolean(context.yearStemVisible) && getSkyStems(palace).includes(context.yearStemVisible);
  if (atom === '月干') return Boolean(context.monthStemVisible) && getSkyStems(palace).includes(context.monthStemVisible);
  if (atom === '值使门' || atom === '值使') return Boolean(palace.isZhiShi);
  if (atom === '值符') return normalizeGod(palace.god) === '值符';
  if (atom === '马星' || atom === '驿马') return Boolean(palace.hasMa || palace.hasHorse);
  if (/^[巽离坤震兑艮坎乾]宫$/.test(atom)) return normalizeText(palace.name).startsWith(atom[0]);
  if (STEMS.has(atom)) {
    const stem = atom === '甲' ? normalizeText(context.jiaHiddenStem) : atom;
    return Boolean(stem) && getSkyStems(palace).includes(stem);
  }
  const door = normalizeDoor(atom);
  if (door.endsWith('门')) return normalizeDoor(palace.door) === door;
  const star = normalizeStar(atom);
  if (star.startsWith('天') && getStars(palace).includes(star)) return true;
  return normalizeGod(palace.god) === normalizeGod(atom);
}

function matchesSymbol(palace = {}, symbol = '', context = {}) {
  if (!palace || isCenterPalace(palace)) return false;
  return splitSymbol(symbol).some((atom) => matchesAtom(palace, atom, context));
}

function findSymbolPalace(palaces = [], symbol = '', context = {}) {
  return (palaces || []).find((palace) => matchesSymbol(palace, symbol, context)) || null;
}

// 用神落宫后代表的天干：天干类用神取自身（甲取遁仪），日干/时干取可见干，其余取该宫天盘干。
function resolveSymbolStem(symbol = '', palace = null, context = {}) {
  const atoms = splitSymbol(symbol);
  for (const atom of atoms) {
    if (STEMS.has(atom)) return atom === '甲' ? normalizeText(context.jiaHiddenStem) : atom;
    if (atom === '日干' && context.dayStemVisible) return context.dayStemVisible;
    if (atom === '时干' && context.hourStemVisible) return context.hourStemVisible;
  }
  return normalizeText(palace?.sky) || '';
}

module.exports = {
  normalizeText,
  normalizeDoor,
  normalizeStar,
  normalizeGod,
  isCenterPalace,
  getSkyStems,
  splitSymbol,
  matchesSymbol,
  findSymbolPalace,
  resolveSymbolStem
};
