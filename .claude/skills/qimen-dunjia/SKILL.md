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

解读守则见 `packages/xuanxue-mcp/prompts/qimen_reading.md`（与 MCP prompt 共用）。访谈要确认的内容（所问事项、起局时间默认取问事当下、时区、`birth` 背景用法、需追问的情形、高风险主题提示）以该文件为准。

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

### 必须覆盖的语义与写作要求

解读守则见 `packages/xuanxue-mcp/prompts/qimen_reading.md`（与 MCP prompt 共用）。报告必须覆盖的语义（含 `palace_depth_reading`、`formations_rendered`、应期、极性修正）、写作要求与同局追问规则以该文件为准；通用安全规则见 `packages/xuanxue-mcp/prompts/common.md`。开始解读前先读这两份文件。

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
