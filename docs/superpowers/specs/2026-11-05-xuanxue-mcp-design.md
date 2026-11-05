# xuanxue-mcp 设计文档

- 日期：2026-11-05
- 状态：待审阅
- 分支：`claude/elegant-goldberg-35dz5i`

## 1. 背景与目标

### 1.1 目标与受众（已与需求方确认）

- **目的**：先自用，同时开源。
- **第一受众**：作者本人。希望在任意 AI 客户端（Claude Code、Claude Desktop、Codex、Cursor）里直接调用本仓库的八字、紫微、奇门三套确定性引擎。
- **第二受众**：在 AI 客户端里玩命理的中文用户，以及做命理类应用的开发者。
- **核心卖点**：AI 不心算排盘。盘面、规则判断、证据和置信度都由确定性引擎给出，调用方 AI 只负责访谈和解读。

### 1.2 成功标准

1. 在 Claude Code 里说"帮我起一局奇门，看下周面试"，能触发奇门技能，跑通 `qimen_cli`，产出报告。
2. 三个 CLI 输出统一结构；传入出生地后能换算真太阳时。
3. 在干净的机器上用 `npx -y xuanxue-mcp` 接入 Claude Desktop，三套体系都能问出结果。

### 1.3 现状（调研结论）

- 三套引擎都在本仓库 `lib/` 中，都是 Node 写的。核心依赖只有 `lunar-javascript`、`iztro`、`ajv`、`yaml`，不依赖 Vue、Supabase 或 worker。
- 八字：`scripts/bazi_cli.cjs` 是 `lib/baziCore` 和 `lib/baziQuestionCore` 的薄封装，有 parity 测试。
- 紫微：`scripts/ziwei_skill_cli.cjs` 基于 iztro 排盘，加上 `knowledge/ziwei` 的证据包。
- 奇门：生产环境唯一入口是 `lib/qimenPipeline.js` 的 `buildQimenEvidence()`（worker 在 `worker/src/index.js` 中引用），一次完成起盘、用神、格局、评分和应期。
- **奇门技能是坏的**：`docs/skills/qimen-dunjia/SKILL.md` 调用的 `scripts/qimen_cli.py`、`route_question.py`、`evaluate_chart.py`、`scan_timing.py` 在所有分支的历史里都不存在；文档里写的规则集 `mainline-cn-v1` 与引擎实际使用的 `dunjia-yanyi-siku-v1` 不一致；该技能也没有注册到 `.claude/skills/`。README 三种语言版本都写着"奇门内核是 Python"，与事实不符。
- 两个现有 CLI 的输入格式不一致：八字用 `{calendar, year, month, day, hour, minute, gender}`，缺时辰时默默按 12 点算；紫微用 `{date, time, gender, time_basis}`。
- 两个 CLI 都没有做真太阳时换算。网页端在前端完成这一步：`src/utils/birthplaceSearch.mjs` 搜索 `src/data/birthplaces.mjs`（3185 条，约 1.1MB，只有经纬度没有时区），`src/utils/baziProfileInput.mjs` 的 `getSolarTimeAdjustment()` 计算「中国大陆 1986–1991 夏令时 + 经度时差 + 均时差」。
- **网页端海外出生地换算有 bug**：经度时差固定以东经 120° 为标准经线，海外当地时间被当作北京时间（纽约 1990-05-01 14:00 被调成 01:07）。中国境内结果正确。该 bug 另立任务修复，不在本项目范围。
- 子时口径不一致：八字是"夜子时算当日"（lunar-javascript 默认 sect=2），紫微是"晚子时算次日"。
- 紫微引擎运行时会读取 `knowledge/ziwei/sources/*/excerpts.jsonl`，用其中的 `ocr_status` 判断依据是否已校验。这些文件含书页原文，其中《命理天机》（周德元著，现代出版物）在 catalog 中标注为 `usage: internal-research`。

## 2. 范围

### 2.1 做

分三个阶段，每个阶段都能单独交付、单独使用：

1. **修复奇门技能**：新建 `scripts/qimen_cli.cjs`；重写 SKILL.md 并注册；修正 README。
2. **统一契约 + 真太阳时**：三个 CLI 共用 `birth` 结构和输出外层；新增 `calendar` 能力。
3. **MCP 打包发布**：`packages/xuanxue-mcp`，包含 4 个工具和 3 个 prompt，发布到 npm。

### 2.2 不做（YAGNI）

- 奇门 `timing` 模式（多时辰择时扫描）：仓库里没有现成逻辑，要写新规则。
- `divine` 自动路由入口：以后可以在现有工具之上再加。
- HTTP/SSE 传输、server 内部调用 LLM、缓存、用户档案存储。
- 统一八字和紫微的子时口径（只做标注）。
- 处理 GitHub 仓库中已有的古籍原文文件。
- 农历输入（v1 只接受公历）。
- 海外出生地的真太阳时换算（v1 只支持中国大陆和港澳台；修复网页端 bug 后再放开）。

## 3. 架构

```
lib/  knowledge/            ← 现有生产引擎（不改，或只做最小改动）
  ↑
scripts/*_cli.cjs          ← 薄封装：每个文件导出 run(input)，CLI 入口只负责解析参数和打印结果
  ↑                           bazi_cli、ziwei_skill_cli 改造；qimen_cli 新建；calendar 新建
packages/xuanxue-mcp/      ← MCP server（stdio）
  ├─ src/server.mjs           注册工具和 prompt
  ├─ src/tools/*.mjs          bazi / ziwei / qimen / calendar
  ├─ prompts/*.md             三套解读守则（SKILL.md 共用同一份内容）
  ├─ scripts/prepack.mjs      复制引擎文件，生成去正文的 excerpts
  └─ engine/                  prepack 产物，加入 .gitignore
```

**关键原则**：CLI 和 MCP 调用同一个 `run(input)`。技能和 MCP 的输出因此一定一致，契约测试只测 `run()` 这一层。MCP 进程内直接 `require`，不起子进程。

## 4. 数据契约

### 4.1 `birth`（八字、紫微共用；奇门可选）

```jsonc
{
  "date": "1990-05-01",          // 必填，公历 YYYY-MM-DD
  "time": "14:00",               // 必填，HH:mm；缺失时报 TIME_REQUIRED，不再默认 12 点
  "gender": "男",                // 必填，男 | 女
  "location": { "place": "杭州" }, // 选填；也可写 { "longitude": 120.16 }，两者都给时以 longitude 为准
  "time_basis": "clock"          // 选填，默认 clock（钟表时间）；true_solar 表示已是真太阳时
}
```

真太阳时规则：换算直接复用 `src/utils/baziProfileInput.mjs` 的 `getSolarTimeAdjustment()`（mode `apparent`），不另写一份。v1 只接受 `country` 为「中国」的出生地（含港澳台，三地标准时间同为 UTC+8；港台历史夏令时不处理，在 `warnings` 中注明）；海外地名返回 `PLACE_UNSUPPORTED`，`hint` 提示用户自行换算后用 `time_basis: true_solar` 传入。直接传 `longitude` 时视为中国境内，经度不在东经 73°–135° 范围内同样返回 `PLACE_UNSUPPORTED`。当 `location` 存在且 `time_basis = clock` 时，先换算成真太阳时再排盘，`input.solar_time` 记录原始时间、经度、经度时差、均时差和换算后的时间。没有 `location` 时按钟表时间排盘，并在 `warnings` 中写明"未做真太阳时校正"。

兼容性：CLI 层继续接受旧输入格式（八字的 `year/month/day/hour/minute`，以及现有的 flags），先转换成新的 `birth` 再处理。旧格式缺 `hour` 时同样报 `TIME_REQUIRED`。这是有意的行为变更，会写进 CHANGELOG。

### 4.2 工具输入

| 工具 | 参数 |
|---|---|
| `bazi` | `birth`；`mode: "chart" \| "question"`；`question?`（question 模式必填）；`current_year?` |
| `ziwei` | `birth`；`mode: "chart" \| "evidence"`；`topic?: overall \| career \| wealth \| relationship`；`time_scope?`（沿用现有结构，一次最多 10 个流年） |
| `qimen` | `mode: "chart" \| "question"`；`question?`（question 模式必填）；`cast_time?`（ISO 时间，默认当前时刻）；`timezone?`（默认 `Asia/Shanghai`）；`birth?`（选填，作为八字背景传给 `baziInfo`） |
| `calendar` | `action: "convert" \| "true_solar" \| "jieqi"`。convert：公历转农历和四柱；true_solar：`date`、`time` 加 `location`；jieqi：给定年份，或给定日期查前后节气交接时刻 |

### 4.3 统一输出外层

```jsonc
{
  "ok": true,
  "system": "bazi | ziwei | qimen | calendar",
  "mode": "...",
  "engine_version": "...",
  "ruleset": "...",                 // 奇门为 dunjia-yanyi-siku-v1
  "input": { },                     // 规范化后的输入，含 solar_time 换算过程
  "conventions": {                  // 口径声明
    "zi_hour": "夜子时算当日 | 晚子时算次日",
    "timezone": "Asia/Shanghai",
    "qimen_method": "时家转盘 · 拆补法 · 中宫寄坤"
  },
  "chart": { },                     // 盘面事实
  "judgments": { },                 // 引擎结论：旺衰、喜忌、格局、用神、应期、评分等
  "evidence": [ ],                  // 规则命中和出处：{ rule_id, source_id?, title?, printed_page?, section? }，不含原文
  "confidence": "high | medium | low",
  "limitations": [ ],               // 调用方必须如实转述
  "warnings": [ ]
}
```

各体系现有输出字段映射到 `chart`、`judgments`、`evidence`，具体映射在实现计划里逐字段列出；原字段不丢失（由 parity 测试保证）。

### 4.4 错误

```jsonc
{ "ok": false, "code": "TIME_REQUIRED", "message": "...", "hint": "请向用户询问出生时辰（精确到分钟）" }
```

- 沿用现有错误码：`NO_INPUT`、`BAD_JSON`、`BIRTH_INCOMPLETE`、`CALENDAR_UNSUPPORTED`、`QUESTION_REQUIRED`、`TOPIC_UNSUPPORTED`、`TIME_SCOPE_INVALID`、`TIME_SCOPE_TOO_WIDE`。
- 新增：`TIME_REQUIRED`、`PLACE_NOT_FOUND`、`PLACE_UNSUPPORTED`、`PLACE_AMBIGUOUS`（`hint` 中列出前 5 个候选及其经度）、`ENGINE_ERROR`（非预期异常，只带引擎版本和输入摘要，不暴露堆栈）。
- MCP 层把错误结果标记为 `isError: true`，正文内容不变。
- 低置信不算错误：返回 `ok: true`、`confidence: "low"`，并在 `limitations` 中写明原因。

## 5. 第 1 阶段：修复奇门技能

1. 新建 `scripts/qimen_cli.cjs`：导出 `run(input)`，内部调用 `buildQimenEvidence({ year, month, day, hour, minute, question, baziInfo })`。默认起局时间为当前时刻，时区 `Asia/Shanghai`；接口风格与 `bazi_cli.cjs` 一致（stdin JSON、`--file`、便捷 flags）。
2. 重写 `docs/skills/qimen-dunjia/SKILL.md`：所有命令改为调用 `node scripts/qimen_cli.cjs`；删掉不存在的 Python 脚本；规则集改为 `dunjia-yanyi-siku-v1`；保留现有"四条底线"、报告落盘和九宫格渲染要求，删掉依赖 timing 扫描的段落。
3. 注册：放到 `.claude/skills/qimen-dunjia/` 和 `.agents/skills/qimen-dunjia/`，与 bazi、ziwei 的放法一致。
4. 修正 `README.md`、`docs/readme/README.en.md`、`docs/readme/README.zh-TW.md` 中奇门内核的描述和技能链接。

这一阶段输出沿用引擎原始结构，统一外层在第 2 阶段完成。

## 6. 第 2 阶段：统一契约与真太阳时

1. 新建 `lib/birthInput.cjs`：解析 `birth`、兼容旧格式、校验字段、做真太阳时换算。通过 Node 22 的 `require(esm)` 直接加载 `src/utils/birthplaceSearch.mjs` 和 `src/utils/baziProfileInput.mjs`，网页端和 CLI 共用一份代码（已验证 Node 22.23 可行；`package.json` 声明 `engines.node >= 22.12`）。
2. 新建 `scripts/calendar_cli.cjs`，提供 convert、true_solar、jieqi 三个 action。
3. `bazi_cli`、`ziwei_skill_cli`、`qimen_cli` 改为通过 `birthInput` 读取输入，并套上第 4.3 节的输出外层。
4. 用 JSON Schema（ajv）定义输出外层：`schemas/xuanxue-output.schema.json`。
5. 更新 bazi、ziwei、qimen 三份 SKILL.md 中的输入输出示例。

## 7. 第 3 阶段：MCP 打包发布

### 7.1 Server

- 依赖 `@modelcontextprotocol/sdk` 和 zod，代码用 ESM 写，通过 `createRequire` 加载 CJS 引擎。
- 每个工具：用 zod 校验参数 → 调用 `run()` → 返回 `content`（JSON 文本）和 `structuredContent`。
- 工具描述用中英双语，写明适用场景，帮助调用方 AI 区分三套体系：奇门看具体事件、时机和方位；八字看命局结构、性格和大运流年；紫微看十二宫、四化和大限流年。
- 全部在本地计算：不联网，不需要 API Key，不保存任何输入。

### 7.2 Prompts

- `bazi_reading`、`ziwei_reading`、`qimen_reading` 三个 prompt，内容为"访谈 → 调用工具 → 解读"的流程，加上通用底线：盘面事实只能引用工具结果；`limitations` 必须如实转述；遵守 `knowledge/ziwei/policies/safety.yaml` 推广后的通用安全规则（不说"注定"等定命式表述，健康、法律、财务问题提醒咨询专业人士）。
- 正文放在 `packages/xuanxue-mcp/prompts/*.md`，SKILL.md 引用同一份文件，不维护两份。

### 7.3 打包

- 包名：`xuanxue-mcp`（2026-11-05 查询 npm 返回 404，名称可用；发布前再确认一次）。入口：`bin: { "xuanxue-mcp": "src/server.mjs" }`。
- 引擎按 `__dirname` 的相对路径读取知识库，所以不打成单个 bundle。`prepack.mjs` 把以下文件按原目录关系复制到 `packages/xuanxue-mcp/engine/`：
  - `lib/` 中引擎运行需要的文件
  - `scripts/` 下四个 `*_cli.cjs` 及其依赖的脚本
  - `knowledge/ziwei/` 中运行时需要的部分（规则、释义、本体、schemas、policies、catalog）
  - `src/data/birthplaces.mjs`（如果第 2 阶段已经移到 `lib/`，就复制新位置的文件）
- **不发布原文**：`sources/*/excerpts.jsonl` 复制时删除 `ocr_text`、`corrected_text`、`correction_notes` 三个字段，保留 `id`、`source_id`、`title`、`pdf_page`、`printed_page`、`section`、`ocr_status` 等元数据。
- `package.json` 的 `files` 字段只列 `src/`、`engine/`、`prompts/`、`README.md`、`LICENSE`。
- MIT 许可；README 中注明第三方来源：iztro、lunar-javascript（MIT），出生地经纬度数据来自 sfyc23/China-zip-code-latitude-and-longitude（MIT）。

### 7.4 README

包括：一句话定位、隐私承诺、四个客户端（Claude Code、Claude Desktop、Codex、Cursor）的配置片段、工具与 prompt 列表、输出结构说明、口径声明（子时、真太阳时、奇门定局法）、免责声明。

## 8. 测试

全部纳入 `npm test`：

1. **奇门 parity**：`qimen_cli.run()` 与直接调用 `buildQimenEvidence` 的结果逐字段一致。
2. **契约**：三个 `run()` 的输出都通过 `xuanxue-output.schema.json` 校验；旧输入格式转换后，结果与改造前一致（复用并扩展 `bazi_cli.test.cjs`、`ziwei_skill_cli.test.cjs`）。
3. **真太阳时**：用乌鲁木齐、杭州等已知经度的城市验证换算结果；覆盖换算后跨时辰、跨子时、跨日的边界情况；覆盖 `PLACE_AMBIGUOUS` 和 `PLACE_NOT_FOUND`。
4. **MCP 端到端**：用 SDK client 通过 stdio 启动 server，`listTools` 应返回 4 个工具、`listPrompts` 应返回 3 个 prompt；每个工具各跑一个正常用例和一个错误用例。
5. **打包**：`npm pack` 后解压到临时目录启动，调用一次紫微 `evidence`。断言包里所有 excerpts 都不含三个正文字段，且输出为 `ok: true`。
6. **回归**：现有 `npm test`、`npm run test:ziwei-knowledge`、`eval/bazi-skill` 全部保持通过。

## 9. 风险

| 风险 | 应对 |
|---|---|
| 紫微证据输出依赖 excerpts 正文字段 | 打包测试覆盖；如有依赖，改为输出时可选附带正文，npm 版本不附带 |
| birthplaces 数据和换算函数是 ESM，引擎是 CJS | 用 `require(esm)`，要求 Node ≥ 22.12 |
| 网页端修复海外 bug 时改动 `getSolarTimeAdjustment()` 签名 | MCP 契约测试覆盖中国城市换算结果，签名变化会被测试发现 |
| 时辰改为必填，属于行为变更 | 写进 CHANGELOG；SKILL.md 访谈流程本来就要求问时辰 |
| npm 包名在发布前被占用 | 备选 `@oceanjustinlin/xuanxue-mcp` |
| 规则持续审计修订，MCP 版本跟不上 | 输出中带 `engine_version` 和 `ruleset`；修订规则后发 patch 版本 |
