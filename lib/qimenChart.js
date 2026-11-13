// 奇门起盘纯函数：给定北京民用时 { year, month, day, hour, minute }，
// 产出完整盘面（qimen_data）及下游所需的全部中间量。
// 与 worker/src/index.js 的 handleQimen 起盘段同源同算（同一组 Calc/U/qimenCore 函数、同一调用次序）。
// 定元采用「符头（最近甲/己日）」拆补法（见 QimenCalculations.calculateJuByChaiBu）。
const { Solar } = require('lunar-javascript');
const C = require('./QimenConstants.js');
const U = require('./QimenUtils.js');
const Calc = require('./QimenCalculations.js');
const { getMaXing, maXingMap, palaceBranches, getKongIndices } = require('./qimenCore.js');
const {
  SAN_QI_TOMB_PALACE,
  EXPLICIT_STEM_TOMB_PALACE,
  XUN_HEAD_PUNISHMENT_PALACE
} = require('./qimenClassicalRules.js');

const PALACE_NAMES = ['巽', '离', '坤', '震', '中', '兑', '艮', '坎', '乾'];
const PALACE_NUMBERS = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const OPPOSITE_PALACE = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const PALACE_ELEMENTS = ['木', '火', '土', '木', '土', '金', '土', '水', '金'];
const DOOR_ELEMENTS = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };
const CONTROLS = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function normalizeDoor(value) {
  return String(value || '').replace(/門/g, '门').replace(/開/g, '开').replace(/傷/g, '伤').replace(/驚/g, '惊');
}

function effectiveSkyStems({ sky, jiSky }) {
  return [sky, jiSky].filter(Boolean);
}

function isStarFuYin(nineStars) {
  return C.FLY_PATH.CLOCKWISE.every((index) => nineStars[index] === C.QIMEN_STARS[index]);
}

function isStarFanYin(nineStars) {
  return C.FLY_PATH.CLOCKWISE.every((index) => nineStars[index] === C.QIMEN_STARS[OPPOSITE_PALACE[index]]);
}

function buildQimenChart({ year, month, day, hour, minute }) {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  // 晚子时（23:00–23:59）采用「夜子时」口径：日柱、日空、定元仍属当日，时柱按次日起子时。
  // 这是有意的流派选择（与对照排盘软件一致），不要改成 Exact 换日。
  const ganzhiHour = lunar.getTimeInGanZhi();
  const ganzhiDay = lunar.getDayInGanZhi();

  const juResult = Calc.calculateJuByChaiBu(solar, C.JIEQI_JUSHU, C.YUAN_NAMES);
  const xunHead = U.getXunHead(ganzhiHour);
  const fuShou = U.getFuShou(xunHead);
  const flyStep = U.calculateFlyStep(xunHead, ganzhiHour);
  const rawTianGan = U.extractTianGan(ganzhiHour);
  const tianGan = U.resolveJiaHiding(rawTianGan, fuShou);

  const diPan = Calc.getDiPan(juResult.isYang, juResult.gameNumber);
  const zhiFuStar = Calc.getZhiFuStar(fuShou, diPan);
  const nineStars = Calc.calculateNineStars(zhiFuStar, tianGan, diPan);
  const zhiShiDoor = Calc.getZhiShiDoor(fuShou, diPan);
  const eightDoors = Calc.calculateEightDoors(juResult.isYang, zhiShiDoor, flyStep, fuShou, diPan);
  const eightGods = Calc.calculateEightGods(juResult.isYang, tianGan, diPan);
  const tianPanGan = Calc.calculateTianPan(juResult.isYang, tianGan, fuShou, diPan);

  const dayZhi = U.extractDiZhi(ganzhiDay);
  const hourZhi = U.extractDiZhi(ganzhiHour);
  const dayMa = getMaXing(dayZhi);
  const hourMa = getMaXing(hourZhi);
  const dayKongObj = lunar.getDayXunKong();
  const hourKongObj = lunar.getTimeXunKong();
  const dayKongIndices = getKongIndices(dayKongObj);
  const hourKongIndices = getKongIndices(hourKongObj);
  const tianRuiIndex = nineStars.indexOf('天芮');
  const centerEarthStem = diPan[4];

  const timestamp_solar = `${year}年${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const timestamp_lunar = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  const qimen_structure = `${juResult.yinYang}遁${juResult.gameNumber}局`;
  const dayStem = U.extractTianGan(ganzhiDay);
  const hourStem = U.extractTianGan(ganzhiHour);
  const yearGanzhi = lunar.getYearInGanZhiExact();
  const monthGanzhi = lunar.getMonthInGanZhiExact();
  const yearStem = U.extractTianGan(yearGanzhi);
  const monthStem = U.extractTianGan(monthGanzhi);
  const dayXunHead = U.getXunHead(ganzhiDay);
  const dayStemVisible = U.resolveJiaHiding(dayStem, U.getFuShou(dayXunHead));
  const hourStemVisible = tianGan;
  const isFuYin = isStarFuYin(nineStars);
  const isFanYin = isStarFanYin(nineStars);
  const rawZhiFuPalaceIndex = nineStars.indexOf(zhiFuStar);
  const effectiveZhiFuPalaceIndex = zhiFuStar === '天禽' ? tianRuiIndex : rawZhiFuPalaceIndex;

  const palaces = [];
  for (let i = 0; i < 9; i++) {
    if (i === 4) {
      palaces.push({ name: `${PALACE_NAMES[i]}${PALACE_NUMBERS[i]}宫`, is_center: true, earth: diPan[i], index: i });
    } else {
      const jiSky = (i === tianRuiIndex) ? centerEarthStem : '';
      const skyStems = effectiveSkyStems({ sky: tianPanGan[i], jiSky });
      palaces.push({
        star: nineStars[i], ji_star: (i === tianRuiIndex) ? '天禽' : '', sky: tianPanGan[i], ji_sky: jiSky,
        door: eightDoors[i], god: eightGods[i], earth: diPan[i], ji_earth: (i === 2) ? centerEarthStem : '',
        stem_relation: U.getStemRelation(tianPanGan[i], diPan[i]),
        kong_wang: { day: dayKongIndices.includes(i), is_kong: dayKongIndices.includes(i) || hourKongIndices.includes(i), hour: hourKongIndices.includes(i) },
        ma_xing: { day: i === maXingMap[dayMa], has_ma: i === maXingMap[dayMa] || i === maXingMap[hourMa], hour: i === maXingMap[hourMa] },
        is_day_stem_sky: skyStems.includes(dayStemVisible),
        is_hour_stem_sky: skyStems.includes(hourStemVisible),
        is_day_stem_earth: diPan[i] === dayStemVisible || (i === 2 && centerEarthStem === dayStemVisible),
        is_hour_stem_earth: diPan[i] === hourStemVisible || (i === 2 && centerEarthStem === hourStemVisible),
        is_zhifu_effective_palace: i === effectiveZhiFuPalaceIndex,
        name: `${PALACE_NAMES[i]}${PALACE_NUMBERS[i]}宫`, index: i
      });
    }
  }

  const qimenData = {
    status: 'success',
    pillars: { hour: ganzhiHour, month: monthGanzhi, day: ganzhiDay, year: yearGanzhi },
    timestamp: { solar: timestamp_solar, lunar: timestamp_lunar },
    ju_info: {
      zhi_fu: zhiFuStar,
      zhi_fu_palace: `落${PALACE_NAMES[effectiveZhiFuPalaceIndex]}${PALACE_NUMBERS[effectiveZhiFuPalaceIndex]}宫`,
      zhi_fu_original_palace: rawZhiFuPalaceIndex === 4 ? '中5宫' : `${PALACE_NAMES[rawZhiFuPalaceIndex]}${PALACE_NUMBERS[rawZhiFuPalaceIndex]}宫`,
      zhi_fu_is_hosted: rawZhiFuPalaceIndex === 4,
      zhi_shi_palace: `落${PALACE_NAMES[eightDoors.indexOf(zhiShiDoor)]}${PALACE_NUMBERS[eightDoors.indexOf(zhiShiDoor)]}宫`,
      jieqi: juResult.jieQiName, yuan: juResult.yuanName, zhi_shi: zhiShiDoor, name: qimen_structure, xun_shou: xunHead
    },
    auxiliary: { ma_xing: { day: dayMa, hour: hourMa }, kong_wang: { day: dayKongObj, hour: hourKongObj } },
    palaces
  };

  return {
    solar, lunar, ganzhiHour, ganzhiDay, yearGanzhi, monthGanzhi,
    yearStem, monthStem, dayStem, hourStem, dayStemVisible, hourStemVisible, dayZhi, hourZhi,
    juResult, xunHead, fuShou, flyStep, tianGan,
    diPan, zhiFuStar, nineStars, zhiShiDoor, eightDoors, eightGods, tianPanGan,
    dayMa, hourMa, dayKongObj, hourKongObj, dayKongIndices, hourKongIndices,
    tianRuiIndex, centerEarthStem, rawZhiFuPalaceIndex, effectiveZhiFuPalaceIndex,
    isFuYin, isFanYin, timestamp_solar, timestamp_lunar, qimen_structure,
    palaceNames: PALACE_NAMES, palaceNumbers: PALACE_NUMBERS,
    qimenData
  };
}

// 评分/应期/复核共用的逐宫事实（未含旺衰；旺衰由 qimenProsperity.annotateProsperity 按月令补）。
function buildEvidencePalaces(chart) {
  const {
    qimenData, tianPanGan, diPan, eightDoors, nineStars, eightGods, zhiShiDoor,
    dayMa, hourMa, dayKongIndices, hourKongIndices, effectiveZhiFuPalaceIndex,
    dayStemVisible, hourStemVisible, xunHead
  } = chart;
  const punishmentPalace = XUN_HEAD_PUNISHMENT_PALACE[xunHead];
  return Array.from({ length: 9 }, (_, i) => {
    const chartPalace = qimenData.palaces[i] || {};
    const skyStems = [tianPanGan[i], chartPalace.ji_sky].filter(Boolean);
    const door = normalizeDoor(eightDoors[i]);
    const palaceElement = PALACE_ELEMENTS[i];
    return {
      index: i,
      name: `${PALACE_NAMES[i]}${PALACE_NUMBERS[i]}宫`,
      element: palaceElement,
      branches: palaceBranches[i],
      door: eightDoors[i],
      star: nineStars[i],
      ji_star: chartPalace.ji_star || '',
      god: eightGods[i],
      sky: tianPanGan[i],
      earth: diPan[i],
      ji_sky: chartPalace.ji_sky || '',
      ji_earth: chartPalace.ji_earth || '',
      sky_stems: skyStems,
      stem_relation: U.getStemRelation(tianPanGan[i], diPan[i]),
      is_center: i === 4,
      hosts_center: i === 2,
      isKong: dayKongIndices.includes(i) || hourKongIndices.includes(i),
      hasMa: i === maXingMap[dayMa] || i === maXingMap[hourMa],
      isZhiShi: i !== 4 && eightDoors[i] === zhiShiDoor,
      isZhiFu: i === effectiveZhiFuPalaceIndex,
      isDayStem: i !== 4 && skyStems.includes(dayStemVisible),
      isHourStem: i !== 4 && skyStems.includes(hourStemVisible),
      isDayStemEarth: diPan[i] === dayStemVisible || (i === 2 && chartPalace.ji_earth === dayStemVisible),
      isHourStemEarth: diPan[i] === hourStemVisible || (i === 2 && chartPalace.ji_earth === hourStemVisible),
      isDoorPressured: Boolean(door && CONTROLS[DOOR_ELEMENTS[door]] === palaceElement),
      isTomb: skyStems.some((stem) => (SAN_QI_TOMB_PALACE[stem] ?? EXPLICIT_STEM_TOMB_PALACE[stem]) === i),
      isPunishment: i === effectiveZhiFuPalaceIndex && i === punishmentPalace
    };
  });
}

// 用神符号匹配所需的本盘上下文（见 qimenSymbols.matchesSymbol）。
// 甲不上盘：日/时干已在起盘时按各自旬首取遁仪；年/月干同法，「甲」符号取时旬遁仪。
function visibleStemOf(ganzhi) {
  const stem = U.extractTianGan(ganzhi || '');
  return stem === '甲' ? U.resolveJiaHiding(stem, U.getFuShou(U.getXunHead(ganzhi))) : stem;
}

function buildSymbolContext(chart) {
  return {
    dayStemVisible: chart.dayStemVisible,
    hourStemVisible: chart.hourStemVisible,
    yearStemVisible: visibleStemOf(chart.yearGanzhi),
    monthStemVisible: visibleStemOf(chart.monthGanzhi),
    jiaHiddenStem: chart.fuShou || ''
  };
}

module.exports = {
  buildQimenChart, buildEvidencePalaces, buildSymbolContext,
  PALACE_NAMES, PALACE_NUMBERS, PALACE_ELEMENTS, isStarFuYin, isStarFanYin
};
