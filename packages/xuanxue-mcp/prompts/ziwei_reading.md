# 紫微斗数解读流程

本流程配合 `ziwei` 工具使用。在 MCP 客户端中调用 `ziwei` 工具；在 Agent Skill 环境中运行 SKILL.md 给出的 CLI 命令（`node scripts/ziwei_skill_cli.cjs`），参数与输出字段相同。两种方式都禁止心算替代。排盘口径唯一：`iztro-default`，公历输入。

## 第 1 步：访谈

信息不全不排盘。先问清：

1. 公历出生日期；农历先换算并说明（MCP 用 `calendar` 工具（`action: "convert"`），Skill 环境用 `node scripts/calendar_cli.cjs`）。
2. 出生时间，必须到分钟。命宫由时辰决定，时辰错则全盘错；不知道时辰时不排盘，可改为理论讲解或建议改看八字。出生时间离时辰交界不足 15 分钟时，提醒命盘可能落在相邻时辰，必要时两盘对照。
3. 这个时间是钟表时间还是已换算的真太阳时（后者在 `birth.time_basis` 传 `true_solar`）；有出生地则传 `birth.location`，引擎会自动换算真太阳时。
4. 性别，影响大限顺逆。
5. 要看什么事；时间范围（只看命盘、当前大限、某几年流年）；最想判断什么。
6. 用户想要直接结论还是详细讲解。

## 第 2 步：调用 `ziwei` 工具

主题与时间维度分开判断，并显式传入：

- `topic`：`overall`（整体、性格、人生主线）、`career`（事业）、`wealth`（财运）、`relationship`（婚恋）。健康、子女、学业等没有单列主题，归入最接近的一项，并在解读里直接读对应宫位，按结构推断标注；健康只做结构提醒，不做诊断。
- `time_scope.type`：`natal`（只看命盘）、`decadal`（某个十年大限，传 `start_year`）、`yearly`（某一年，`start_year` 等于 `end_year`）、`cross_period`（几年间的变化，传 `start_year` 与 `end_year`，最多 10 年）。
- `mode`：`chart` 只要盘面与运限事实；`evidence` 额外返回 `judgments` 与 `evidence`。给了 `topic` 或 `time_scope` 时用 `evidence`。
- "今年整体运势" 即 `topic: "overall"` 加 `time_scope: {type: "yearly", start_year: 今年, end_year: 今年}`。
- 输出较大，按需读取字段，不要整段转述。

同一张盘追问新年份或新主题，只改 `topic` 与 `time_scope` 重新调用；命盘部分应与上次一致，不一致说明出生信息变了，先和用户确认。

## 第 3 步：按读盘次序解读

静态先于动态，没讲清本命底色，不得直接下运限结论。次序固定：

1. 定盘（`chart`）：五行局、命主身主、命宫与身宫位置、生年四化落宫。
2. 主题宫本体：主星组合与亮度、辅星煞星；空宫借对宫时标明借星。
3. 三方四正：本宫加对宫和两个三合宫，再看左右邻宫的夹。
4. 四化：生年四化先讲，宫干飞化后讲；化忌所在与所冲之宫必须讲。
5. 把 `judgments.topic_report.conclusions` 与 `judgments.annual_overviews[].report.conclusions` 的已审核命题放进上面的结构里讲，不孤立罗列。
6. 运限（如有）：大限命宫落本命哪宫、流年命宫落哪宫、大限与流年四化落入本命哪宫、是否进入主题宫三方四正；与本命底色比较是增强、削弱、转向还是冲突。
7. 综合：结论、风险、建议与限制；支撑条件与压力条件并列，压力不省略。

## 证据分级

- A 级，已审核命题：`judgments.topic_report.conclusions` 与 `judgments.annual_overviews[].report.conclusions`，可作为结论主干，直接陈述。
- B 级，确定性事实：`chart`（含 `chart.natal_features`、`chart.periods`）与方法状态已审核的派生特征，可直接引用。
- 输出带 `已精简输出` 的 warning 时（MCP 工具默认 `detail: "summary"`），`chart.natal_features` 换成按宫位的 `chart.natal_features_summary`，`chart.periods[].dynamic_features` 换成 `dynamic_features_summary`；各特征的方法审核状态看 `natal_features_summary.methods`。需要逐条特征及其来源路径时，带 `detail: "full"` 重新调用。
- C 级，结构推断：方法状态为待审的特征（亮度分组、三方会照聚合、夹宫、宫干飞化、空宫借星、四化叠加）与古籍象义，措辞必须标明"按传统看法"或"从结构上看"，且不得压过 A、B 级。

三合派判断为主，四化飞星只作补充，两者冲突时并列说明，不静默合并。若未命中任何已审核命题，要在局限里说明。

## 口径

- `conventions.zi_hour` 为"晚子时算次日"：23:00–24:00 出生的人按次日排盘，早子时（00:00–01:00）按当日。出生在子时时说明这一口径。
- 流年按农历年计（约春节起），跨年初的事说明边界。
- `warnings` 里若有使用未换算时间的提醒（如 `ZIWEI_USING_UNADJUSTED_PROFILE_TIME`），解读时提一句即可，并转述其对时辰的影响。
