# Changelog

## 未发布

- 新增 `astro` 工具（西洋占星本命盘）与 `astro_reading` prompt：行星落座落宫与逆行、上升天顶、Placidus / 整宫制 / 等宫制宫位、主相位、元素模式分布、日夜盘与命主星。出生地需能定出纬度与时区，时间按 IANA 时区换算为 UTC（不做真太阳时）。新增依赖 `astronomy-engine`（MIT）。

## 0.1.0

首个版本：以 stdio MCP server 形式提供 `bazi`、`ziwei`、`qimen`、`calendar` 四个工具和 `bazi_reading`、`ziwei_reading`、`qimen_reading` 三个 prompt。

行为变更与限制（相对仓库中原有 CLI）：

- **时辰必填**：缺失出生时间返回 `TIME_REQUIRED`。旧行为是默认 12 点。
- **v1 只支持中国（含港澳台）出生地**：海外地名返回 `PLACE_UNSUPPORTED`，需自行换算真太阳时后以 `time_basis: "true_solar"` 传入。
- **子时口径差异**：八字夜子时算当日，紫微晚子时算次日，23:00–24:00 出生者两套体系相差一天（仅标注，未统一）。
- 夏令时：以地名给出大陆出生地时自动扣除 1986–1991 年中国大陆夏令时；港澳台出生地不套用大陆夏令时，其自身历史夏令时未校正（`warnings` 中注明）。只传经度时一律按大陆规则处理。
- 工具结果为紧凑 JSON；`bazi`、`ziwei`、`qimen` 新增 `detail` 参数，默认 `summary` 精简大块字段以适配 Claude Code 的 `MAX_MCP_OUTPUT_TOKENS`（默认 25000），`full` 返回完整外层。
- 紫微 evidence 不附古籍原文，只带规则 id、摘录标题、页码、章节。
