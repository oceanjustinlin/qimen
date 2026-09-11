const { detectPolarityOverrides } = require('./qimenPolarityRules');
const {
  QIMEN_RULESET_VERSION,
  QIMEN_PRIMARY_SOURCE,
  SAN_QI_TOMB_PALACE,
  getPalaceSkyStems,
  findLiuYiJiXingPalace,
  findSanQiDeShiPalace,
  findYuNvShouMenPalace,
  isWuBuYuShi
} = require('./qimenClassicalRules');

const SCORE_VERSION = 'qimen-score-v4.2';
const NEUTRAL_SCORE = 60;

const PALACE_ELEMENTS_BY_INDEX = ['木', '火', '土', '木', '土', '金', '土', '水', '金'];
const GOOD_DOORS = new Set(['休门', '生门', '开门']);
const MIXED_DOORS = new Set(['杜门', '景门']);
const WARNING_DOORS = new Set(['伤门', '死门', '惊门']);
// 《遁甲演义·烟波钓叟赋》：“辅禽心星为上吉，冲任小吉……大凶逢芮……小凶英柱”。
// 天蓬在同书《阴符经》版本中与英、芮、柱并列为凶，采用小凶档，保留底本差异。
const GREAT_STARS = new Set(['天辅', '天禽', '天心']);
const GOOD_STARS = new Set(['天冲', '天任']);
const GREAT_WARNING_STARS = new Set(['天芮']);
const WARNING_STARS = new Set(['天蓬', '天英', '天柱']);
const GOOD_GODS = new Set(['值符', '太阴', '六合', '九天', '九地']);
const WARNING_GODS = new Set(['白虎', '玄武', '腾蛇', '滕蛇', '朱雀', '勾陈']);

const GENERATES = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木'
};

const CONTROLS = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木'
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDoor(value) {
  return normalizeText(value).replace(/門/g, '门');
}

function normalizeStar(value) {
  return normalizeText(value).replace(/輔/g, '辅').replace(/沖/g, '冲').replace(/蓬/g, '蓬');
}

function normalizeGod(value) {
  return normalizeText(value).replace(/騰/g, '腾');
}

function getPalaceElement(palace = {}) {
  return palace.element || PALACE_ELEMENTS_BY_INDEX[palace.index] || '';
}

function moveScoreTowardNeutral(score, factor = 0.5) {
  return Math.round(NEUTRAL_SCORE + (score - NEUTRAL_SCORE) * factor);
}

function relationBetween(fromElement, toElement) {
  if (!fromElement || !toElement) return 'unknown';
  if (fromElement === toElement) return 'same';
  if (GENERATES[fromElement] === toElement) return 'generate';
  if (CONTROLS[fromElement] === toElement) return 'control';
  if (GENERATES[toElement] === fromElement) return 'leak';
  if (CONTROLS[toElement] === fromElement) return 'controlled_by';
  return 'unknown';
}

function scoreDoor(doorInput, intent = {}, polarityByPalace = new Map(), palaceName = '') {
  const door = normalizeDoor(doorInput);
  const override = polarityByPalace.get(`${palaceName}:${door}`) || polarityByPalace.get(door);
  if (override) {
    if (override.domain_polarity === 'positive_with_risk') return { delta: 3, label: '语境转义为可用但有风险' };
    if (override.domain_polarity === 'mixed_or_positive') return { delta: 2, label: '语境转义为偏可用' };
    if (override.domain_polarity === 'warning') return { delta: -4, label: '语境下仍为警示' };
  }

  if (GOOD_DOORS.has(door)) return { delta: 4, label: '吉门得用' };
  if (MIXED_DOORS.has(door)) return { delta: intent.category === 'career_business' && door === '杜门' ? -2 : 0, label: '中性门需看语境' };
  if (WARNING_DOORS.has(door)) return { delta: -4, label: '凶门警示' };
  return { delta: 0, label: '门象中性' };
}

function scoreStar(starInput) {
  const star = normalizeStar(starInput);
  if (GREAT_STARS.has(star)) return { delta: 5, label: '大吉星天时有力' };
  if (GOOD_STARS.has(star)) return { delta: 3, label: '吉星扶助' };
  if (GREAT_WARNING_STARS.has(star)) return { delta: -5, label: '大凶星天时阻力重' };
  if (WARNING_STARS.has(star)) return { delta: -3, label: '星象带阻力' };
  return { delta: 0, label: '星象中性' };
}

function scoreGod(godInput) {
  const god = normalizeGod(godInput);
  if (GOOD_GODS.has(god)) return { delta: 2, label: '吉神扶助' };
  if (WARNING_GODS.has(god)) return { delta: -2, label: '神煞警示' };
  return { delta: 0, label: '八神中性' };
}

// 五阳时（甲乙丙丁戊）利动方（客），五阴时利静方（主）
const YANG_STEMS = new Set(['甲', '乙', '丙', '丁', '戊']);

// 所有问卦方默认视为主动方（客）
const ROLE_AUTO_MAP = {
  career_business: 'client',
  finance_wealth: 'client',
  exam_study: 'client',
  health_action: 'client',
  relationship: 'client',
  lawsuit_legal: 'client'
};

const NAMED_FORMATIONS = [
  // 吉格 — 天地盘干组合
  {
    name: '飞鸟跌穴', sky: '丙', earth: '戊',
    domainDeltas: { default: 12, health_action: -10, lawsuit_legal: 10 },
    // 诉讼中飞鸟跌穴利主动出击（客），守方被压制（主）
    roleByDomainDeltas: { lawsuit_legal: { client: 10, master: -6 } }
  },
  {
    name: '青龙返首', sky: '戊', earth: '丙',
    domainDeltas: { default: 10, health_action: -8, lawsuit_legal: 8 },
    // 诉讼中青龙返首利守方（主），主动进攻方反受其扰（客）
    roleByDomainDeltas: { lawsuit_legal: { client: -4, master: 8 } }
  },
  { name: '日月并行', sky: '丙', earth: '乙', domainDeltas: { default: 5, relationship: 6, lawsuit_legal: 4 } },
  { name: '奇仪相佐', sky: '乙', earth: '丁', domainDeltas: { default: 4, exam_study: 6, lawsuit_legal: 4 } },
  { name: '青龙转光', sky: '丁', earth: '戊', domainDeltas: { default: 4, career_business: 5, lawsuit_legal: 3 } },
  { name: '青龙耀明', sky: '戊', earth: '丁', domainDeltas: { default: 3, career_business: 4 } },
  { name: '星奇入太阴', sky: '丁', earth: '丁', domainDeltas: { default: 6, exam_study: 8 } },
  { name: '奇仪相合·乙庚', sky: '乙', earth: '庚', domainDeltas: { default: 4, relationship: 5, lawsuit_legal: 5 } },
  { name: '奇仪相合·丙辛', sky: '丙', earth: '辛', domainDeltas: { default: 4, relationship: 5, lawsuit_legal: 5 } },
  { name: '奇仪相合·丁壬', sky: '丁', earth: '壬', domainDeltas: { default: 4, relationship: 5, lawsuit_legal: 5 } },
  { name: '奇仪相合·戊癸', sky: '戊', earth: '癸', domainDeltas: { default: 3, relationship: 4 } },
  // 凶格 — 天地盘干组合
  {
    name: '青龙逃走', sky: '乙', earth: '辛',
    domainDeltas: { default: -12, health_action: 5, lawsuit_legal: -10 },
    // 凶格主要惩罚主动方（客）；守方虽有阻，较轻
    roleDeltas: { client: -12, master: 0 }
  },
  {
    name: '白虎猖狂', sky: '辛', earth: '乙',
    domainDeltas: { default: -12, lawsuit_legal: -12 },
    roleDeltas: { client: -12, master: 0 }
  },
  {
    name: '朱雀投江', sky: '丁', earth: '癸',
    domainDeltas: { default: -10, health_action: -14, lawsuit_legal: -10 },
    roleDeltas: { client: -10, master: -3 }
  },
  {
    name: '螣蛇夭矫', sky: '癸', earth: '丁',
    domainDeltas: { default: -10, relationship: -6, lawsuit_legal: -8 },
    roleDeltas: { client: -10, master: -4 }
  },
  {
    name: '太白入荧', sky: '庚', earth: '丙',
    domainDeltas: { default: -6, finance_wealth: -8, health_action: -8, lawsuit_legal: -8 },
    // 庚击丙：客（主动进攻）得益，主（被动守待）大损；健康两伤；诉讼主动告人有利
    roleDeltas: { client: 8, master: -10 },
    roleByDomainDeltas: { health_action: { client: -8, master: -8 }, lawsuit_legal: { client: 8, master: -8 } }
  },
  {
    name: '荧入太白', sky: '丙', earth: '庚',
    domainDeltas: { default: -6, career_business: -4, health_action: 6, lawsuit_legal: 5 },
    // 丙反克庚：守方（主）转危为安，主动方（客）自陷被动
    roleDeltas: { client: -8, master: 6 },
    roleByDomainDeltas: { health_action: { client: 6, master: 6 }, lawsuit_legal: { client: -5, master: 6 } }
  },
  { name: '大格', sky: '庚', earth: '癸', domainDeltas: { default: -10, relationship: -12, health_action: -10, lawsuit_legal: -10 } },
  { name: '小格', sky: '庚', earth: '壬', domainDeltas: { default: -5, career_business: -5 } },
  { name: '伏宫格', sky: '庚', earth: '戊', domainDeltas: { default: -8, finance_wealth: -8, lawsuit_legal: -8 } },
  { name: '飞宫格', sky: '戊', earth: '庚', domainDeltas: { default: -8, career_business: -8, lawsuit_legal: -8 } },
  { name: '刑格', sky: '庚', earth: '己', domainDeltas: { default: -8, finance_wealth: -8, lawsuit_legal: -10 } },
  {
    name: '天网四张', sky: '癸', earth: '癸',
    domainDeltas: { default: -8, health_action: -8, lawsuit_legal: -8 },
    roleDeltas: { client: -10, master: -3 }
  },
  { name: '地网遮蔽', sky: '壬', earth: '壬', domainDeltas: { default: -6, career_business: -6 } },
  // 凶格 — 结构格（宫位+天干组合）
  {
    name: '六仪击刑', type: 'liu_yi_ji_xing',
    domainDeltas: { default: -15, relationship: -15, health_action: -15, lawsuit_legal: -15 },
    roleDeltas: { client: -15, master: -5 }
  },
  { name: '三奇入墓·乙', type: 'san_qi_ru_mu', qi: '乙', palaceIndices: [SAN_QI_TOMB_PALACE.乙], domainDeltas: { default: -10, career_business: -8, finance_wealth: -8, relationship: -6, lawsuit_legal: -10 } },
  { name: '三奇入墓·丙', type: 'san_qi_ru_mu', qi: '丙', palaceIndices: [SAN_QI_TOMB_PALACE.丙], domainDeltas: { default: -10, career_business: -8, finance_wealth: -8, relationship: -6, lawsuit_legal: -10 } },
  { name: '三奇入墓·丁', type: 'san_qi_ru_mu', qi: '丁', palaceIndices: [SAN_QI_TOMB_PALACE.丁], domainDeltas: { default: -10, career_business: -8, finance_wealth: -8, relationship: -6, lawsuit_legal: -10 } },
  // 吉格 — 三奇得使
  { name: '三奇得使', type: 'zhi_shi_san_qi', domainDeltas: { default: 6, health_action: 4, lawsuit_legal: 5 } },
  // 吉格 — 三奇贵人升殿（乙临震三+丙临离九+丁临兑七同时成立）
  { name: '三奇贵人升殿', type: 'san_qi_gui_ren', domainDeltas: { default: 10, finance_wealth: 8, relationship: 7, health_action: 5, lawsuit_legal: 8, exam_study: 10 } },
  // 吉格 — 玉女守门（值使加临地盘丁）
  { name: '玉女守门', type: 'yu_nv_shou_men', domainDeltas: { default: 5, relationship: 7, career_business: 4 } },
  // 吉格 — 天显时格（甲己日甲时，六甲时头显现）
  { name: '天显时格', type: 'tian_xian_shi_ge', domainDeltas: { default: 5, career_business: 6, lawsuit_legal: -5 } },
  // 吉格 — 三诈格（奇+吉门+特定八神同宫）
  { name: '真诈格', type: 'single_palace_multi', cond: { sky: '乙', doors: ['生门', '休门', '开门'], god: '太阴' }, domainDeltas: { default: 6, career_business: 6, finance_wealth: 5, lawsuit_legal: 7, health_action: 3 } },
  { name: '重诈格', type: 'single_palace_multi', cond: { sky: '丙', doors: ['生门', '休门', '开门'], god: '九地' }, domainDeltas: { default: 6, career_business: 6, finance_wealth: 5, lawsuit_legal: 7, health_action: 3 } },
  { name: '休诈格', type: 'single_palace_multi', cond: { sky: '丁', doors: ['生门', '休门', '开门'], god: '六合' }, domainDeltas: { default: 6, career_business: 6, finance_wealth: 5, lawsuit_legal: 7, health_action: 3 } },
  // 吉格 — 五假格（凶门+奇仪+特定八神同宫）
  { name: '天假格', type: 'single_palace_multi', cond: { door: '景门', skies: ['乙', '丙', '丁'], god: '九天' }, domainDeltas: { default: 5, career_business: 5, finance_wealth: 4, health_action: 2 } },
  { name: '地假格', type: 'single_palace_multi', cond: { door: '杜门', skies: ['乙', '丙', '丁'], god: '九地' }, domainDeltas: { default: 5, career_business: 5, finance_wealth: 4, health_action: 2 } },
  { name: '物假格', type: 'single_palace_multi', cond: { door: '伤门', skies: ['乙', '丙', '丁'], god: '六合' }, domainDeltas: { default: 5, career_business: 5, finance_wealth: 4, health_action: 2 } },
  { name: '鬼假格', type: 'single_palace_multi', cond: { door: '死门', skies: ['乙', '丙', '丁'], god: '玄武' }, domainDeltas: { default: 5, career_business: 5, finance_wealth: 4, health_action: 2 } },
  { name: '人假格', type: 'single_palace_multi', cond: { door: '惊门', skies: ['乙', '丙', '丁'], god: '腾蛇' }, domainDeltas: { default: 5, career_business: 5, finance_wealth: 4, health_action: 2 } },
  // 吉格 — 九遁格（单宫多条件）
  { name: '天遁', type: 'single_palace_multi', cond: { sky: '丙', earth: '丁', door: '生门' }, domainDeltas: { default: 10, relationship: 9, health_action: 7, lawsuit_legal: 9 } },
  { name: '地遁', type: 'single_palace_multi', cond: { sky: '乙', earth: '己', door: '开门' }, domainDeltas: { default: 10, relationship: 9, health_action: 7, lawsuit_legal: 9 } },
  { name: '人遁', type: 'single_palace_multi', cond: { sky: '丁', door: '休门', god: '太阴' }, domainDeltas: { default: 10, relationship: 9, health_action: 7, lawsuit_legal: 9 } },
  { name: '神遁', type: 'single_palace_multi', cond: { sky: '丙', door: '生门', god: '九天' }, domainDeltas: { default: 8, career_business: 9, relationship: 5, health_action: 5, lawsuit_legal: 7 } },
  { name: '云遁', type: 'single_palace_multi', cond: { sky: '乙', earth: '辛', doors: ['生门', '休门', '开门'] }, domainDeltas: { default: 8, relationship: 5, health_action: 5 } },
  { name: '风遁', type: 'single_palace_multi', cond: { sky: '乙', doors: ['生门', '休门', '开门'], index: 0 }, domainDeltas: { default: 7, career_business: 7, relationship: 5 } },
  { name: '龙遁', type: 'single_palace_multi', cond: { sky: '乙', doors: ['生门', '休门', '开门'], indexOrEarth: { index: 7, earth: '癸' } }, domainDeltas: { default: 7, relationship: 5 } },
  { name: '虎遁', type: 'single_palace_multi', cond: { sky: '乙', door: '休门', indexOrEarth: { index: 6, earth: '辛' } }, domainDeltas: { default: 7, career_business: 7, relationship: 5 } },
  { name: '鬼遁', type: 'single_palace_multi', cond: { sky: '丁', door: '杜门', god: '九地' }, domainDeltas: { default: 7, career_business: 7, relationship: 5 } },
  // 凶格 — 五不遇时（时干克日干，需 intent.dayStem / intent.hourStem）
  {
    name: '五不遇时', type: 'wu_bu_yu_shi',
    domainDeltas: { default: -10, career_business: -8, finance_wealth: -10, relationship: -6, health_action: -12 },
    roleDeltas: { client: -10, master: -4 }
  },
  // 凶格 — 庚格系列扩展
  {
    name: '奇格', type: 'qi_ge',
    domainDeltas: { default: -8, career_business: -8, finance_wealth: -8, lawsuit_legal: -10 },
    // 庚压奇（乙丁）主动者首当其冲；庚+丙已由太白入荧覆盖（qi_ge 排除earth='丙'）
    roleDeltas: { client: -10, master: 2 }
  },
  { name: '岁格', type: 'sui_ge', domainDeltas: { default: -10, career_business: -10, finance_wealth: -10, lawsuit_legal: -10 } },
  { name: '月格', type: 'yue_ge', domainDeltas: { default: -8, career_business: -8, finance_wealth: -8, lawsuit_legal: -8 } },
  // 凶格 — 悖格（丙临日/时/年/月干，倒行逆施）
  {
    name: '悖格', type: 'bei_ge',
    domainDeltas: { default: -5, career_business: -6, finance_wealth: -5, health_action: -3 },
    roleDeltas: { client: -7, master: -2 }
  },
  // 凶格 — 伏干格 / 飞干格（需 intent.dayStem 或 isDayStem palace earth）
  {
    name: '伏干格', type: 'fu_gan_ge',
    domainDeltas: { default: -12, career_business: -10, finance_wealth: -12, health_action: -10, lawsuit_legal: -12 },
    // 伏干格对日干压制极重，主（守）更难脱身
    roleDeltas: { client: -12, master: -14 }
  },
  { name: '飞干格', type: 'fei_gan_ge', domainDeltas: { default: -12, career_business: -10, finance_wealth: -12, health_action: -10, lawsuit_legal: -12 } },
  // 凶格 — 伏吟/反吟（盘局结构，需 intent.isFuYin / intent.isFanYin 标志位）
  {
    name: '伏吟（凶）', type: 'fu_yin_xiong',
    domainDeltas: { default: -4, career_business: -6, finance_wealth: -5 },
    // 伏吟利主（守）不利客（动）
    roleDeltas: { client: -6, master: -2 }
  },
  {
    name: '反吟（凶）', type: 'fan_yin_xiong',
    domainDeltas: { default: -4, career_business: -6, finance_wealth: -5 },
    // 反吟利客（动）不利主（守）
    roleDeltas: { client: -2, master: -6 }
  }
];

const FORMATION_WARNING_GROUPS = new Map([
  ['青龙逃走', 'severe_stem_warning'],
  ['白虎猖狂', 'severe_stem_warning'],
  ['朱雀投江', 'severe_stem_warning'],
  ['螣蛇夭矫', 'severe_stem_warning'],
  ['奇格', 'geng_pressure'],
  ['伏干格', 'geng_pressure'],
  ['飞干格', 'geng_pressure'],
  ['大格', 'geng_pressure'],
  ['小格', 'geng_pressure'],
  ['伏宫格', 'geng_pressure'],
  ['飞宫格', 'geng_pressure'],
  ['刑格', 'geng_pressure'],
  ['天网四张', 'net_block'],
  ['地网遮蔽', 'net_block'],
  ['三奇入墓·乙', 'san_qi_tomb'],
  ['三奇入墓·丙', 'san_qi_tomb'],
  ['三奇入墓·丁', 'san_qi_tomb']
]);

function getFormationWarningGroup(signal = '') {
  return FORMATION_WARNING_GROUPS.get(signal) || null;
}

function matchesSinglePalaceCond(p, cond) {
  if (cond.sky && normalizeText(p.sky) !== cond.sky) return false;
  if (cond.skies && !cond.skies.includes(normalizeText(p.sky))) return false;
  if (cond.earth && normalizeText(p.earth) !== cond.earth) return false;
  if (cond.door && normalizeDoor(p.door) !== cond.door) return false;
  if (cond.god && normalizeGod(p.god) !== cond.god) return false;
  if (cond.index !== undefined && p.index !== cond.index) return false;
  if (cond.doors && !cond.doors.map(normalizeDoor).includes(normalizeDoor(p.door))) return false;
  if (cond.indexOrEarth) {
    if (p.index !== cond.indexOrEarth.index && normalizeText(p.earth) !== cond.indexOrEarth.earth) return false;
  }
  return true;
}

// 返回 null（未命中）或 { index }（命中；index 为落宫索引，非单宫类格局为 null）
function detectNamedFormation(formation, palaces, intent = {}) {
  const type = formation.type || 'sky_earth_pair';
  const hit = (p) => (p ? { index: p.index } : null);
  const flag = (matched) => (matched ? { index: null } : null);
  if (type === 'sky_earth_pair') {
    return hit(palaces.find((p) => normalizeText(p.sky) === formation.sky && normalizeText(p.earth) === formation.earth));
  }
  if (type === 'liu_yi_ji_xing') {
    return hit(findLiuYiJiXingPalace(palaces, intent.xunHead));
  }
  if (type === 'san_qi_ru_mu') {
    // 三奇 (乙丙丁) are on the sky board (天盘)
    return hit(palaces.find((p) => getPalaceSkyStems(p).includes(formation.qi) && formation.palaceIndices.includes(p.index)));
  }
  if (type === 'zhi_shi_san_qi') {
    return hit(findSanQiDeShiPalace(palaces));
  }
  if (type === 'single_palace_multi') {
    return hit(palaces.find((p) => matchesSinglePalaceCond(p, formation.cond)));
  }
  if (type === 'wu_bu_yu_shi') {
    const dayStem = intent.dayStem || palaces.find((p) => p.isDayStem)?.earth;
    const hourStem = intent.hourStem || palaces.find((p) => p.isHourStem)?.earth;
    if (!dayStem || !hourStem) return null;
    return flag(isWuBuYuShi(dayStem, hourStem));
  }
  if (type === 'fu_gan_ge') {
    const dayStem = intent.dayStem || palaces.find((p) => p.isDayStem)?.earth;
    if (!dayStem) return null;
    return hit(palaces.find((p) => normalizeText(p.sky) === '庚' && normalizeText(p.earth) === normalizeText(dayStem)));
  }
  if (type === 'fei_gan_ge') {
    const dayStem = intent.dayStem || palaces.find((p) => p.isDayStem)?.earth;
    if (!dayStem) return null;
    return hit(palaces.find((p) => normalizeText(p.sky) === normalizeText(dayStem) && normalizeText(p.earth) === '庚'));
  }
  if (type === 'san_qi_gui_ren') {
    // 乙临震三宫(index=3) + 丙临离九宫(index=1) + 丁临兑七宫(index=5) 同时成立
    const hasYi = palaces.some((p) => normalizeText(p.sky) === '乙' && p.index === 3);
    const hasBing = palaces.some((p) => normalizeText(p.sky) === '丙' && p.index === 1);
    const hasDing = palaces.some((p) => normalizeText(p.sky) === '丁' && p.index === 5);
    return flag(hasYi && hasBing && hasDing);
  }
  if (type === 'yu_nv_shou_men') {
    return hit(findYuNvShouMenPalace(palaces));
  }
  if (type === 'tian_xian_shi_ge') {
    // 甲己日 + 甲时（六甲时头，天禽贵人显现）
    const dayStem = intent.dayStem || palaces.find((p) => p.isDayStem)?.earth;
    const hourStem = intent.hourStem || palaces.find((p) => p.isHourStem)?.earth;
    if (!dayStem || !hourStem) return null;
    return flag(new Set(['甲', '己']).has(normalizeText(dayStem)) && normalizeText(hourStem) === '甲');
  }
  if (type === 'qi_ge') {
    // 庚克乙(木)/庚克丁(火)。庚+丙已由太白入荧（sky_earth_pair）覆盖，排除以避免重叠。
    const QI_GE_EARTHS = new Set(['乙', '丁']);
    return hit(palaces.find((p) => normalizeText(p.sky) === '庚' && QI_GE_EARTHS.has(normalizeText(p.earth))));
  }
  if (type === 'sui_ge') {
    const yearStem = intent.yearStem;
    if (!yearStem) return null;
    return hit(palaces.find((p) => normalizeText(p.sky) === '庚' && normalizeText(p.earth) === normalizeText(yearStem)));
  }
  if (type === 'yue_ge') {
    const monthStem = intent.monthStem;
    if (!monthStem) return null;
    return hit(palaces.find((p) => normalizeText(p.sky) === '庚' && normalizeText(p.earth) === normalizeText(monthStem)));
  }
  if (type === 'bei_ge') {
    // 丙临日/时/年/月干所在宫（倒行逆施）
    const dayStem = intent.dayStem || palaces.find((p) => p.isDayStem)?.earth;
    const hourStem = intent.hourStem || palaces.find((p) => p.isHourStem)?.earth;
    const stems = new Set([dayStem, hourStem, intent.yearStem, intent.monthStem].filter(Boolean).map(normalizeText));
    return hit(palaces.find((p) => normalizeText(p.sky) === '丙' && stems.has(normalizeText(p.earth))));
  }
  if (type === 'fu_yin_xiong') {
    return flag(intent.isFuYin === true);
  }
  if (type === 'fan_yin_xiong') {
    return flag(intent.isFanYin === true);
  }
  return null;
}

// 优先级: roleByDomainDeltas[category][role] > roleDeltas[role] > domainDeltas[category] > domainDeltas.default
function getFormationDelta(formation, category, role) {
  if (role) {
    const rbd = formation.roleByDomainDeltas?.[category]?.[role];
    if (rbd !== undefined) return rbd;
    const rd = formation.roleDeltas?.[role];
    if (rd !== undefined) return rd;
  }
  return Object.prototype.hasOwnProperty.call(formation.domainDeltas, category)
    ? formation.domainDeltas[category]
    : formation.domainDeltas.default;
}

function evaluateNamedFormation(palaces, intent = {}, role = null) {
  const category = intent.category || 'general';
  const hits = [];
  let positiveTotal = 0;
  let ungroupedNegativeTotal = 0;
  const groupedNegative = new Map();
  const firedSignals = new Set();
  const warningGroups = new Set();

  for (const formation of NAMED_FORMATIONS) {
    const detected = detectNamedFormation(formation, palaces, intent);
    if (!detected) continue;
    const delta = getFormationDelta(formation, category, role);
    if (formation.sky && formation.earth) firedSignals.add(`${formation.sky}+${formation.earth}`);
    if (delta >= 0) {
      positiveTotal += delta;
    } else {
      const group = getFormationWarningGroup(formation.name);
      if (group) {
        warningGroups.add(group);
        groupedNegative.set(group, Math.min(groupedNegative.get(group) ?? 0, delta));
      } else {
        ungroupedNegativeTotal += delta;
      }
    }
    hits.push({
      layer: 'named_formation',
      signal: formation.name,
      palace_index: detected.index ?? null,
      effect: signed(delta),
      reason: `命中有名格「${formation.name}」，领域「${category}」下评分 ${signed(delta)}。`
    });
  }

  const groupedNegativeTotal = [...groupedNegative.values()].reduce((sum, value) => sum + value, 0);
  const total = positiveTotal + groupedNegativeTotal + ungroupedNegativeTotal;
  return { namedFormationDelta: clamp(total, -12, 20), hits, firedSignals, warningGroups };
}

function buildPolarityMaps(overrides = []) {
  const map = new Map();
  for (const override of overrides) {
    if (override.door) {
      map.set(`${override.palace || ''}:${normalizeDoor(override.door)}`, override);
      map.set(normalizeDoor(override.door), override);
    }
    if (override.signal) map.set(override.signal, override);
  }
  return map;
}

function getCoreSymbols(yongshenRule = {}) {
  return new Set((yongshenRule.outputRequirements?.scoreAuditMustIncludeAtLeastOneOf || []).map(normalizeText));
}

function isSymbolPalace(palace = {}, symbol = '') {
  const normalized = normalizeText(symbol);
  if (!normalized) return false;
  if (normalized === '日干') return Boolean(palace.isDayStem);
  if (normalized === '时干') return Boolean(palace.isHourStem);
  if (normalized === '值使门') return Boolean(palace.isZhiShi);
  if (normalized === '值符') return normalizeGod(palace.god) === '值符';
  if (normalized.endsWith('门')) return normalizeDoor(palace.door) === normalized;
  if (normalized.endsWith('星')) return normalizeStar(palace.star) === normalized.replace(/星$/, '');
  return [palace.sky, palace.earth, palace.door, palace.star, palace.god].map(normalizeText).includes(normalized);
}

function isScoredCorePalace(palace = {}, coreSymbols = new Set()) {
  for (const symbol of coreSymbols) {
    if (isSymbolPalace(palace, symbol)) return true;
  }
  return false;
}

function evaluatePalace(palace = {}, intent = {}, polarityByPalace = new Map()) {
  const door = scoreDoor(palace.door, intent, polarityByPalace, palace.name);
  const star = scoreStar(palace.star);
  const god = scoreGod(palace.god);
  // 旺衰名称依《遁甲演义》九星专法；以下数值仅用于产品内部排序。
  let ground = 0;
  if (palace.prosperity === '旺') ground = 8;
  else if (palace.prosperity === '相') ground = 5;
  else if (palace.prosperity === '废') ground = -7;
  else if (palace.prosperity === '囚') ground = -5;
  // 入墓/受刑为另一个古法状态；-5 是工程排序权重。
  if (palace.isTomb || palace.isPunishment) ground -= 5;

  let doorDelta = door.delta;
  if (palace.isDoorPressured) {
    doorDelta = doorDelta > 0 ? Math.round(doorDelta / 2) : Math.round(doorDelta * 1.5);
  }

  const raw = ground + doorDelta + star.delta + god.delta;
  const delta = clamp(raw, -15, 15);

  return {
    palace: palace.name || '',
    palace_index: palace.index,
    delta,
    energy_score: clamp(NEUTRAL_SCORE + delta * 2.5, 0, 100),
    components: {
      ground,
      door: doorDelta,
      star: star.delta,
      god: god.delta
    },
    reasons: [door.label, star.label, god.label].filter(Boolean),
    isKong: Boolean(palace.isKong),
    hasHorse: Boolean(palace.hasMa || palace.hasHorse)
  };
}

function evaluateMacro(palaces = []) {
  let macro = 0;
  const hits = [];
  const zhifu = palaces.find((palace) => normalizeGod(palace.god) === '值符');
  const zhishi = palaces.find((palace) => palace.isZhiShi);

  if (zhifu && !zhifu.isKong) {
    macro += 4;
    hits.push({ layer: 'macro', signal: `${zhifu.name}临值符`, effect: '+4', reason: '值符提纲看大局；值符不空，工程指标记为仍有主导资源。' });
  } else if (zhifu?.isKong) {
    macro -= 4;
    hits.push({ layer: 'macro', signal: `${zhifu.name}值符空亡`, effect: '-4', reason: '值符提纲落空，表示大方向资源或关键权力端不实。' });
  }

  if (zhishi) {
    const door = normalizeDoor(zhishi.door);
    const delta = GOOD_DOORS.has(door) ? 4 : WARNING_DOORS.has(door) ? -4 : 0;
    macro += delta;
    if (delta) {
      hits.push({ layer: 'macro', signal: `${zhishi.name}值使${door}`, effect: signed(delta), reason: '值使门用于观察具体执行，门象影响流程顺滞。' });
    }
  }

  return { macroDelta: clamp(macro, -8, 8), hits };
}

function evaluateRelation(subject, object) {
  if (!subject || !object) return { relationDelta: 0, relations: [] };

  const subjectElement = getPalaceElement(subject);
  const objectElement = getPalaceElement(object);
  const relation = relationBetween(objectElement, subjectElement);
  let effect = 0;
  let reason = '日干与时干五行关系中性。';

  if (relation === 'generate') {
    effect = 14;
    reason = '客体/事项所在宫生日干，表示事情来生我、外部条件对本人有承接。';
  } else if (relation === 'same') {
    effect = 8;
    reason = '主客比和，表示人事同气，推进阻力相对较小。';
  } else if (relation === 'control') {
    effect = -14;
    reason = '客体/事项所在宫克日干，表示事情压我、外部条件构成压力。';
  } else if (relation === 'controlled_by') {
    effect = 8;
    reason = '日干克客体，表示本人能主动制事，但需要投入行动成本。';
  } else if (relation === 'leak') {
    effect = -5;
    reason = '日干生客体，表示本人耗力求事，成事需付出资源。';
  }

  const subjectEnergy = evaluatePalace(subject).energy_score;
  const objectEnergy = evaluatePalace(object).energy_score;
  let adjustedByPower = false;
  if (effect < 0 && objectEnergy < 38 && subjectEnergy > 70) {
    effect = Math.max(Math.round(effect * 0.35), -5);
    adjustedByPower = true;
    reason += ' 但客体能量弱而主体能量强，按"衰不克旺"减轻扣分。';
  }
  if (effect > 0 && objectEnergy < 38) {
    effect = Math.round(effect * 0.5);
    adjustedByPower = true;
    reason += ' 但生扶方自身能量偏弱，正向力度折半。';
  }

  return {
    relationDelta: clamp(effect, -20, 20),
    relations: [{
      from: 'object',
      to: 'subject',
      relation,
      effect,
      adjustedByPower,
      reason
    }]
  };
}

function parseEffectHint(hint = '') {
  const match = String(hint).match(/([+-])\s*(\d+)/);
  if (!match) return 0;
  const value = Number(match[2]);
  return match[1] === '-' ? -value : value;
}

function evaluateContext(overrides = []) {
  let delta = 0;
  const hits = [];
  for (const override of overrides) {
    let effect = parseEffectHint(override.score_effect_hint);
    if (!effect) {
      if (override.domain_polarity === 'positive_with_risk') effect = 3;
      else if (override.domain_polarity === 'mixed_or_positive') effect = 2;
      else if (override.domain_polarity === 'warning') effect = -3;
    }
    if (override.domain_polarity === 'positive_with_risk') effect = Math.max(2, Math.round(effect * 0.6));
    effect = clamp(effect, -6, 6);
    delta += effect;
    hits.push({
      layer: 'context',
      signal: override.signal,
      effect: signed(effect),
      reason: override.reason || '命中问题域极性翻转规则，按当前语境调整吉凶。'
    });
  }
  return { contextDelta: clamp(delta, -8, 8), hits };
}

function applyVoidModifier(score, coreEvaluations = [], { hasFillVoidSuccess = false } = {}) {
  const voidCore = coreEvaluations.filter((item) => item.isKong);
  if (!voidCore.length) return { score, applied: false, factor: 1, tags: [] };
  const factor = hasFillVoidSuccess ? 0.75 : (voidCore.length >= 2 ? 0.40 : 0.55);
  return {
    score: moveScoreTowardNeutral(score, factor),
    applied: true,
    factor,
    tags: ['needs_fill_void']
  };
}

function buildLevel(score) {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 55) return 'medium';
  if (score >= 40) return 'cautious';
  return 'low';
}

// 主客动静层：五阳时利客（主动方），五阴时利主（守待方）
function evaluateMasterClient(palaces, intent = {}) {
  const hourStem = intent.hourStem || palaces.find((p) => p.isHourStem)?.earth;
  if (!hourStem) return { masterClientDelta: 0, hits: [], role: 'client' };
  const isYangHour = YANG_STEMS.has(normalizeText(hourStem));
  const favoredRole = isYangHour ? 'client' : 'master';
  let role = intent.role;
  if (!role || role === 'auto') {
    if (intent.category === 'career_business' && intent.subcategory === 'job_search') {
      return {
        masterClientDelta: 0,
        role: 'observer',
        hits: [{
          layer: 'master_client',
          signal: `${hourStem}时（${isYangHour ? '阳' : '阴'}时）`,
          effect: '0',
          reason: `求职面试后的进展类问题按等待反馈/流程观察处理，不因${isYangHour ? '阳' : '阴'}时自动套用主动方扣分。`
        }]
      };
    }
    role = ROLE_AUTO_MAP[intent.category] ?? 'client';
  }
  const matches = role === favoredRole;
  const delta = matches ? 4 : -4;
  return {
    masterClientDelta: delta,
    role,
    hits: [{
      layer: 'master_client',
      signal: `${hourStem}时（${isYangHour ? '阳' : '阴'}时）`,
      effect: signed(delta),
      reason: `时干「${hourStem}」属${isYangHour ? '阳' : '阴'}时，${isYangHour ? '利主动方（客）' : '利守待方（主）'}。提问方立场为「${role === 'client' ? '主动方' : '守待方'}」，${matches ? '时机契合，' : '时机相悖，'}${signed(delta)}。`
    }]
  };
}

function timingCandidates(timingAnalysis = {}) {
  return [
    ...(Array.isArray(timingAnalysis.p1_candidates) ? timingAnalysis.p1_candidates : []),
    ...(Array.isArray(timingAnalysis.p2_scan?.candidates) ? timingAnalysis.p2_scan.candidates : [])
  ];
}

function getTimingRecovery(timingAnalysis = {}, intent = {}) {
  const candidates = timingCandidates(timingAnalysis)
    .filter((item) => item && (item.event_mode === 'success' || !item.event_mode));
  const hasFillVoidSuccess = candidates.some((item) => (
    item.timing_type === 'kongwang_fill_or_clash' || item.matched_rule === 'kongwang_fill_or_clash'
  ));
  const hasZhifuHorseSuccess = candidates.some((item) => (
    (item.timing_type === 'horse_star_activated' || item.matched_rule === 'horse_star_activated') &&
    normalizeText(item.target_symbol) === '值符'
  ));
  const hits = [];
  let timingRecoveryDelta = 0;

  if (hasZhifuHorseSuccess) {
    const delta = intent.category === 'career_business' && intent.subcategory === 'job_search' ? 8 : 4;
    timingRecoveryDelta += delta;
    hits.push({
      layer: 'timing_recovery',
      signal: '值符马星动',
      effect: signed(delta),
      reason: '值符代表决策方/权力资源，马星动表示流程或消息端有推进，求职进展类问题按推进信号补正。'
    });
  }

  if (hasFillVoidSuccess) {
    timingRecoveryDelta += 4;
    hits.push({
      layer: 'timing_recovery',
      signal: '空亡冲填',
      effect: '+4',
      reason: '核心流程虽有空亡，但应期扫描已出现填实或冲空窗口，按“待填实”而非“落空”处理。'
    });
  }

  return {
    timingRecoveryDelta: clamp(timingRecoveryDelta, 0, 12),
    hits,
    hasFillVoidSuccess,
    hasZhifuHorseSuccess
  };
}

function calculateQimenScore({
  intent = {},
  palaces = [],
  yongshenRule = {},
  polarityOverrides,
  timingAnalysis = {}
} = {}) {
  const normalizedPalaces = palaces
    .filter((palace) => palace && !palace.is_center)
    .map((palace) => ({ ...palace, element: getPalaceElement(palace) }));
  const overrides = polarityOverrides || detectPolarityOverrides({ intent, palaces: normalizedPalaces });
  const timingRecovery = getTimingRecovery(timingAnalysis, intent);
  // 主客动静层：先确定 role，再传入 named_formation 层做格局差异化评分
  const masterClient = evaluateMasterClient(normalizedPalaces, intent);
  const namedFormation = evaluateNamedFormation(normalizedPalaces, intent, masterClient.role);
  // Suppress polarity override entries whose signal is already covered by a named formation
  const filteredOverrides = overrides.filter((o) => {
    if (namedFormation.firedSignals.has(o.signal)) return false;
    if (normalizeText(o.signal) === '庚格' && namedFormation.warningGroups.has('geng_pressure')) return false;
    if (normalizeText(o.signal) === '空亡' && timingRecovery.hasFillVoidSuccess) return false;
    return true;
  });
  const polarityByPalace = buildPolarityMaps(filteredOverrides);
  const coreSymbols = getCoreSymbols(yongshenRule);
  const subject = normalizedPalaces.find((palace) => palace.isDayStem);
  const object = normalizedPalaces.find((palace) => palace.isHourStem);
  const scoredCorePalaces = normalizedPalaces
    .filter((palace) => isScoredCorePalace(palace, coreSymbols))
    .filter((palace, index, all) => all.findIndex((item) => item.index === palace.index) === index);
  const coreEvaluations = scoredCorePalaces.map((palace) => evaluatePalace(palace, intent, polarityByPalace));
  const stateCorePalaces = [subject, object, ...scoredCorePalaces]
    .filter(Boolean)
    .filter((palace, index, all) => all.findIndex((item) => item.index === palace.index) === index);
  const stateCoreEvaluations = stateCorePalaces.map((palace) => evaluatePalace(palace, intent, polarityByPalace));

  const macro = evaluateMacro(normalizedPalaces);
  const palaceDelta = clamp(coreEvaluations.reduce((sum, item) => sum + item.delta, 0), -20, 20);
  const relation = evaluateRelation(subject, object);
  const context = evaluateContext(filteredOverrides);
  const riskDelta = intent.category === 'health_action' || intent.category === 'lawsuit_legal' ? -2 : 0;
  const raw = clamp(
    NEUTRAL_SCORE + macro.macroDelta + palaceDelta + namedFormation.namedFormationDelta +
    relation.relationDelta + context.contextDelta + riskDelta + masterClient.masterClientDelta +
    timingRecovery.timingRecoveryDelta,
    0, 100
  );
  const voidResult = applyVoidModifier(raw, stateCoreEvaluations, { hasFillVoidSuccess: timingRecovery.hasFillVoidSuccess });
  const finalScore = clamp(voidResult.score, 0, 100);
  const horseTags = normalizedPalaces.some((palace) => (palace.hasMa || palace.hasHorse) && (palace.isDayStem || palace.isHourStem || isScoredCorePalace(palace, coreSymbols)))
    ? ['moving']
    : [];

  const adjustments = [
    ...masterClient.hits,
    ...macro.hits,
    ...namedFormation.hits,
    ...coreEvaluations.map((item) => ({
      layer: 'palace',
      signal: `${item.palace}单宫能量`,
      effect: signed(item.delta),
      reason: `按盘面事实分层生成工程排序指标：${item.reasons.join('；')}。`
    })),
    ...relation.relations.map((item) => ({
      layer: 'relation',
      signal: '日干/时干主客生克',
      effect: signed(item.effect),
      reason: item.reason
    })),
    ...timingRecovery.hits,
    ...context.hits
  ];

  if (riskDelta) {
    adjustments.push({
      layer: 'risk',
      signal: '高风险问题保守校准',
      effect: signed(riskDelta),
      reason: '健康、法律等高风险问题按产品表达要求轻度保守，不改变盘面规则命中事实。'
    });
  }
  if (voidResult.applied) {
    adjustments.push({
      layer: 'modifier',
      signal: '核心用神空亡',
      effect: 'toward-60',
      reason: `空亡按所选规则解释为虚、不实、待填实；工程指标将原分按系数 ${voidResult.factor} 向60中线回归。`
    });
  }

  return {
    version: SCORE_VERSION,
    ruleset_version: QIMEN_RULESET_VERSION,
    rule_source: QIMEN_PRIMARY_SOURCE,
    score_kind: 'engineering_index',
    base_score: NEUTRAL_SCORE,
    raw_score_before_modifiers: raw,
    final_score: finalScore,
    level: buildLevel(finalScore),
    confidence: adjustments.length >= 4 ? 'medium' : 'low',
    role: masterClient.role,
    deltas: {
      macro: macro.macroDelta,
      palace: palaceDelta,
      named_formation: namedFormation.namedFormationDelta,
      relation: relation.relationDelta,
      context: context.contextDelta,
      risk: riskDelta,
      master_client: masterClient.masterClientDelta,
      timing_recovery: timingRecovery.timingRecoveryDelta,
      void_modifier_applied: voidResult.applied
    },
    adjustments,
    yongshen_nodes: coreEvaluations,
    relations: relation.relations,
    polarity_overrides: overrides,
    state_tags: [...voidResult.tags, ...horseTags],
    timing: {
      tags: horseTags,
      status: voidResult.applied ? 'pending_fill_void' : horseTags.length ? 'moving' : 'normal'
    },
    summary: {
      score: finalScore,
      score_basis: {
        positive_signals: adjustments.filter((item) => String(item.effect).startsWith('+')).map((item) => item.signal),
        negative_signals: adjustments.filter((item) => String(item.effect).startsWith('-')).map((item) => item.signal),
        score_logic: `后端依据古籍规则识别盘面事实，再以项目权重从60中线合成${finalScore}点工程指标；该数值不是古籍分数或概率。`
      }
    }
  };
}

module.exports = {
  SCORE_VERSION,
  NEUTRAL_SCORE,
  calculateQimenScore,
  evaluateNamedFormation,
  evaluateMasterClient,
  moveScoreTowardNeutral
};
