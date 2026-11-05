# xuanxue-mcp

**English summary.** `xuanxue-mcp` is a stdio MCP server that exposes deterministic Chinese metaphysics engines (Bazi / Four Pillars, Zi Wei Dou Shu, Qimen Dunjia, plus a calendar toolkit) to any MCP client. The AI never computes a chart in its head: charts, rule hits, evidence and confidence all come from the engine; the AI only interviews and interprets. Everything runs locally: no network, no API key, no input is stored. Requires Node >= 22.12. Output is a structured reference, not medical, legal, financial or life-critical advice.

## 定位

把八字、紫微斗数、奇门遁甲三套确定性排盘引擎（外加历法工具）接入任意支持 MCP 的 AI 客户端。**AI 不心算排盘**：盘面、规则判断、证据和置信度都由引擎给出，调用方 AI 只负责访谈和解读。

## 隐私承诺

全部在本地计算：不联网、不需要 API Key、不保存任何输入。

## 安装与配置

需要 Node >= 22.12。下面所有配置都通过 `npx -y xuanxue-mcp` 启动 server（stdio 传输）。

### Claude Code

```bash
claude mcp add xuanxue -- npx -y xuanxue-mcp
```

### Claude Desktop / Cursor

在 `claude_desktop_config.json`（Claude Desktop）或 Cursor 的 MCP 配置中加入：

```json
{
  "mcpServers": {
    "xuanxue": {
      "command": "npx",
      "args": ["-y", "xuanxue-mcp"]
    }
  }
}
```

### Codex

在 `~/.codex/config.toml` 中加入：

```toml
[mcp_servers.xuanxue]
command = "npx"
args = ["-y", "xuanxue-mcp"]
```

## 工具

| 工具 | 适用场景 | 主要参数 |
| --- | --- | --- |
| `bazi` | 命局结构、性格禀赋、旺衰喜忌、大运流年、问事应期 | `birth`；`mode`: `chart` \| `question`；`question`（question 模式必填）；`current_year` |
| `ziwei` | 十二宫、主星、四化、大限流年 | `birth`；`mode`: `chart` \| `evidence`；`topic`: `overall` \| `career` \| `wealth` \| `relationship`；`time_scope`（一次最多 10 个流年） |
| `qimen` | 具体事件的成败、时机、方位；不需要生辰 | `mode`: `chart` \| `question`；`question`；`cast_time`（ISO 时间，默认当前时刻）；`timezone`（默认 `Asia/Shanghai`）；`birth`（选填，仅作背景，奇门本身的判断不使用它） |
| `calendar` | 公历转农历与四柱、真太阳时换算、节气查询 | `action`: `convert` \| `true_solar` \| `jieqi`，配合 `date`、`time`、`location`、`year` |

`birth` 结构（八字、紫微必填）：

```json
{
  "date": "1990-05-01",
  "time": "14:00",
  "gender": "男",
  "location": { "place": "杭州" },
  "time_basis": "clock"
}
```

- `time` 必填，缺失返回 `TIME_REQUIRED`，不会默认 12 点。
- `location` 可写 `{ "place": "杭州" }` 或 `{ "longitude": 120.16 }`，两者都给时以经度为准。
- 地名解析：可省略“区/县/市”（“海淀”即“海淀区”），可带省份前缀（“浙江杭州”“北京市朝阳区”）。同名地点有多个时返回 `PLACE_AMBIGUOUS` 与候选列表（如“朝阳”有辽宁朝阳市、北京朝阳区、长春朝阳区）；候选的 `label`（如“北京 - 北京市 - 朝阳区”）可原样作为 `place` 传回。
- `time_basis` 默认 `clock`（钟表时间）；`true_solar` 表示传入的已经是真太阳时。
- 仅接受公历。

## Prompts

| Prompt | 内容 |
| --- | --- |
| `bazi_reading` | 八字解读守则：访谈、调用 `bazi`、解读顺序与安全措辞 |
| `ziwei_reading` | 紫微斗数解读守则：访谈、调用 `ziwei`、读盘次序、证据分级与安全措辞 |
| `qimen_reading` | 奇门遁甲解读守则：访谈、调用 `qimen`、用神宫与格局解读及安全措辞 |

## 输出结构

每个工具返回统一外层（同时放在 `content` 的 JSON 文本和 `structuredContent` 中）：

```jsonc
{
  "ok": true,
  "system": "bazi | ziwei | qimen | calendar",
  "mode": "...",
  "engine_version": "...",
  "ruleset": "...",       // 奇门为 dunjia-yanyi-siku-v1
  "input": { },           // 规范化后的输入，含真太阳时换算过程
  "conventions": { },     // 口径声明
  "chart": { },           // 盘面事实
  "judgments": { },       // 引擎结论：旺衰、喜忌、格局、用神、应期、评分等
  "evidence": [ ],        // 规则命中与出处
  "confidence": "high | medium | low",
  "limitations": [ ],     // 调用方必须如实转述
  "warnings": [ ]
}
```

- `evidence` 只带规则 id、摘录标题、页码、章节等出处信息。紫微部分不附古籍原文摘录。
- 低置信不是错误：返回 `ok: true`、`confidence: "low"`，原因写在 `limitations`。
- 失败时返回 `{ "ok": false, "code": "...", "message": "...", "hint": "..." }`，MCP 层同时标记 `isError: true`。常见错误码：`TIME_REQUIRED`、`BIRTH_INCOMPLETE`、`PLACE_NOT_FOUND`、`PLACE_UNSUPPORTED`、`PLACE_AMBIGUOUS`、`QUESTION_REQUIRED`、`TOPIC_UNSUPPORTED`、`TIME_SCOPE_INVALID`、`TIME_SCOPE_TOO_WIDE`、`ENGINE_ERROR`。

## 口径声明

- **子时**：八字夜子时算当日；紫微晚子时算次日。因此 23:00–24:00 出生的人，在两套体系里日柱与命盘所用的日相差一天，这是有意为之，不是 bug。
- **真太阳时**：仅支持中国（含港澳台）出生地，按出生地经度与均时差换算。海外出生地返回 `PLACE_UNSUPPORTED`，请自行换算后以 `time_basis: "true_solar"` 传入。
- **夏令时**：以地名给出大陆出生地时，自动扣除 1986–1991 年中国大陆夏令时；以地名给出港澳台出生地时，不套用大陆夏令时，但港澳台自身的历史夏令时也未校正，会在 `warnings` 中注明。只传经度（`location.longitude`）时无法区分大陆与港澳台，一律按大陆规则处理；港澳台出生者请改传地名。
- **未给出生地**：按钟表时间排盘，并在 `warnings` 中写明未做真太阳时校正。
- **奇门定局**：时家转盘 · 拆补法 · 天禽寄坤，规则集 `dunjia-yanyi-siku-v1`。

## 免责声明

本工具输出的是结构化参考，不构成医疗、法律、财务或人生重大决策建议。

## 第三方来源与许可

本包以 MIT 许可发布（见 `LICENSE`）。

- [iztro](https://github.com/SylarLong/iztro)（MIT）：紫微斗数排盘
- [lunar-javascript](https://github.com/6tail/lunar-javascript)（MIT）：农历与干支历法
- 出生地经纬度数据来自 [sfyc23/China-zip-code-latitude-and-longitude](https://github.com/sfyc23/China-zip-code-latitude-and-longitude)（MIT）

## 来源

本包是 [qimen 仓库](https://github.com/oceanjustinlin/qimen) 中确定性引擎的 MCP 封装。
