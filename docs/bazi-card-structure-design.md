# 八字问事卡片结构设计

> 结论来源：10个真实问事用例横向评测（Claude/ChatGPT/Gemini）+ 陆致极理论框架 + BaziEngine 代码审查
>
> 关联文档：[bazi-dynamic-analysis-theory.md](./bazi-dynamic-analysis-theory.md)
>
> 2026-11-03 更新：第二、三、五、六节的字段名、路由规则与代码位置已按 `lib/baziQuestionCore.js` 当前的统一输出 envelope v2 与双轴路由（`framework` ⟂ `target_source`）校正。第三节各模式下的「评测发现」与第七节是改版前的评测记录，保留当时的字段名，并注明对应的现行字段。各字段与奇门、紫微共享答案槽位的对应见 `lib/divinationDimensions.js` 的 `BAZI_SLOT_MAP`。

---

## 一、核心设计原理

八字解读的本质是**两类分析的组合**：

| 类别 | 分析对象 | 产出 | 对应 BaziEngine |
|------|---------|------|----------------|
| **静态分析**（原局底盘） | 命局先天结构：强弱、调候、格局、形象、合化 | 先天容量、目标十神状态、宫位稳定性 | `assessOriginalChartState()` |
| **动态分析**（大运流年触发） | 大运建场 × 流年触发 × 引动机制 | 事件概率、应期窗口、变动性质 | `assessDynamicTriggers()` |

不同领域的问题，**是这两类分析的不同组合**，而非完全不同的分析体系。

---

## 二、10 个问事类型 → analysis_mode 映射

`analysis_mode` 是旧的扁平路由字段，现由 `migrateLegacyRoute()` 迁移为双轴：`framework`（分析框架）与 `target_source`（目标从哪来：`backend_shishen` / `yongshen` / `llm_derived`）。两者对应关系：

| analysis_mode（旧） | framework（现行） | 含义 |
|---|---|---|
| `status` | `dynamic_current` | 当下大运流年引动 |
| `timing` | `dynamic_scan` | 逐年应期扫描 |
| `pattern` | `static_structure` | 先天结构容量 |
| `character` | `portrait` | 他人十神画像 |
| `profile_driven` | `open_strategy` | 开放战略、多路径 |

### 映射表

| # | 领域 | 问题示例 | analysis_mode | secondary_mode | 静/动 比重 |
|---|------|---------|---------------|----------------|-----------|
| Q1 | 财运-当年收入 | 今年薪资会不会涨？ | `status` | — | 动为主，静做底 |
| Q2 | 职业-主副业方向 | 适合主业还是副业？ | `profile_driven` | — | 静为主，动辅助时间轴 |
| Q3 | 职业-工作异动 | 今年会不会跳槽？ | `status` | — | 动为主，静做底 |
| Q4 | 学业-考研升学 | 会不会读研，哪年？ | `timing` | — | 动为主（年份扫描） |
| Q5 | 城市-发展方位 | 去哪个城市最旺我？ | `profile_driven` | — | 静为主（五行方位） |
| Q6 | 财运-财富自由 | 何时实现财富自由？ | `timing` | — | 动为主（多阶段里程碑） |
| Q7 | 婚恋-结婚时机 | 未来十年哪年结婚？ | `timing` | — | 动为主（年份扫描） |
| Q8 | 婚恋-伴侣特征 | 未来伴侣是什么样？ | `character` | — | 静为主（十神画像） |
| Q9 | 生育-孩子时机 | 何时有孩子+孩子特征？ | `timing` | `character` | 动+静双输出 |
| Q10 | 创业-行业适配 | 适合做品牌吗？做哪行？ | `pattern` | — | 静为主（先天容量） |

### 规则路由（`inferBaziRouteFromQuestion`）

按顺序匹配，命中即停：

```
含"什么时候/哪年/几岁/何时/未来几年/未来五年/未来十年"                 →  timing
含"什么样/画像/长相/性格/对象/老婆/老公/伴侣" 且含"今年/现在/当前/这步大运/状态/怎么样"
                                                                      →  character，secondary=status
含上述画像词且不含"今年/现在/当前/这步大运"                             →  character
含"适合/格局/命里/有没有/先天/上限/容量/创业还是打工/行业" 且不含当下时间词 →  pattern
含"适合/格局/命里/先天/创业/打工/行业" 且含"今年/现在/当前/这步大运/能不能做"
                                                                      →  pattern，secondary=status
其余                                                                  →  status（默认）
```

规则层不会产出 `profile_driven`；该模式只由 LLM 语义路由（`lib/divinationRouter.js` 的 analysis_mode 判断）给出。

---

## 三、统一输出 envelope v2 与各模式的 readings 结构

所有模式共用同一个 envelope（`buildUnifiedOutputSchemaBlock`），模式之间只有 `readings` 不同（`buildReadingsSchema`）。

### 公共 envelope

```
┌─ envelope v2（全部模式）───────────────────────────────────────────┐
│ meta          analysis_mode / secondary_mode / branch / category /   │
│               subcategory / target{shishen,gongwei,fallback_level,   │
│               llm_derived_target} / confidence / limitations         │
│ summary       title（≤16字）/ conclusion（40-80字）/ basis（80-160字）│
│               score 恒为 null，不输出数字分数                        │
│ key_signals[] title（≤20字）/ reading（60-120字）                    │
│ readings      各模式不同，见下                                       │
│ rhythm        segments[]：period / dayun_shishen / phenomenon /      │
│               strategy / key_liunians[]{year,gz,shishen,note}        │
│ action_guide  text（80-160字）/ items[1-4]                           │
└──────────────────────────────────────────────────────────────────┘
```

`rhythm` 只做大运级宏观定调，逐年判断由 `readings.trigger_windows` 负责。禁止输出 `trigger_vigor`、`activation_strength` 等 pipeline 内部数值字段。

### `status` / `dynamic_current`（当年气候判断）

适用：Q1 薪资、Q3 工作异动

```
┌─ readings ────────────────────────────────────────────────────────┐
│ base_foundation  { text（80-160字）, signals[]{title, detail} }     │
│                  原局底盘；高置信时须贴合静态面板                     │
│ target_state[]   { title（≤15字）, text（≤50字）}                   │
│                  目标用神为何被选、当前状态                           │
│ dayun_field      { text（80-240字）}                                │
│                  大运建场，须映射到自身变化与外部环境变化             │
│ liunian_trigger  { text（80-240字）, phenomena[]{tag, explain} }    │
│                  流年触发，phenomena 引用引动机制清单                 │
└──────────────────────────────────────────────────────────────────┘
```

**Q1 vs Q3 差异**：target 不同（Q1→财/食伤，Q3→官/伤官），`target_state` 与 `liunian_trigger.phenomena` 的描述语言随 target 切换。

**评测发现（改版前）**：三个模型均未输出当时的 `psychological_mirror`（心理镜像）和 `outcome_projection.hidden_catch`（隐藏代价）。v2 已移除这两个字段，心理与现实映射要求并入 `dayun_field` / `liunian_trigger` 的「须映射到自身与外部环境变化」。

---

### `timing` / `dynamic_scan`（应期扫描）

适用：Q4 考研、Q6 财富自由、Q7 结婚、Q9 孩子时机

```
┌─ readings ────────────────────────────────────────────────────────┐
│ base_foundation  { text, signals[] }（同 status）                   │
│ target_state[]   { title, text }                                    │
│ trigger_windows[]                                                   │
│   year / ganzhi / dayun_ganzhi                                      │
│   verdict（≤80字，须引用具体干支机制，须与咨询领域年龄段契合）       │
│   phenomena[]{tag, explain}                                         │
│ best_window   { year, reason }（可选，有明显建议时间偏好时填）       │
│ worst_window  { year, reason }（可选，有明显规避时间偏好时填）       │
└──────────────────────────────────────────────────────────────────┘
```

`trigger_windows` 只能来自后端「候选年份断语包」，由 LLM 筛选（topN≤5）。

**各 timing 问题的特殊处理**：

| 问题 | 特殊要求 |
|------|---------|
| Q4 考研 | 年龄语境决定深造类型（53岁≠22岁）；历史年份仅作一句验证，不占主体 |
| Q6 财富自由 | 非离散事件，trigger_windows 宜以"阶段里程碑"呈现而非单一时间点；**建议增加 `milestone_stages` 字段（尚未实现）** |
| Q7 结婚 | 每个窗口附加"感情发展路径"描述（见面→稳定→成婚的时序）|
| Q9 孩子时机 | 需双模式输出：timing（何时）+ secondary character（孩子画像）|

---

### `pattern` / `static_structure`（先天容量判断）

适用：Q10 创业行业适配

```
┌─ readings ────────────────────────────────────────────────────────┐
│ base_foundation      { text, signals[] }，侧重先天结构容量          │
│ target_state[]       { title, text }                                │
│ structural_supports  ≤3条：原局支撑本领域的现象（引用柱位/十神/关系）│
│ structural_risks     ≤3条：原局制约本领域的现象                     │
│ structural_verdict   ≤120字：先天容量与适配方向的综合断语           │
│ [current_status_note] secondary=status 时追加（≤80字）：当前大运流年 │
│                      是否适合推进，不展开成应期预测                 │
└──────────────────────────────────────────────────────────────────┘
```

**评测发现（改版前）**：当时的 `real_world_expression`（日常行为场景）三个模型均输出了"食神旺=才华强"的十神翻译，没有写出具体行为场景。v2 已移除该字段；`capacity_level`、`verdict`、`how_to_leverage` 分别并入 `structural_verdict` 与 envelope 的 `action_guide`。

---

### `character` / `portrait`（人物画像）

适用：Q8 伴侣特征，Q9 孩子特征（secondary）

```
┌─ readings ────────────────────────────────────────────────────────┐
│ portrait_subject       spouse | partner | boss | child | other     │
│ target_resolution      backend_mapped | llm_derived                │
│ llm_derived_target_note                                            │
│ appearance_tendency    { text, confidence, evidence[] }            │
│ personality_tendency   { text, confidence, evidence[] }            │
│ career_style           { text, confidence, evidence[] }            │
│ relationship_dynamic   相处模式/关系动态                            │
│ do_not_overclaim       标准免责声明                                 │
└──────────────────────────────────────────────────────────────────┘
```

**结构性缺口（仍存在）**：portrait 的 readings 没有 timing 字段。用户问"伴侣什么样"时天然想知道"大概什么时候出现"。建议：
- 伴侣特征（character）→ 自发延伸：结婚时机的大致区间（一段话，不需要完整 timing 扫描）
- 结婚时机（timing）→ 自发延伸：伴侣类型线索（一段话，帮用户识别对象）

---

### `profile_driven` / `open_strategy`（开放战略问题）

适用：Q2 主副业方向、Q5 城市方位

```
┌─ readings ────────────────────────────────────────────────────────┐
│ base_foundation  { text, signals[] }                                │
│                  无后端目标定位，LLM 自主选择最相关的干支线索        │
│ target_state[]   { title, text, confidence: "low" }                 │
│                  LLM 自拟的关注十神/方向                             │
│ dayun_field      { text }：当前大运建场                              │
│ liunian_trigger  { text, phenomena[] }：当前流年触发                │
│ path_readings[]                                                     │
│   path / structural_fit / likely_experience（80-120字）/            │
│   satisfaction_prediction / peak_period / risk / confidence         │
└──────────────────────────────────────────────────────────────────┘
```

改版前的 `framework_used`、`structural_reading`、`strategic_recommendation`、`timeline` 已移除：结构评估并入 `base_foundation`，主线策略并入 envelope 的 `action_guide`，按大运分组的时间线并入 envelope 的 `rhythm`。

**Q2 评测发现（改版前）**：Gemini 使用了错误的日主（乙木，应为丁火），且回答了错误问题（工作异动）。Claude 和 ChatGPT 的输出结构最接近当时的 `profile_driven` schema，但均缺少 `psychological_mirror`。

---

## 四、同一 analysis_mode 下不同问题的开放性延伸段落

| 主问题 | 必须自发延伸到 | 理由 |
|--------|--------------|------|
| **结婚时机**（timing） | 伴侣类型线索（character 摘要） | 知道时机不知道对象，用户无法在现实中识别 |
| **伴侣特征**（character） | 大约什么时候出现（timing 摘要） | 特征再详细，没有时间感参考价值减半 |
| **财运薪资**（status） | 涨薪路径（主动换岗/副业/体制内） | 只回答"会涨"不给路径，信息价值低 |
| **财富自由**（timing） | 近3年可做什么来积累 | 遥远的时间窗口需要当下行动的连接 |
| **工作异动**（status） | 变动方向（什么类型公司/岗位） | 只回答"会跳"不给方向，不完整 |
| **主副业**（profile_driven） | 具体行业 + 年份节奏 | 方向没有行业落地则答案悬空 |
| **创业行业**（pattern） | 启动时机（当前大运支持度） | 适不适合之外，用户最需要知道"现在能动吗" |
| **考研升学**（timing） | 深造类型（传统学历/EMBA/在职研究生） | 结合命主年龄给出合理深造形式 |
| **孩子时机**（timing） | 孩子特征（secondary character） | 用户同时问了时机和特征，两者不可分离 |

---

## 五、两类 UI 组件抽象

基于静态/动态分析框架，前端可抽象出两类可复用组件：

### 组件 A：原局底盘组件（静态）

**数据来源**：`assessOriginalChartState()` 输出 + ctx 字段

```
┌─────────────────────────────────────────────┐
│  原局底盘                                    │
├──────────────────────────────────────────────┤
│  目标十神                                    │
│  ├─ [位置] [12长生] [旺衰系数]               │
│  └─ [关系标签: 帝旺/被冲/被合化/入墓...]     │
├──────────────────────────────────────────────┤
│  目标宫位                                    │
│  ├─ 星宫得正 / 鸠占鹊巢 / 宫位受冲          │
│  └─ 宫内坐十神                              │
├──────────────────────────────────────────────┤
│  格局特征（如触发）                           │
│  └─ 特殊规则：妻星入墓 / 官杀混杂...        │
├──────────────────────────────────────────────┤
│  整体稳定性                                  │
│  strong / stable / dynamic / buried / damaged │
└─────────────────────────────────────────────┘
```

**适用 mode**：`pattern`、`character`，以及其余模式 readings 中的 `base_foundation`、`target_state` 底盘说明

**参考截图**：婚恋结婚时机卡片上半部分「婚姻用神推算」区域

---

### 组件 B：动态触发组件（动态）

**数据来源**：`assessDynamicTriggers()` 输出

```
┌─────────────────────────────────────────────────┐
│  动态触发                                        │
├──────────────────────────────────────────────────┤
│  大运层                                          │
│  ├─ [大运干支] [十神] [与目标元素的关系]          │
│  └─ 建场效果：喜/忌/中性                         │
├──────────────────────────────────────────────────┤
│  流年层（status 模式：当年一行）                  │
│  ├─ 引动机制：冲动/合动/填实三合/开墓库/伏吟/反吟  │
│  ├─ 引动强度：有效（≥0.35）/ 潜伏                 │
│  └─ 方向：喜→有利 / 忌→不利                      │
├──────────────────────────────────────────────────┤
│  timing 模式：年份列表（可扩展）                  │
│  每行：[年份] [干支] [激烈程度] [核心机制]        │
├──────────────────────────────────────────────────┤
│  综合结论（高亮框）                               │
│  best_window + worst_window + 一句话结论          │
└─────────────────────────────────────────────────┘
```

**适用 mode**：`status`（`dayun_field` + `liunian_trigger`，当年一行）、`timing`（`trigger_windows` 多年列表），以及全部模式 envelope 中的 `rhythm`（按大运分组的时间线）

**参考截图**：婚恋结婚时机卡片下半部分「未来十年年运推演」年表 + 「综合结论」紫色高亮框

---

## 六、BaziEngine 现有覆盖度与 Gap

### 静态分析覆盖

| 陆致极步骤 | 实现状态 | 位置 |
|-----------|---------|------|
| 强弱（扶抑用神） | 依赖上游 ctx 字段，不自算 | `favorableWuxing` 透传 |
| 调候 | 依赖上游 ctx，文字透传至 prompt | `baziQuestionCore.js:52` |
| 格局 | 依赖上游 ctx，文字透传至 prompt | `baziQuestionCore.js:51` |
| 形象/从化 | **完全缺失** | — |
| 目标十神定位评估 | **完整实现**（12长生+vigor+刑冲合害+状态标签） | `assessOneShishen()` |
| 宫位独立评估 | **完整实现**（星宫得正/鸠占鹊巢） | `assessGongwei()` |
| 格局层静态规则 | **部分实现**（仅婚姻类 9 条规则） | `STATIC_CHECK_RULES`（`baziStateAssessor.js`） |
| 合化对用神的影响 | 标记了 `合_化`/`合_不化` 标签，不重新计算用神 | `baziStateAssessor.js:193` |

### 动态分析覆盖

| 陆致极机制 | 实现状态 | 位置 |
|-----------|---------|------|
| 大运建场（扩展 6 柱扫描环境） | **完整** | `buildExtendedPillars()` |
| 冲动 | **完整** | `MECH.CHONG_DONG` |
| 合动 | **完整** | `MECH.HE_DONG` |
| 合化/合而不化 | **完整** | `MECH.HE_HUA/HE_BU_HUA` |
| 伏吟/反吟 | **完整** | `isFuyin()` / `isFanyin()`（`baziDynamicAssessor.js`） |
| 开墓库 | **完整** | `MECH.KAI_MU` |
| 透干引动 | **完整** | `MECH.TOU_GAN` |
| 填实三合 | **完整** | `MECH.TIAN_SHI` |
| 填实三刑 | **完整** | `MECH.TIAN_SHI_XING` |
| 引动强度（vigor ≥0.35 有效） | **完整** | `buildVigorCheck()` |
| 月份级应期精度 | **缺失** | — |
| 大运改变喜忌后流年方向重算 | **结构化缺失**（交给 LLM 理解） | — |

### 关键 Gap 汇总

| Gap | 影响范围 | 优先级 |
|-----|---------|-------|
| 全局强弱/喜忌无自算 | pattern、profile_driven 的结构分析精度 | 高 |
| 形象/从化分析缺失 | 极旺/极弱命局全部走错分析路径 | 高 |
| character 模式无 timing 延伸 | 伴侣特征问题缺少"何时出现"的结构化输出 | 中 |
| timing + character 双输出（孩子问题）| Q9 类问题需要两种模式同时输出 | 中 |
| 月份级应期精度 | timing 模式精度止于年，无法给出季/月节点 | 中 |
| 财富自由的 milestone_stages 字段 | timing 模式处理长周期渐进事件时结构不匹配 | 低 |

---

## 七、评测发现的 LLM 质量问题

### 根本性错误（不可用）

| 模型 | 问题 | 原因 |
|------|------|------|
| Gemini Q2（主副业） | 日主识别错误（乙木 vs 实际丁火）+ 回答了错误问题（工作异动） | Excel 行错位，或 Gemini 串题 |
| Gemini Q9（生育） | "男命以官杀代表子女" — 传统规则颠倒（男命应看食伤+时柱） | LLM 知识错误 |

### 逻辑缺陷（部分段落不可用）

| 模型 | 问题 | 原因 |
|------|------|------|
| Claude Q4（考研，1973年生） | 大篇幅分析 1995-1997 年历史节点 | timing 模式应聚焦未来候选年，历史一句带过 |
| Claude Q9（生育，1998年生） | 2024 为最高概率窗口，但当前 2026 已过 | timing 扫描应过滤掉过去年份或明确说明"窗口已过" |
| ChatGPT Q9（生育） | 2031-2035 为主窗口，跳过了命理上更显著的 2025-2028 | 过度保守，漏掉申子辰三合触发 |

### 过度延伸（偏离 mode 定义）

| 模型 | 问题 | 原因 |
|------|------|------|
| ChatGPT Q1（薪资） | status 问题里大篇幅输出 profile_driven 战略分析 | 改版前应在 `outcome_projection.if_happens` 提一句路径；v2 中路径建议放在 envelope 的 `action_guide` |
