# 双人合盘重设计 Spec

> 状态：设计稿（2026-11-16），尚未实现。§12 的三项已由 Justin 拍板（同日），实施任务分解见 §13。理论依据见 [`compatibility-theory.md`](./compatibility-theory.md)，下文称「理论文档」。
> 涉及现有代码：`public/wrapped.html`（朋友合盘页面与评分）、`worker/src/index.js` 的 `handleCompatibilityInit`、`docs/sql/compatibility-sessions-migration.sql`、`src/views/ReportView.vue`（入口卡片）、`src/wrappedCompatibility.test.mjs`。

## 1. 目标与边界

**目标**

1. 用理论文档的五层模型替换现有的评分逻辑，让每个分数都能追溯到具体的干支证据和依据等级。
2. 把合盘计算从页面内联脚本移到 `lib/` 下的可测试模块，由 Worker 调用。
3. 在不改动线上「朋友合盘」交互的前提下，增加婚恋合盘这一报告类型。
4. 为后续的 LLM 解读、岁运同步、紫微与星盘侧验留好接口。

**不变的东西**

- 朋友合盘的全部现有功能保留：落地页、两步填写向导、五个维度的逐页演示（扫描、分析、计分）、悬念页、总分与称号、分享图。五个维度的名称和顺序不变。
- 不增加交互步骤。婚恋合盘通过报告页的新入口卡片进入，关系类型由入口决定，向导步骤与朋友合盘相同。
- `/api/compatibility/init` 的现有返回字段（`ok`、`sessionId`、`A`、`B` 及其内部字段）全部保留，只新增字段。

**不做**

- 不做三人及以上的合盘、不做择日。
- 本期不做紫微与星盘侧验的实现，只定接口位置。
- 不改八字档案页、问事、运势的任何行为。

## 2. 现状问题清单

理论层面的问题见理论文档第 9 节，这里补充工程与数据层面的。

| # | 位置 | 问题 | 处理 |
|---|---|---|---|
| E1 | `worker/src/index.js` L2847 | 时辰不详时按 12:00 排盘，`five_shens` 与 `wuxing_ratio` 混入虚构的午时柱 | §7 时辰不详的处理 |
| E2 | 同上 L2850–2855 | 真太阳时修正只调整小时并对 24 取模，不回退或前进日期。子时（取 0:00）遇到负修正时，时间变成当天 23 点多而不是前一天 23 点多 | 改用带日期进位的时间运算；与档案页共用 `lib/birthInput.cjs` 的口径 |
| E3 | `docs/sql/compatibility-sessions-migration.sql` | 匿名角色的查询策略是 `using (true)`，名为「select own」实则任何持匿名密钥的人都能读出全表的姓名、生日、出生地。Worker 用服务端密钥写库，本来就不需要匿名策略 | 已处理：脚本里的两条匿名策略已删除（2026-11-16）。核查线上库发现这张表从未建过，所以没有数据暴露，也无需执行任何线上变更 |
| E7 | `worker/src/index.js` L2896–2922 | 线上库没有 `compatibility_sessions` 表，写库每次都失败并被 `catch` 吞掉，接口返回的 `sessionId` 恒为 `null`。合盘会话目前实际上没有被保存 | P1 建表（§8），建表前合盘功能照常可用 |
| E4 | `public/wrapped.html` L1971 `computeScores`、L1921 `computeMockBazi` | 基于随机数的旧评分函数与模拟排盘函数仍留在页面里，已没有任何调用 | 引擎迁移时删除 |
| E5 | `public/wrapped.html` 全部评分 | 评分在前端内联脚本里，唯一的测试是对 HTML 源码做正则匹配，无法验证数值行为 | §3 迁移到 `lib/` |
| E6 | 测试注释提到的「compatibility PRD」 | 仓库内找不到这份文档 | 以本文与理论文档为准 |

## 3. 架构

```
POST /api/compatibility/init
  └─ handleCompatibilityInit            worker/src/index.js（瘦身为参数校验与落库）
       └─ buildSynastryReport           lib/synastry/index.js
            ├─ normalizePair            lib/synastry/input.js      出生信息归一，时辰不详处理
            ├─ assessBaseline           lib/synastry/baseline.js   第 0 层 底色
            ├─ assessComplement         lib/synastry/complement.js 第 1 层 互济
            ├─ scanBonds                lib/synastry/bonds.js      第 2 层 勾连
            ├─ mapRoles                 lib/synastry/roles.js      第 3 层 角色
            ├─ assessTiming             lib/synastry/timing.js     第 4 层 同步（P3 期）
            ├─ collectAux               lib/synastry/aux.js        辅证层
            ├─ scoreFourQuestions       lib/synastry/score.js      四问
            └─ projectFriendDims        lib/synastry/friendDims.js 朋友合盘五维度的投影
```

**复用现有引擎，不重复造轮子**

| 需要的能力 | 现有模块 |
|---|---|
| 排盘、强弱、格局、喜忌五神、调候、五行占比 | `lib/baziCore.js` 的 `buildCompleteBaziDetail` |
| 十神加宫位的原局主题评估 | `lib/baziStateAssessor.js` 的 `assessOriginalChartState` |
| 合、冲、刑、害、三合三会、拱合的判定 | `lib/baziRelationScanner.js`、`lib/constants/relations.js` |
| 关系强度的基础权重 | `lib/constants/relationStrength.js` |
| 神煞 | `lib/constants/shensha.js` |
| 调候 | `lib/constants/tiaohou.js`、`lib/calculateTiaohouRatio.js` |
| 大运流年评分 | `lib/calculateAnnualScore.js` |

跨盘扫描不改动 `baziRelationScanner`（它与单盘的宫位、旺衰逻辑耦合较深），`lib/synastry/bonds.js` 直接使用 `lib/constants/relations.js` 的关系表（`GAN_HES`、`ZHI_6HES`、`ZHI_HALF_3HES`、`ZHI_3HES`、`ZHI_HUIS`、`ZHI_CHONGS`、`XINGS`、`ZI_XINGS`、`ZHI_HAIS`）自行两两比对。相破（`ZHI_POS`）不用。

前端 `public/wrapped.html` 只保留展示：从接口返回里读分数和证据，渲染现有的各页。页面里的 `l1Score`、`l3Score`、`compScore`、`zhiRel` 等评分函数全部删除。

## 4. 数据结构

### 4.1 证据条目

所有层的产出都是同一种结构的证据条目。分数由证据汇总而来，文案由证据生成，LLM 解读也只看证据。

```js
{
  id: 'bond.day_zhi.liuhe',        // 稳定标识，文案与测试都按它索引
  layer: 'bond',                   // baseline | complement | bond | role | timing | aux
  kind: 'liuhe',                   // 层内的类别
  dir: 'mutual',                   // 'A<-B'（A 受 B）| 'B<-A' | 'mutual'
  locus: { a: 'day.zhi', b: 'day.zhi' },   // 涉及的柱位
  chars: { a: '子', b: '丑' },             // 涉及的字，供页面高亮与用户核对
  tie: 2,                          // 牵系量，0 到 3；进入「缘」
  strain: 0,                       // 张力量，0 到 3；进入「和」
  benefit: { A: +1, B: 0 },        // 对各自的益损，−3 到 +3；进入「益」
  basis: 'book',                   // book | derived | tradition_unverified | folk
  confidence: 'high',              // high | mid | low
  needsHour: false,                // 是否依赖时柱
  seed: '日支子丑相合'              // 给文案与 LLM 的事实陈述，不含评价
}
```

`basis` 对应理论文档的四个依据等级。`folk`（民俗）条目的 `tie`、`strain`、`benefit` 恒为 0，只用于展示。`tradition_unverified` 条目的量值乘以 0.5，待原文核对后调整。

### 4.2 接口返回

```js
{
  ok: true,
  sessionId,
  A: { ...现有字段 },              // 不变
  B: { ...现有字段 },              // 不变
  report: {
    engineVersion: 'synastry/1',
    relationType: 'friend',        // friend | romance；请求里不传则为 friend
    hourKnown: { A: true, B: false },
    evidence: [ ... ],             // 证据条目
    fourQuestions: {
      tie:    { score: 0..100, grade: '深' | '中' | '浅' },
      ease:   { score: 0..100, grade: '顺' | '有磨合' | '多摩擦' },
      benefit:{ A: -100..100, B: -100..100, gradeA, gradeB },
      lasting:{ score: 0..100, grade, available: true }
    },
    structure: '相成' | '纠缠' | '偏济' | '淡益' | '平行',
    friendDims: { d1, d2, d3, d4, d5, total, tier, raw: {...} },   // 仅 friend
    confidence: 'high' | 'mid' | 'low',
    caveats: [ '乙方时辰不详，未使用时柱' ]
  }
}
```

请求体新增可选字段 `relationType`。旧版页面不传该字段时行为与今天一致。

## 5. 各层的计算规则

以下数值是初始值，全部集中在 `lib/synastry/weights.js`，并在 §10 的校准流程里调整。规则本身的依据见理论文档对应小节。

### 5.1 底色（理论文档 4.1）

对每个人调用 `assessOriginalChartState`，目标十神与宫位按关系类型取：

| 关系类型 | `targetShishens` | 宫位 |
|---|---|---|
| romance | 男：正财、偏财；女：正官、七杀 | 日支 |
| friend | 比肩、劫财 | 月柱 |

取其 `overall_stability` 作为该人的底色等级。性别缺失时 romance 只评估日支宫位，并在 `caveats` 里注明。

### 5.2 互济（理论文档 4.2）

对 A 受 B 这一方向（另一方向对称）：

1. **需求向量**：由 A 的 `five_shens` 得到五行的喜忌系数：用神 +1.5，喜神 +1.0，闲神 0，仇神 −1.0，忌神 −1.3。沿用现有 `SHEN_TIER`，这是现有实现里方向正确的部分。
2. **供给向量**：B 的 `wuxing_ratio`，并给 B 的日主五行额外加权（日主入用），初始为占比之外再加 0.15。
3. **喜用互济量** 为两个向量的内积，再乘以 A 的需求强度：A 的强弱越偏（极弱或极强），需求越强；中和的命局系数取 0.6。
4. **调候互济**：A 的 `tiaohou_detail.primary_gods` 中的天干，出现在 B 的天干或日柱时记一条证据；出现在月干或日干时量值更高。
5. **病药与伤用**：取 A 占比最高的忌神五行为病，B 盘中克它或泄它的五行占比超过阈值（初始 0.25）记为得药；B 的最旺五行克 A 的用神五行，且 A 的用神占比低于阈值（初始 0.12）记为伤用。
6. A 的 `special_patterns` 非空，或强弱判定处于临界时，本层该方向的证据 `confidence` 降为 `low`。

### 5.3 勾连（理论文档 4.3）

对 A 的四柱与 B 的四柱两两扫描，天干对天干，地支对地支。

**关系的基础量**

| 关系 | 牵系 | 张力 |
|---|---|---|
| 天干五合 | 2 | 0 |
| 天干相克，异性 | 0.5 | 0.5 |
| 天干相克，同性 | 0 | 1.5 |
| 天干相同 | 1 | 0 |
| 地支六合 | 2 | 0 |
| 地支半三合、拱合 | 1.2 | 0 |
| 两盘补全三合局或三会局 | 2.5 | 0 |
| 地支六冲 | 0.5 | 2.5 |
| 地支相刑 | 0 | 1.5 |
| 地支相害 | 0 | 1.2 |
| 地支相同 | 1 | 0（辰午酉亥另记自刑，张力 0.8） |
| 日柱天合地合 | 额外 +1.5 | 0 |
| 日柱天克地冲 | 0 | 额外 +1.5 |

同一对地支同时满足多种关系时全部记录，例如巳申既合又刑。

**位置系数**（两端柱位系数相乘后开方）

| 柱位 | romance | friend |
|---|---|---|
| 日柱 | 1.5 | 1.2 |
| 月柱 | 1.2 | 1.5 |
| 时柱 | 0.9 | 0.7 |
| 年柱 | 0.6 | 0.6 |

**顺逆判定**。对每条关系里 A 这一端的字，查它的五行在 A 的喜忌中的位置：

- 冲、克、刑、害落在忌神上，`benefit.A` 为正；落在用神或喜神上为负。
- 合住忌神为正；合住用神为轻微的负，牵系量不变。
- 补成的局，按所成五行对 A 的喜忌给正负。
- 冲 A 的日支时，romance 类型另加一条 `bond.spouse_palace.clash` 证据，只进「和」与「久」，不重复计入益损。

### 5.4 角色（理论文档 4.4）

- **日干原型**：由两个日干得到六种原型之一，写入 `role.archetype`。牵系量：相合 2.5，同道 1.5，启发与庇护 1.5，供养与受养 1.2，竞合 1.0，驾驭与受制 0.8。益损不在这里给，由互济层的日主入用决定。
- **星见、星透、宫合**：按理论文档 4.4 的表判定，各记一条证据。星见为 `derived`，星透与宫合为 `tradition_unverified`。
- 朋友类型不使用配偶星，改看对方日主是否为我的比劫、食伤、印，分别对应同道、玩伴、照应三种取象。

### 5.5 同步（理论文档 4.5，P3 期）

- 取两人未来十年的大运与流年，逐年调用 `calculateAnnualScore` 得到各自的喜忌走势，分类为同升、同降、一升一降。
- 逐年检查流年干支与各自日支的合冲、关系星透出，标出引动年；两人同年被引动的记为共振窗口。
- 输出为年份列表与定性标签，不折算进「缘」「和」「益」，只进「久」。
- 本层未实现时 `lasting.available` 为 `false`，「久」只由底色给出等级，页面相应位置显示为未开放而不是 0 分。

### 5.6 辅证

- 天乙贵人互见：沿用现有 `tianyiBranches` 的判定，`tradition_unverified`，牵系 0.8。
- 生肖与纳音：计算年支关系与年柱纳音生克，`folk`，只展示。

## 6. 汇总

### 6.1 四问

```
缘 = 归一化( Σ 证据.tie × 位置系数 × 依据系数 )
和 = 100 − 归一化( Σ 证据.strain × 位置系数 × 依据系数 )
益.A = 归一化( 互济量(A<-B) + Σ 证据.benefit.A ) × 相处密度
久 = f( 底色.A, 底色.B, 同步 )
```

相处密度系数：romance 1.0，friend 0.6。

归一化的分母不靠猜，由 §10 的随机配对分布确定：取大量随机配对的原始量，把第 50 百分位映射到 50 分，第 95 百分位映射到 90 分。这样各等级的人群占比是已知的，不会出现大多数人挤在同一档的情况。

结构类型按理论文档第 6 节的表判定：缘的「深」以 60 分为界；益的正负以 ±15 为界。表里没写的组合按以下归类（2026-11-17 实现时定，依据是随机配对分布）：缘深而双方都不得益记为纠缠；缘浅时至少一方得益且没有一方受损记为淡益，其余为平行。按此规则，一万对随机样本里五种结构的占比在 7% 到 35% 之间（`eval/synastry/distribution.json`）。

### 6.2 朋友合盘五维度的投影

五个维度的名称、顺序、每个维度由两个来源组成的页面结构都保留，来源改为取自证据：

| 维度 | 来源一 | 来源二 | 与现状的差别 |
|---|---|---|---|
| 同频 | 日干原型的牵系量 | 日柱与月柱之间的合、同 | 五合不再是 0 分；不再用固定的十神加减分 |
| 义气 | 互济量的正向部分，两个方向都展示 | 对方盘中我的印星是否为我所喜，加贵人互见 | 印星按喜忌计，不再一律加分 |
| 消耗（不大于 0） | 互济量的负向部分：增病、伤用 | 落在我喜用字上的冲、刑、害 | 不再把比劫七杀一律算作消耗 |
| 成长 | 调候互济与通关 | 日干原型中的相生关系，P3 期后加入大运同步 | 文案与计分一致 |
| 钱财 | 财星与比劫的关系：对方比劫旺而我以财为用则为夺财；对方食伤能生我财则为生财 | 日支与月支的合冲 | 文案不再说年支 |

总分仍为五个维度的加权和，权重沿用现有的 0.30、0.25、0.20、0.15、0.10，八档称号的文案保留。各档的分数线按 §10 的分布重新划定，让每一档都有合理的人群占比。

有向的结果在现有页面里的呈现：义气与消耗两个维度的分析页本来就分两块展示两个人的盘（`comp-block`），把「谁给谁」的方向写进这两块的小标题即可，不新增页面。

页面里的古籍引文逐条核对原文。核对不到出处的，改标为「释义」而不是带书名号的引文。

### 6.3 文案

文案方向已定（Justin，2026-11-16）：以「对盘」为核心词，短句、口语、抓耳，参照运动品牌广告语的写法。「对盘」在口语里就是合得来，字面上又是两张命盘相对，不需要再解释。现有的「充电 / 漏电」说法和「柠檬精」「敌蜜」「赛博急救包」一类网络梗全部替换。

写法约束：一句只说一件事；能用四个字说完的不用八个字；不用感叹号、不用表情符号、不用网络流行语；每屏新增的说明文字不超过两行。

**落地页**

| 位置 | 朋友合盘 | 婚恋合盘 |
|---|---|---|
| 标题 | 你们俩，对盘吗？ | 对的人，对得上。 |
| 副句 | 两个人的八字，摆在一起看。 | 同左 |
| 按钮 | 开始对盘 | 开始对盘 |

**五个维度的页头短问**：同频「聊得来吗」、义气「靠得住吗」、消耗「处着累吗」、成长「有长进吗」、钱财「谈钱伤吗」。

**八档称号**（由高到低，替换 `TIERS` 的 `label`，分数线见 T1.7）：天生对盘、很对盘、对得上、还算对盘、不咸不淡、有点拧、不太对盘、不对盘。

**各维度的五档徽标**（由高到低，替换 `DIM_BADGES` 的 `b`）

| 维度 | 一 | 二 | 三 | 四 | 五 |
|---|---|---|---|---|---|
| 同频 | 一拍即合 | 聊得来 | 能聊 | 时断时续 | 聊不到一块 |
| 义气 | 靠得住 | 帮得上 | 得开口 | 别指望 | 各顾各 |
| 消耗 | 不累 | 有点累 | 处久了累 | 很累 | 少见为好 |
| 成长 | 互相成就 | 有长进 | 各走各路 | 互相拖 | 别一起卷 |
| 钱财 | 账清 | 还好 | 小钱可以 | 少沾钱 | 别谈钱 |

徽标下的副句（`DIM_BADGES` 的 `s`）、各维度的结论正文（`DIM_VERDICTS`）、结果页的亮点与雷点（`R3A_COPY`、`R3B_COPY`）按同一写法重写：先给一句由证据生成的事实（哪两个字、什么关系），再给一句不超过十个字的断语。示例见设计稿：亮点「一拍即合。日干甲己相合，日支子丑也相合。话不用说完。」，无明显短板时「没有硬伤。不累人，不伤钱，不互拖。」

婚恋合盘沿用同样的短句写法，但不用戏谑口吻，并遵守理论文档第 8 节的禁区。

**四问的外显名称**（Justin，2026-11-16）：「缘、和、益、久」四个单字只是引擎内部的名称，**不外显**。婚恋合盘的章节名与结果页的行标题一律用短问：

| 内部 | 接口字段 | 外显 | 等级的外显写法 |
|---|---|---|---|
| 缘 | `tie` | 有缘吗 | 深、中、浅 |
| 和 | `ease` | 处得顺吗 | 顺、有磨合、多摩擦 |
| 益 | `benefit` | 谁成就谁 | 互相、偏向一方（写明谁成就谁）、互耗、各不相干 |
| 久 | `lasting` | 走得远吗 | 稳、看年份、多变；未开放时写「待开放」 |

朋友合盘不出现四问，外显的仍是五个维度。

### 6.4 置信度

报告整体的 `confidence` 取以下各项的最低值：两人时辰是否都已知；两人强弱判定是否远离临界；是否为特殊格局；主要证据中 `book` 与 `derived` 的占比。低置信时结果页显示一行说明，分数照常展示。

## 7. 时辰不详的处理

现状是按 12:00 排盘，用了一个假的时柱。改为：

1. 对时辰不详的一方，把十二个时辰各排一次盘，得到十二组强弱、喜忌、五行占比。
2. 强弱与用神五行在十二组里至少十组一致的，采用这个结论，`confidence` 记为 `mid`；否则该人的喜忌记为不定，互济层里以此人为受方的证据全部标 `low`，量值减半。
3. 五行占比取三柱的占比，不含时柱。
4. 勾连层与角色层只用年、月、日三柱；`needsHour` 为真的证据不生成。
5. `caveats` 里写明哪一方时辰不详、哪些层受影响。

这个做法不需要改动 `buildCompleteBaziDetail`，只是多调用十一次，计算量可以接受。

## 8. 存储

线上库（Supabase 项目 Qimen Engine）目前没有 `compatibility_sessions` 表。P1 先执行已修正的 `docs/sql/compatibility-sessions-migration.sql` 建表（RLS 开启、不建任何策略），再执行新增列：

```sql
alter table compatibility_sessions
  add column if not exists relation_type  text not null default 'friend',
  add column if not exists engine_version text,
  add column if not exists report         jsonb;
```

- `dim_scores` 与 `total_score` 两列保留，朋友合盘继续写入，改由后端在同一次请求里写，不再依赖前端回传。
- 表只能通过 Worker 的服务端密钥读写。前端代码里没有任何地方直接访问这张表（全仓库只有 `worker/src/index.js` 一处引用），所以不建匿名策略不影响任何功能。
- 新增列的脚本放在 `docs/sql/compatibility-synastry-migration.sql`。建表属于线上数据库变更，执行前向用户确认。

## 9. 婚恋合盘（新报告类型）

- **入口**：`src/views/ReportView.vue` 的报告列表里新增一张卡片「八字双人合盘 · 姻缘」，链接到 `/wrapped.html?type=romance`。现有的朋友合盘卡片不动。
- **向导**：与朋友合盘完全相同的两步，不新增字段。性别选项现有向导里已经有，但默认预选为男（`public/wrapped.html` L1425）。婚恋合盘里性别决定配偶星与大运顺逆，默认值会悄悄给出错误结果，所以这个入口下改为不预选，未选时不能进入下一步。朋友合盘不使用性别相关的结论，保持现状。
- **展示**：复用现有的逐页演示框架，章节为四问，外显用短问「有缘吗」「处得顺吗」「谁成就谁」「走得远吗」（见 §6.3），每章仍是「理论页、扫描页、分析页、计分页」的结构。**不给总分，也不给八档称号**（已拍板），结果页显示结构类型（相成、纠缠、偏济、淡益、平行）加四问的等级。接口返回里 romance 类型不含 `friendDims`，也不含任何合成的总分字段。
- **文案**：婚恋文案新写，口径遵守理论文档第 8 节的全部禁区。朋友合盘的戏谑语气不沿用到婚恋。

## 10. 测试与校准

**单元测试**（`lib/synastry/*.test.js`，`node --test`）

- 对称性：交换 A 与 B，`mutual` 证据不变，有向证据的方向互换，四问里「益」的两个值互换，其余不变。
- 五对天干五合的日干组合，日干原型都是「相合」，牵系量都大于同性相克的组合。
- 六冲、六合、三合、刑、害各取一组已知地支，断言扫描结果。
- 同一个七杀，对身强喜官杀的人 `benefit` 为正，对身弱忌官杀的人为负。
- 时辰不详：结果里不出现任何 `needsHour` 证据；十二时辰一致与不一致两种情形各一例。
- 真太阳时修正跨日：子时加负修正后日期回退。
- 接口兼容：返回里 `A`、`B` 的现有字段齐全。

**分布校准**

写一个脚本生成一万对随机出生时间，跑完整引擎，输出四问与五维度的分布。用它来确定归一化分母与各档分数线，并把分布摘要存进 `eval/synastry/`。以后改权重时重跑，对比分布漂移。

**人工评议**

没有带标注的合盘数据，引擎的效度无法用数据验证。建议由用户提供十对左右自己了解的关系（夫妻、朋友、合伙各若干），在不看分数的情况下先写下对这段关系的印象，再对照引擎给出的结构类型与主要证据。这是调整「对方如运」力度系数的唯一依据，也能发现文案上的问题。

**现有测试**

`src/wrappedCompatibility.test.mjs` 是对页面源码的正则断言。评分函数移走后其中多数断言会失效，改写为对 `lib/synastry` 的行为测试，页面测试只保留结构性的断言（五个维度的页面都在、出生地搜索的配置）。

## 11. 分期

| 期 | 内容 | 是否改变线上表现 |
|---|---|---|
| P0 | 修缺陷：时辰不详的假时柱（E1）、真太阳时跨日（E2）、文案与计分不符、引文核对；匿名策略（E3）经确认后执行 | 分数会有小幅变化 |
| P1 | `lib/synastry` 的底色、互济、勾连、角色、辅证五个模块与四问；朋友合盘五维度改由引擎投影；分布校准 | 朋友合盘的分数整体变化，页面结构不变 |
| P2 | 婚恋合盘入口与页面 | 新增一个报告 |
| P3 | 同步层：大运走势与引动年；朋友合盘的成长维度接入 | 「久」开放 |
| P4 | LLM 解读：把证据条目组织成解读包，由 DeepSeek 转写为连贯的文字。system 与 user 拆分、不把分数交给模型、输入加标签隔离，做法与 PR #47 及紫微解读设计（PR #48）一致 | 新增一段解读文字 |
| P5 | 紫微与星盘侧验 | 新增侧验区块 |

P0 可以单独发一个小 PR。P1 是主体。每一期开工前先确认。

## 12. 决定与待定

**已拍板（Justin，2026-11-16）**

1. 婚恋合盘**不给总分**，只给结构类型和四问的等级。朋友合盘的总分与称号照旧。
2. 匿名策略**删除**。迁移脚本已改；线上没有这张表，无需执行变更。
3. P0 暂不实施。本文先保证各期任务拆到可以独立完成的颗粒度（§13）。

**仍待定**（不阻塞 P0 与 P1 的开发，括号内为未答复时的默认做法）

4. 朋友合盘分数整体变化是否可以接受。（默认：接受，旧会话本来就没有落库，不存在新旧对照的问题）
5. 是否提供传统合婚文献。（默认：`tradition_unverified` 规则维持半权重）
6. 是否提供十对左右熟悉的关系做人工评议。（默认：先只做分布校准）
7. 婚恋合盘是否允许从八字档案里直接选人。（默认：不做）

## 13. 实施任务分解

每个任务都可以单独开发、单独验收。任务之间的依赖写在「前置」里。除特别说明外，新模块一律用 CommonJS（`module.exports`，文件扩展名 `.js`），与 `lib/` 现有模块一致，Worker 以默认导入的方式使用。

### 13.0 通用约定

- **测试入口**：`package.json` 的 `test` 脚本目前只匹配 `lib/*.test.js`，不会进入子目录。T1 需要在脚本里加上 `lib/synastry/*.test.js`。
- **运行**：`npm ci --ignore-scripts && npm test`。
- **命盘样本**：下表的样本用于各任务的验收，均按 10:00、男、不做真太阳时修正排盘（`Solar.fromYmdHms(y, m, d, 10, 0, 0)`）。数值由当前主干的引擎算出，引擎升级后若喜忌变化，以引擎为准更新样本。

| 代号 | 出生 | 四柱 | 强弱 | 用神 / 喜神 / 忌神 / 仇神 |
|---|---|---|---|---|
| S1 | 1992-02-18 | 壬申 壬寅 甲子 己巳 | 身强 | 食神 / 正财 / 正印 / 偏印 |
| S2 | 1992-01-14 | 辛未 辛丑 己丑 己巳 | 身弱 | 正印 / 正官 / 比肩 / 无 |
| S3 | 1992-02-24 | 壬申 壬寅 庚午 辛巳 | 身弱 | 食神 / 正财、偏财、偏印 / 七杀 / 正官 |
| S4 | 1992-01-19 | 辛未 辛丑 甲午 己巳 | 身弱 | 正财 / 偏财 / 劫财 / 比肩 |
| S5 | 1992-02-20 | 壬申 壬寅 丙寅 癸巳 | 身强 | 七杀 / 无 / 无 / 无 |
| S6 | 1992-02-05 | 壬申 壬寅 辛亥 癸巳 | 身弱 | 食神 / 伤官、正财 / 偏印 / 正印 |

- **引擎字段**：`buildCompleteBaziDetail` 返回值里本设计用到的字段及形态：
  - `pillars.ganzhi`：`{ year, month, day, time }`，每项是两个字的干支。
  - `matrix.pillars`：四个对象，`{ name: '年'|'月'|'日'|'时', gan, zhi, hidden_stems: [{ gan, shi_shen }], ... }`。`assessOriginalChartState` 需要它。
  - `strong_weak`：`'身强' | '身弱' | '中和'`；`strength_detail.total_score`：0 到 10；`strength_detail.band`：极弱、偏弱、偏强等。
  - `five_shens`：`{ yong: 十神名, yong_confidence: 'HIGH'|'LOW', xi: [], ji: [], chou: [], xian: [] }`，内容是十神全称。
  - `wuxing_ratio`：`{ 金, 木, 水, 火, 土 }`，百分数，合计 100。
  - `tiaohou_detail.primary_gods`：`[{ gan, wuxing, priority }]`。
  - `special_patterns`：数组，非空表示特殊格局。
- **十神到五行的换算**：以日干五行为基准，比劫为同行，食伤为我生，财为我克，官杀为克我，印为生我。页面里现有的 `shenWx` 就是这个逻辑，移到 `lib/synastry/elements.js`。
- **临界判定**：`five_shens.yong_confidence === 'LOW'`，或 `strength_detail.total_score` 落在 4.5 到 5.5 之间，视为强弱临界。

### 13.1 P0 修缺陷（暂缓，已拆好）

**T0.1 时辰不详不再使用假时柱**
- 文件：`worker/src/index.js` 的 `parsePerson`；新增 `lib/synastry/input.js`、`lib/synastry/input.test.js`。
- 接口：`normalizePerson(profile) → { hourKnown, charts }`。`hourKnown` 为真时 `charts` 只有一项；为假时是十二项（子到亥各取时辰中点排一次）。`resolveStable(charts) → { strongWeak, yongWuxing, stable, wuxingRatio3 }`，规则见 §7。
- 验收：`hour_index: -1` 时，返回的 `A.gans[3]` 与 `A.zhis[3]` 为空串（与现状一致），且 `A.five_shens`、`A.wuxing_ratio` 不再随「假设为午时」而定：对同一出生日期，把内部默认时辰从午改成任何其他时辰，输出不变。
- 前置：无。

**T0.2 真太阳时修正跨日**
- 文件：`lib/synastry/input.js`（同上）。
- 做法：用 `Solar.fromYmdHms(y, m, d, h, 0, 0).next(...)` 或等价的分钟级加减得到修正后的完整日期时间，不再对小时取模。
- 验收：出生日期 2000-01-02、子时（`hour_index: 0`）、`tst_correction_min: -90`，排盘用的时间是 2000-01-01 22:30，日柱为 1 月 1 日的日柱；`tst_correction_min: 0` 时仍是 1 月 2 日 00:00。
- 前置：无。

**T0.3 文案与计分对齐、引文核对**
- 文件：`public/wrapped.html` 的 `DIM_VERDICTS`（d4、d5 的正文）与五处 `th-src`、`th-quote`。
- 做法：d4 文案里的「月支相生」「成长宫位」改为与实际来源（五神互补、贵人）一致的说法；d5 文案里的「年支」改为日支。五处引文逐条核对原书，核对不到的把书名号出处改成「释义」，不保留引号。
- 验收：`src/wrappedCompatibility.test.mjs` 增加断言：`DIM_VERDICTS` 的 d5 段不含「年支」，d4 段不含「月支相生」。
- 前置：无。本任务在 P1 完成后会被新文案覆盖，若 P0 与 P1 连着做可以跳过。

### 13.2 P1 引擎与朋友合盘投影

**T1.1 骨架、常量与证据结构**
- 文件：`lib/synastry/index.js`、`weights.js`、`elements.js`、`evidence.js`、`index.test.js`；`package.json`（测试脚本）。
- 接口：
  - `buildSynastryReport({ A, B, relationType }) → report`，`A`、`B` 为 `normalizePerson` 的输出；`report` 形态见 §4.2。本任务里各层先返回空数组，四问返回占位。
  - `makeEvidence(fields) → evidence`，校验 §4.1 的字段与取值范围，非法时抛错。
  - `elements.js`：`ganWuxing(gan)`、`zhiWuxing(zhi)`、`shenToWuxing(dayGan, shenName)`、`tenGod(dayGan, otherGan)`、`needVector(detail) → { 金, 木, 水, 火, 土 }`（用神 +1.5、喜神 +1.0、闲神 0、仇神 −1.0、忌神 −1.3，同一五行取绝对值最大的那个）。
  - `weights.js`：§5 的全部数值，一个导出对象，不在其他文件里写魔法数字。
- 验收：`needVector(S1)` 中火（食神）为 +1.5、土（正财）为 +1.0、水（印）为 −1.3；`tenGod('甲','己') === '正财'`，`tenGod('己','甲') === '正官'`；`makeEvidence({ tie: 5 })` 抛错。
- 前置：T0.1（需要 `normalizePerson`；若 P0 未做，本任务一并实现它）。

**T1.2 勾连层**
- 文件：`lib/synastry/bonds.js`、`bonds.test.js`。
- 接口：`scanBonds(A, B, relationType) → evidence[]`。对四柱天干两两、地支两两比对，量值与位置系数取 §5.3；顺逆判定用 `needVector`。
- 细节：同一对地支命中多种关系时各出一条；补局只在两盘各出至少一支、合起来凑齐三合或三会三支时成立；日柱天合地合、天克地冲各出一条额外证据，`id` 为 `bond.day_pillar.double_he`、`bond.day_pillar.clash`。
- 验收：
  - S1 对 S2：日干甲己合、日支子丑合，且有 `bond.day_pillar.double_he`。
  - S1 对 S3：日干甲庚同性相克、日支子午冲，且有 `bond.day_pillar.clash`。
  - S5 对 S6：日干丙辛合、日支寅亥合。
  - S1 对 S4：日干相同、日支子午冲。
  - 交换 A 与 B，证据条数不变，`mutual` 证据的 `tie`、`strain` 不变，`benefit.A` 与 `benefit.B` 互换。
  - 任一方 `hourKnown` 为假时，结果里没有 `locus` 涉及 `time` 的证据。
- 前置：T1.1。

**T1.3 互济层**
- 文件：`lib/synastry/complement.js`、`complement.test.js`。
- 接口：`assessComplement(A, B, relationType) → evidence[]`，对两个方向各出：喜用互济一条（`complement.need_supply`）、日主入用至多一条（`complement.daymaster_as_yong`）、调候互济零到多条、得药或增病至多一条、伤用至多一条。规则与初始阈值见 §5.2。
- 验收：
  - 构造两个最小的假命盘对象（只含本层用到的字段）：受方用神为火，供方火占 50% 且日主为丙，则有 `complement.daymaster_as_yong`，`benefit` 为正；把受方用神改成水、忌神改成火，同一供方给出的 `complement.need_supply` 的 `benefit` 为负。这一条就是「同一股气，对喜它的人是益，对忌它的人是损」的测试。
  - 受方 `yong_confidence` 为 `LOW` 时，该方向全部证据 `confidence === 'low'`。
  - 时辰不详且 `stable` 为假的受方，量值减半。
- 前置：T1.1。

**T1.4 角色层与辅证层**
- 文件：`lib/synastry/roles.js`、`aux.js` 及各自的测试。
- 接口：`mapRoles(A, B, relationType) → evidence[]`；`collectAux(A, B) → evidence[]`。
- 细节：日干原型六选一，`id` 为 `role.archetype`，`kind` 取 `tongdao`（同道）、`jinghe`（竞合）、`gongyang`（供养与受养）、`qifa`（启发与庇护）、`jiayu`（驾驭与受制）、`xianghe`（相合）；相生与相克的原型在 `seed` 里写明谁生谁、谁克谁。星见、星透、宫合只在 `romance` 下生成，性别缺失时不生成并加一条 `caveats`。天乙贵人用 `lib/constants/shensha.js` 里 `天乙` 的映射（与页面现有的 `tianyiBranches` 等价）。生肖与纳音为 `folk`，量值全为 0。
- 验收：五对天干五合（甲己、乙庚、丙辛、丁壬、戊癸）的日干组合全部得到 `xianghe`，且 `tie` 高于任何一种同性相克的组合；S1 对 S4 为 `tongdao`；`friend` 类型下没有任何 `role.spouse_*` 证据。
- 前置：T1.1。

**T1.5 底色层**
- 文件：`lib/synastry/baseline.js`、`baseline.test.js`。
- 接口：`assessBaseline(person, relationType) → { stability, evidence[] }`，内部调用 `assessOriginalChartState({ matrix, targetSpec, dayStem, gender, favorableWuxing, unfavorableWuxing, geju })`，`targetSpec` 为 `{ primary_shishen, primary_gongwei, extra_static_checks: [] }`，取值见 §5.1。`primary_gongwei` 是字符串数组，写作 `['日支']` 或 `['月柱']`（内部去掉「支」「柱」后按柱名匹配）；`favorableWuxing`、`unfavorableWuxing` 是五行的 `Set`，由 `needVector` 的正负项得到。返回值的 `overall_stability` 取 `strong`、`stable`、`dynamic`、`buried`、`damaged` 之一。已用 S1 实测过这一调用方式可行。
- 验收：对 S1 到 S6 调用不抛错，`stability` 取值为上述五个之一；时辰不详的人用十二组里出现次数最多的等级，并标 `confidence: 'mid'`。
- 前置：T1.1。

**T1.6 四问与结构类型**
- 文件：`lib/synastry/score.js`、`score.test.js`；`scripts/synastry_calibrate.cjs`；`eval/synastry/distribution.json`。
- 接口：`scoreFourQuestions(evidence, baselines, relationType, norms) → fourQuestions`；`classifyStructure(fourQuestions) → structure`。`norms` 是校准脚本产出的各原始量的第 50、第 95 百分位，存放在 `lib/synastry/norms.json`。
- 校准脚本：用固定种子生成一万对 1950 到 2010 年间的随机出生时间（两成设为时辰不详），跑 T1.2 到 T1.5，输出各原始量的分位数与五种结构类型的占比。
- 验收：校准后的随机样本里，「缘」的中位数在 48 到 52 之间，五种结构类型里没有哪一种的占比低于 5% 或高于 45%；S1 对 S2 的「缘」高于 S1 对 S5；交换 A 与 B，`tie`、`ease`、`lasting` 不变，`benefit.A` 与 `benefit.B` 互换。
- 前置：T1.2 到 T1.5。

**T1.7 朋友合盘五维度投影**
- 文件：`lib/synastry/friendDims.js`、`friendDims.test.js`。
- 接口：`projectFriendDims(report) → { d1, d2, d3, d4, d5, total, tier, raw }`。`raw` 保持现有形态 `{ d1: { s1, s3 }, ... }`，页面的计分页直接可用。来源映射见 §6.2；总分权重与八档称号文案从页面原样搬来，分数线用校准分布重划，使八档的占比依次大约为 5%、12%、20%、18%、18%、14%、9%、4%。
- 验收：`d3` 恒不大于 0；所有维度在 −100 到 100 之间；一万对随机样本的称号占比与目标占比的偏差不超过 3 个百分点。
- 前置：T1.6。

**T1.8 接口接入**
- 文件：`worker/src/index.js` 的 `handleCompatibilityInit`；`src/workerCompatibility.test.mjs`（参照现有的 `src/workerBaziAudit.test.mjs` 写法）；`docs/sql/compatibility-synastry-migration.sql`。
- 做法：`parsePerson` 改为调用 `normalizePerson`；返回里保留 `A`、`B` 的全部现有字段，新增 `report`；落库时一并写 `relation_type`、`engine_version`、`report`、`dim_scores`、`total_score`，落库失败仍不影响返回。
- 验收：不带 `relationType` 的请求返回 `report.relationType === 'friend'` 且含 `friendDims`；`relationType: 'romance'` 的返回不含 `friendDims`，也没有任何名为 `total` 的字段；现有页面在不改动的情况下仍能跑通（它只读 `A`、`B`）。
- 前置：T1.7。

**T1.9 页面改读接口**
- 文件：`public/wrapped.html`；`src/wrappedCompatibility.test.mjs`。
- 做法：删除 `computeScores`、`computeMockBazi`、`l1Score`、`l3*`、`l4*`、`l5NobleScore`、`dayZhiMoneyScore`、`compScore`、`zhiRel`、`computeRealDIMs` 及只被它们使用的常量；`S.dims`、`S.dimRaw`、`S.total`、`S.tier` 改为从 `data.report.friendDims` 取。各维度的分析页与扫描页改为按证据渲染：高亮哪些字由证据的 `locus` 与 `chars` 决定，小标题写明方向。`DIM_ANALYSIS_CONFIG`、`DIM_VERDICTS` 的文案按 §6.2 的新来源重写。
- 验收：页面里不再有任何计算分数的函数；用 Playwright 走一遍 S1 对 S2 的完整流程，五个维度页、悬念页、结果页、分享图都能出现，控制台无报错；深浅两套配色下各截一张结果页。
- 前置：T1.8。样式以设计稿为准（https://claude.ai/artifact/EjWQrGZZTxHmrJoze7FEY7 ，深浅两套主题；设计稿未画的向导、扫描页、计分页、悬念页、分享图沿用现有结构并套用同一套 token），文案以 §6.3 为准。

### 13.3 P2 婚恋合盘

**T2.1 入口与类型透传**
- 文件：`src/views/ReportView.vue`（新增卡片，文案走 `src/i18n`）；`public/wrapped.html`（读取 `?type=romance`，请求体带 `relationType`，性别不预选）。
- 验收：从新卡片进入，落地页标题为姻缘版；未选性别时「下一步」不可点；朋友入口的行为与改动前逐像素一致。
- 前置：T1.9。

**T2.2 四问章节与结果页**
- 文件：`public/wrapped.html`（或拆出 `public/wrapped-romance.js`，由体量决定）。
- 做法：章节为四问四章，章节名与结果页行标题用 §6.3 的短问，页面上不出现「缘、和、益、久」单字；每章沿用「理论页、扫描页、分析页、计分页」；计分页显示等级而不是数字；结果页显示结构类型、四问等级、两到三条最重要的证据、`caveats`，以及理论文档第 8 节的说明文字。`lasting.available` 为假时，「走得远吗」一章只展示底色，注明岁运部分尚未开放。
- 验收：页面上任何位置都不出现合成的总分或称号；文案全文检索不含「克夫」「克妻」「旺夫」「注定」「必」；分享图同样不含总分。
- 前置：T2.1。

### 13.4 P3 到 P5（开工前再细化）

- **P3 同步层**：`lib/synastry/timing.js`，`assessTiming(A, B, { fromYear, years }) → { trend: [{ year, a, b, label }], triggers: [{ year, who, kind }], resonance: [year] }`。逐年调用 `calculateAnnualScore`（入参见该文件 L700 起的注释），大运取自 `matrix.dayun_list`。验收用书中三例的结构：流年支与日支成六合或六冲的年份必须出现在 `triggers` 里。
- **P4 LLM 解读**：解读包由证据的 `seed` 与等级组成，不含分数。细化时参照紫微解读设计的 §7。
- **P5 侧验**：等紫微飞入对方命盘的书证补齐后再设计。
