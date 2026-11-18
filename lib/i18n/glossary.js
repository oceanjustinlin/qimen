'use strict';
// 共享术语表：B（符号与枚举）、C（引擎断语）、D（LLM 断语）三层共同的事实来源。
// 前端用它显示 `English (汉字)`，Worker 用它拼进 prompt，离线翻译脚本用它约束译文。
//
// 每个条目：
//   zh       简体原值（唯一键）
//   group    分类（见 GROUPS）
//   en       英文正式名：优先用英文八字圈通行译法（Ten Gods、Goat Blade、Peach Blossom…），
//            干支、纳音、九星等没有通行意译的用拼音（spec §5.5）
//   desc?    给初学者的短释义：天干为阴阳五行（Yang Wood），地支为生肖（Rat）
//   hant?    仅在通用简转繁会出错时填写
//   variants? 同一符号在代码里的其他写法（繁体字形、十神简称、带「星」「宫」后缀等），lookup 时等同 zh
//
// 紫微术语不进本表（用 iztro 自带的 en-US 语言包）。
// 改动任何 en 译名都要递增 GLOSSARY_VERSION。

const GLOSSARY_VERSION = 'g2';

const GROUPS = [
  'stem', 'branch', 'element', 'shishen', 'door', 'star', 'deity', 'palace',
  'bazi_term', 'climate', 'qimen_term', 'score_band', 'shensha', 'pattern', 'pattern_sub', 'nayin', 'jieqi', 'category',
];

function rows(group, list) {
  return list.map(([zh, en, extra]) => ({ zh, group, en, ...(extra || {}) }));
}

const entries = [
  ...rows('stem', [
    ['甲', 'Jia', { desc: 'Yang Wood' }], ['乙', 'Yi', { desc: 'Yin Wood' }],
    ['丙', 'Bing', { desc: 'Yang Fire' }], ['丁', 'Ding', { desc: 'Yin Fire' }],
    ['戊', 'Wu', { desc: 'Yang Earth' }], ['己', 'Ji', { desc: 'Yin Earth' }],
    ['庚', 'Geng', { desc: 'Yang Metal' }], ['辛', 'Xin', { desc: 'Yin Metal' }],
    ['壬', 'Ren', { desc: 'Yang Water' }], ['癸', 'Gui', { desc: 'Yin Water' }],
  ]),
  ...rows('branch', [
    ['子', 'Zi', { desc: 'Rat' }], ['丑', 'Chou', { desc: 'Ox', hant: '丑' }], ['寅', 'Yin', { desc: 'Tiger' }],
    ['卯', 'Mao', { desc: 'Rabbit' }], ['辰', 'Chen', { desc: 'Dragon' }], ['巳', 'Si', { desc: 'Snake' }],
    ['午', 'Wu', { desc: 'Horse' }], ['未', 'Wei', { desc: 'Goat' }], ['申', 'Shen', { desc: 'Monkey' }],
    ['酉', 'You', { desc: 'Rooster' }], ['戌', 'Xu', { desc: 'Dog' }], ['亥', 'Hai', { desc: 'Pig' }],
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
    ['日主', 'Day Master', { variants: ['元男', '元女'] }],
    ['用神', 'Useful God'],
    ['喜神', 'Favorable God'],
    ['忌神', 'Unfavorable God'],
    ['格局', 'Structure'],
    ['大运', 'Luck Pillar'],
    ['流年', 'Annual Pillar'],
    ['流月', 'Monthly Pillar'],
    ['身强', 'Strong Day Master'],
    ['身弱', 'Weak Day Master'],
    ['身中', 'Balanced Day Master', { variants: ['中和'] }],
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
    ['星运', 'Life Stage'],
    ['自座', 'Self Seat'],
    ['长生', 'Birth'], ['沐浴', 'Bath'], ['冠带', 'Crown Belt'], ['临官', 'Coming of Age', { variants: ['建禄'] }],
    ['帝旺', 'Peak'], ['衰', 'Decline'], ['病', 'Sickness'], ['死', 'Death'], ['墓', 'Tomb', { variants: ['库'] }],
    ['绝', 'Extinction'], ['胎', 'Conception'], ['养', 'Nurture'],
  ]),
  // 调候气候状态与紧迫度（lib/BaziRuleEngine.js 月令表）
  ...rows('climate', [
    ['初春余寒', 'Lingering Early-Spring Cold'],
    ['春木舒展', 'Spring Wood Flourishing'],
    ['春末湿滞', 'Late-Spring Damp'],
    ['初夏燥热', 'Early-Summer Heat'],
    ['火炎燥烈', 'Blazing Dry Fire'],
    ['暑土燥湿相杂', 'Midsummer Earth, Dry and Damp'],
    ['初秋肃燥', 'Early-Autumn Dryness'],
    ['秋金肃杀', 'Austere Autumn Metal'],
    ['晚秋燥土', 'Late-Autumn Dry Earth'],
    ['初冬寒湿', 'Early-Winter Cold and Damp'],
    ['寒湿偏重', 'Heavy Cold and Damp'],
    ['寒湿冻土', 'Frozen Damp Earth'],
    ['气候未定', 'Climate Undetermined'],
    ['普通', 'Normal'],
    ['偏急', 'Pressing'],
    ['极急', 'Urgent'],
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
  // 神煞：用英文八字圈通行译名（Nobleman、Peach Blossom、Travelling Horse…），
  // 显示为 `Heavenly Nobleman (天乙贵人)`；确无通行意译的（魁罡、元辰）用拼音。
  ...rows('shensha', [
    ['天乙贵人', 'Heavenly Nobleman', { variants: ['天乙'] }],
    ['太极贵人', 'Grand Ultimate Nobleman'],
    ['天德', 'Heavenly Virtue', { variants: ['天德贵人'] }],
    ['月德', 'Monthly Virtue', { variants: ['月德贵人'] }],
    ['天德合', 'Heavenly Virtue Combination'],
    ['月德合', 'Monthly Virtue Combination'],
    ['天官贵人', 'Heavenly Official Nobleman'],
    ['国印贵人', 'National Seal Nobleman'],
    ['福星贵人', 'Fortune Star Nobleman'],
    ['德秀贵人', 'Virtue Excellence Nobleman'],
    ['文昌', 'Intelligence Star', { variants: ['文昌贵人'] }],
    ['学堂', 'Study Hall'],
    ['天医', 'Heavenly Doctor'],
    ['天厨', 'Heavenly Kitchen', { variants: ['天厨贵人'] }],
    ['天喜', 'Heavenly Happiness'],
    ['红鸾', 'Red Phoenix Star'],
    ['将星', 'General Star'],
    ['华盖', 'Canopy'],
    ['桃花', 'Peach Blossom', { variants: ['咸池'] }],
    ['红艳', 'Red Romance', { variants: ['红艳煞'] }],
    ['禄神', 'Prosperity Star'],
    ['金舆', 'Golden Carriage'],
    ['阳刃', 'Goat Blade', { variants: ['羊刃'] }],
    ['飞刃', 'Flying Blade'],
    ['血刃', 'Blood Blade'],
    ['魁罡', 'Kui Gang'],
    ['金神', 'Golden Spirit'],
    ['三奇', 'Three Wonders'],
    ['日德', 'Day Virtue'],
    ['日贵', 'Day Nobleman'],
    ['孤辰', 'Lonely Star'],
    ['寡宿', 'Widow Star'],
    ['大耗', 'Great Loss'],
    ['元辰', 'Yuan Chen'],
    ['劫煞', 'Robbery Star'],
    ['亡神', 'Lost Spirit'],
    ['灾煞', 'Calamity Star'],
    ['流霞', 'Flowing Haze'],
    ['天罗', 'Heaven Net'],
    ['地网', 'Earth Net'],
    ['阴差阳错', 'Yin Yang Mismatch'],
    ['孤鸾煞', 'Lonely Phoenix'],
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
    ['建禄格', 'Thriving Structure', { variants: ['禄格'] }],
    ['羊刃格', 'Goat Blade Structure', { variants: ['阳刃格', '月刃格'] }],
    ['从财格', 'Follow Wealth Structure'],
    ['从官杀格', 'Follow Officer Structure', { variants: ['从杀格'] }],
    ['从儿格', 'Follow Child Structure'],
    ['从势格', 'Follow Power Structure'],
    ['专旺格', 'Dominant Structure'],
    ['化气格', 'Transformation Structure'],
    ['从食伤格', 'Follow Output Structure'],
    ['曲直格', 'Wood Dominant Structure'],
    ['炎上格', 'Fire Dominant Structure'],
    ['稼穑格', 'Earth Dominant Structure'],
    ['从革格', 'Metal Dominant Structure'],
    ['润下格', 'Water Dominant Structure'],
    ['魁罡格', 'Kui Gang Structure'],
    ['杀印相生格', 'Seven Killings Producing Resource'],
    ['食神生财格', 'Eating God Producing Wealth'],
    ['伤官生财格', 'Hurting Officer Producing Wealth'],
    ['伤官佩印格', 'Hurting Officer with Resource', { variants: ['伤官配印格', '伤官配印', '伤官佩印'] }],
    ['正官佩印格', 'Direct Officer with Resource', { variants: ['官印相生格'] }],
    ['食神制杀格', 'Eating God Controlling Seven Killings'],
    ['财旺生官格', 'Wealth Producing Officer'],
    ['财滋弱杀格', 'Wealth Nourishing Seven Killings'],
    ['羊刃驾官格', 'Goat Blade with Officer'],
    ['刃杀相停格', 'Goat Blade Balancing Seven Killings'],
  ]),
  // 成格子类（小格）：只给界面显示用，不进 prompt 术语块（控制前缀长度）
  ...rows('pattern_sub', [
    ['用官喜财格', 'Officer Supported by Wealth'],
    ['用财喜印格', 'Wealth Supported by Resource'],
    ['用财喜比格', 'Wealth Supported by Friend'],
    ['用印喜官格', 'Resource Supported by Officer'],
    ['用印喜食格', 'Resource Supported by Eating God'],
    ['用印喜比格', 'Resource Supported by Friend'],
    ['用食喜比格', 'Eating God Supported by Friend'],
    ['弃官就食格', 'Officer Yielding to Eating God'],
    ['弃官存财格', 'Officer Removed, Wealth Kept'],
    ['弃杀就财格', 'Seven Killings Yielding to Wealth'],
    ['弃印就财格', 'Resource Yielding to Wealth'],
    ['弃食就印格', 'Eating God Yielding to Resource'],
    ['合杀存财格', 'Seven Killings Combined, Wealth Kept'],
    ['制杀生财格', 'Seven Killings Controlled, Wealth Produced'],
    ['杀邀食制格', 'Seven Killings Met by Eating God'],
    ['七杀用财格', 'Seven Killings Using Wealth'],
    ['以劫合杀格', 'Rob Wealth Combining Seven Killings'],
    ['灵枭得用格', 'Indirect Resource Put to Use'],
    ['伤官用杀印格', 'Hurting Officer with Seven Killings and Resource'],
    ['官兼用财印格', 'Officer with Wealth and Resource'],
    ['伤官喜官格', 'Hurting Officer Welcoming Officer'],
    ['伤官弃官格', 'Hurting Officer Without Officer'],
    ['建禄用官格', 'Thriving with Officer'],
    ['建禄用财格', 'Thriving with Wealth'],
    ['建禄用食格', 'Thriving with Eating God'],
    ['刃旺泄秀格', 'Strong Blade Venting Brilliance'],
    ['刃泄生财格', 'Blade Venting to Wealth'],
    ['印旺泄秀格', 'Strong Resource Venting Brilliance'],
    ['财带暗官格', 'Wealth with Hidden Officer'],
    ['财格佩印格', 'Wealth with Resource'],
    ['财喜食生格', 'Wealth Produced by Eating God'],
    ['化官为印格', 'Officer Transformed into Resource'],
    ['金白水清', 'Pure Metal, Clear Water'],
    ['强众敌寡', 'Strong Many over Weak Few'],
    ['火土成势', 'Fire-Earth Momentum'],
  ]),
  // 纳音：用英文书常见的意译（Gold in the Sea…）
  ...rows('nayin', [
    ['海中金', 'Gold in the Sea'], ['炉中火', 'Fire in the Furnace'], ['大林木', 'Great Forest Wood'],
    ['路旁土', 'Roadside Earth'], ['剑锋金', 'Sword Edge Metal'], ['山头火', 'Mountain Top Fire'],
    ['涧下水', 'Valley Stream Water'], ['城头土', 'City Wall Earth'], ['白蜡金', 'White Wax Metal'],
    ['杨柳木', 'Willow Wood'], ['泉中水', 'Spring Water'], ['屋上土', 'Rooftop Earth'],
    ['霹雳火', 'Thunderbolt Fire'], ['松柏木', 'Pine and Cypress Wood'], ['长流水', 'Long River Water'],
    ['沙中金', 'Gold in the Sand', { variants: ['砂中金'] }], ['山下火', 'Fire Below the Mountain'], ['平地木', 'Flatland Wood'],
    ['壁上土', 'Wall Earth'], ['金箔金', 'Gold Foil Metal', { variants: ['金泊金'] }], ['覆灯火', 'Lamp Fire'],
    ['天河水', 'Heavenly River Water'], ['大驿土', 'Great Road Earth'], ['钗钏金', 'Hairpin Metal'],
    ['桑柘木', 'Mulberry Wood'], ['大溪水', 'Great Stream Water'], ['沙中土', 'Sand Earth'],
    ['天上火', 'Heavenly Fire'], ['石榴木', 'Pomegranate Wood'], ['大海水', 'Great Ocean Water'],
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

// 初学者释义：甲 → 'Yang Wood'，子 → 'Rat'；没有释义返回 undefined
function describe(zh) {
  return lookup(zh)?.desc;
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
  climate: 'Climate (Tiao Hou)',
  qimen_term: 'Qimen terms',
  score_band: 'Rating bands',
  shensha: 'Symbolic Stars',
  pattern: 'Structures',
  pattern_sub: 'Sub-structures',
  nayin: 'Na Yin',
  jieqi: 'Solar Terms',
  category: 'Question categories',
};

const PROMPT_EXCLUDED_GROUPS = new Set(['pattern_sub']);

let promptBlockCache = null;

// 固定文本，按 group（GROUPS 顺序）与 zh 排序，供输出语言块拼进 prompt。
// 不含任何请求相关变量；连续调用逐字相同，保证 DeepSeek 前缀缓存稳定。
function buildPromptGlossaryBlock() {
  if (promptBlockCache) return promptBlockCache;
  const lines = [`Glossary (${GLOSSARY_VERSION}) — use exactly these English names:`];
  for (const group of GROUPS) {
    if (PROMPT_EXCLUDED_GROUPS.has(group)) continue;
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
  describe,
  buildPromptGlossaryBlock,
};
