'use strict';
// 西洋占星的静态对照表：星座、星体、相位、庙旺落陷。只放公认的固定表，不放断语。

const SIGNS = [
  { key: 'aries', name: '白羊', element: 'fire', modality: 'cardinal', ruler: 'mars' },
  { key: 'taurus', name: '金牛', element: 'earth', modality: 'fixed', ruler: 'venus' },
  { key: 'gemini', name: '双子', element: 'air', modality: 'mutable', ruler: 'mercury' },
  { key: 'cancer', name: '巨蟹', element: 'water', modality: 'cardinal', ruler: 'moon' },
  { key: 'leo', name: '狮子', element: 'fire', modality: 'fixed', ruler: 'sun' },
  { key: 'virgo', name: '处女', element: 'earth', modality: 'mutable', ruler: 'mercury' },
  { key: 'libra', name: '天秤', element: 'air', modality: 'cardinal', ruler: 'venus' },
  { key: 'scorpio', name: '天蝎', element: 'water', modality: 'fixed', ruler: 'mars' },
  { key: 'sagittarius', name: '射手', element: 'fire', modality: 'mutable', ruler: 'jupiter' },
  { key: 'capricorn', name: '摩羯', element: 'earth', modality: 'cardinal', ruler: 'saturn' },
  { key: 'aquarius', name: '水瓶', element: 'air', modality: 'fixed', ruler: 'saturn' },
  { key: 'pisces', name: '双鱼', element: 'water', modality: 'mutable', ruler: 'jupiter' },
];

// astronomy-engine 的天体名；北交点单独计算
const PLANETS = [
  { key: 'sun', name: '太阳', body: 'Sun' },
  { key: 'moon', name: '月亮', body: 'Moon' },
  { key: 'mercury', name: '水星', body: 'Mercury' },
  { key: 'venus', name: '金星', body: 'Venus' },
  { key: 'mars', name: '火星', body: 'Mars' },
  { key: 'jupiter', name: '木星', body: 'Jupiter' },
  { key: 'saturn', name: '土星', body: 'Saturn' },
  { key: 'uranus', name: '天王星', body: 'Uranus' },
  { key: 'neptune', name: '海王星', body: 'Neptune' },
  { key: 'pluto', name: '冥王星', body: 'Pluto' },
];
const NODE = { key: 'north_node', name: '北交点' };

const ANGLE_NAMES = { asc: '上升', mc: '天顶', dsc: '下降', ic: '天底' };

// 托勒密五种主相位
const ASPECTS = [
  { type: 'conjunction', name: '合', angle: 0 },
  { type: 'sextile', name: '六合', angle: 60 },
  { type: 'square', name: '刑', angle: 90 },
  { type: 'trine', name: '拱', angle: 120 },
  { type: 'opposition', name: '冲', angle: 180 },
];

const ORB_PRESETS = {
  standard: { conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5 },
  tight: { conjunction: 5, opposition: 5, trine: 4, square: 4, sextile: 3 },
};

// 传统七星的入庙 / 擢升（旺）/ 失势（陷）/ 落：值为星座 key
const DIGNITIES = {
  sun: { domicile: ['leo'], exaltation: ['aries'], detriment: ['aquarius'], fall: ['libra'] },
  moon: { domicile: ['cancer'], exaltation: ['taurus'], detriment: ['capricorn'], fall: ['scorpio'] },
  mercury: { domicile: ['gemini', 'virgo'], exaltation: ['virgo'], detriment: ['sagittarius', 'pisces'], fall: ['pisces'] },
  venus: { domicile: ['taurus', 'libra'], exaltation: ['pisces'], detriment: ['scorpio', 'aries'], fall: ['virgo'] },
  mars: { domicile: ['aries', 'scorpio'], exaltation: ['capricorn'], detriment: ['libra', 'taurus'], fall: ['cancer'] },
  jupiter: { domicile: ['sagittarius', 'pisces'], exaltation: ['cancer'], detriment: ['gemini', 'virgo'], fall: ['capricorn'] },
  saturn: { domicile: ['capricorn', 'aquarius'], exaltation: ['libra'], detriment: ['cancer', 'leo'], fall: ['aries'] },
};
const DIGNITY_NAMES = { domicile: '入庙', exaltation: '擢升', detriment: '失势', fall: '落陷' };

const HOUSE_SYSTEMS = ['placidus', 'whole_sign', 'equal'];
const HOUSE_SYSTEM_NAMES = { placidus: 'Placidus', whole_sign: '整宫制', equal: '等宫制' };

module.exports = {
  SIGNS, PLANETS, NODE, ANGLE_NAMES, ASPECTS, ORB_PRESETS, DIGNITIES, DIGNITY_NAMES, HOUSE_SYSTEMS, HOUSE_SYSTEM_NAMES,
};
