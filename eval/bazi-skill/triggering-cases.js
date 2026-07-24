'use strict';

/**
 * D1 触发准确度数据集。
 * should_trigger：bazi skill 是否应在该 prompt 上启动。
 * kind：bazi(正) / ziwei / qimen / western / non_divination / meta（负例分组，看误触发来源）。
 * ambiguous:true 的用例不计入硬门禁 F1，仅单独报告（边界口径有争议）。
 */

const CASES = [
  // ── 正例：八字（should_trigger = true）────────────────────────────────────
  { id: 'pos_01', kind: 'bazi', should_trigger: true, prompt: '帮我看看我的八字' },
  { id: 'pos_02', kind: 'bazi', should_trigger: true, prompt: '1990年5月1日下午2点出生，男，帮我排个命盘' },
  { id: 'pos_03', kind: 'bazi', should_trigger: true, prompt: '我的日主是什么，身强还是身弱？' },
  { id: 'pos_04', kind: 'bazi', should_trigger: true, prompt: '用八字看看我今年的财运' },
  { id: 'pos_05', kind: 'bazi', should_trigger: true, prompt: '我的大运流年怎么走？' },
  { id: 'pos_06', kind: 'bazi', should_trigger: true, prompt: '我的喜用神是什么？' },
  { id: 'pos_07', kind: 'bazi', should_trigger: true, prompt: '伤官配印是什么意思，我命里有没有？' },
  { id: 'pos_08', kind: 'bazi', should_trigger: true, prompt: '我这个四柱是不是七杀格？' },
  { id: 'pos_09', kind: 'bazi', should_trigger: true, prompt: '从八字看我适合做什么行业？' },
  { id: 'pos_10', kind: 'bazi', should_trigger: true, prompt: '食神生财在我命里成立吗？' },
  { id: 'pos_11', kind: 'bazi', should_trigger: true, prompt: '我五行缺什么？' },
  { id: 'pos_12', kind: 'bazi', should_trigger: true, prompt: '我的正官在哪一柱，代表什么？' },
  { id: 'pos_13', kind: 'bazi', should_trigger: true, prompt: '帮我分析下这个八字：庚午 辛巳 甲子 辛未' },
  { id: 'pos_14', kind: 'bazi', should_trigger: true, prompt: '我什么时候能结婚，看八字' },
  { id: 'pos_15', kind: 'bazi', should_trigger: true, prompt: '我今年犯太岁吗？从命理角度看' },
  { id: 'pos_16', kind: 'bazi', should_trigger: true, prompt: '天干地支的十神关系能帮我解一下吗' },
  { id: 'pos_17', kind: 'bazi', should_trigger: true, prompt: '我的旺衰和调候用神怎么定？' },
  { id: 'pos_18', kind: 'bazi', should_trigger: true, prompt: '未来五年我事业哪一年最有突破？用生辰八字推一下' },
  { id: 'pos_19', kind: 'bazi', should_trigger: true, prompt: '我是阳历1988年腊月生的男命，帮我看命局' },
  { id: 'pos_20', kind: 'bazi', should_trigger: true, prompt: '我的格局成格了吗，用神被破了没有？' },
  { id: 'pos_21', kind: 'bazi', should_trigger: true, prompt: '我八字里比劫太多是不是不聚财？' },
  { id: 'pos_22', kind: 'bazi', should_trigger: true, prompt: '想了解下自己的命，我的生辰是1995-08-12 早上7点，女' },
  { id: 'pos_23', kind: 'bazi', should_trigger: true, prompt: '我的日柱是丙寅，这代表什么性格？' },
  { id: 'pos_24', kind: 'bazi', should_trigger: true, prompt: '帮我看下我和我对象的八字合不合' },
  { id: 'pos_25', kind: 'bazi', should_trigger: true, prompt: '我今年流年走七杀，会有什么变化？' },

  // ── 硬负例：紫微斗数（should_trigger = false）─────────────────────────────
  { id: 'neg_zw_01', kind: 'ziwei', should_trigger: false, prompt: '帮我看紫微斗数命盘' },
  { id: 'neg_zw_02', kind: 'ziwei', should_trigger: false, prompt: '我的命宫主星是什么？' },
  { id: 'neg_zw_03', kind: 'ziwei', should_trigger: false, prompt: '紫微化忌落在哪个宫？' },
  { id: 'neg_zw_04', kind: 'ziwei', should_trigger: false, prompt: '武曲天府坐命是什么意思？' },
  { id: 'neg_zw_05', kind: 'ziwei', should_trigger: false, prompt: '我的大限走得怎么样，用紫微看' },
  { id: 'neg_zw_06', kind: 'ziwei', should_trigger: false, prompt: '廉贞在夫妻宫代表婚姻如何？' },
  { id: 'neg_zw_07', kind: 'ziwei', should_trigger: false, prompt: '帮我排一下十二宫的斗数命盘' },

  // ── 硬负例：奇门遁甲（should_trigger = false）─────────────────────────────
  { id: 'neg_qm_01', kind: 'qimen', should_trigger: false, prompt: '用奇门遁甲看这单生意能不能成' },
  { id: 'neg_qm_02', kind: 'qimen', should_trigger: false, prompt: '现在起个局，看我丢的东西在哪个方位' },
  { id: 'neg_qm_03', kind: 'qimen', should_trigger: false, prompt: '奇门择时，今天几点适合谈判？' },
  { id: 'neg_qm_04', kind: 'qimen', should_trigger: false, prompt: '值符落在几宫？' },
  { id: 'neg_qm_05', kind: 'qimen', should_trigger: false, prompt: '帮我排个奇门盘看这场官司走向' },
  { id: 'neg_qm_06', kind: 'qimen', should_trigger: false, prompt: '时家奇门里这个局的用神怎么取？' },

  // ── 负例：其他体系 / 非命理（should_trigger = false）─────────────────────
  { id: 'neg_w_01', kind: 'western', should_trigger: false, prompt: '狮子座今天运势怎么样？' },
  { id: 'neg_w_02', kind: 'western', should_trigger: false, prompt: '帮我看下我的星盘，太阳星座和上升' },
  { id: 'neg_w_03', kind: 'western', should_trigger: false, prompt: '塔罗牌帮我抽一张看感情' },
  { id: 'neg_nd_01', kind: 'non_divination', should_trigger: false, prompt: '今天天气怎么样？' },
  { id: 'neg_nd_02', kind: 'non_divination', should_trigger: false, prompt: '帮我写一段 Python 快排代码' },
  { id: 'neg_nd_03', kind: 'non_divination', should_trigger: false, prompt: '帮我把这段话翻译成英文' },
  { id: 'neg_nd_04', kind: 'non_divination', should_trigger: false, prompt: '推荐几个适合周末去的公园' },
  { id: 'neg_meta_01', kind: 'meta', should_trigger: false, prompt: '推荐几本讲八字入门的书' },
  { id: 'neg_meta_02', kind: 'meta', should_trigger: false, prompt: '八字这门术数大概是什么原理，简单科普一下' },

  // ── 边界模糊（不计入硬门禁，仅报告）──────────────────────────────────────
  { id: 'amb_01', kind: 'other', should_trigger: false, ambiguous: true, prompt: '我最近运气很差，怎么办？' },
  { id: 'amb_02', kind: 'other', should_trigger: true, ambiguous: true, prompt: '帮我算算命' },
  { id: 'amb_03', kind: 'other', should_trigger: false, ambiguous: true, prompt: '帮我看看今天的黄道吉日适不适合搬家' },
];

module.exports = { CASES };
