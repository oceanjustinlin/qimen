const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SAN_QI_TOMB_PALACE,
  EXPLICIT_STEM_TOMB_PALACE,
  isWuBuYuShi,
  findLiuYiJiXingPalace,
  findSanQiDeShiPalace,
  findYuNvShouMenPalace
} = require('./qimenClassicalRules');

test('《遁甲演义》三奇墓与明载时干墓使用同一宫位索引口径', () => {
  assert.deepEqual(SAN_QI_TOMB_PALACE, { 乙: 2, 丙: 8, 丁: 6 });
  assert.equal(EXPLICIT_STEM_TOMB_PALACE.丙, SAN_QI_TOMB_PALACE.丙);
  assert.equal(EXPLICIT_STEM_TOMB_PALACE.丁, SAN_QI_TOMB_PALACE.丁);
});

test('五不遇时要求时干同性相克日干', () => {
  assert.equal(isWuBuYuShi('甲', '庚'), true);
  assert.equal(isWuBuYuShi('甲', '辛'), false);
  assert.equal(isWuBuYuShi('甲', '壬'), false);
});

test('六仪击刑取旬首值符所落刑宫', () => {
  const palaces = [
    { index: 3, isZhiFu: true, sky: '戊', earth: '乙' },
    { index: 2, isZhiFu: false, sky: '乙', earth: '己' }
  ];
  assert.equal(findLiuYiJiXingPalace(palaces, '甲子')?.index, 3);
  assert.equal(findLiuYiJiXingPalace(palaces, '甲戌'), null);
});

test('三奇得使取六组奇仪组合，玉女守门取值使加地丁', () => {
  assert.equal(findSanQiDeShiPalace([{ index: 1, sky: '丙', earth: '庚', isZhiShi: false }])?.index, 1);
  assert.equal(findSanQiDeShiPalace([{ index: 1, sky: '丙', earth: '辛', isZhiShi: true }]), null);
  assert.equal(findYuNvShouMenPalace([{ index: 5, sky: '乙', earth: '丁', isZhiShi: true }])?.index, 5);
  assert.equal(findYuNvShouMenPalace([{ index: 5, sky: '丁', earth: '乙', isZhiShi: true }]), null);
  assert.equal(findSanQiDeShiPalace([{ index: 2, sky: '壬', ji_sky: '丁', earth: '乙', ji_earth: '癸' }])?.index, 2);
  assert.equal(findYuNvShouMenPalace([{ index: 2, earth: '乙', ji_earth: '丁', isZhiShi: true }])?.index, 2);
});
