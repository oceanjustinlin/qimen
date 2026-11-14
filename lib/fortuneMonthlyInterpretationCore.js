const MONTHLY_INTERPRETATION_PROMPT_VERSION = 'monthly-interpretation-v6-flow-month';
const { buildContextPromptBlock } = require('./fortuneContextNotes');

const ALLOWED_MONTHLY_DIMENSIONS = new Set(['overall', 'career', 'wealth', 'love']);

const GAN_WUXING = {
  甲: '木', 乙: '木',
  丙: '火', 丁: '火',
  戊: '土', 己: '土',
  庚: '金', 辛: '金',
  壬: '水', 癸: '水',
};

const DIMENSION_LABELS = {
  overall: '综合运势',
  career: '事业运',
  wealth: '财运',
  love: '爱情运',
};

const DIMENSION_SHISHEN_COPY = {
  overall: `
| 十神 | 综合白话 |
|------|----------|
| 正官 | 规则、秩序、被认可、稳定推进 |
| 七杀 | 压力、挑战、竞争、需要快速反应 |
| 正印 | 贵人、学习、背书、被保护 |
| 偏印 | 独立思考、深耕、灵感、略显孤立 |
| 食神 | 表达、享受、口碑、自然流动 |
| 伤官 | 锋芒、改革、表达欲、容易顶撞 |
| 正财 | 稳定回报、现实成果、细水长流 |
| 偏财 | 流动机会、人脉资源、额外收益 |
| 比肩 | 同伴、竞争、并肩推进、自我坚持 |
| 劫财 | 资源分流、消耗、同伴牵扯 |`,
  career: `
| 十神 | 事业维度白话 |
|------|------------|
| 正官 | 职场被认可、上级关注、规则内推进 |
| 七杀 | 高压挑战、竞争对手、KPI施压 |
| 正印 | 领导背书、学习机会、资质考证 |
| 偏印 | 独立钻研、适合深耕、不喜受控 |
| 食神 | 创意输出、口碑积累、受众喜爱 |
| 伤官 | 改革冲劲、易与权威摩擦 |
| 正财 | 勤劳有回报、绩效薪资 |
| 偏财 | 副业机会、人脉带来项目 |
| 比肩 | 团队协作或竞争、同事关系 |
| 劫财 | 被同伴拖累、容易做无用功 |`,
  wealth: `
| 十神 | 财运维度白话 |
|------|------------|
| 正官 | 合规收益、稳定制度内收入 |
| 七杀 | 意外支出、资金缺口、财务压力 |
| 正印 | 有人兜底、稳健支持 |
| 偏印 | 偏门收益、版税专利 |
| 食神 | 轻松进财、口碑变现 |
| 伤官 | 开源思维活跃，也易冲动消费 |
| 正财 | 细水长流、适合记账守财 |
| 偏财 | 意外收益、流动性收入 |
| 比肩 | 钱财分流、易被朋友借钱 |
| 劫财 | 冲动消费、钱不知去向 |`,
  love: `
| 十神 | 爱情维度白话 |
|------|------------|
| 正官 | 女命：靠谱追求者或关系进展；男命：感情更有规划 |
| 七杀 | 女命：强势或控制欲强的对象；男命：感情有摩擦 |
| 正印 | 感情中偏被动，贵人缘好 |
| 偏印 | 感情淡漠期，不易主动 |
| 食神 | 感情自然流露，适合轻松约会 |
| 伤官 | 言语容易伤感情，热烈但不稳定 |
| 正财 | 男命：稳定踏实的感情；女命：感情有物质保障 |
| 偏财 | 男命：新异性缘分；女命：非典型缘分 |
| 比肩 | 同性竞争桃花、感情有外部干扰 |
| 劫财 | 遇到消耗自己资源的对象 |`,
};

function normalizeDimension(value) {
  const dimension = String(value || 'overall').trim().toLowerCase();
  if (!ALLOWED_MONTHLY_DIMENSIONS.has(dimension)) {
    const error = new Error('不支持的月运解读维度');
    error.statusCode = 400;
    throw error;
  }
  return dimension;
}

function getDayMaster(profile = {}) {
  const gan = String(profile.ri_zhu || '').charAt(0);
  return gan ? `${gan}${GAN_WUXING[gan] || ''}` : '未知日主';
}

// 分层分值换成定性档位再给模型：模型没见过分数，就不会把“格局层21分”写给用户。
function levelLabel(value, strong, weak) {
  const n = Number(value) || 0;
  if (n >= strong) return '明显偏强';
  if (n >= weak) return '略偏强';
  if (n > -weak) return '平稳';
  if (n > -strong) return '略偏弱';
  return '明显偏弱';
}

function monthToneLabel(score) {
  const n = Number(score) || 70;
  if (n < 60) return '谨慎蛰伏';
  if (n <= 75) return '平稳蓄力';
  if (n <= 85) return '积极进取';
  return '高光时刻';
}

function dailyAverageLabel(avg) {
  const n = Number(avg) || 70;
  if (n >= 75) return '整体偏顺';
  if (n >= 65) return '整体平稳';
  return '整体偏弱';
}

function transitLabel(value) {
  const n = Number(value) || 0;
  if (n > 0) return '被大运流年扶起';
  if (n < 0) return '被大运流年冲破';
  return '大运流年影响不大';
}

function formatArray(value) {
  return Array.isArray(value) ? value.join('、') : String(value || '');
}

function getDimensionRules(dimension) {
  if (dimension === 'career') {
    return `
career 事业运：
- 月干信号若指向规则、上级、考核，且为喜用：写成职场被看见、被认可、适合争取资源。
- 若指向规则、上级、考核，且为忌仇：写成上级施压、流程卡顿或职场内耗。
- 若指向竞争、高压，且为喜用：写成竞争中可出头，适合攻坚。
- 若指向竞争、高压，且为忌仇：写成压力大、防小人、少硬碰硬。
- 文昌贵人触发：特别适合考试、写作、提案、演讲。
- 禄神触发：本职工作有回报，守住本位比冒进更有效。
- 岁运承接为“被大运流年扶起”：说明事业信号有承接，可以写成“更容易被接住、被看见”。
- 岁运承接为“被大运流年冲破”：说明好信号被冲破，需写成“有想法但落地需更谨慎”。`;
  }
  if (dimension === 'wealth') {
    return `
wealth 财运：
- 月令与命主关系为喜用，且干支格局层偏强：主动财较旺，适合谈判、争取收入。
- 月令与命主关系为忌仇，且干支格局层偏弱：偏守财，不宜重仓冒险。
- 月干信号指向副业、人脉、流动收益，且驿马触发：副业或流动性收益有机会，但需结合本月整体基调控制语气。
- 月干信号指向同伴竞争、钱财分流，且在忌仇列表中：提示借钱、人情消费、冲动消费风险。
- 月内日运整体偏弱：整体财运偏弱，不适合大额投资或赌博性决策。
- 本月空亡：财来财去，不宜做大额长线投入。
- 岁运承接为“被大运流年冲破”：即使有赚钱信号，也要写成“进账不稳、容易被支出抵消”。`;
  }
  if (dimension === 'love') {
    return `
love 爱情运：
- 男命：稳定伴侣信号为喜用，现有感情稳定推进，适合认真表态；新缘分/社交吸引信号为忌仇，容易遇到消耗型关系。
- 女命：稳定关系信号为喜用，感情有正向进展；强烈吸引/张力信号为忌仇，感情压力大，易争吵或遭遇控制型对象。
- 表达欲旺的月份：言语容易伤感情，约会前少说多听。
- 温和输出的月份：感情自然流露，适合轻松约会。
- 本月三刑：有缘分也容易节外生枝，需格外注意相处边界。
- 天乙贵人触发：社交场合更容易遇到愿意帮你、理解你的人。
- 岁运承接为“被大运流年冲破”：感情好信号要打折，不要写成稳定确定。`;
  }
  return `
overall 综合运势：
- 综合干支格局层、日运节奏层、月令神煞层描述本月整体节奏。
- 干支格局层偏强时，强调结构上有助力；偏弱时，强调刑冲合害带来的现实压力。
- 日运节奏层只作为日内节奏参考，不得把它写成本月主因。
- 月令神煞层偏强时，强调月令、神煞或岁运承接有力；偏弱时，强调有虚耗或好信号难落地。
- 必须点出高分日窗口。
  - trough_period 非空时必须提示低谷期。`;
}

function getDimensionFewShot(dimension) {
  if (dimension === 'career') {
    return `
#### career（事业运）

**示例 C — 被看见、易推进的月份**

输入信号：
- 本月整体基调：积极进取
- month_gan_shishen = "正官"
- favorable_elements = ["正官", "正印"]
- month_wuxing_relation = "喜用"
- 岁运承接：被大运流年扶起
- lu_active = true
- high_score_dates = ["2026-05-08", "2026-05-20"]

好的写法：
"这个月在职场上是一个可以往前走的月份。本月的能量方向跟职场规则、上级关系、被看见这件事是对齐的，而这个方向对你来说本身就是有利的，所以不是强行去争，而是顺势而为就更容易有回响。简单说就是：这个月你在工作上做了什么，更容易被看到。\n\n本月还有一个信号是本职工作的回报感会比较明显，不需要特别去冒险或开辟新方向，守好自己的核心职责，反而会有不错的反馈。大运和流年也在放大这个信号，说明这种被认可的感觉不只是昙花一现，而是有延续性的。\n\n5月8日和5月20日前后是状态比较集中的日子，适合在那附近安排重要的汇报、沟通或提案。如果有一直想找机会和上级说的事情，这个月是比较自然的时机，不需要刻意铺垫太多。"

坏的写法：
"月干十神为正官，属于喜用神，所以事业运好。禄神触发，transit_support_score 为正。建议在高分日汇报工作。"

问题：
- 把推演结论直接说出来，没有转译成用户能感受到的现实场景
- 术语直接外露

**示例 D — 压力偏重、宜稳守的月份**

输入信号：
- 本月整体基调：平稳蓄力
- month_gan_shishen = "七杀"
- unfavorable_elements = ["七杀", "正官"]
- month_wuxing_relation = "忌仇"
- 岁运承接：被大运流年冲破
- high_score_dates = ["2026-05-14"]
- trough_period = "5月21日–5月25日"

好的写法：
"这个月职场上的节奏会比平时紧一些，主要来自外部压力，可能是考核变严、竞争对手动作变多，或者上面的要求突然变密。这种月份的本质不是你做错了什么，而是环境本身在给你施加更多变量，你的精力要分配在应对上，而不是扩张上。再加上大运和流年在这个方向上并没有给你提供什么缓冲，所以这些压力相对来说是比较实在的，不太容易靠运气化解。\n\n本月比较合适的姿态是把正在推进的项目做扎实，不要在这个时间点主动去挑战规则或向上博弈，否则容易两头受力。5月21日到5月25日尤其要放缓，这几天适合处理例行事务，把需要对外沟通的事情往前或往后挪。5月14日前后状态相对稳，有必须推进的事可以安排在那附近。\n\n总结一句，这个月不是不能动，而是动作要稳，先守住已有的，等压力周期过了再发力。"

坏的写法：
"七杀为忌仇，本月事业不顺，竞争压力大。layer1_score 为-9，transit_support_score 为负，所以要防守。5月21日到25日为低谷期。"

问题：
- 完全是数据复述，没有语境和温度
- 用户看完只会焦虑，不知道具体怎么应对`;
  }

  if (dimension === 'wealth') {
    return `
#### wealth（财运）

**示例 E — 流动收益更顺的月份**

输入信号：
- 本月整体基调：积极进取
- month_gan_shishen = "偏财"
- month_wuxing_relation = "喜用"
- yima_active = true
- yima_favorable = true
- 月内日运：整体平稳偏顺
- is_kongwang = false
- 岁运承接：被大运流年扶起
- high_score_dates = ["2026-05-06", "2026-05-18", "2026-05-26"]

好的写法：
"这个月财运的主旋律是流动性的收益，而不是靠死守一个稳定来源慢慢积累。本月的能量方向天然倾向于副业、人脉转化、出行带来的收益，或者某件意外推进的事情带来的回报，而这个方向对你来说是顺的。之所以这样判断，是因为本月月令的五行方向对你是有利的，同时还有一个变动加速的信号在，这两个叠在一起，说明钱大概率不会只从原有的固定渠道来，而是从某个你动起来之后才会看到的地方来。\n\n5月6日、5月18日和5月26日前后是本月能量比较集中的几个点，这几天如果有需要谈钱、谈合作、或者推进某个有收益潜力的项目，成功率会相对高一些。月内整体日运质量也算稳，没有太大的低谷起伏，所以不用刻意保留很多防守空间，正常推进即可。\n\n这个月最值得做的一件事，是把你一直觉得可以试试但还没动的那个副业或收入渠道，往前推进一步。"

坏的写法：
"偏财为喜用，yima_active 为 true，yima_favorable 为 true，月令喜用，所以本月财运不错，适合发展副业。layer1_score 为10，整体偏正。"

问题：
- 把字段的名称和状态直接输出，完全没有转译
- 没有说清楚为什么这个月更适合副业而不是主业收益

**示例 F — 容易钱往外流的月份**

输入信号：
- 本月整体基调：平稳蓄力
- month_gan_shishen = "劫财"
- unfavorable_elements = ["劫财", "比肩"]
- month_wuxing_relation = "忌仇"
- 月内日运：整体偏弱
- 岁运承接：被大运流年冲破
- trough_period = "5月16日–5月20日"
- high_score_dates = ["2026-05-10"]

好的写法：
"这个月在财运上更适合守住已有的，而不是去追新的。本月的能量方向跟钱往外流这件事比较对齐，不一定是大额损失，而是那种钱不知道花到哪里去了、朋友借钱开口不好拒绝、或者冲动下单了一些其实不需要的东西。这种月份的特点是支出来得悄悄的，事后才发现账单比预期高。再加上大运流年方向也在放大这个消耗信号，所以财务上的纪律感，这个月比平时更值钱。\n\n5月16日到5月20日是本月最容易在钱的问题上出现意外摩擦的几天，那几天特别适合推迟大额消费决定，也不太适合给别人做财务背书。5月10日前后相对稳，有必要处理的财务事项可以安排在那附近。\n\n这个月真正要做的不是找新的收益方式，而是把记账这件事认真做起来，知道钱去哪了，才是最实在的财运管理。"

坏的写法：
"月干十神为劫财，属于忌仇神，本月漏财风险高。layer1_score 为-8，月令也是忌仇，avg_daily_score 偏低。建议减少支出。"

问题：
- 没有生活场景，用户不知道是哪种漏财
- 建议太笼统，没有时间锚点`;
  }

  if (dimension === 'love') {
    return `
#### love（爱情运）

**示例 G — 稳定关系更容易推进的月份**

输入信号：
- 本月整体基调：积极进取
- month_gan_shishen = "正官"
- gender = "female"
- favorable_elements = ["正官", "正印"]
- tianyi_active = true
- has_sanxing = false
- 岁运承接：被大运流年扶起
- high_score_dates = ["2026-05-11", "2026-05-22"]

好的写法：
"这个月在感情上是一个比较值得认真对待的月份。本月的能量方向天然偏向稳定关系的推进，不是那种热烈但没有落点的激情，而是我们要不要往前走一步这件事变得更容易开口，也更容易被接住。之所以这样判断，是因为本月的能量结构对女命来说更倾向于靠谱、有规划的感情方向，而这个方向对你来说是有利的，加上大运流年也在放大这个信号，所以如果有一直想往前推进但没找到合适时机的感情，这个月是比较自然的窗口。\n\n另外本月贵人运比较旺，社交场合更容易遇到真心愿意帮你、理解你的人，单身的话也值得多出现在新的圈子里。5月11日和5月22日前后是本月状态比较顺的日子，适合在那附近安排重要的约会或认真的谈话。\n\n这个月的感情关键词是稳稳地往前走，不用催，但也别错过窗口。"

坏的写法：
"正官为喜用，女命正官代表感情，所以本月爱情运好。tianyi_active 为 true，transit_support_score 为正。建议在高分日约会。"

问题：
- 术语直接外露
- 没有任何场景感，用户不知道好在哪

**示例 H — 新缘分有吸引，但不宜快投入的月份**

输入信号：
- 本月整体基调：平稳蓄力
- month_gan_shishen = "偏财"
- gender = "male"
- unfavorable_elements = ["偏财", "劫财"]
- taohua_active = true
- has_sanxing = true
- 岁运承接：被大运流年冲破
- high_score_dates = ["2026-05-15"]
- trough_period = "5月20日–5月24日"

好的写法：
"这个月感情上会有一些新的异性缘分信号出现，但这个月更值得做的是看清楚那个信号背后是什么，而不是直接跟进。本月的桃花信号是真实存在的，会有人出现、有互动、有吸引，但本月整体的能量结构说明这些吸引更偏向消耗型，对方看起来有趣，可跟进之后可能会发现在消耗你的时间、精力或者资源，而你本来就在忌讳这个方向。再加上大运流年也没有在放大这段缘分，所以吸引力是有的，但稳定性要打折。\n\n本月人际关系也相对敏感，三方关系或者意外的干扰比较容易出现，有在谈的感情要注意相处边界，避免因为一时冲动说了不该说的话。5月20日到5月24日感情上的摩擦感会更明显，那几天不太适合做重要表白或确认关系的谈话。5月15日前后是本月相对稳的一天，有需要沟通的事情可以尽量安排在那附近。\n\n这个月感情上最实在的建议，是让新缘分保持轻松接触，但别太快把自己的资源和时间大量投入进去。"

坏的写法：
"偏财为忌仇，taohua_active 为 true，has_sanxing 为 true，所以本月爱情要小心。可能遇到烂桃花。transit_support_score 为负。注意5月20日到24日。"

问题：
- 直接把字段名输出
- 结论粗暴，没有说清楚为什么、怎么判断、怎么应对`;
  }

  return `
#### overall（综合运势）

**示例 A — 整体偏强月份**

输入信号：
- 本月整体基调：积极进取
- 干支格局层：明显偏强
- 日运节奏层：明显偏强
- 月令神煞层：明显偏强
- 岁运承接：被大运流年扶起
- month_relations = "流月天干与命主日干天干五合化木（喜用）；月德贵人得令"
- high_score_dates = ["2026-05-09", "2026-05-17", "2026-05-23"]
- trough_period = ""

好的写法：
"这个月整体是一个值得主动出手的月份，不是那种靠感觉说好像挺顺的，而是有结构在撑着。流月天干跟你本身的日主形成了一种合化关系，合出来的能量方向对你来说是有利的，这意味着外部环境不会刻意跟你对着来，很多事推起来阻力会小一截。再加上本月贵人信号比较旺，大运和流年的方向也在放大这些好信号，所以不只是时机看起来好，而是真的更容易落地。\n\n本月大部分日子状态都算稳，5月9日、5月17日和5月23日前后能量尤其集中，适合把需要拍板或沟通的事情安排在这几天附近。没有明显的连续低谷期，所以不用刻意留防守周，保持正常节奏推进即可。\n\n总的来说，这个月比较适合把手上准备了一段时间、等待时机的事情往前推一步。"

坏的写法：
"本月 baseScore 为82，layer1_score 为16，layer2_score 为12，综合来看本月运势较好。transit_support_score 为正，说明大运流年承接正向。建议在高分日行动。"

问题：
- 直接复述字段名和数字，像系统日志不像人话
- 完全没有解释为什么，用户看不出这个月好在哪

**示例 B — 整体偏弱月份**

输入信号：
- 本月整体基调：谨慎蛰伏
- 干支格局层：明显偏弱
- 日运节奏层：明显偏弱
- 月令神煞层：略偏弱
- 岁运承接：被大运流年冲破
- month_relations = "流月地支与命主日支六冲（冲喜用）；流月地支与流年支形成六害"
- high_score_dates = ["2026-05-12"]
- trough_period = "5月19日–5月23日"
- is_kongwang = true

好的写法：
"这个月更适合把重心放在稳住现有局面，而不是开新战线。之所以这样说，是因为流月的地支跟你原局和今年流年都形成了比较明显的对冲和摩擦关系，这种结构不是一时的情绪波动，而是外部环境本身对你正在做的事情会产生更多干扰，计划容易变、沟通容易反复、推进中的事情容易卡在细节上。再加上本月有空亡的信号，很多事情看着能动，但真正落地时会发现有一层虚耗，能量容易散在不重要的地方。\n\n5月19日到5月23日这段时间是本月最需要放慢的窗口，重要决定尽量不要卡在这几天做，已经在走的事情也要留出回旋余地。5月12日前后是本月难得状态相对稳一点的日子，如果有非做不可的事情，优先安排在那附近。\n\n这个月做好一件事就够了，把手里最重要的那条线守住，其他能缓则缓。"

坏的写法：
"本月运势不佳，建议防守。layer1_score 为-17说明格局差，layer2 也低，整体比较糟糕。5月19日到23日是低谷期，要注意。"

问题：
- 语气负面但没有解释原因，用户会焦虑但不知道怎么应对
- 字段名直接外露`;
}

function buildMonthlyInterpretationPrompt(profile = {}, monthlyData = {}, dimensionInput = 'overall', contextNotes = {}) {
  const dimension = normalizeDimension(dimensionInput);
  const signals = monthlyData.shishen_signals || {};

  return `
你是一位精通《渊海子平》体系的现代命理解读师，擅长将传统命理术语转化为年轻人能理解的现实语言。你的任务是：根据下方提供的命理数据，为命主撰写本月【${dimension}】维度的运势解读文案。

---

## 命主基础信息
- 日主：${getDayMaster(profile)}
- 性别：${['M', '男', '乾造'].includes(profile.gender) ? '男' : ['F', '女', '坤造'].includes(profile.gender) ? '女' : '未提供'}
- 喜用神：${formatArray(profile.favorable_elements)}
- 忌仇神：${formatArray(profile.unfavorable_elements)}

---

## 流月干支与算分层信号
- 流月干支：${monthlyData.month_gz || ''}
- 流月范围：${monthlyData.flow_month_range_label || ''}
- 起始节气：${monthlyData.flow_month_start_jie || ''}
- 结束前界：${monthlyData.flow_month_next_jie || ''}
- 当前大运：${monthlyData.dayun_gz || ''}
- 当前流年：${monthlyData.liunian_gz || ''}
- 本月整体基调：${monthToneLabel(monthlyData.monthly_score)}
- 干支格局层：${levelLabel(monthlyData.layer1_score, 15, 5)}（流月与原局、大运、流年的合冲刑害、合化、制忌与冲喜用，权重最大）
- 日运节奏层：${levelLabel(monthlyData.layer2_score, 6, 3)}（关键事件日、连续低谷或高峰、节气交接与空亡三刑等月内波动）
- 月令神煞层：${levelLabel(monthlyData.layer3_score, 8, 3)}（月令、神煞、节气与岁运承接）
- 岁运承接：${transitLabel(monthlyData.transit_support_score)}（流月喜用、月令、神煞是否被大运流年扶起或冲破）

---

## 流月与原局/岁运的关键生克关系
- 月干十神（month_gan_shishen）：${monthlyData.month_gan_shishen || ''}
- 干支互动摘要（month_relations）：${monthlyData.month_relations || monthlyData.month_zhi_relations || '无明显刑冲合害'}
- 月令五行：${monthlyData.month_wuxing || ''}
- 月令与命主关系（month_wuxing_relation）：${monthlyData.month_wuxing_relation || '闲'}

解释口径：
- “制忌，转为小吉”表示流月克制命主忌神，可视为压力被化解。
- “冲喜用，加重”表示流月冲动命主有利力量，需谨慎表达为阻力或损耗。
- “冲忌仇，冲罚减半”表示冲到不利力量，但未形成有效克制，不能写成大吉。
- 岁运承接分为正，表示流月喜用或神煞被大运/流年扶起；为负，表示被冲破或忌神被扶。

---

## 流月神煞状态
- 天乙贵人：${!!signals.tianyi_active}
- 文昌贵人：${!!signals.wenchang_active}
- 禄神：${!!signals.lu_active}
- 驿马：${!!signals.yima_active}（是否朝喜用方向：${!!signals.yima_favorable}）
- 月德贵人（yuede_active）：${!!monthlyData.yuede_active}
- 本月空亡（is_kongwang）：${!!monthlyData.is_kongwang}
- 本月三刑（has_sanxing）：${!!monthlyData.has_sanxing}

---

## 本月日运分布
- 月内日运：${dailyAverageLabel(monthlyData.avg_daily_score)}
- 状态较好的日子（高分日）：${monthlyData.high_score_days || 0}天，具体日期：${JSON.stringify(monthlyData.high_score_dates || [])}
- 状态偏弱的日子：${monthlyData.low_score_days || 0}天，具体日期：${JSON.stringify(monthlyData.low_score_dates || [])}
- 本月最佳日：${monthlyData.best_date || ''}
- 本月最差日：${monthlyData.worst_date || ''}
- 连续低谷期（trough_period）：${monthlyData.trough_period || ''}
- 本月节气（jieqi_list）：${JSON.stringify(monthlyData.jieqi_list || [])}

---

## 当前解读维度：${dimension}（${DIMENSION_LABELS[dimension]}）

${buildContextPromptBlock(
  dimension,
  contextNotes.profile_context,
  contextNotes.current_monthly_context,
  contextNotes.recent_monthly_contexts
)}

---

## 强制推演规则

### 一、文案基调必须锚定“本月整体基调”
- 谨慎蛰伏：以守为主。禁止出现“大机会”“突破”“大吉”“顺风”等强乐观词；如提及高分日，只能表达为“相对可操作窗口”。
- 平稳蓄力：攻守各半。不得全程正向，必须有一处注意事项。
- 积极进取：有所作为。需点出至少一处注意事项。
- 高光时刻：乘势而为。禁止“百分百”“一定成功”等绝对化表达。

特殊兜底规则，优先级最高：
- 本月空亡：details 中必须用自己的话写出“本月容易虚耗、行事宜稳扎稳打、不宜过度扩张”这层意思，不要套固定句子。
- 本月三刑：details 中必须用自己的话写出“人际关系较敏感、合作与沟通要格外审慎”这层意思，不要套固定句子。

### 二、分层信号解释规则
- 干支格局层明显偏强：格局上有明显加持，流月结构较有力；明显偏弱：格局上有明显阻力，需要应对刑冲压力。
- 日运节奏层偏强：月内日运节奏较顺，可持续推进；偏弱：月内低谷或波动较明显，需要节奏管理。
- 月令神煞层偏强：月令、神煞或岁运承接有力；偏弱：承接不足，容易虚耗或分心。
- 岁运承接为扶起：行动更容易落地；为冲破：吉象需要打折表达。

### 三、十神白话化翻译
允许你内部依据 month_gan_shishen 推理，但输出正文 details、highlight、advice 中禁止直接出现“正官、七杀、正印、偏印、食神、伤官、正财、偏财、比肩、劫财”等原始十神术语，必须转译成人话。
${DIMENSION_SHISHEN_COPY[dimension]}

### 四、判断依据融入规则
- 你不能只给结论，必须把“为什么这样判断”自然写进 details。
- details 至少出现 2 处明确依据句，优先使用这类表达：“这主要来自于……”“一方面……另一方面……”“之所以这样看，是因为……”。
- 依据必须来自上面提供的信号，例如干支互动、月令与命主的关系、岁运承接、月德等神煞、空亡、三刑、高分日、低谷期、节气。
- 正文里不要出现任何分数（包括整月评分、分层得分、日运分数），也不要出现字段名或“格局层”“神煞层”这类分层名称；分数在页面上另有展示。
- 依据要说人话，不要堆砌术语；但可以保留少量必要命理词，例如“月令”“六冲”“空亡”“三刑”，且出现后要紧跟现实解释。
- 如果是偏负面判断，必须交代主要压力源；如果是偏正面判断，必须交代主要助力源。

### 五、few-shot 风格示例
以下示例按维度分组，每次只参考当前维度对应的写法。核心原则：评判依据必须以“因为……所以……”或“之所以这样说，是因为……”的逻辑自然融入正文，禁止直接出现字段名或数字得分。
${getDimensionFewShot(dimension)}

### 六、当前维度核心推演逻辑
${getDimensionRules(dimension)}

### 七、日期信息落地规则
- 不要把本轮流月默认写成一个完整公历月；若跨月，优先写成“这一轮流月”“从X月X日到X月X日这段时间”。
- 高分日非空：必须在 details 或 advice 中至少提及一次，格式为“X月X日前后……”。
- trough_period 非空：必须在 details 中点出，格式为“X日至X日……”。
- jieqi_list 非空：可作为运势转折点提示，格式为“X节气前后……”。
- 不得凭空捏造日期，所有日期引用必须来自上游数据字段。

---

## 输出格式
只输出合法 JSON，禁止任何 markdown 包裹。
{
  "dimension": "${dimension}",
  "title": "15字以内，有代入感的维度标题",
  "highlight": "20字以内核心金句，点出本月该维度最重要的一件事",
  "details": "200-400字正文。禁止 Markdown 语法。段落间用 \\n\\n 分隔。结构：①本月该维度整体定调 ②关键信号白话解读 ③高分日或低谷期具体提示 ④收尾行动号召",
  "tags": ["不超过3个关键词标签"],
  "advice": [
    {
      "action": "5字以内行动短语",
      "description": "30-50字执行细节，必须包含具体时间或场景"
    }
  ]
}
advice 固定返回 2-3 条。score 字段和 version 字段不需要你生成，由算分引擎与服务端提供。`;
}

function parseModelJson(content) {
  const raw = String(content || '').replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(raw);
}

function pickMonthlyInterpretationFields(data = {}) {
  return {
    dimension: normalizeDimension(data.dimension || 'overall'),
    title: String(data.title || ''),
    highlight: String(data.highlight || ''),
    details: String(data.details || ''),
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 3) : [],
    advice: Array.isArray(data.advice) ? data.advice.slice(0, 3) : [],
    interpretation_version: MONTHLY_INTERPRETATION_PROMPT_VERSION,
    interpretation_status: 'ready',
  };
}

function mergeMonthlyInterpretation(baseData = {}, interpretationData = {}, dimensionInput = 'overall') {
  const dimension = normalizeDimension(dimensionInput);
  return {
    ...baseData,
    ...pickMonthlyInterpretationFields({ ...interpretationData, dimension }),
    monthly_score: baseData.monthly_score,
    layer1_score: baseData.layer1_score,
    layer2_score: baseData.layer2_score,
    layer3_score: baseData.layer3_score,
    transit_support_score: baseData.transit_support_score,
    month_gz: baseData.month_gz,
    dayun_gz: baseData.dayun_gz,
    liunian_gz: baseData.liunian_gz,
    period_key: baseData.period_key,
  };
}

function hasReadyMonthlyInterpretation(data = {}) {
  return Boolean(data?.title && data?.highlight && data?.details && Array.isArray(data?.advice));
}

function buildMonthlyInterpretationPeriodKey(monthKey, profileId, dimensionInput, contextSeed = 'ctx:none') {
  const dimension = normalizeDimension(dimensionInput);
  return profileId
    ? `${monthKey}::${MONTHLY_INTERPRETATION_PROMPT_VERSION}::${dimension}::${contextSeed}::${profileId}`
    : `${monthKey}::${MONTHLY_INTERPRETATION_PROMPT_VERSION}::${dimension}::${contextSeed}`;
}

module.exports = {
  MONTHLY_INTERPRETATION_PROMPT_VERSION,
  normalizeDimension,
  buildMonthlyInterpretationPrompt,
  buildMonthlyInterpretationPeriodKey,
  parseModelJson,
  pickMonthlyInterpretationFields,
  mergeMonthlyInterpretation,
  hasReadyMonthlyInterpretation,
};
