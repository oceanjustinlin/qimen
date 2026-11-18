'use strict';
// 共享术语表：B（符号与枚举）、C（引擎断语）、D（LLM 断语）三层共同的事实来源。
// 前端用它显示 `English (汉字)`，Worker 用它拼进 prompt，离线翻译脚本用它约束译文。
//
// 每个条目：
//   zh       简体原值（唯一键）
//   group    分类（见 GROUPS）
//   en       英文正式名；没有通行英文名的用拼音（spec §5.5）
//   hant?    仅在通用简转繁会出错时填写
//   variants? 同一符号在代码里的其他写法（繁体字形、十神简称、带「星」「宫」后缀等），lookup 时等同 zh
//
// 紫微术语不进本表（用 iztro 自带的 en-US 语言包）。
// 改动任何 en 译名都要递增 GLOSSARY_VERSION。

const GLOSSARY_VERSION = 'g1';

const GROUPS = [
  'stem', 'branch', 'element', 'shishen', 'door', 'star', 'deity', 'palace',
  'bazi_term', 'qimen_term', 'score_band', 'shensha', 'pattern', 'nayin', 'jieqi', 'category',
];

function rows(group, list) {
  return list.map(([zh, en, extra]) => ({ zh, group, en, ...(extra || {}) }));
}

const entries = [
  ...rows('stem', [
    ['甲', 'Jia'], ['乙', 'Yi'], ['丙', 'Bing'], ['丁', 'Ding'], ['戊', 'Wu'],
    ['己', 'Ji'], ['庚', 'Geng'], ['辛', 'Xin'], ['壬', 'Ren'], ['癸', 'Gui'],
  ]),
  ...rows('branch', [
    ['子', 'Zi'], ['丑', 'Chou', { hant: '丑' }], ['寅', 'Yin'], ['卯', 'Mao'], ['辰', 'Chen'], ['巳', 'Si'],
    ['午', 'Wu'], ['未', 'Wei'], ['申', 'Shen'], ['酉', 'You'], ['戌', 'Xu'], ['亥', 'Hai'],
  ]),
  ...rows('element', [
    ['木', 'Wood'], ['火', 'Fire'], ['土', 'Earth'], ['金', 'Metal'], ['水', 'Water'],
  ]),
  ...rows('shishen', [
    ['比肩', 'Friend', { variants: ['比'] }],
    ['劫财', 'Rob Wealth', { variants: ['劫'] }],
    ['食神', 'Eating God', { variants: ['食'] }],
    ['伤官', 'Hurting Officer', { variants: ['伤'] }],
    ['偏财', 'Indirect Wealth', { variants: ['才'] }],
    ['正财', 'Direct Wealth', { variants: ['财'] }],
    ['七杀', 'Seven Killings', { variants: ['杀', '偏官'] }],
    ['正官', 'Direct Officer', { variants: ['官'] }],
    ['偏印', 'Indirect Resource', { variants: ['枭', '枭神'] }],
    ['正印', 'Direct Resource', { variants: ['印'] }],
  ]),
  ...rows('door', [
    ['休门', 'Rest Door', { variants: ['休門'] }],
    ['生门', 'Life Door', { variants: ['生門'] }],
    ['伤门', 'Harm Door', { variants: ['傷門'] }],
    ['杜门', 'Block Door', { variants: ['杜門'] }],
    ['景门', 'Scenery Door', { variants: ['景門'] }],
    ['死门', 'Death Door', { variants: ['死門'] }],
    ['惊门', 'Fear Door', { variants: ['驚門'] }],
    ['开门', 'Open Door', { variants: ['開門'] }],
  ]),
  ...rows('star', [
    ['天蓬', 'Tian Peng', { variants: ['天蓬星'] }],
    ['天芮', 'Tian Rui', { variants: ['天芮星'] }],
    ['天冲', 'Tian Chong', { hant: '天沖', variants: ['天冲星', '天沖', '天沖星'] }],
    ['天辅', 'Tian Fu', { variants: ['天辅星', '天輔', '天輔星'] }],
    ['天禽', 'Tian Qin', { variants: ['天禽星'] }],
    ['天心', 'Tian Xin', { variants: ['天心星'] }],
    ['天柱', 'Tian Zhu', { variants: ['天柱星'] }],
    ['天任', 'Tian Ren', { variants: ['天任星'] }],
    ['天英', 'Tian Ying', { variants: ['天英星'] }],
  ]),
  ...rows('deity', [
    ['值符', 'Chief'],
    ['螣蛇', 'Serpent', { hant: '螣蛇', variants: ['滕蛇', '腾蛇'] }],
    ['太阴', 'Moon', { variants: ['太陰'] }],
    ['六合', 'Harmony'],
    ['白虎', 'White Tiger'],
    ['玄武', 'Black Tortoise'],
    ['九地', 'Nine Earth'],
    ['九天', 'Nine Heaven'],
    ['勾陈', 'Hook', { variants: ['勾陳'] }],
    ['朱雀', 'Red Phoenix'],
  ]),
  ...rows('palace', [
    ['坎一宫', 'Kan 1', { variants: ['坎', '坎宫', '坎1宫'] }],
    ['坤二宫', 'Kun 2', { variants: ['坤', '坤宫', '坤2宫'] }],
    ['震三宫', 'Zhen 3', { variants: ['震', '震宫', '震3宫'] }],
    ['巽四宫', 'Xun 4', { variants: ['巽', '巽宫', '巽4宫'] }],
    ['中五宫', 'Center 5', { variants: ['中', '中宫', '中5宫'] }],
    ['乾六宫', 'Qian 6', { variants: ['乾', '乾宫', '乾6宫'] }],
    ['兑七宫', 'Dui 7', { variants: ['兑', '兌', '兑宫', '兑7宫'] }],
    ['艮八宫', 'Gen 8', { variants: ['艮', '艮宫', '艮8宫'] }],
    ['离九宫', 'Li 9', { variants: ['离', '離', '离宫', '离9宫'] }],
  ]),
  ...rows('bazi_term', [
    ['日主', 'Day Master'],
    ['用神', 'Useful God'],
    ['喜神', 'Favorable God'],
    ['忌神', 'Unfavorable God'],
    ['格局', 'Structure'],
    ['大运', 'Luck Pillar'],
    ['流年', 'Annual Pillar'],
    ['流月', 'Monthly Pillar'],
    ['身强', 'Strong Day Master'],
    ['身弱', 'Weak Day Master'],
    ['调候', 'Climate Balance'],
    ['神煞', 'Symbolic Stars'],
    ['藏干', 'Hidden Stems'],
    ['纳音', 'Na Yin'],
    ['十神', 'Ten Gods'],
    ['四柱', 'Four Pillars'],
    ['年柱', 'Year Pillar'],
    ['月柱', 'Month Pillar'],
    ['日柱', 'Day Pillar'],
    ['时柱', 'Hour Pillar'],
    ['天干', 'Heavenly Stems'],
    ['地支', 'Earthly Branches'],
    ['五行', 'Five Elements'],
    ['长生', 'Growth'], ['沐浴', 'Bath'], ['冠带', 'Crown Belt'], ['临官', 'Coming of Age'],
    ['帝旺', 'Prosperity Peak'], ['衰', 'Decline'], ['病', 'Sickness'], ['死', 'Death'], ['墓', 'Grave'],
    ['绝', 'Extinction'], ['胎', 'Conception'], ['养', 'Nurture'],
  ]),
  ...rows('qimen_term', [
    ['值使', 'Envoy Door'],
    ['空亡', 'Void'],
    ['驿马', 'Travelling Horse'],
    ['伏吟', 'Fu Yin'],
    ['反吟', 'Fan Yin'],
    ['应期', 'Timing Window'],
    ['旬首', 'Xun Leader'],
    ['阳遁', 'Yang Dun'],
    ['阴遁', 'Yin Dun'],
    ['入墓', 'Entering the Tomb'],
    ['击刑', 'Punishment'],
    ['八门', 'Eight Doors'],
    ['九星', 'Nine Stars'],
    ['八神', 'Eight Deities'],
    ['九宫', 'Nine Palaces'],
    ['天盘', 'Heaven Plate'],
    ['地盘', 'Earth Plate'],
    ['上元', 'Upper Yuan'],
    ['中元', 'Middle Yuan'],
    ['下元', 'Lower Yuan'],
  ]),
  ...rows('score_band', [
    ['大吉', 'Highly Favorable'],
    ['小吉', 'Favorable'],
    ['平', 'Neutral'],
    ['凶', 'Unfavorable'],
    ['中上吉', 'Above Average'],
    ['中平', 'Average'],
    ['偏凶', 'Below Average'],
  ]),
  // 神煞：没有通行英文名，一律用拼音（显示为 `Tian Yi Gui Ren (天乙贵人)`）。
  ...rows('shensha', [
    ['天乙贵人', 'Tian Yi Gui Ren', { variants: ['天乙'] }],
    ['太极贵人', 'Tai Ji Gui Ren'],
    ['天德', 'Tian De'],
    ['月德', 'Yue De'],
    ['天德合', 'Tian De He'],
    ['月德合', 'Yue De He'],
    ['天官贵人', 'Tian Guan Gui Ren'],
    ['国印贵人', 'Guo Yin Gui Ren'],
    ['福星贵人', 'Fu Xing Gui Ren'],
    ['德秀贵人', 'De Xiu Gui Ren'],
    ['文昌', 'Wen Chang'],
    ['学堂', 'Xue Tang'],
    ['天医', 'Tian Yi'],
    ['天厨', 'Tian Chu'],
    ['天喜', 'Tian Xi'],
    ['将星', 'Jiang Xing'],
    ['华盖', 'Hua Gai'],
    ['桃花', 'Tao Hua', { variants: ['咸池'] }],
    ['红艳', 'Hong Yan'],
    ['禄神', 'Lu Shen'],
    ['金舆', 'Jin Yu'],
    ['阳刃', 'Yang Ren', { variants: ['羊刃'] }],
    ['飞刃', 'Fei Ren'],
    ['血刃', 'Xue Ren'],
    ['魁罡', 'Kui Gang'],
    ['金神', 'Jin Shen'],
    ['三奇', 'San Qi'],
    ['日德', 'Ri De'],
    ['日贵', 'Ri Gui'],
    ['孤辰', 'Gu Chen'],
    ['寡宿', 'Gua Su'],
    ['大耗', 'Da Hao'],
    ['元辰', 'Yuan Chen'],
    ['劫煞', 'Jie Sha'],
    ['亡神', 'Wang Shen'],
    ['灾煞', 'Zai Sha'],
    ['流霞', 'Liu Xia'],
    ['天罗', 'Tian Luo'],
    ['地网', 'Di Wang'],
    ['阴差阳错', 'Yin Cha Yang Cuo'],
    ['孤鸾煞', 'Gu Luan Sha'],
  ]),
  ...rows('pattern', [
    ['正官格', 'Direct Officer Structure'],
    ['七杀格', 'Seven Killings Structure'],
    ['正财格', 'Direct Wealth Structure'],
    ['偏财格', 'Indirect Wealth Structure'],
    ['食神格', 'Eating God Structure'],
    ['伤官格', 'Hurting Officer Structure'],
    ['正印格', 'Direct Resource Structure'],
    ['偏印格', 'Indirect Resource Structure'],
    ['建禄格', 'Jian Lu Structure'],
    ['羊刃格', 'Yang Ren Structure', { variants: ['阳刃格'] }],
    ['从财格', 'Follow Wealth Structure'],
    ['从官杀格', 'Follow Officer Structure', { variants: ['从杀格'] }],
    ['从儿格', 'Follow Output Structure'],
    ['从势格', 'Follow Power Structure'],
    ['专旺格', 'Dominant Element Structure'],
  ]),
  // 纳音：拼音
  ...rows('nayin', [
    ['海中金', 'Hai Zhong Jin'], ['炉中火', 'Lu Zhong Huo'], ['大林木', 'Da Lin Mu'],
    ['路旁土', 'Lu Pang Tu'], ['剑锋金', 'Jian Feng Jin'], ['山头火', 'Shan Tou Huo'],
    ['涧下水', 'Jian Xia Shui'], ['城头土', 'Cheng Tou Tu'], ['白蜡金', 'Bai La Jin'],
    ['杨柳木', 'Yang Liu Mu'], ['泉中水', 'Quan Zhong Shui'], ['屋上土', 'Wu Shang Tu'],
    ['霹雳火', 'Pi Li Huo'], ['松柏木', 'Song Bai Mu'], ['长流水', 'Chang Liu Shui'],
    ['沙中金', 'Sha Zhong Jin', { variants: ['砂中金'] }], ['山下火', 'Shan Xia Huo'], ['平地木', 'Ping Di Mu'],
    ['壁上土', 'Bi Shang Tu'], ['金箔金', 'Jin Bo Jin', { variants: ['金泊金'] }], ['覆灯火', 'Fu Deng Huo'],
    ['天河水', 'Tian He Shui'], ['大驿土', 'Da Yi Tu'], ['钗钏金', 'Chai Chuan Jin'],
    ['桑柘木', 'Sang Zhe Mu'], ['大溪水', 'Da Xi Shui'], ['沙中土', 'Sha Zhong Tu'],
    ['天上火', 'Tian Shang Huo'], ['石榴木', 'Shi Liu Mu'], ['大海水', 'Da Hai Shui'],
  ]),
  ...rows('jieqi', [
    ['立春', 'Start of Spring'], ['雨水', 'Rain Water'], ['惊蛰', 'Awakening of Insects'],
    ['春分', 'Spring Equinox'], ['清明', 'Clear and Bright'], ['谷雨', 'Grain Rain'],
    ['立夏', 'Start of Summer'], ['小满', 'Grain Buds'], ['芒种', 'Grain in Ear'],
    ['夏至', 'Summer Solstice'], ['小暑', 'Minor Heat'], ['大暑', 'Major Heat'],
    ['立秋', 'Start of Autumn'], ['处暑', 'End of Heat'], ['白露', 'White Dew'],
    ['秋分', 'Autumn Equinox'], ['寒露', 'Cold Dew'], ['霜降', "Frost's Descent"],
    ['立冬', 'Start of Winter'], ['小雪', 'Minor Snow'], ['大雪', 'Major Snow'],
    ['冬至', 'Winter Solstice'], ['小寒', 'Minor Cold'], ['大寒', 'Major Cold'],
  ]),
  // 一级分类 label（code 见 lib/divinationCategories.js）
  ...rows('category', [
    ['事业职场', 'Career'],
    ['求财投资', 'Wealth & Investment'],
    ['婚恋感情', 'Love & Relationships'],
    ['健康疾病', 'Health'],
    ['交易失物', 'Deals & Lost Items'],
    ['考试学习', 'Exams & Study'],
    ['官司法务', 'Legal Matters'],
    ['风水家宅', 'Home & Feng Shui'],
    ['孕产子嗣', 'Pregnancy & Children'],
    ['杂事', 'General'],
  ]),
];

const byKey = new Map();
for (const entry of entries) {
  byKey.set(entry.zh, entry);
}
for (const entry of entries) {
  for (const v of entry.variants || []) {
    if (!byKey.has(v)) byKey.set(v, entry);
  }
}

function lookup(zh) {
  if (typeof zh !== 'string' || !zh) return undefined;
  return byKey.get(zh) || byKey.get(zh.trim());
}

function toEnglish(zh) {
  return lookup(zh)?.en;
}

function formatBilingual(zh) {
  const entry = lookup(zh);
  if (!entry) return zh;
  return `${entry.en} (${zh})`;
}

const GROUP_TITLES = {
  stem: 'Heavenly Stems',
  branch: 'Earthly Branches',
  element: 'Five Elements',
  shishen: 'Ten Gods',
  door: 'Eight Doors',
  star: 'Nine Stars',
  deity: 'Eight Deities',
  palace: 'Nine Palaces',
  bazi_term: 'Bazi terms',
  qimen_term: 'Qimen terms',
  score_band: 'Rating bands',
  shensha: 'Symbolic Stars (use pinyin)',
  pattern: 'Structures',
  nayin: 'Na Yin (use pinyin)',
  jieqi: 'Solar Terms',
  category: 'Question categories',
};

let promptBlockCache = null;

// 固定文本，按 group（GROUPS 顺序）与 zh 排序，供输出语言块拼进 prompt。
// 不含任何请求相关变量；连续调用逐字相同，保证 DeepSeek 前缀缓存稳定。
function buildPromptGlossaryBlock() {
  if (promptBlockCache) return promptBlockCache;
  const lines = [`Glossary (${GLOSSARY_VERSION}) — use exactly these English names:`];
  for (const group of GROUPS) {
    const items = entries
      .filter((e) => e.group === group)
      .slice()
      .sort((a, b) => (a.zh < b.zh ? -1 : a.zh > b.zh ? 1 : 0));
    if (!items.length) continue;
    lines.push(`- ${GROUP_TITLES[group]}: ${items.map((e) => `${e.zh}=${e.en}`).join('; ')}`);
  }
  promptBlockCache = lines.join('\n');
  return promptBlockCache;
}

module.exports = {
  GLOSSARY_VERSION,
  GROUPS,
  entries,
  lookup,
  toEnglish,
  formatBilingual,
  buildPromptGlossaryBlock,
};
