'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCareerPicture } = require('./baziCareerPicture');

const pic = (p) => buildCareerPicture({ pillars: p });

test('A 普通格 / 势水', () => {
  const r = pic({ year: '壬寅', month: '辛亥', day: '戊辰', hour: '癸丑' });
  assert.equal(r.pattern_type, '普通');
  assert.equal(r.dominant_element, '水');
  assert.equal(r.day_master, '戊');
});

test('Q 润下 → 特殊格', () => {
  const r = pic({ year: '壬子', month: '辛亥', day: '癸丑', hour: '壬子' });
  assert.equal(r.pattern_type, '特殊');
  assert.equal(r.special_kind, '润下格');
});

test('制化配置关键对照：J 七杀有制 ↔ K 七杀无制', () => {
  const j = pic({ year: '庚申', month: '庚辰', day: '甲戌', hour: '丙寅' });
  assert.equal(j.career_star_config.has_qisha, true);
  assert.equal(j.career_star_config.qisha_controlled, true);   // 丙食神透→食神制杀
  assert.equal(j.career_star_config.qisha_control.by_food, true);

  const k = pic({ year: '甲申', month: '甲戌', day: '甲寅', hour: '甲戌' });
  assert.equal(k.career_star_config.has_qisha, true);
  assert.equal(k.career_star_config.qisha_controlled, false);  // 火全藏不透→无制
});

test('I 丙午日 → 标记羊刃', () => {
  const r = pic({ year: '癸巳', month: '戊午', day: '丙午', hour: '壬辰' });
  assert.equal(r.career_star_config.has_yangren, true);
});

test('缺柱抛错', () => {
  assert.throws(() => buildCareerPicture({ pillars: { year: '甲子' } }), TypeError);
});
