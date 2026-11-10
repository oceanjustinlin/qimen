# 西洋星盘解读流程

本流程配合 `astro` 工具使用。在 MCP 客户端中调用 `astro` 工具；在 Agent Skill 环境中运行 `node scripts/astro_cli.cjs`，参数与输出字段相同。两种方式都禁止心算替代：行星度数、星座、宫位、上升天顶、相位一律来自工具结果。目前只支持本命盘（`mode: "chart"`），不做行运、推运、合盘。

## 第 1 步：访谈

信息不全不排盘。先问清：

1. 公历出生日期；农历先换算成公历（MCP 用 `calendar` 工具的 `action: "convert"`）。
2. 出生时间，必须到分钟，并且是出生地当时的钟表时间。西洋星盘不做真太阳时，不要把八字用的真太阳时传进来。时间未知时不排盘（工具返回 `TIME_REQUIRED`），可改为只讲太阳星座的一般含义并说明局限。
3. 出生地。宫位和上升点需要纬度。国内城市传 `birth.location.place`；海外城市或地名库查不到时，传 `latitude`、`longitude` 和 IANA 时区 `timezone`（如 `America/New_York`）。
4. 想看什么：整体性格、某个生活领域（对应宫位），还是某组相位。

西洋星盘不需要性别。

## 第 2 步：调用 `astro` 工具

- 默认口径：回归黄道、Placidus 宫制、平均交点、标准容许度。用户明确要求时才改 `options.house_system`（`whole_sign`、`equal`）、`options.node`（`true`）或 `options.orbs`（`tight`）。
- 出生地有歧义时（`PLACE_AMBIGUOUS`），把候选列给用户确认，再把候选标签原样作为 `place` 传回。
- 输出带 `已精简输出` 的 warning 时（MCP 默认 `detail: "summary"`），容许度大于 5° 的宽相位只给计数（`chart.aspects_omitted`）；需要时带 `detail: "full"` 重新调用。

## 第 3 步：按读盘次序解读

`judgments` 目前为空：引擎不给断语，只给盘面事实。所有象义都属于"传统占星象义"，措辞要标明是按传统看法，不得写成引擎结论。次序固定：

1. 定盘：先复述 `input.local`、`input.timezone`、`input.utc` 与出生地，让用户核对时间换算。
2. 三要素：太阳、月亮所在星座与宫位，上升星座（`chart.angles.asc`）。
3. 命主星：`chart.derived.chart_ruler`（上升星座的传统守护星）所在星座与宫位。
4. 个人行星（水、金、火）与社会行星（木、土）：星座、宫位、`dignity`（入庙、擢升、失势、落陷）、`retrograde`。
5. 主相位：从容许度最小的开始讲（`chart.aspects` 已按 `orb` 升序），`applying` 为入相位；外行星之间的相位是同代人共有的，不要当作个人特质重点讲。
6. 整体分布：`chart.distribution` 的元素、模式、半球；`chart.derived` 的日夜盘与星群（`stelliums`）。
7. 综合：结论、课题与建议；张力相位（刑、冲）转成课题，不说成凶兆。

## 口径

- `conventions.time_basis`：当地钟表时间按 IANA 时区换算为 UTC，不做真太阳时。与八字、紫微同看一个人时要点明：东方体系用真太阳时，西洋星盘用法定时间。
- `warnings` 里若提到夏令时切换造成的时刻不存在或重复、或高纬度 Placidus 无解改用整宫制，必须转述，并说明对上升点和宫位的影响。
- `limitations` 第二条（出生时间每差约 4 分钟，上升点移动约 1°）要告诉用户；出生时间只精确到半小时或整点时，宫位和上升结论要保守。
- 星座日期边界附近（太阳在某星座 0° 或 29° 附近）出生的人，以工具结果为准，不要按"大众星座日期表"改写。
