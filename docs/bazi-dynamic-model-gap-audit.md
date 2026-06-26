# 八字动态模型现状审计与缺失项

> 审计日期：2026-06-19  
> 审计范围：项目现有八字原局、目标星宫、大运流年与应期扫描链路  
> 理论参照：陆致极《八字命理动态分析教程》《八字命理学进阶教程》，辅以项目 NotebookLM 中的《滴天髓》《三命通会》等资料  
> 本文只做现状审计与缺失识别，不包含实现方案。

## 1. 结论摘要

项目已经具备题设向量的大部分底层能力：

\[
B=[强弱,\ 调候,\ 流通,\ 格局完整度,\ 五行分布,\ 星宫状态]
\]

但当前的准确描述应是：

> 六个要素均有实现或数据来源，但主要以静态结果、局部评分或目标星宫报告的形式分散存在；尚未形成一个在每个大运、流年节点重新求值的统一动态状态 \(B_t\)。

现有系统最成熟的部分是：

- 原局强弱与五行分布；
- 月令格局、成格判断与特殊形象；
- 目标十神和目标宫位的星宫同参；
- 刑冲合害、墓库、伏吟、反吟、透干、填实三合/三刑；
- 大运建场、流年触发以及逐年候选排序。

对照陆致极动态分析体系，明确缺失或只部分实现的主干要素是：

1. 四柱运限与大运、流年的时间并轨；
2. 广义“应局”——单个天干或地支重现，而不仅是整柱伏吟；
3. “原身与禄”的跨干支引动；
4. 岁运介入后对全局强弱、调候、五行分布、流通、格局和形象的统一重算；
5. 跨年份状态的持续、进入与退出；
6. 多领域并行状态输出，以及激活强度与吉凶方向的彻底分离；
7. 动态结论自身的统一置信度与历史事件校准闭环。

因此，项目不是“缺少八字建模”，而是：

> 已完成静态底盘和局部动态触发器，但尚未完成统一的动态状态转移模型。

---

## 2. 审计对象与现有调用链

### 2.1 主要模块

| 模块 | 当前职责 |
|---|---|
| `lib/BaziRuleEngine.js` | 日主强弱、五行分布、调候、病药、通关、扶抑、喜用忌神 |
| `lib/baziCore.js` | 月令取格、成格/败格、格局输出、特殊结构整合 |
| `lib/baziImageAssessor.js` | 从格、专旺、化气、两气成象及匹配度 |
| `lib/baziTargetElement.js` | 按事业、财富、婚姻、学业等问题解析目标十神与宫位 |
| `lib/baziRelationScanner.js` | 原局及岁运的刑冲合害、三合三会、墓库、盖头截脚等关系扫描 |
| `lib/baziStateAssessor.js` | 目标十神与目标宫位的原局状态评估 |
| `lib/baziDynamicAssessor.js` | 大运、流年对目标星宫的引动和状态变化判断 |
| `lib/baziQuestionCore.js` | 当前状态管线、逐年应期扫描、候选年份排序与报告组装 |
| `lib/calculateAnnualScore.js` 等 | 日、月、年运势评分与调候、喜忌、神煞修正 |

### 2.2 当前动态链路

```text
原局排盘
  -> 强弱 / 五行 / 调候 / 格局 / 形象 / 喜忌
  -> 按问题解析 TargetSpec
  -> 评估目标十神与目标宫位的原局状态
  -> 扫描大运与原局关系
  -> 扫描流年与原局、大运关系
  -> 选取最强机制，生成状态变化和事件类型
  -> 多年份重复运行，按机制强度排序候选年份
```

这条链路已经具备“静态解剖 → 动态激发”的基本骨架。

---

## 3. \(B\) 六维要素现状

### 3.1 审计矩阵

| 要素 | 当前状态 | 现有实现 | 审计结论 |
|---|---|---|---|
| 强弱 | 已实现 | `calculateStrength()` 输出得令、得地、得助、结构修正及 0–10 分 | 静态完整；岁运节点未统一重算 |
| 调候 | 部分完整 | 调候用神表、月令气候描述、喜忌评分和年/月运乘数 | 有调候判断，但不是统一的全局寒暖燥湿状态量；动态只做局部修正 |
| 流通 | 部分实现 | 通关评分、成格组合、食伤生财、杀印相生、形象内部流通等规则 | 能识别若干流通结构，但没有独立、统一、可随岁运重算的流通状态 |
| 格局完整度 | 已实现但分散 | 月令取格、成格/败格、特殊形象匹配度、喜用覆盖决策 | 静态能力强；普通格局和特殊形象没有统一动态完整度 |
| 五行分布 | 已实现 | `scores`、`ganScores`、`dominantElement`、`dominantRatio` | 静态完整；合化、三合三会形成后没有生成新的动态分布快照 |
| 星宫状态 | 已实现 | 目标十神、目标宫位分别评估，再合成为 `base_state` | 当前最接近陆致极体系；缺运限权重、原身禄引动与跨年状态持续 |

### 3.2 强弱

`BaziRuleEngine.calculateStrength()` 已经提供：

- 五行及十干分值；
- 得令、得地、得助；
- 日主是否有根；
- 主导五行和占比；
- 常规旺衰、疑似从格或专旺判断；
- 结构修正及 0–10 内部量表。

对应代码：`lib/BaziRuleEngine.js:527-725`。

缺口不在“有没有强弱”，而在于动态管线仍沿用原局强弱。`assessDynamicTriggers()` 接收原局矩阵与岁运干支，扫描关系和触发机制，但不会把大运、流年加入新盘后重新调用全局强弱模型。

结论：**静态完整，动态缺失。**

### 3.3 调候

项目已有两类调候能力：

1. 原局层：按日干、月支读取调候用神及忌用干，参与喜用神评分；
2. 年月运层：流年或流月天干命中第一调候用神时乘 `1.08`，命中次级用神乘 `1.04`，加剧偏枯乘 `0.93`。

对应代码：

- `lib/BaziRuleEngine.js:955-1030`；
- `lib/calculateTiaohouRatio.js:1-124`。

但陆致极教程中还存在“干支寒暖燥湿计分”的整体状态概念。当前实现更接近“调候用神命中表＋局部乘数”，未见以下统一结果：

- 原局八字寒暖燥湿总量；
- 加入大运后的气候状态；
- 再加入流年后的气候变化量；
- 合化导致五行改变后重新计算的调候状态。

结论：**取用逻辑已实现，动态气候状态量未形成。**

### 3.4 流通

项目能识别大量流通关系，例如：

- 病药与通关；
- 官印相生、杀印相生；
- 食伤生财、财生官；
- 特殊形象中的顺势、泄秀和去寡；
- 三合、三会、六合与合化。

但这些能力分散在喜用评分、成格规则、形象评估和关系扫描中。当前没有一个独立的“流通状态”回答：

- 气从哪里开始；
- 经哪些十神或五行传递；
- 在哪里堵塞、反克或被合住；
- 岁运加入后通路是接通、截断还是改道。

结论：**规则存在，统一状态缺失。**

### 3.5 格局完整度

项目对格局的静态识别较完整：

- 月令取格；
- 成格、败格、待定；
- 用神、相神及败格因素；
- 从格、专旺、化气和两气成象；
- 特殊形象 `match_score` 及覆盖常规格局的决策。

对应代码主要位于：

- `lib/baziCore.js` 的成格与 `buildPatternAnalysis()`；
- `lib/baziImageAssessor.js`。

现状问题是普通格局使用分类状态，特殊形象使用匹配分，两者没有统一的“结构完整度”语义。更重要的是，动态管线只对特殊形象产生 `image_luck_effect.score_delta`，没有对普通格局执行“成格 → 破格”或“败格 → 得救”的完整重判。

结论：**静态成熟，动态只覆盖特殊形象的一部分。**

### 3.6 五行分布

原局五行分布已有明确量化：

- 五行分数 `scores`；
- 十干分数 `ganScores`；
- 主导五行 `dominantElement`；
- 主导比例 `dominantRatio`。

对应代码：`lib/BaziRuleEngine.js:527-653`。

关系扫描也能判断三合、三会和六合化出的五行，见 `lib/baziRelationScanner.js:251-294`。但关系结果只以标签或机制存在，没有回写成新的动态五行分布。因此：

> 系统知道“形成了金局”，但没有统一产出“形成金局以后，木火土金水的有效分布变成什么”。

结论：**静态完整，动态分布缺失。**

### 3.7 星宫状态

这是当前最完整的一层。

`baziStateAssessor` 已实现：

- 定位目标十神的天干、地支主气和藏干位置；
- 计算十二长生、空亡、墓库、盖头截脚；
- 扫描目标十神所受关系；
- 独立评估目标宫位；
- 星宫得正、鸠占鹊巢；
- 综合为 `overall_stability` 和 `base_state`。

对应代码：`lib/baziStateAssessor.js:550-655`。

动态层又以宫位机制优先于星机制，并输出 `state_change`、`new_stability` 和 `event_type`。

不足主要不是星宫本身，而是：

- 没有把当前年龄对应的四柱运限并入权重；
- 没有原身与禄的跨干支引动；
- 多个领域需要分别运行，尚无同一岁运的并行领域状态向量；
- `new_stability` 没有传递到下一年。

结论：**局部模型完整，时间坐标和持续状态不足。**

---

## 4. 动态分析链路审计

| 陆致极动态环节 | 项目现状 | 完整度 |
|---|---|---|
| 原局四视角：强弱、调候、格局、形象 | 均有实现 | 高 |
| 星宫同参 | 十神和宫位独立评估，再综合 | 高 |
| 大运建场 | 有 `field_type` 和目标引动 | 中高 |
| 流年触发 | 有逐年扫描和触发机制 | 高 |
| 刑冲合会、开墓、填实 | 已实现主要机制 | 高 |
| 整柱伏吟、反吟 | 已实现 | 高 |
| 广义应局 | 只覆盖整柱伏吟及部分直接关系 | 低 |
| 原身与禄引动 | 未见实现 | 缺失 |
| 四柱运限并轨 | 未见实现 | 缺失 |
| 岁运后的全局重新解盘 | 仅局部关系和特殊形象增损 | 低 |
| 状态变化 | 单次节点有 `base → new` | 中 |
| 跨年状态持续 | 每年从同一原局 `base_state` 重新开始 | 缺失 |
| 多领域并行结果 | 目标路由存在，但单次只评估一个目标 | 中低 |
| 激活与吉凶分离 | 有部分区分，但候选排名仍偏重最强机制 | 中 |

---

## 5. 明确缺失项

### G1. 四柱运限没有进入动态模型

NotebookLM 对原著的核验结果：

- 《动态分析教程》第三章明确要求将四柱运限与大运、流年按时间序列并轨；
- 原著采用每柱约十六年的阶段：年柱 1–16、月柱 17–32、日柱 33–48、时柱 49–64；
- 原著强调要把当时大运与当前运限干支“挂起钩来”，以突出该阶段的人生重点。

项目虽有年龄、大运起止年龄和年份扫描，但未发现把当前年龄映射为运限柱、再影响动态机制优先级的逻辑。

影响：

- 相同的刑冲合会在不同年龄可能得到近似权重；
- 难以区分早年家庭、青年门户、中年自身/婚姻、晚年子女及归宿等生命坐标；
- 事件领域只能依靠 TargetSpec 宫位，无法得到运限的第二重时间定位。

状态：**明确缺失。**

### G2. “应局”被收窄为整柱伏吟

当前 `isFuyin()` 要求干支完全相同，见 `lib/baziDynamicAssessor.js:107-110`。

NotebookLM 核验显示，陆致极的“应局”范围更广：岁运进入时，要检查原局是否已有同一整柱、同一天干或同一地支。原著示例明确使用“有没有己巳，或己，或巳”的检查方式，单支重现也可构成应局。

当前系统可以通过关系扫描发现部分同支参与的刑冲合会，但“同字重现本身”没有作为独立机制统一输出；单干重现也未形成对应的应局标签。

影响：

- 对原局潜在信息的聚焦放大可能漏判；
- 同一干或支重现但没有额外刑冲合害时，系统可能判断为“未直接引动”；
- 广义应局和普通关系触发无法区分。

状态：**部分实现。**

### G3. 缺少“原身与禄”引动

NotebookLM 核验显示，陆致极在《动态分析教程》第八章明确把“引动”定义为：

> 通过原身和禄的关系，把岁运成分与原局相关成分联系起来。

其作用是跨越天干、地支层级：

- 岁运地支可以通过禄引动原局天干；
- 岁运天干可以通过原身引动原局地支。

当前项目具备：

- 流年天干本身是目标十神时的“透干引动”；
- 天干对天干、地支对地支的直接关系；
- 日干禄神用于日/月/年运辅助评分。

但未见“岁运支 ↔ 原局干”和“岁运干 ↔ 原局支”的通用跨层扫描。

影响：

- 表面没有直接刑冲合害的年份可能被漏掉；
- 原局天干在岁运地支得禄时不能被识别为降临；
- 原局地支对应原身透出时不能被识别为显化；
- 对拔根、六亲星出现及隐性应期存在假阴性。

状态：**明确缺失。**

### G4. 岁运介入后没有统一重算 \(B_t\)

当前动态评估主要执行：

```text
原局 base_state
  + 岁运与原局的关系扫描
  + 最强触发机制
  -> new_stability / event_type
```

没有形成：

\[
B_t=f(B_0,\ 大运_t,\ 流年_t,\ 合化与刑冲会局)
\]

具体表现为：

- 不重新计算日主强弱；
- 不生成新的五行有效分布；
- 不重新计算全局调候状态；
- 不重新评估普通格局成败；
- 不重新计算全局流通路径；
- 特殊形象仅有局部 `score_delta`，不是完整复算。

NotebookLM 中的原著案例显示，岁运三合、三会或合化可能改变全局五行性质，使原有用神失去功能，甚至导致格局或形象破局。因此，只看目标星宫会遗漏“全局变局先改变领域条件”的路径。

影响：

- 能识别“某宫被冲”，但不一定知道冲后全局谁旺谁败；
- 能识别“形成三合金局”，但不能把金局结果反馈给强弱、调候、格局和各领域；
- 同一个岁运节点的多个模块可能继续引用互不一致的静态结论。

状态：**核心缺失。**

### G5. 没有跨年份状态机

当前逐年扫描会为每个候选年调用 `assessDynamicTriggers()`，但每一次都从相同的原局 `stateReport.base_state` 出发，见 `lib/baziQuestionCore.js:1281-1334`。

因此系统可以表达：

- 某年由稳定变为动态；
- 某年由入墓变为开墓；
- 某年目标被合动或冲动。

但下一年不会继承上一年的 `new_stability`。例如，某年结婚后，下一年仍从原局的未婚静态结构重新推断，而不是从“已婚”状态继续。

NotebookLM 对原著婚姻案例的核验显示，陆致极的推演隐含清晰的状态延续：原局不稳 → 岁运合解而结婚 → 状态持续 → 后续刑冲再次打破而离婚。

影响：

- 无法区分进入条件、持续条件和退出条件；
- 婚姻、就业、学业阶段、财富积累等具有持续性的事件容易被逐年重复触发；
- “事件发生”与“事件状态仍在持续”混为一谈。

状态：**明确缺失。**

### G6. 多领域结果尚未在同一岁运节点并行计算

`baziTargetElement` 已经覆盖事业、财富、婚姻、学业等领域，说明领域映射本身存在。但管线按当前问题选择单一 TargetSpec，通常只运行一个领域。

陆致极命例允许同一岁运同时出现：

- 五行或用神层面对事业有利；
- 日柱或夫妻宫结构对婚姻不利。

当前系统需要分别提问、分别运行目标，才能看到这种并行结果，尚无统一的年度领域状态向量。

影响：

- 不适合直接生成“一生各领域曲线”；
- 容易用某一领域的结果代替综合状态；
- 无法原生表达“事业高、婚姻低、财富中性、波动很大”。

状态：**基础映射已实现，并行聚合缺失。**

### G7. 激活强度、方向、承载力仍有耦合

项目已经有较好的初步拆分：

- `effective_strength`：机制强度；
- `trigger_vigor`：命主承接状态；
- `is_activated`：是否引动；
- `auspice_direction`：方向；
- `new_stability`：状态结果。

但逐年候选排名主要由最强机制和“大运＋流年双重触发”决定，见 `lib/baziQuestionCore.js:546-607`。`rank_score` 没有系统纳入：

- 该领域最终方向是吉还是凶；
- 全局调候和格局是否被改善或破坏；
- 多个中等机制是同向叠加还是相互抵消；
- 当前运限柱是否命中；
- 事件是否只是活跃而非有利。

影响：

- 高激活年份容易排在前面，但“最容易发生事情”和“结果最好”仍可能混淆；
- 同样的 `rank_score` 可能对应大机会或大风险。

状态：**部分分离，未形成完整指标体系。**

### G8. 动态结论缺统一置信度与校准闭环

项目已有多种局部置信信息：

- 路由置信度；
- 用神置信度；
- 特殊形象匹配度；
- 候选年份 `quality`；
- 大运定位不精确时的文字降级；
- 基于命主历史事件的 LLM 校准流程。

但没有一个动态结论级置信度统一吸收：

- 出生时间和真太阳时可靠度；
- 大运起运及年份定位可靠度；
- 原局格局/从格判断分歧；
- 星与宫是否同时命中；
- 多种规则是否同向；
- 历史事件校准后的命中表现。

现有历史事件校准主要用于反推喜忌和修正文案，尚未见其对动态机制权重、年份排序或领域模型进行结构化更新。

状态：**局部存在，统一闭环缺失。**

---

## 6. 非缺失项：不应重复建设

以下能力已经存在，不宜在后续设计中重新造一套：

- 日主强弱、五行分布、得令得地得助；
- 月令格局、成格败格与特殊形象；
- 调候用神及调候优先修正；
- 用神、喜神、闲神、仇神、忌神分层；
- 目标十神和目标宫位解析；
- 星宫独立状态评估；
- 十二长生、空亡、墓库、盖头截脚；
- 六冲、三刑、六害、破、六合、三合、三会、暗合、拱合；
- 合化条件的初步验证；
- 伏吟、反吟、开墓、透干、填实三合和填实三刑；
- 当前状态分析和逐年应期扫描；
- 大运、流年的基本分工；
- 特殊形象的岁运增损。

后续真正需要的是把这些能力接入统一状态，而不是再增加一组平行评分器。

---

## 7. 缺失项优先级

| 优先级 | 缺失项 | 原因 |
|---|---|---|
| P0 | G1 四柱运限并轨 | 属于陆致极动态模型的时间坐标主干 |
| P0 | G2 广义应局 | 当前对原著定义覆盖不完整 |
| P0 | G3 原身与禄引动 | 属于陆致极明确提出的核心引动机制 |
| P0 | G4 动态全局重算 | 决定六维要素能否真正成为 \(B_t\) |
| P1 | G5 跨年状态机 | 决定“一生动态分析”是否有连续性 |
| P1 | G6 多领域并行状态 | 决定事业、学业、婚姻、财富能否同时比较 |
| P1 | G7 指标解耦 | 防止把高激活误写成高好运 |
| P2 | G8 统一置信度和校准闭环 | 决定模型能否回测和逐步修正 |

---

## 8. 最终判断

现有项目已经拥有大量可复用的命理计算零件，尤其是原局规则、星宫状态和岁运关系扫描，基础相当扎实。

真正缺失的不是再增加一个总分，而是建立下面这条统一主线：

```text
静态原局 B0
  -> 当前年龄对应运限柱
  -> 大运进入并形成全局状态 BU
  -> 流年通过应局 / 原身禄 / 刑冲合会触发
  -> 重新计算 Bt
  -> 分别投影到事业 / 学业 / 婚姻 / 财富
  -> 输出激活、方向、承载、波动和置信度
  -> 将事件后的状态传递给下一年
```

因此，对当前系统最准确的评价是：

> 已有静态命局模型、目标星宫模型和单节点触发模型；尚缺陆致极意义上的“运限并轨＋跨干支引动＋全局重算＋连续状态”四位一体动态模型。

---

## 9. NotebookLM 反查依据摘要

本次针对项目疑似缺口，使用 NotebookLM 对陆致极两本教程进行了定向反查，得到以下可核验结论：

1. 《动态分析教程》第三章明确提出把四柱运限与大运、流年按时间序列联系，使大运按时序走入原局；
2. 原著明确使用年柱 1–16、月柱 17–32、日柱 33–48、时柱 49–64 的阶段划分；
3. 第八章“应局”不仅检查整柱，也检查单独天干或地支是否在原局重现；
4. 第八章“引动”明确以原身与禄为跨干支互通机制；
5. 原著案例显示岁运会改变全局五行性质、用神功能及格局/形象状态，不能只做目标星宫局部加减；
6. 原著通过星宫同参允许同一岁运对不同人生领域产生相反结果；
7. 原著婚姻案例体现了跨年状态的进入、持续和退出，而不是每年无记忆地独立判断。

受扫描版 OCR 质量影响，NotebookLM 返回的个别短引文存在异体字或识别噪声；本文只采用多处内容能够互相支持的理论结论，不以 OCR 页码或单句作为唯一依据。

## 10. 研究边界

本文审计的是项目对传统命理理论的工程覆盖度，不代表相关命理规则已经获得现代科学意义上的因果验证。后续若进行量化或回测，应区分：

- 原著明确规则；
- 项目工程化权重；
- 待历史数据验证的假设。

---

# 第二部分：人生变化轴产品 PRD

> 产品形态：用户默认定位当前流年，并可沿人生变化轴横向拖动至任一年；系统同步展示该年的时空上下文、动态关系、领域落点、量化指标和可能事件。  
> 本 PRD 只定义产品数据与模块契约，不定义前端布局、视觉样式或具体交互组件。

## 11. 产品目标

### 11.1 核心目标

把现有“原局分析＋单年动态判断＋应期扫描”组织为一条可连续浏览的人生时间序列：

```text
选中年份
  -> 定位年龄 / 大运 / 流年 / 四柱运限
  -> 计算该时点动态命局状态 Bt
  -> 提取应局、引动、刑冲合会等动态关系
  -> 将关系投影到事业、学业、婚姻、财富等领域
  -> 生成领域状态分、激活度、波动度和置信度
  -> 给出最多三条可能事件及证据
```

### 11.2 用户需要回答的问题

用户拖动到任一年时，应能明确知道：

1. 当时处于什么年龄、大运、流年和四柱运限；
2. 大运、流年与原局发生了哪些关键关系；
3. 这些关系主要落到哪些人生领域；
4. 该领域相对原局、相邻年份处于上升、下降还是波动；
5. 哪些事情更可能在该年被触发，以及判断依据是什么。

### 11.3 非目标

- 不把命理指标包装为科学概率；
- 不用单一总分代替事业、学业、婚姻和财富的独立判断；
- 不把激活度高直接解释为好运；
- 不输出“必然发生”的事件断言；
- 本阶段不定义页面布局与视觉组件。

---

## 12. 总体数据架构

采用混合数据结构：固定原局只返回一次，全时间轴返回轻量点位，用户选中的年份返回完整快照。

```text
LifeAxisResponse
├── metadata
├── natal_context
├── range
├── life_axis[]
└── selected_year_snapshot
    ├── temporal_context
    ├── dynamic_state
    ├── dynamic_relations[]
    ├── domain_impacts[]
    ├── metrics
    └── possible_events[]
```

### 12.1 为什么采用混合结构

| 数据层 | 返回策略 | 原因 |
|---|---|---|
| `metadata` | 每个响应携带 | 用于解释版本、口径和可靠度 |
| `natal_context` | 首次加载或版本变化时返回 | 原局固定，无需随年份重复 |
| `life_axis[]` | 批量返回轻量年度点 | 支撑折线、拖动和年份标记 |
| `selected_year_snapshot` | 按选中年份返回完整数据 | 关系、证据和事件体量较大，按需加载 |

### 12.2 时间范围

数据层不硬编码人生轴长度，而是接收：

```typescript
interface LifeAxisRangeRequest {
  start_year: number;
  end_year: number;
  selected_year?: number; // 缺省为当前公历年
}
```

约束：

- `selected_year` 默认当前年；
- `start_year` 不得早于出生年；
- `end_year` 不得超出已排出的大运、流年范围；
- 超长范围允许分段加载；
- 返回结果必须声明实际计算范围，不能静默截断。

---

## 13. 顶层响应契约

```typescript
interface LifeAxisResponse {
  metadata: LifeAxisMetadata;
  natal_context?: NatalContext;
  range: {
    requested_start_year: number;
    requested_end_year: number;
    actual_start_year: number;
    actual_end_year: number;
    selected_year: number;
    truncated: boolean;
    limitations: string[];
  };
  life_axis: LifeAxisPoint[];
  selected_year_snapshot: YearSnapshot;
}
```

### 13.1 `metadata`

```typescript
interface LifeAxisMetadata {
  schema_version: string;
  engine_version: string;
  generated_at: string;
  timezone: string;
  calendar_convention: {
    year_boundary: '立春';
    month_boundary: '节气';
    zi_hour_convention: string;
    true_solar_time_applied: boolean;
  };
  score_definition: {
    min: 0;
    neutral: 50;
    max: 100;
    meaning: '领域状态/顺遂度，不是事件概率';
  };
  reliability: {
    birth_time: 'high' | 'medium' | 'low';
    dayun_timing: 'high' | 'medium' | 'low';
    chart_structure: 'high' | 'medium' | 'low';
  };
}
```

数据来源：

- 排盘口径来自现有出生信息和排盘参数；
- `engine_version`、缓存版本已有分散定义，需要统一透出；
- `birth_time` 需要根据出生时间精度、真太阳时和交界时段生成；
- `dayun_timing` 根据起运时间是否精确、是否由列表估算生成；
- `chart_structure` 根据格局、从格/形象和用神判断的一致程度生成。

现状：**部分存在，需要聚合。**

---

## 14. 固定原局模块：`natal_context`

该模块回答“命局先天底盘是什么”，只在原局版本变化时重新计算。

```typescript
interface NatalContext {
  profile_id: string;
  birth_year: number;
  day_stem: string;
  gender: 'male' | 'female' | 'unknown';
  pillars: NatalPillar[];
  natal_state: {
    strength: StrengthState;
    climate: ClimateState;
    circulation: CirculationState;
    pattern: PatternState;
    wuxing_distribution: Record<'木' | '火' | '土' | '金' | '水', number>;
    image: ImageState | null;
  };
  yongshen_profile: {
    yong: string[];
    xi: string[];
    xian: string[];
    chou: string[];
    ji: string[];
    favorable_wuxing: string[];
    unfavorable_wuxing: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  natal_domain_baselines: DomainBaseline[];
}
```

### 14.1 四柱字段

```typescript
interface NatalPillar {
  name: '年' | '月' | '日' | '时';
  gan: string;
  zhi: string;
  gan_shishen: string;
  zhi_main_shishen: string;
  hidden_stems: Array<{
    gan: string;
    shishen: string;
    weight: number;
  }>;
  twelve_phase: string;
  is_kong: boolean;
  nayin?: string;
}
```

### 14.2 原局六维状态

| 维度 | 必需数据 | 现有来源 | 当前缺口 |
|---|---|---|---|
| 强弱 | 得令、得地、得助、总分、强弱档位、根气 | `BaziRuleEngine.calculateStrength()` | 无统一公共 schema |
| 调候 | 寒暖、燥湿、急迫度、调候用神、当前满足度 | `tiaohou_detail`、调候表 | 缺全局寒暖燥湿量化状态 |
| 流通 | 起点、通路、阻塞点、通关神、完整度 | 通关、成格及形象规则 | 缺统一流通图和完整度 |
| 格局 | 基础格局、最终格局、成败、用相神、破格因素 | `pattern_analysis`、`chengge_detail` | 普通格局与形象分值口径未统一 |
| 五行分布 | 五行分数、比例、主导五行 | `strengthResult.scores` 等 | 无统一归一化输出 |
| 星宫状态 | 各领域的目标星、目标宫、基础稳定度 | `baziStateAssessor` | 需批量生成领域基线 |

共享状态对象定义：

```typescript
interface StrengthState {
  score: number;
  classification: '极弱' | '偏弱' | '中和' | '偏强' | '极强' | '从格' | '专旺';
  de_ling: number;
  de_di: number;
  de_zhu: number;
  has_root: boolean;
  dominant_element: string;
  dominant_ratio: number;
  evidence: string[];
}

interface ClimateState {
  thermal_score: number;       // 寒 ↔ 暖
  moisture_score: number;      // 燥 ↔ 湿
  balance_score: number;       // 0–100
  state: string;
  urgency: 'high' | 'medium' | 'low';
  required_gods: string[];
  harmful_gods: string[];
  evidence: string[];
}

interface CirculationState {
  score: number;               // 0–100，气机通达程度
  paths: Array<{
    nodes: string[];
    status: 'open' | 'blocked' | 'redirected' | 'broken';
  }>;
  bridge_elements: string[];
  blockers: string[];
  evidence: string[];
}

interface PatternState {
  base_pattern: string;
  final_pattern: string;
  status: 'formed' | 'pending' | 'broken' | 'transformed';
  integrity_score: number;
  yongshen: string[];
  assistant_gods: string[];
  breaking_factors: string[];
  rescue_factors: string[];
  evidence: string[];
}

interface ImageState {
  category: string;
  subtype: string;
  match_score: number;
  status: 'formed' | 'strengthened' | 'weakened' | 'broken';
  target_elements: string[];
  counter_elements: string[];
  evidence: string[];
}

interface BaziStateDelta {
  strength_delta: number;
  climate_delta: number;
  circulation_delta: number;
  pattern_integrity_delta: number;
  wuxing_deltas: Record<'木' | '火' | '土' | '金' | '水', number>;
  changed_features: string[];
}
```

这些数值均为内部工程指标。产品文案必须同时提供证据与定性结论，不能只暴露裸分。

### 14.3 领域基线

```typescript
interface DomainBaseline {
  domain: 'overall' | 'career' | 'study' | 'relationship' | 'wealth';
  target_shishen: string[];
  target_palaces: string[];
  base_capacity: number;   // 0–100，先天承载能力
  base_stability: number;  // 0–100，原局结构稳定性
  key_supports: string[];
  key_risks: string[];
  source_rule_ids: string[];
}
```

现状：目标映射和单目标状态评估已有；五个领域的基线尚未一次性批量输出。

---

## 15. 轻量人生轴：`life_axis[]`

人生轴只保存折线和拖动导航所需的数据，不携带完整关系证据。

```typescript
interface LifeAxisPoint {
  year: number;
  age: number;
  liunian: {
    gan: string;
    zhi: string;
    ganzhi: string;
  };
  dayun: {
    id: string;
    gan: string;
    zhi: string;
    ganzhi: string;
    start_year: number;
    end_year: number;
    start_age: number;
    end_age: number;
  };
  yunxian: {
    pillar: '年' | '月' | '日' | '时' | '延伸';
    age_range: string;
    weight_status: 'primary' | 'extended';
  };
  scores: {
    overall: number;
    career: number;
    study: number;
    relationship: number;
    wealth: number;
  };
  activation: number;  // 0–100，事情被触发的强度
  volatility: number;  // 0–100，状态变化幅度
  confidence: number;  // 0–100，模型证据一致度
  trend: {
    versus_previous_year: 'up' | 'flat' | 'down';
    score_delta: number;
  };
  event_markers: Array<{
    domain: string;
    polarity: 'opportunity' | 'risk' | 'mixed';
    level: 'high' | 'medium';
  }>;
  snapshot_available: boolean;
}
```

### 15.1 人生轴必须满足的数据语义

- 五个领域分值始终同时计算，前端下拉切换只改变读取哪一列；
- `overall` 不是四个领域的简单平均，应来自全局 \(B_t\) 与原局喜用、格局、调候的适配度；
- `activation` 只表示事件活跃程度；
- `volatility` 只表示变化幅度；
- 分数高低与事件发生概率必须分离；
- 同一年允许事业高、婚姻低；
- `confidence` 是证据质量，不是吉凶程度；
- `event_markers` 只提供时间轴标记，不承载完整事件文案。

### 15.2 现有数据可复用项

- 年份、年龄、流年干支、大运及起止年龄；
- 当前候选年份扫描；
- `effective_strength`、`trigger_vigor`；
- `quality`、`rank_score`；
- 目标事件类型。

### 15.3 当前缺口

- 四柱运限；
- 每年统一动态状态 \(B_t\)；
- 五个领域同时计算；
- 0–100 领域状态分的统一定义；
- 激活度和波动度独立聚合；
- 动态结论级置信度；
- 上一年状态继承。

---

## 16. 选年快照模块一：`temporal_context`

该模块回答“这一年处在什么时空结构里”。

```typescript
interface TemporalContext {
  selected_year: number;
  age: number;
  is_current_year: boolean;
  natal_pillars_ref: string;
  dayun: TransitPillar;
  liunian: TransitPillar;
  yunxian: {
    pillar: '年' | '月' | '日' | '时' | '延伸';
    start_age: number;
    end_age: number | null;
    natal_gan: string;
    natal_zhi: string;
    matched_topics: string[];
    relation_weight: number;
  };
  previous_state_ref?: string;
}

interface TransitPillar {
  gan: string;
  zhi: string;
  ganzhi: string;
  gan_shishen: string;
  hidden_stems: string[];
  twelve_phase: string;
  gaitou_jiejiao: 'same' | 'gaitou' | 'jiejiao' | 'neutral';
  start_year?: number;
  end_year?: number;
}
```

数据要求：

1. 四柱只引用 `natal_context.pillars`，避免重复；
2. 大运必须包含干支、十神、十二运、盖头截脚和起止年份；
3. 流年必须包含干支、十神、十二运和盖头截脚；
4. 运限必须标明当前对应原局哪一柱，以及该柱承担的阶段主题；
5. 65 岁以后如何延伸运限必须显式声明规则，不能默认为时柱无限延长而不标注。

现状：四柱、大运、流年已有；运限和状态引用缺失。

---

## 17. 选年快照模块二：`dynamic_state`

该模块回答“岁运进入后，全局状态变成什么”。

```typescript
interface DynamicState {
  natal_state_ref: string;
  dayun_state: DynamicBaziState;
  year_state: DynamicBaziState;
  state_delta: {
    from_natal: BaziStateDelta;
    from_previous_year: BaziStateDelta | null;
  };
}

interface DynamicBaziState {
  strength: StrengthState;
  climate: ClimateState;
  circulation: CirculationState;
  pattern: PatternState;
  wuxing_distribution: Record<'木' | '火' | '土' | '金' | '水', number>;
  image: ImageState | null;
  yongshen_effectiveness: Array<{
    shishen: string;
    wuxing: string;
    state: 'strengthened' | 'stable' | 'weakened' | 'transformed';
    delta: number;
  }>;
}
```

### 17.1 计算层次

必须区分两个动态快照：

1. `dayun_state`：原局＋大运，表示十年场域；
2. `year_state`：原局＋大运＋流年，表示当年最终状态。

不能直接把大运和流年同时加到原局后只算一次，否则无法解释“大运建场、流年触发”。

### 17.2 当前缺口

现有 `baziDynamicAssessor` 输出关系和目标状态变化，但不会重算上述六维状态。该模块是人生变化轴成立的核心新增数据层。

---

## 18. 选年快照模块三：`dynamic_relations[]`

该模块回答“这一年发生了哪些动态关系”。

```typescript
interface DynamicRelation {
  id: string;
  source_scope: 'dayun_to_natal' | 'liunian_to_natal' | 'liunian_to_dayun' | 'combined';
  mechanism:
    | '应局_整柱'
    | '应局_同干'
    | '应局_同支'
    | '原身引动'
    | '禄引动'
    | '透干引动'
    | '冲动'
    | '合动'
    | '合化'
    | '合而不化'
    | '三合'
    | '三会'
    | '填实三合'
    | '填实三刑'
    | '伏吟'
    | '反吟'
    | '开墓库'
    | '入墓'
    | '六害'
    | '破'
    | '暗合'
    | '拱合';
  source: RelationEndpoint;
  targets: RelationEndpoint[];
  transformed_element?: string;
  activation_strength: number;
  effective: boolean;
  direction: 'supportive' | 'harmful' | 'mixed' | 'neutral';
  target_change: {
    before: string;
    after: string;
  };
  affected_domains: Array<'career' | 'study' | 'relationship' | 'wealth' | 'overall'>;
  rule_id: string;
  evidence_text: string;
}

interface RelationEndpoint {
  layer: 'natal' | 'dayun' | 'liunian';
  pillar?: '年' | '月' | '日' | '时';
  position: 'gan' | 'zhi' | 'hidden';
  value: string;
  shishen?: string;
  palace?: string;
  wuxing?: string;
}
```

### 18.1 必须分离的概念

- `activation_strength`：关系有多强；
- `effective`：是否达到实际引动阈值；
- `direction`：对目标领域偏利、偏害还是混合；
- `affected_domains`：关系落在哪些领域；
- `target_change`：目标从什么状态变成什么状态。

### 18.2 现有来源

- `baziRelationScanner` 的关系对象；
- `baziDynamicAssessor` 的机制对象；
- `stateReport` 的星宫状态；
- `effective_strength`、`vigor_check` 和 `auspice_direction`。

### 18.3 当前缺口

- 广义应局；
- 原身与禄引动；
- 运限命中；
- 关系到领域的多对多映射；
- 统一 `rule_id`；
- 同一关系对不同领域产生不同方向时的表达。

---

## 19. 选年快照模块四：`domain_impacts[]`

该模块回答“关系最终落到哪些人生领域”。

```typescript
interface DomainImpact {
  domain: 'overall' | 'career' | 'study' | 'relationship' | 'wealth';
  targets: {
    shishen: string[];
    palaces: string[];
    structures: string[];
  };
  base_capacity: number;
  current_state_score: number;
  activation: number;
  volatility: number;
  direction: 'up' | 'flat' | 'down' | 'mixed';
  trend_delta: number;
  state: string;
  supporting_relation_ids: string[];
  blocking_relation_ids: string[];
  confidence: number;
}
```

### 19.1 领域目标数据

| 领域 | 主要十神 | 主要宫位/结构 | 动态重点 |
|---|---|---|---|
| 综合 | 用神、喜神、忌神 | 全局 \(B_t\)、格局、调候 | 整体适配、承载和风险，不等于四领域平均 |
| 事业 | 官杀、印、食伤 | 月柱、格局职业主轴 | 权责承载、官印、食伤发挥、事业宫引动 |
| 学业 | 印、食伤、官 | 年/月柱、官印结构 | 吸收、输出、评审认可、财坏印或枭夺食 |
| 婚姻 | 配偶星 | 日支夫妻宫 | 星宫同参、合解、冲动、入墓、争合争克 |
| 财富 | 财、食伤、比劫 | 月柱职业财源、全局任财能力 | 财源、任财、比劫夺财、食伤生财 |

### 19.2 领域状态分

`current_state_score` 的语义统一为：

```text
0–19   严重受阻
20–39  偏弱或风险较高
40–60  中性或条件混合
61–80  条件较有利
81–100 强适配，但仍需结合激活度判断是否发生事件
```

约束：

- 50 是中性，不代表“一半概率”；
- 分数代表当年该领域结构状态，不代表成就绝对高低；
- 原局容量低但当年改善明显，可以“分数中等、趋势向上”；
- 原局容量高但当年未触发，可以“分数较高、激活度较低”；
- 高激活且低分表示明显风险窗口；
- 高激活且高分表示明显机会窗口。

### 19.3 当前缺口

- 五领域同时运行；
- 统一状态分；
- 综合领域的独立算法；
- 多个关系的同向聚合、冲突仲裁；
- 运限、全局 \(B_t\) 对领域的修正。

---

## 20. 选年快照模块五：`metrics`

该模块提供选中年份的指标解释，以及折线图点位的详细拆解。

```typescript
interface YearMetrics {
  selected_dimension: 'overall' | 'career' | 'study' | 'relationship' | 'wealth';
  dimensions: Record<string, {
    state_score: number;
    base_capacity: number;
    activation: number;
    volatility: number;
    confidence: number;
    versus_natal: number;
    versus_previous_year: number | null;
    components: {
      global_fit: number;
      star_state: number;
      palace_state: number;
      pattern_integrity: number;
      climate_fit: number;
      circulation: number;
      trigger_direction: number;
    };
    reason_codes: string[];
  }>;
}
```

### 20.1 五类指标的严格区分

| 指标 | 含义 | 不能解释为 |
|---|---|---|
| `state_score` | 当年该领域的结构适配和顺遂程度 | 事件概率 |
| `base_capacity` | 原局对该领域机会和压力的承载上限 | 当年结果 |
| `activation` | 岁运是否强烈触发该领域 | 好坏 |
| `volatility` | 状态变化幅度 | 凶险程度 |
| `confidence` | 数据和规则证据的一致程度 | 命运确定性 |

### 20.2 折线图数据来源

折线图读取 `life_axis[].scores[dimension]`。选中年份后，详细指标读取 `selected_year_snapshot.metrics.dimensions[dimension]`。

两者必须由同一计算结果产生，禁止折线使用年运旧分、详情使用动态星宫新分，造成同年数值不一致。

### 20.3 当前缺口

现有年运、应期和星宫模型各自有分数或强度，但分数语义不同。不能直接拼接，需先建立统一指标语义和同源计算结果。

---

## 21. 选年快照模块六：`possible_events[]`

该模块回答“这一年更可能出现什么类型的事情”。每年最多输出三条。

```typescript
interface PossibleEvent {
  id: string;
  domain: 'career' | 'study' | 'relationship' | 'wealth' | 'overall';
  event_type: string;
  title: string;
  description: string;
  polarity: 'opportunity' | 'risk' | 'mixed';
  likelihood_level: 'high' | 'medium' | 'low';
  activation: number;
  confidence: number;
  timing: {
    year: number;
    phase: 'dayun_field' | 'liunian_trigger' | 'continued_state';
  };
  state_transition?: {
    from: string;
    to: string;
    transition_type: 'entry' | 'persistence' | 'exit' | 'change';
  };
  supporting_relation_ids: string[];
  blocking_relation_ids: string[];
  evidence_summary: string[];
  disclaimer: string;
}
```

### 21.1 事件生成约束

1. 事件必须先有领域落点，再生成事件名称；
2. 至少有一个有效动态关系才能输出 `high`；
3. 星、宫、运限同时命中时，置信度可以上调；
4. 只有大运建场而流年未触发时，应标为趋势或背景，不应输出明确事件；
5. 只有流年触发而大运不承载时，应降低可能性等级；
6. 支持证据和阻断证据必须同时保留；
7. 同类事件不可重复占据三条名额；
8. 健康、法律、重大财务风险不得使用确定性断言；
9. `likelihood_level` 是规则证据分级，不是统计概率；
10. 事件状态必须支持进入、持续与退出，避免逐年重复预测“结婚”或“升职”。

### 21.2 现有来源

- `target_trigger.event_type`；
- `state_change`、`new_stability`；
- 候选年份 `quality`；
- 大运与流年双重引动；
- 机制证据和阻断证据。

### 21.3 当前缺口

- 事件状态机；
- 一年多领域候选的统一排序；
- 去重和互斥规则；
- 支持/阻断证据的结构化归因；
- 事件级置信度；
- 连续状态和退出条件。

---

## 22. 选年快照完整结构

```typescript
interface YearSnapshot {
  snapshot_id: string;
  year: number;
  temporal_context: TemporalContext;
  dynamic_state: DynamicState;
  dynamic_relations: DynamicRelation[];
  domain_impacts: DomainImpact[];
  metrics: YearMetrics;
  possible_events: PossibleEvent[];
  limitations: string[];
}
```

数据一致性要求：

- `YearSnapshot.year` 必须等于 `temporal_context.selected_year`；
- `domain_impacts[].current_state_score` 必须与 `metrics.dimensions` 同领域分值一致；
- `life_axis` 对应年份的分值必须与快照一致；
- `possible_events[].supporting_relation_ids` 必须能在 `dynamic_relations[]` 中找到；
- `state_transition.from` 必须来自上一状态或原局基线；
- 所有输出必须携带引擎和 schema 版本，便于缓存失效与历史回放。

---

## 23. 数据加载与缓存要求

### 23.1 首次加载

首次加载需要：

1. `metadata`；
2. `natal_context`；
3. 请求范围内的 `life_axis[]`；
4. 当前年份的 `selected_year_snapshot`。

### 23.2 用户拖动年份

- 折线和年份标签直接读取本地 `life_axis[]`；
- 若目标年份快照已缓存，直接读取；
- 未缓存时只请求该年的 `YearSnapshot`；
- 相邻年份可低优先级预取，但不得阻塞当前年展示；
- 原局或引擎版本变化时，相关人生轴及快照缓存必须整体失效。

### 23.3 缓存键至少包含

```text
profile_id
+ chart_hash
+ start_year/end_year 或 selected_year
+ schema_version
+ engine_version
+ scoring_model_version
+ calendar_convention_hash
```

---

## 24. 数据降级与错误状态

| 场景 | 数据层行为 |
|---|---|
| 出生时间不精确 | 正常返回，但降低 `birth_time` 可靠度和相关事件置信度 |
| 大运年份只能估算 | 返回估算结果，在 `limitations` 标注并降低置信度 |
| 目标年份超出大运列表 | 返回明确范围错误，不静默使用当前大运 |
| 某领域无明确目标星 | 使用用神/全局结构兜底，并标注 `fallback_level` |
| 动态全局重算失败 | 不得回退到旧年运分冒充同一指标；该年标记不可用 |
| 事件证据不足 | 返回空事件数组，不为了凑满三条生成泛化事件 |
| 上一年状态缺失 | `versus_previous_year=null`，不得假设连续状态 |
| 规则冲突 | 保留 `mixed` 方向并降低置信度，不强行平均为中性 |

---

## 25. 数据来源与建设状态总表

| 模块 | 主要现有来源 | 可直接复用 | 仍需补齐 |
|---|---|---|---|
| `metadata` | 排盘口径、引擎版本、路由置信度 | 部分 | 统一可靠度和版本契约 |
| `natal_context` | `baziCore`、`BaziRuleEngine`、`baziImageAssessor` | 大部分 | 六维统一 schema、五领域基线 |
| `life_axis` | 大运流年列表、timing scan | 少量 | 每年 \(B_t\)、五领域分值、运限、趋势和置信度 |
| `temporal_context` | matrix、dayun/liunian list | 大部分 | 四柱运限、状态引用 |
| `dynamic_state` | 原局强弱/格局/调候、形象岁运增损 | 基础数据 | 大运态、流年态六维全局重算 |
| `dynamic_relations` | relation scanner、dynamic assessor | 大部分 | 广义应局、原身禄、运限、多领域映射 |
| `domain_impacts` | TargetSpec、state report | 映射和单目标 | 五领域并行、统一分值与聚合 |
| `metrics` | 年运分、机制强度、星宫稳定度 | 指标原料 | 统一语义和同源计算 |
| `possible_events` | target trigger、timing quality | 单事件雏形 | 状态机、多领域排序、证据与置信度 |

---

## 26. 验收标准

### 26.1 数据完整性

- 任一人生轴年份都有年龄、大运、流年、运限和五维分值；
- 任一可用年份都能请求完整 `YearSnapshot`；
- 折线点、领域详情和事件证据使用同一年度快照；
- 支持从出生年开始的历史年份和未来年份；
- 当前年只负责默认定位，不拥有特殊计算口径。

### 26.2 命理逻辑一致性

- 大运先形成 `dayun_state`，流年再形成 `year_state`；
- 整柱、同干、同支应局可以区分；
- 原身与禄引动可以追溯到具体干支；
- 当前年龄对应的运限柱进入关系权重和领域落点；
- 合化、三合、三会发生后会反馈到五行、强弱、调候、流通和格局；
- 同一年度允许不同领域出现相反方向；
- 激活度不直接决定吉凶分；
- 事件能够表达进入、持续和退出。

### 26.3 可解释性

- 每个领域分值至少有一个 `reason_code`；
- 每个高可能性事件至少有一个有效关系证据；
- 每个关系能追溯规则编号、作用对象和状态变化；
- 所有置信度下降都有明确限制说明；
- 不输出无来源的裸分。

### 26.4 一致性测试

- 同一输入、同一引擎版本产生稳定结果；
- 当前年快照与人生轴对应点完全一致；
- 切换领域只改变读取维度，不重新定义年份状态；
- 分段计算人生轴与一次性全范围计算结果一致；
- 缓存命中结果与实时计算结果一致；
- 上一年状态变化能够正确进入下一年基线。

---

## 27. 产品数据主线总结

人生变化轴的数据核心不是“为每年生成一段命理文案”，而是形成可重复计算、可比较、可追溯的年度状态：

\[
YearSnapshot_t =
TemporalContext_t
+ DynamicState_t
+ Relations_t
+ DomainImpacts_t
+ Events_t
\]

其中：

- `TemporalContext` 决定这个年份处于哪里；
- `DynamicState` 决定全局状态发生了什么变化；
- `DynamicRelations` 解释变化是如何发生的；
- `DomainImpacts` 解释变化落到哪里；
- `Metrics` 负责跨年份比较；
- `PossibleEvents` 把结构变化翻译成有限、带证据的事件假设。

最终产品应坚持：

> 一条人生轴、一个统一年度状态、五个可切换领域、三类独立指标（状态、激活、波动）和最多三条带证据的可能事件。

---

# 第三部分：方案落地前的专业评审与修正建议

> 本部分对前两部分的审计与 PRD 做工程与命理双视角评审，只记录"动工前需要先拍板"的高风险点，不复述已经做对的部分。  
> 评审结论以"建议"形式给出，最终取舍由项目维护者决定。

## 28. 评审总判断

审计部分（第 1–10 节）可信、克制，"不重复造轮子"的边界划得清楚，可直接作为开发依据；PRD 的数据契约（第 11–27 节）也较扎实，激活/方向/承载/置信度的拆分、"分数不是概率"、版本化缓存键都是正确取向。

真正需要在动工前定死的是三件事：

1. **G4 必须写成"扰动"而不是"重排盘"**；
2. **全轴 \(B_t\) 计算需要预计算 / 缓存策略，以绕开 Cloudflare Worker 的单请求 CPU 上限**；
3. **PRD 自身需要分期，先发一个能上线的 MVP，而不是八项全做完才成立**。

下文 R1–R8 按风险高低排列。

## 29. 高风险修正项

### R1. G4 的 \(f()\) 必须是带阻尼的扰动函数，不是重新实例化静态引擎（最高风险）

第 17 节的 schema 让 `DynamicBaziState` 完整复用 `StrengthState`、`PatternState`，会强烈诱导实现走成"把大运、流年当两根新柱塞进盘里，重跑 `calculateStrength()`"。这是错的：

- 传统旺衰不会因为流年来一个比劫就把弱身算成强身；大运流年参与生克制化、改变环境/调候/通关，但**原局旺衰基准盘基本固定**；
- 用 6 柱重算会导致一年一根就"转强"、十神分布逐年剧烈跳动，使折线图（产品核心价值）抖动到不可用。

**建议**：

- 把 \(f()\) 明确定义为**在原局 `scores` / `ganScores` 上叠加大运流年有限权重增量**的扰动函数，重算"调候满足度 / 通关是否接通 / 用神是否被合绊"，而不是重新实例化静态强弱与格局引擎；
- `DynamicBaziState` 中的 `StrengthState` 应携带 `delta_from_natal`，而非一个独立重算的绝对分；
- 此项不在设计阶段定死，后期必然返工。

### R2. 合化反馈回路会放大假阳性

G4 让"三合成局 → 改变全局五行 → 回写强弱/格局/调候"。合化判定本身争议大、条件严，一旦进入反馈回路，一次误判的化局会同时污染强弱、调候、格局、五个领域分。

**建议**：

- 合化进入全局重算前必须过保守闸门，并携带单独 confidence；
- 化局对 \(B_t\) 的影响要**限幅**，不能让一个存疑化局直接把格局从"成"翻成"破"；
- 取向上宁可漏判，不要级联放大。

### R3. G5 跨年状态机建议降级为软先验或后置

"结婚后下一年从已婚态继续"在叙事上动人，但工程上：

- 状态持续意味着**误差跨年复利**，一个错误的"某年结婚"会污染之后所有年份；
- 八字并不确定性地给出离散人生事件，硬状态机等于过度承诺。

**建议**：

- 把持续性做成**软先验 / 标注**（挂在 `possible_events.state_transition` 上作为提示），而不是会覆盖逐年重算的硬状态；
- 优先级上 G5 应排在 G4 之后，比当前 P1 更靠后，必要时单列为可选期。

## 30. 工程落地修正项

### R4. 全轴 \(B_t\) 会撞 Cloudflare Worker 的 CPU 预算

按现有部署架构，`lib/` 业务逻辑跑在 Cloudflare Worker，单请求有 CPU 时间上限。

- 第 15 节把 `life_axis[]` 叫"轻量"，但第 26.4 要求"折线与详情同源"。同源 = 折线每个年点也必须由完整 \(B_t\) 管线算出。所以"轻量"只是**传输轻**，**计算不轻**——60~80 年 × 全局重算，一次性算整条轴很可能超时。

**建议**：

1. 文档应明确区分"payload 轻量"与"compute 轻量"，当前把两者混在一起；
2. 全轴计算走**预计算 + 持久缓存**（KV / D1 / R2），请求只读；或分段计算 + 拼接（已允许分段，但需补上"分段是为绕开 CPU 上限"的动机与一致性校验）；
3. 把 \(B_t\) 管线设计成**可增量**：`dayun_state` 十年只算一次并缓存，`year_state` 在其上做增量，天然契合第 17.1 的"建场 / 触发"两层，同时省算力。

### R5. PRD 自身没有分期，建议先切一个能发布的 MVP

审计列了 G1–G8，PRD 默认八项全做完才成立，风险全压在最难的 G4 / G5 上。

**建议把 PRD 也切片**：

- **MVP（先上线拿价值）**：人生轴外壳 + 现有逐年分值 + G1 运限并轨 + G2 广义应局。两项均为纯增量、低风险，且立刻让"拖动看一生"成立；
- **P1**：G4 扰动式全局重算（按 R1 做对）+ G6 五领域并行；
- **P2**：G5 状态机（软先验）+ G8 校准。

### R6. 折线分数稳定性需要显式的平滑与版本契约

0–100 的逐年分对规则改动极敏感，小改动会让曲线跳变，而曲线连续性正是产品卖点。

**建议**：

- 显式定义**平滑策略**；
- 约定"规则变更 = `engine_version` / `scoring_model_version` 升级 + 缓存整体失效 + 向用户说明曲线会变"。

## 31. 命理观与口径修正项

### R7. 整台引擎绑定陆致极一家框架，应显式声明

"应局 / 原身与禄 / 四柱运限并轨"是陆致极的特有术语与体系，并非命理通识，滴天髓 / 三命通会不这么讲。第 10 节研究边界写得好，但 P0 把四个陆氏专有机制全列为"主干缺失"，等于宣布产品命理观 = 陆致极。

**建议**：

- 在 `metadata` 或文案层**显式声明"动态分析采用陆致极体系"**，避免与用户或其他模块的命理直觉冲突；
- 在 `engine_version` 之外加 `theory_profile` 字段，为以后换 / 叠加流派留口子。

### R8. G8"校准闭环"有过度承诺风险

用命主自报的少数历史事件（通常 n=3~5）去**结构化更新机制权重 / 年份排序**，统计上极易过拟合到个例。

**建议**：

- 把历史事件校准定位成**定性的置信度调节**（命中则该类机制 confidence 上调一档），而非真去学权重；
- 第 8.G8 节"尚未见其对权重做结构化更新"宜改写为**显式非目标**，更诚实也更安全。

## 32. 待定项的兜底建议

- **`overall` 算法（第 19.1 节）**：全篇只说"来自全局 \(B_t\) 适配度、不是四领域平均"，但没给实际定义，是最容易被偷懒写成加权平均的地方。建议在 PRD 中就把 `overall` 的成分（`global_fit` / 格局 / 调候适配）定死，否则第 26 节验收无法判定；
- **65 岁后运限延伸（第 16 节）**：陆致极四柱 64 年跑完后的处理本无公认定论，建议直接定一个保守规则（时柱权重衰减、标 `extended`）并在 `limitations` 声明，不要留作"待定"。
