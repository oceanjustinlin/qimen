---
name: astro
description: >
  西洋占星本命盘（星盘）排盘与解读技能。当用户提到星盘、本命盘、西洋占星、星座、
  太阳月亮上升、行星落座落宫、宫位、相位（合、冲、刑、拱、六合）、水逆、命主星等内容时触发。
  本技能用项目引擎（astronomy-engine）做确定性排盘，再由你负责解读，绝不心算行星位置。
compatibility: Requires Node.js 22.12+ and repo deps (astronomy-engine). Run scripts/astro_cli.cjs from repo root.
---

# 西洋星盘技能

> 核心红线：行星度数、星座、宫位、上升天顶、相位一律来自 `scripts/astro_cli.cjs`。
> 你只负责访谈与解读，不心算、不凭记忆补全、不按“大众星座日期表”改写结果。

## 调用

在仓库根目录运行（输入与 MCP `astro` 工具相同）：

```bash
echo '{"birth":{"date":"1990-05-17","time":"10:20","location":{"place":"杭州"}}}' | node scripts/astro_cli.cjs
node scripts/astro_cli.cjs --date 1990-05-17 --time 10:20 --place 杭州
node scripts/astro_cli.cjs --date 1990-05-17 --time 10:20 --lat 40.71 --lng -74.01 --tz America/New_York
```

可选：`options.house_system`（`placidus` 默认 | `whole_sign` | `equal`）、`options.node`（`mean` 默认 | `true`）、
`options.orbs`（`standard` 默认 | `tight`）。目前只有 `mode: "chart"`（本命盘）。

失败时输出 `{ok:false, code, message, hint}`，按 `hint` 追问用户，不要心算替代：
`TIME_REQUIRED`（缺出生时间）、`LOCATION_REQUIRED`（缺出生地或时区）、`PLACE_AMBIGUOUS`（地名有多个候选）、
`TIMEZONE_INVALID`、`HOUSE_SYSTEM_UNSUPPORTED`、`OPTION_INVALID`、`DATE_OUT_OF_RANGE`（只支持 1800–2200 年）。

## 访谈、读盘次序与措辞

完整守则与 MCP prompt `astro_reading` 共用同一份正文，按顺序阅读并遵守：

1. `packages/xuanxue-mcp/prompts/common.md`（通用守则：只翻译不判断、如实转述 limitations/warnings、安全措辞）
2. `packages/xuanxue-mcp/prompts/astro_reading.md`（访谈、调用、读盘次序、口径）

要点：出生时间是当地钟表时间（不做真太阳时）；宫位与上升需要出生地；`judgments` 为空，所有象义都要标明是“按传统占星看法”。
