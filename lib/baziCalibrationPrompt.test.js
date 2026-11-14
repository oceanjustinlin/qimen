const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCalibrationPrompt, yearGanzhi } = require('./baziCalibrationPrompt');

const profile = {
  gender: 'M',
  bazi_str: '丁卯 戊申 庚寅 丁亥',
  geju: '正官格',
  strong_weak: '身弱',
  favorable_elements: ['土', '金'],
  unfavorable_elements: ['火', '木'],
  bazi_detail: {
    matrix: {
      current_dayun: { gan: '甲', zhi: '辰', star: '偏财' },
      current_liunian: { gan: '丙', zhi: '午', star: '七杀' },
      dayun_list: [
        { gan: '乙', zhi: '巳', shi_shen: '财', liunian_list: [{ year: 2012, gan: '壬', zhi: '辰', shi_shen: '食', dayun_ganzhi: '乙巳' }] },
      ],
    },
  },
};

test('yearGanzhi 按公历年换算干支', () => {
  assert.equal(yearGanzhi(2026), '丙午');
  assert.equal(yearGanzhi(1984), '甲子');
});

test('纠偏 prompt 给出当前时间、当前大运流年与事件干支五行', () => {
  const prompt = buildCalibrationPrompt(profile, [
    { year: 2012, month: 10, impact: -1, category: 'relationship', description: '结婚，婚后争吵多', dayun_at_time: '乙巳' },
    { year: 2019, impact: 1, category: 'career', description: '升职' },
  ], { now: new Date(2026, 10, 13) });

  assert.match(prompt, /今天：2026年11月13日/);
  assert.match(prompt, /当前大运：甲辰（木\/土），天干十神偏财/);
  assert.match(prompt, /当前流年（2026年）：丙午（火\/火）/);
  assert.match(prompt, /明年（2027年）：流年丁未/);
  assert.match(prompt, /2012年10月：流年壬辰（水\/土），十神食；当时大运乙巳（木\/火），十神财/);
  assert.match(prompt, /2019年（月份不详）：流年己亥（土\/水）/);
  assert.match(prompt, /性别：男/);
  assert.match(prompt, /命主描述：结婚，婚后争吵多/);
});

test('没有事件时不生成 prompt', () => {
  assert.equal(buildCalibrationPrompt(profile, []), '');
});
