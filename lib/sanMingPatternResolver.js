const CHONG = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
};

const LU_BRANCH = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

const TIAN_YUAN_AN_LU_DAYS = new Set(['庚寅', '丙申', '己亥', '乙巳']);

const LIU_REN_YI_HUAN = new Map([
  ['己巳 癸酉 丁卯 癸卯', {
    aliases: [],
    methodTags: ['六壬移换', '卯酉冲', '各逢贵地'],
    evidence: '卯酉冲动，天干各逢贵地。',
  }],
  ['甲午 甲戌 戊辰 壬子', {
    aliases: ['壬骑龙背', '财官双美'],
    methodTags: ['六壬移换', '壬骑龙背', '财官双美'],
    evidence: '壬归辰位为壬骑龙背，日时俱财官双美。',
  }],
  ['丙子 丙申 庚辰 壬午', {
    aliases: ['造化之妙'],
    methodTags: ['六壬移换', '官印俱全', '造化之妙'],
    evidence: '子午冲动后各得官印俱全。',
  }],
  ['乙亥 戊子 壬午 戊申', {
    aliases: ['拱贵格'],
    methodTags: ['六壬移换', '子午冲动', '拱贵'],
    evidence: '子午冲动，变成戊午、戊申拱贵之格。',
  }],
  ['癸亥 丁巳 甲子 庚午', {
    aliases: [],
    methodTags: ['六壬移换', '地支冲动', '偏官有制'],
    evidence: '巳亥子午冲动，天干亦动。',
  }],
]);

const SCANNED_SANMING_PATTERNS = new Map([
  ['己巳 丁丑 庚寅 戊寅', ['冲禄格', [], ['冲禄', '并冲禄位', '三命合格']]],
  ['辛巳 乙未 甲申 壬申', ['冲禄格', [], ['冲禄', '并冲禄位', '三命合格']]],
  ['乙卯 甲申 辛卯 辛卯', ['冲禄格', [], ['冲禄', '并冲禄位', '三命合格']]],
  ['己丑 丁卯 壬午 癸卯', ['财官双美格', ['禄马同乡'], ['财官双美', '禄马同乡', '归禄日下']]],
  ['丙午 庚子 壬午 丙午', ['财官双美格', ['禄马同乡', '六壬移换'], ['禄马同乡', '水火既济', '六壬移换']]],
  ['甲子 丙寅 壬戌 辛丑', ['财官双美格', ['三奇禄马飞天'], ['财官双美', '三奇禄马飞天', '无合有合']]],
  ['丙午 甲午 壬戌 丙午', ['财官双美格', ['化象'], ['财官双美', '丁壬从火', '化象']]],
  ['壬午 乙巳 甲辰 己巳', ['金神贵格', ['金神格'], ['金神', '火制得宜', '火地发达']]],
  ['甲申 戊辰 戊辰 壬戌', ['日德格', [], ['日德', '戊辰日', '性情慈善']]],
  ['庚辰 己卯 戊辰 甲寅', ['日德格', ['三位日德'], ['日德', '三位日德', '犯日德所忌']]],
  ['庚午 丁亥 戊戌 丙辰', ['魁罡格', [], ['魁罡', '财官印取用']]],
  ['丁亥 癸丑 庚戌 戊寅', ['魁罡格', [], ['魁罡', '财官印取用']]],
  ['己卯 癸酉 甲午 辛未', ['三奇真贵格', ['天干三奇'], ['三奇真贵', '天干三奇', '财官印兼全']]],
  ['乙酉 辛巳 辛酉 辛卯', ['三奇真贵格', ['男遇三奇'], ['三奇真贵', '官印建禄', '辛乙互换归禄']]],
  ['庚辰 甲申 丁未 丙午', ['三奇真贵格', ['男遇三奇'], ['三奇真贵', '财官印俱在', '归禄于时']]],
  ['庚子 甲申 庚寅 丙戌', ['天元暗禄格', [], ['天元暗禄', '庚寅日', '数命此日生']]],
  ['丙辰 丙申 丙申 壬辰', ['天元暗禄格', [], ['天元暗禄', '丙申日', '数命此日生']]],
  ['辛巳 辛丑 己亥 丙寅', ['天元暗禄格', [], ['天元暗禄', '己亥日', '数命此日生']]],
  ['丁亥 壬寅 己亥 乙亥', ['天元暗禄格', [], ['天元暗禄', '己亥日', '数命此日生']]],
  ['甲子 丁卯 乙巳 丙子', ['天元暗禄格', [], ['天元暗禄', '乙巳日', '数命此日生']]],
  ['癸亥 壬戌 丙子 癸巳', ['禄元互换格', [], ['禄元互换', '互换禄旺', '各临官贵']]],
  ['己未 辛未 丙子 癸巳', ['禄元互换格', [], ['禄元互换', '合格']]],
  ['己巳 癸酉 丁卯 癸卯', ['六壬移换格', [], ['六壬移换', '卯酉冲', '各逢贵地']]],
  ['甲午 甲戌 戊辰 壬子', ['六壬移换格', ['壬骑龙背', '财官双美'], ['六壬移换', '壬骑龙背', '财官双美']]],
  ['丙子 丙申 庚辰 壬午', ['六壬移换格', ['造化之妙'], ['六壬移换', '官印俱全', '造化之妙']]],
  ['乙亥 戊子 壬午 戊申', ['六壬移换格', ['拱贵格'], ['六壬移换', '子午冲动', '拱贵']]],
  ['癸亥 丁巳 甲子 庚午', ['六壬移换格', [], ['六壬移换', '地支冲动', '偏官有制']]],
  ['壬午 壬子 戊午 壬子', ['子午双包格', [], ['子午双包', '两午两子', '水火既济']]],
  ['壬子 癸丑 戊午 壬子', ['子午双包格', [], ['子午双包', '两个包午', '水火既济']]],
  ['甲子 庚午 丙申 戊子', ['子午双包格', [], ['子午双包', '两个包午', '水火既济']]],
  ['戊子 戊午 丁未 庚子', ['子午双包格', [], ['子午双包', '两个包午', '水火既济']]],
  ['戊午 甲子 甲申 庚午', ['子午双包格', [], ['子午双包', '两午包子', '水火既济']]],
  ['己巳 戊辰 癸丑 丙辰', ['墓煞格', ['七煞入墓', '夹煞持丘'], ['墓煞', '七煞入墓', '夹煞持丘']]],
  ['庚戌 丙戌 甲寅 庚午', ['八专禄旺格', ['专禄'], ['八专禄旺', '专禄', '化煞为权']]],
  ['己巳 辛未 乙卯 丁亥', ['八专禄旺格', ['专禄'], ['八专禄旺', '专禄', '木局']]],
  ['戊辰 甲子 戊申 乙卯', ['土局润下格', [], ['土局润下', '土虚逢润下', '申子辰水局']]],
  ['辛未 庚子 戊辰 壬子', ['土局润下格', [], ['土局润下', '土从众水', '土堤防']]],
  ['戊申 己未 丙午 乙未', ['火土夹杂格', [], ['火土夹杂', '火虚土聚', '平常']]],
  ['癸卯 辛酉 乙亥 辛巳', ['鬼象格', ['煞旺身衰'], ['鬼象', '鬼旺身衰', '二辛煞旺']]],
  ['戊戌 丁巳 己未 丙寅', ['火土夹杂格', [], ['火土夹杂', '火虚土聚', '平常']]],
  ['乙亥 己卯 己巳 甲子', ['夹库格', [], ['夹库', '虚拱库位', '辰中水库']]],
  ['戊戌 戊午 丙午 戊戌', ['照象格', [], ['照象', '火土高明', '四柱无伤']]],
  ['戊戌 甲寅 丙午 甲午', ['照象格', [], ['照象', '火土高明', '四位无伤']]],
  ['甲戌 丙寅 丙午 庚寅', ['照象格', [], ['照象', '火土高明', '照上无破']]],
]);

function splitPillars(input = {}) {
  const pillars = input.pillars || [];
  if (pillars.length === 4) return pillars;
  const gans = input.gans || [];
  const zhis = input.zhis || [];
  if (gans.length === 4 && zhis.length === 4) {
    return gans.map((gan, index) => `${gan}${zhis[index]}`);
  }
  return [];
}

function counts(items) {
  return items.reduce((map, item) => {
    map[item] = (map[item] || 0) + 1;
    return map;
  }, {});
}

function pattern({ name, aliases = [], methodTags = [], evidence = '' }) {
  return {
    name,
    aliases,
    methodTags,
    evidence,
    scoreScope: 'display_only',
    source: '三命通会',
  };
}

function resolveChongLu(pillars) {
  const dayPillar = pillars[2];
  const dayGan = dayPillar?.[0];
  const branches = pillars.map(item => item[1]);
  const lu = LU_BRANCH[dayGan];
  const rushingBranch = CHONG[lu];
  if (!lu || !rushingBranch) return null;
  if ((counts(branches)[rushingBranch] || 0) < 2) return null;
  return pattern({
    name: '冲禄格',
    methodTags: ['冲禄', '并冲禄位', '三命合格'],
    evidence: `${dayGan}禄在${lu}，局中${rushingBranch}并见冲禄。`,
  });
}

function resolveTianYuanAnLu(pillars) {
  const dayPillar = pillars[2];
  if (!TIAN_YUAN_AN_LU_DAYS.has(dayPillar)) return null;
  return pattern({
    name: '天元暗禄格',
    methodTags: ['天元暗禄', `${dayPillar}日`, '数命此日生'],
    evidence: `${dayPillar}日入天元暗禄小节所列暗禄日。`,
  });
}

function resolveLiuRenYiHuan(pillars) {
  const hit = LIU_REN_YI_HUAN.get(pillars.join(' '));
  if (!hit) return null;
  return pattern({
    name: '六壬移换格',
    aliases: hit.aliases,
    methodTags: hit.methodTags,
    evidence: hit.evidence,
  });
}

function resolveZiWuShuangBao(pillars) {
  const branchCounts = counts(pillars.map(item => item[1]));
  const zi = branchCounts['子'] || 0;
  const wu = branchCounts['午'] || 0;
  const isListedBaoPattern = (zi === 2 && wu >= 1) || (zi === 1 && wu === 2);
  if (!isListedBaoPattern) return null;

  let middleTag = '水火既济';
  if (zi >= 2 && wu >= 2) middleTag = '两午两子';
  else if (zi >= 2) middleTag = '两个包午';
  else if (wu >= 2) middleTag = '两午包子';

  return pattern({
    name: '子午双包格',
    methodTags: ['子午双包', middleTag, '水火既济'],
    evidence: `四支子午相包，子${zi}、午${wu}。`,
  });
}

function resolveSanMingPattern(input = {}) {
  const pillars = splitPillars(input);
  if (pillars.length !== 4) return null;
  const scanned = SCANNED_SANMING_PATTERNS.get(pillars.join(' '));
  if (scanned) {
    const [name, aliases, methodTags] = scanned;
    return pattern({
      name,
      aliases,
      methodTags,
      evidence: `命中《图解三命通会》第2部扫描页核验命例：${pillars.join('、')}。`,
    });
  }
  return resolveLiuRenYiHuan(pillars)
    || resolveZiWuShuangBao(pillars)
    || resolveChongLu(pillars)
    || resolveTianYuanAnLu(pillars)
    || null;
}

module.exports = {
  resolveSanMingPattern,
};
