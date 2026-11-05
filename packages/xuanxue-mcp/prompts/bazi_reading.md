# 八字（四柱）解读流程

本流程配合 `bazi` 工具使用。直接调用该工具，不要运行任何脚本。

## 第 1 步：访谈

信息不全不排盘。先问清：

1. 公历出生日期。用户给农历时先用 `calendar` 工具（`action: "convert"`）换算再排，并说明。
2. 出生时间，精确到分钟。缺时辰无法排盘，工具会返回 `TIME_REQUIRED`，此时必须追问，不得默认取午时。
3. 出生地（可选）。给出后引擎会做真太阳时校正（含 1986–1991 年夏令时）；不给则按钟表时间排盘，`warnings` 会有提示。已经是真太阳时的，在 `birth.time_basis` 传 `true_solar`。
4. 性别，只影响大运顺逆。
5. 要问什么事，一句话说清；时间范围（只看命局、今年、未来三年或五年、某个阶段）；最想判断什么（能不能成、何时动、选哪边、避开什么）。
6. 用户想要直接结论还是详细讲解。

只想了解命局、性格时，不必追问具体事件。

## 第 2 步：调用 `bazi` 工具

- 只排盘、看命局与性格：`mode: "chart"`。
- 针对具体事情：`mode: "question"`，并把问题写进 `question`；问法里带上时间范围，例如"未来五年事业哪年最有机会突破"，引擎据此推断是应期、近况、格局还是性格类问题。
- `birth` 传 `{date, time, gender, location}`；需要时传 `current_year`。
- 该工具不接收 `route` 参数，分析类型由引擎根据问题判断，不要自行构造。

## 第 3 步：按顺序解读

按统一外层的字段读，次序固定：

1. 四柱排盘（`chart`）：四柱、藏干、十神、神煞、起运与大运列。`input.solar_time` 有值时说明已做真太阳时校正。
2. 日主强弱与格局（`judgments.strong_weak`、`judgments.geju`、`judgments.geju_info`）。
3. 喜用忌神（`judgments.five_shens` 的 `yong`、`xi`、`ji`，以及 `favorable_gods`、`unfavorable_gods`）。
4. 十神配置与性格。
5. 针对所问之事（仅 `mode: "question"`，`judgments.question` 段）：
   - `target_spec`：这件事看哪个十神、哪个落点。
   - `state_report`：原局对这件事的状态。
   - `dynamic_report`：当前大运流年的引动机制。
   - `timing_candidates`：应期候选年，只能从中挑，并解释"为什么是这几年"，不得自行推新年份。
6. 用户提供过往已发生事件时，对照 `timing_candidates` 与大运节点做校验。
7. 总结：核心特点、最需要注意的风险、最值得把握的方向、关键年份。

遇到 `judgments.question.engine_ran === false`：引擎没有定出这件事的目标元素。此时依静态 `judgments` 做结构推断，并在措辞上明确标注"这是基于命局结构的推断"。

## 口径

- `conventions.zi_hour` 为"夜子时算当日"：23:00–00:00 出生的人，日柱算当日。用户出生在子时附近时说明这一口径。
- 公历为唯一输入口径。
- `warnings` 与 `limitations` 按通用守则转告。
