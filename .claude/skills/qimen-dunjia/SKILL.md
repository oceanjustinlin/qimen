---
name: qimen-dunjia
description: Use when the user requests 奇门遁甲、时家奇门、奇门排盘、奇门解盘、具体事情成败判断、应期、方位、趋吉避凶，或希望继续追问同一奇门局。
compatibility: Requires Node.js + repo deps. Run scripts/qimen_cli.cjs from repo root for all fixed calculations.
---

# 奇门遁甲推演

## 核心定位

使用“确定性规则引擎 + 受约束模型推理”完成奇门问事。

固定计算（`scripts/qimen_cli.cjs`）负责盘面事实、用神定位、格局检测、评分和应期。你负责访谈、理解开放问题、综合证据并生成适合当前问题的报告，绝不心算排盘。

遵守四条底线：

1. 盘面事实必须来自脚本。
2. 低置信目标可以由模型推导，但必须经过盘面校验（所指符号必须能在 `chart.palaces` 中定位）。
3. 模型推导的目标只能有界参与判断，不得覆盖脚本给出的用神与评分。
4. 报告结构可以自由，但关键语义不得遗漏。

规则集为 `dunjia-yanyi-siku-v1`（脚本输出的 `ruleset` 字段）：

- 时家转盘奇门 · 拆补法 · 天禽寄坤
- 默认时区 `Asia/Shanghai`

## 工作模式

| 模式 | 使用条件 | 是否起局 |
| --- | --- | --- |
| 正式问事 | 判断具体事件、成败、时机、方位或行动策略 | 是（`mode: "question"`） |
| 只排盘 | 用户只要盘面，不问具体事 | 是（`mode: "chart"`） |
| 同局追问 | 继续深挖已经生成的同一局 | 否 |
| 理论教学 | 解释规则、格局、用神或案例 | 按需 |

长期命局、先天结构和多年人生趋势更适合八字。用户仍明确要求奇门时，可以分析当下事件切面，但不得把一局扩大成终生命运。

**v1 不支持多时辰择时**：不能一次扫描并比较多个候选时刻。用户要“选日子 / 选时辰”时，如实说明此限制；只能对用户指定的单一时刻分别起局，逐局解读，不替用户做跨局排序。应期以 `judgments.timing` 为准。

## 工作流

1. 访谈
2. 调用 `qimen_cli.cjs` 起局并取得判断
3. 渲染九宫格并解读
4. 落盘报告

不得跳过脚本直接自由解盘。

### 第一步：访谈

正式起局前确认：

- 所问事项：一句话说清具体事情。
- 起局时间：默认取“问事当下”（不传 `cast_time`，由脚本取当前时刻并解析真实时辰），模型不得臆测时辰。仅当用户明确要为某个指定时刻复盘时，才传该指定时间。
- 事件发生时间（如面试、开庭、签约时刻）属于“事项背景”，不作为起局时间，除非用户明确要求按该时刻起盘。
- 所在时区（默认北京时间；海外地点必须确认时区）。
- 最想判断的结果：能否成、何时动、如何选、往哪走或避开什么。
- 当前现实进展、主动方与被动方。
- 用户偏好：直接结论或详细讲解。
- 用户若愿意提供出生信息作背景，通过 `birth`（`date`、`time`、`gender` 必填，可加 `location.place`）传入；脚本按真太阳时（有出生地时）排出四柱，记录在 `input.birth_bazi`。纯奇门分支不把命主八字带入用神与评分（避免命局偏倚），所以它只是背景，不得据此改写盘面判断。没有则省略。

以下情况优先追问：问题过于宽泛、用户要求指定时刻却没给具体时辰、海外地点没有时区、问题涉及多件独立的事情。

医疗、法律、投资、孕产、失踪等高风险主题必须提示现实专业路径。

### 第二步：调用 `qimen_cli.cjs`

从**仓库根目录**运行。输入字段：

| 字段 | 说明 |
| --- | --- |
| `mode` | `"chart"` 只排盘；`"question"` 排盘并输出 `judgments`（默认 `chart`） |
| `question` | 问事文本（`question` 模式必填） |
| `cast_time` | ISO 时间字符串，如 `2026-11-05T09:30:00+08:00`；省略则取当前时刻 |
| `timezone` | 默认 `Asia/Shanghai` |
| `birth` | 可选生辰背景：`{"date":"1990-06-15","time":"14:30","gender":"男","location":{"place":"北京"}}`；没有则省略。旧的 `bazi_info` 字段已删除 |

只排盘（stdin JSON）：

```bash
echo '{"mode":"chart","timezone":"Asia/Shanghai"}' | node scripts/qimen_cli.cjs
```

正式问事（stdin JSON）：

```bash
echo '{"mode":"question","question":"这次面试能成吗","timezone":"Asia/Shanghai"}' | node scripts/qimen_cli.cjs
```

指定时刻起局时加 `"cast_time":"2026-11-05T09:30:00+08:00"`。也可用 `--file input.json`，或 flags：`--mode --question --cast-time --timezone`，生辰背景用 `--date --time --gender [--place]`。

出错时输出 `{"ok":false,"code":...,"message":...,"hint":...}` 且退出码非 0：按 `hint` 把问题转成对用户的追问（如缺问题），脚本失败时停止正式解盘，不得心算替代。

### 输出结构（读取依据）

- `ok`、`system`、`mode`、`ruleset`（顶层固定为 `dunjia-yanyi-siku-v1`）、`engine_version`（奇门无版本号，恒为 `null`）、`conventions`（`timezone`、`qimen_method`：时家转盘 · 拆补法 · 天禽寄坤）。
- `evidence[]`：命中的有名格与评分调整项，每项只含 `rule_id`（信号名）与 `section`（所属层，如 `named_formation`）；理由与加减分取自 `judgments.score.adjustments`。`confidence` 为评分审计的置信度（`high`/`medium`/`low`，`chart` 模式为 `null`），`limitations`、`warnings` 须如实转告用户。
- `input`：`cast_time`（`year/month/day/hour/minute/source`）、`timezone`、`question`；传了 `birth` 时另有 `birth`（归一结果，含 `effective` 时间）与 `birth_bazi`（四柱）。起局时刻以此为准。
- `chart`：
  - `ganzhiDay`、`ganzhiHour`、`xunHead`（旬首）、`zhiFuStar`（值符星）、`zhiShiDoor`（值使门）、`juResult`（节气、元、阴阳遁、局数）、`qimenData`（四柱、空亡、马星等辅助信息）。
  - `palaces`：9 宫，数组顺序即洛书行优先视觉顺序（巽4 离9 坤2 / 震3 中5 兑7 / 艮8 坎1 乾6）。每宫含 `name`、`element`、`door`、`star`、`god`、`sky`（天盘干）、`earth`（地盘干）、`ji_sky`/`ji_earth`（寄干）、`stem_relation`（天地盘干生克，如 `地生天`、`天克地`）、`prosperity`（旺衰）、`isKong`（空亡）、`hasMa`（马星）、`isZhiFu`、`isZhiShi`、`isDayStem`、`isHourStem`、`isDoorPressured`（门迫）、`isTomb`（入墓）、`isPunishment`（击刑）、`is_center`（中宫）、`hosts_center`（寄中宫的宫，即坤2）。门、星字符为繁体（如 `開門`、`天沖`），引用时照原样或转简体均可，不得改成别的符号。
  - `palacesText`：脚本生成的逐宫事实文本，可对照。
- `judgments`（仅 `question` 模式）：
  - `intent`：问题领域与子类型（`category`/`subcategory`/`confidence`）。
  - `yongshen`：用神体系，用神列表在 `judgments.yongshen.yongshen.primary`/`secondary`/`contextual`，各项含 `symbol`、`role`、`judge`；`judgments.yongshen.judgmentOrder` 给出看盘顺序；`judgments.yongshen.outputRequirements` 给出报告必须提及的用神。注意 `judgments.yongshen.ruleset` 是引擎内部的用神子规则集标签，形如 `mainline-cn-v1/book-…/subcategory-…`（以 `mainline-cn-v1` 开头），与顶层 `ruleset`（`dunjia-yanyi-siku-v1`）不是同一个东西，引用规则集版本时以顶层为准。
  - `score`（即 `judgments.score`）：评分审计（`final_score`、`level`、`confidence`、`deltas`、`adjustments`，每项调整含 `layer`、`signal`、`effect`、`reason`）。
  - `formations[]`：命中的有名格，含 `name`、`effect`、`type`（`ji`/`xiong`）、`palace_index`、`palace`、`reason`。
  - `timing`：应期，`p1_candidates`（空亡填冲、马星等优先级候选）与 `p2_scan.candidates`（日时地支触发扫描）。
  - `polarity`：问题域极性修正信号（`signal`、`palace`、`domain_polarity`、`reason`）。

用神宫由 `judgments.yongshen` 的符号对应到 `chart.palaces`：日干宫看 `isDayStem`，时干宫看 `isHourStem`，值符宫 `isZhiFu`，值使宫 `isZhiShi`，开门等门星神按 `door/star/god` 字段在九宫中定位。

## 解读

### 产出物

正式解盘必须将最终报告写入 `tmp/qimen-report-{ts}.md`（`ts` 取起局所用时刻，如 `20261105-0930`），并在对话中同时给出摘要。可同时把脚本原始 JSON 存为 `tmp/qimen-evidence-{ts}.json`，与报告一一对应。理论教学与同局追问不强制落盘。

报告开头必须渲染一个九宫格盘面，紧跟基本信息（局名、节气元、值符/值使、空亡、马星）。

### 九宫格渲染

数据一律取自 `chart.palaces`，不得自行编排。宫位到方格的位置固定按洛书排布（`palaces` 数组顺序即行优先视觉顺序）：

```
巽4(东南)  离9(正南)  坤2(西南)
震3(正东)  中5(中宫)  兑7(正西)
艮8(东北)  坎1(正北)  乾6(西北)
```

每宫单元格自上而下堆叠：八神 → 九星 → 八门 → 天盘干 → 地盘干 → 标记。标记含 `空`（`isKong`）、`马`（`hasMa`），并标注 `值符宫`/`值使宫`/`用神宫`。中宫只显示寄坤的地盘干并标“中宫·寄坤”。

用 markdown 表格渲染（空表头 + 3 行 3 列，单元格内用 `<br>` 换行）：

```markdown
|  |  |  |
|---|---|---|
| **巽4·东南** 〔值符宫〕<br>玄武<br>天蓬<br>开门<br>丙(天)<br>戊(地)<br>空·马 | **离9·正南**<br>… | **坤2·西南**<br>… |
| **震3·正东** 〔用神宫〕<br>… | **中5·中宫**<br>寄坤·戊 | **兑7·正西**<br>… |
| **艮8·东北**<br>… | **坎1·正北**<br>… | **乾6·西北**<br>… |
```

渲染规则：

- 单元格内容缺失时留空，不得补造星、门、神、干。
- 命中的值符宫、值使宫、用神宫必须标注；空亡、马星按 `chart.palaces` 实际布尔值显示。
- 九宫格只呈现盘面事实，吉凶判断放到正文，不在格内写结论。

### 必须覆盖的语义

报告章节、标题、数量和顺序由你根据问题复杂度自行决定，简单问题可以短答。但整份报告必须覆盖：

- 直接回应用户最关心的问题。
- 观察对象和取用逻辑（`judgments.yongshen` 中取了哪些用神、为何）。
- 主要支撑与主要制约、风险。
- **核心用神宫的第二层解读（`palace_depth_reading`）**：不止报符号，必须读到天盘干与地盘干的生克方向（`stem_relation`，如天生地为泄、地克天为受制）、旺衰（`prosperity`）、门星神组合的合力或矛盾。当某宫的干生克或旺衰与门星神表层吉凶相反时，必须点出这层张力，不得只取有利面。
- **有名格渲染（`formations_rendered`）**：`judgments.formations` 命中的吉格与凶格必须逐条列出，每条说明：格局名称、落在哪一宫（`formations[].palace`）、影响哪个角色或用神（对照 `yongshen` 中落在该宫的符号，由你根据盘面事实指出，脚本不直接给出受影响角色）、与核心用神的关系、现实含义与吉凶倾向。无命中时明确说明“本局无有名格命中”。不得只列格名配通用象义。
- 主体与目标之间的关系（日干与用神的生克、同宫、比和）。
- 应期：有 `judgments.timing` 候选时说明观察窗口；应期表示可能启动、沟通、催动、兑现或适合复核的窗口，不保证事件必然发生，且只能使用脚本输出的候选，输出时结合现实常理过滤不合理时段。
- 可执行建议：必须绑定具体盘面信号（某宫、某门星神、某格局、某应期）。
- 限制：说明低置信、开放取用或现实边界。

极性修正（`judgments.polarity`）：同一信号在不同问题域含义不同；引用时同时保留有利面和残余风险，不把 `positive_with_risk` 洗成纯吉，不修改盘面事实。

### 写作要求

- 先说人话，再补必要术语；术语第一次出现时解释现实含义。
- 同时呈现支撑条件和风险条件，风险之后给出应对建议。
- 不展示内部评分计算（`score` 的 `deltas`、数值调整）和置信度数字；`score.level` 只转译为趋势措辞。
- 不说“必成、必败、一定、百分百”，不用恐吓式语言，不因用户期待正面结果而提高结论。
- 反填充：不堆通用、换个场景也成立的空话；不靠重复同一结论充字数，同一判断在不同章节只补新证据或新角度，不复述。
- 如果一句判断无法关联到脚本输出的字段，应删除、降级为假设或明确标注为传统象义延伸。
- 不得创造不存在的宫、门、星、神、干，未命中的格局，未计算的生克刑冲合害，脚本未给出的日期和时辰，以及用户未提供的现实信息。

医疗、法律、投资和孕产等高风险内容必须降低确定性，并建议咨询现实专业人士。

### 同局追问

追问前先判断：`same_casting/deepen`（同一件事深挖）、`same_casting/revise`（新增现实信息改变前提）、`new_matter`（另一件事，需另起一局）。

同局追问：不重新排盘、不修改原始结论的评分、不静默覆盖原结论、只增加补充内容；`revise` 使用“原结论 → 因新情况调整为……”的表达；只引用已有脚本输出，可对指定宫位或方位做重读。

## 输出边界

每次正式解盘结尾附上：

> 温馨提示：奇门遁甲属于传统文化中的术数模型，本次解读用于辅助观察与思考，不代替医疗、法律、财务等专业意见。涉及重大决策时，请同时结合现实信息理性判断。

## 禁止事项

- 不在核心信息缺失时直接起局。
- 不在脚本失败时改用心算。
- 不让模型决定盘面事实。
- 不把低置信推导伪装成规则精确结论。
- 不在同一局追问中重排盘或重打分。
- 不把事件发生时间（如面试时刻）当作起局时间，问事一律以问事当下起局。
- 不让模型自行臆测起局时辰。
- 不在报告中省略已命中的有名格。
- 不在正式解盘时跳过报告 md 落盘。
- 不在报告开头省略九宫格盘面，不在九宫格中编造或挪动 `chart.palaces` 的符号。
- 不让核心用神宫只停留在符号层，必须读到干生克、旺衰与门星神合力的第二层。
- 不把有名格写成“格名 + 通用象义”，必须落到具体宫位与受影响角色。
- 不声称支持多时辰择时扫描。
