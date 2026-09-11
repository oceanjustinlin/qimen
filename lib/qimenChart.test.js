const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQimenChart } = require('./qimenChart.js');
const { parsePanTime } = require('./panTime.js');

// ── parsePanTime ──
test('parsePanTime: 缺省/非法回退 null（保证 worker 走"现在"路径）', () => {
  assert.equal(parsePanTime(null), null);
  assert.equal(parsePanTime(undefined), null);
  assert.equal(parsePanTime(''), null);
  assert.equal(parsePanTime('202702300900'), null); // 2月30日
  assert.equal(parsePanTime('202707012500'), null); // 25 时
  assert.equal(parsePanTime({ year: 1800, month: 1, day: 1, hour: 0, minute: 0 }), null); // 年越界
});

test('parsePanTime: 对象 / 12位串 / 带分隔串 都解析为同一结构', () => {
  const exp = { year: 2027, month: 7, day: 1, hour: 9, minute: 0 };
  assert.deepEqual(parsePanTime({ year: 2027, month: 7, day: 1, hour: 9, minute: 0 }), exp);
  assert.deepEqual(parsePanTime('202707010900'), exp);
  assert.deepEqual(parsePanTime('2027-07-01 09:00'), exp);
});

test('四柱年、月均以实际交节时刻为界，不混用农历年界', () => {
  const chart = buildQimenChart({ year: 2026, month: 2, day: 4, hour: 9, minute: 0 });
  assert.equal(chart.qimenData.pillars.year, '丙午');
  assert.equal(chart.qimenData.pillars.month, '庚寅');
  assert.equal(chart.yearGanzhi, '丙午');
  assert.equal(chart.monthGanzhi, '庚寅');
});

test('天禽值符按中宫寄坤保存原宫与有效落宫', () => {
  const chart = buildQimenChart({ year: 2026, month: 9, day: 6, hour: 4, minute: 0 });
  assert.equal(chart.zhiFuStar, '天禽');
  assert.equal(chart.qimenData.ju_info.zhi_fu_original_palace, '中5宫');
  assert.equal(chart.qimenData.ju_info.zhi_fu_is_hosted, true);
  assert.equal(chart.qimenData.ju_info.zhi_fu_palace, '落坤2宫');
  assert.equal(chart.qimenData.palaces[2].is_zhifu_effective_palace, true);
});

// ── buildQimenChart golden master（CP1 人工核对权威盘"时家拆补转盘"通过的样本）──
// 锁死：定元(符头拆补法) + 局 + 四柱 + 值符/值使及落宫 + 空亡/马星。
const CASES = [
  {
    name: '2027-07-01 09:01 夏至上元(超神)',
    t: { year: 2027, month: 7, day: 1, hour: 9, minute: 1 },
    ju: '陰遁9局', jieqi: '夏至', yuan: '上元',
    pillars: { year: '丁未', month: '丙午', day: '辛巳', hour: '癸巳' },
    zhi_fu: '天柱', zhi_fu_palace: '落巽4宫', zhi_shi: '驚門', zhi_shi_palace: '落兑7宫',
    kong: { day: '申酉', hour: '午未' }, ma: { day: '亥', hour: '亥' }
  },
  {
    name: '2020-01-01 14:30 冬至中元',
    t: { year: 2020, month: 1, day: 1, hour: 14, minute: 30 },
    ju: '陽遁7局', jieqi: '冬至', yuan: '中元',
    pillars: { year: '己亥', month: '丙子', day: '癸卯', hour: '己未' },
    zhi_fu: '天沖', zhi_fu_palace: '落艮8宫', zhi_shi: '傷門', zhi_shi_palace: '落艮8宫',
    kong: { day: '辰巳', hour: '子丑' }, ma: { day: '巳', hour: '巳' }
  },
  {
    name: '2027-06-21 22:15 夏至中元(节气交接后)',
    t: { year: 2027, month: 6, day: 21, hour: 22, minute: 15 },
    ju: '陰遁3局', jieqi: '夏至', yuan: '中元',
    pillars: { year: '丁未', month: '丙午', day: '辛未', hour: '己亥' },
    zhi_fu: '天英', zhi_fu_palace: '落坤2宫', zhi_shi: '景門', zhi_shi_palace: '落巽4宫',
    kong: { day: '戌亥', hour: '辰巳' }, ma: { day: '巳', hour: '巳' }
  },
  {
    name: '2025-12-21 23:10 冬至上元(晚子时三重边界)',
    t: { year: 2025, month: 12, day: 21, hour: 23, minute: 10 },
    ju: '陽遁1局', jieqi: '冬至', yuan: '上元',
    pillars: { year: '乙巳', month: '戊子', day: '甲子', hour: '丙子' },
    zhi_fu: '天芮', zhi_fu_palace: '落艮8宫', zhi_shi: '死門', zhi_shi_palace: '落巽4宫',
    kong: { day: '戌亥', hour: '申酉' }, ma: { day: '寅', hour: '寅' }
  },
  {
    name: '2026-01-01 00:30 冬至下元(跨年早子时·伏吟)',
    t: { year: 2026, month: 1, day: 1, hour: 0, minute: 30 },
    ju: '陽遁4局', jieqi: '冬至', yuan: '下元',
    pillars: { year: '乙巳', month: '戊子', day: '乙亥', hour: '丙子' },
    zhi_fu: '天禽', zhi_fu_palace: '落坤2宫', zhi_shi: '死門', zhi_shi_palace: '落兑7宫',
    kong: { day: '申酉', hour: '申酉' }, ma: { day: '巳', hour: '寅' }
  },
  {
    name: '2025-08-01 10:00 大暑中元(农历闰六月)',
    t: { year: 2025, month: 8, day: 1, hour: 10, minute: 0 },
    ju: '陰遁1局', jieqi: '大暑', yuan: '中元',
    pillars: { year: '乙巳', month: '癸未', day: '壬寅', hour: '乙巳' },
    zhi_fu: '天心', zhi_fu_palace: '落坤2宫', zhi_shi: '開門', zhi_shi_palace: '落坤2宫',
    kong: { day: '辰巳', hour: '寅卯' }, ma: { day: '申', hour: '亥' }
  }
];

for (const c of CASES) {
  test(`buildQimenChart golden: ${c.name}`, () => {
    const { qimenData: q } = buildQimenChart(c.t);
    assert.equal(q.ju_info.name, c.ju, '局数(定元)');
    assert.equal(q.ju_info.jieqi, c.jieqi, '节气');
    assert.equal(q.ju_info.yuan, c.yuan, '三元');
    assert.deepEqual(q.pillars, c.pillars, '四柱');
    assert.equal(q.ju_info.zhi_fu, c.zhi_fu, '值符星');
    assert.equal(q.ju_info.zhi_fu_palace, c.zhi_fu_palace, '值符落宫');
    assert.equal(q.ju_info.zhi_shi, c.zhi_shi, '值使门');
    assert.equal(q.ju_info.zhi_shi_palace, c.zhi_shi_palace, '值使落宫');
    assert.equal(q.auxiliary.kong_wang.day, c.kong.day, '日空');
    assert.equal(q.auxiliary.kong_wang.hour, c.kong.hour, '时空');
    assert.equal(q.auxiliary.ma_xing.day, c.ma.day, '日马');
    assert.equal(q.auxiliary.ma_xing.hour, c.ma.hour, '时马');
  });
}

// 锁死全盘天地盘干分布（取 2027-07-01 案例若干宫，CP1 已逐宫核对）
test('buildQimenChart golden: 2027-07-01 九宫天地盘干抽样', () => {
  const { qimenData: q } = buildQimenChart({ year: 2027, month: 7, day: 1, hour: 9, minute: 1 });
  const byName = Object.fromEntries(q.palaces.map(p => [p.name, p]));
  // 巽4：值符·天柱·杜門，天盘庚→地盘癸
  assert.deepEqual(
    { god: byName['巽4宫'].god, star: byName['巽4宫'].star, door: byName['巽4宫'].door, sky: byName['巽4宫'].sky, earth: byName['巽4宫'].earth },
    { god: '值符', star: '天柱', door: '杜門', sky: '庚', earth: '癸' }
  );
  // 乾6：白虎·天冲·開門，天盘丁→地盘辛，带马
  assert.deepEqual(
    { star: byName['乾6宫'].star, door: byName['乾6宫'].door, sky: byName['乾6宫'].sky, earth: byName['乾6宫'].earth, hasMa: byName['乾6宫'].ma_xing.has_ma },
    { star: '天沖', door: '開門', sky: '丁', earth: '辛', hasMa: true }
  );
  // 坎1：六合·天辅·休門，天盘癸→地盘乙
  assert.deepEqual(
    { star: byName['坎1宫'].star, door: byName['坎1宫'].door, sky: byName['坎1宫'].sky, earth: byName['坎1宫'].earth },
    { star: '天輔', door: '休門', sky: '癸', earth: '乙' }
  );
});
