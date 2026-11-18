'use strict';
/**
 * 测试与验收用的命盘样本（spec §13.0）：10:00（巳时）、男、不做真太阳时修正。
 * 时辰不详的样本：S1、S2 十二时辰结论一致（稳定），S3、S5 不一致（不稳定）。
 */

const { normalizePerson, toView } = require('./input');

const SAMPLES = {
  S1: '1992-02-18', // 壬申 壬寅 甲子 己巳 身强
  S2: '1992-01-14', // 辛未 辛丑 己丑 己巳 身弱
  S3: '1992-02-24', // 壬申 壬寅 庚午 辛巳 身弱
  S4: '1992-01-19', // 辛未 辛丑 甲午 己巳 身弱
  S5: '1992-02-20', // 壬申 壬寅 丙寅 癸巳 身强
  S6: '1992-02-05', // 壬申 壬寅 辛亥 癸巳 身弱
};

const cache = new Map();

/** @param {string} code S1…S6 @param {object} [opts] { hourKnown = true, gender = 'M' } */
function samplePerson(code, { hourKnown = true, gender = 'M' } = {}) {
  const key = `${code}|${hourKnown}|${gender}`;
  if (!cache.has(key)) {
    cache.set(key, normalizePerson(
      { birth_date: SAMPLES[code], hour_index: hourKnown ? 5 : -1, gender },
      { currentYear: 2026 },
    ));
  }
  return cache.get(key);
}

function sampleView(code, opts) {
  return toView(samplePerson(code, opts));
}

module.exports = { SAMPLES, samplePerson, sampleView };
