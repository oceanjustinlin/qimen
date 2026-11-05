# xuanxue-mcp 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修好奇门技能，统一三套引擎的 CLI 契约（含真太阳时），并把它们打包成可用 `npx -y xuanxue-mcp` 启动的 MCP server。

**Architecture:** 每个 `scripts/*_cli.cjs` 导出同步的 `run(input)`，CLI 入口和 MCP 工具都调用它。`lib/birthInput.cjs` 统一解析出生信息并复用网页端的真太阳时函数；`lib/cliEnvelope.cjs` 统一输出外层和错误。`packages/xuanxue-mcp` 是 npm workspace 子包，开发时直接引用仓库根目录的引擎，发布时由 `prepack` 复制到 `engine/`。

**Tech Stack:** Node ≥ 22.12（CJS 引擎 + `require(esm)`）、`node:test`、ajv、`@modelcontextprotocol/sdk`、zod、lunar-javascript、iztro。

**Spec:** `docs/superpowers/specs/2026-11-05-xuanxue-mcp-design.md`

## Global Constraints

- 所有面向用户的文案、错误 message、hint、SKILL.md、prompt 一律简体中文；代码标识符保持英文。
- 不修改 `lib/` 中现有引擎的计算逻辑；只允许新增文件。
- 奇门规则集：`dunjia-yanyi-siku-v1`（取自 `lib/qimenClassicalRules.js` 的 `QIMEN_RULESET_VERSION`，不要硬编码）。
- 奇门默认时区：`Asia/Shanghai`；默认问题沿用 `buildQimenEvidence` 默认值 `当前局势吉凶如何？`。
- `birth.time` 必填，缺失报 `TIME_REQUIRED`，不再默认 12 点。
- 真太阳时只支持 `country === '中国'`（含港澳台）；直接传经度时只接受东经 73°–135°；其余报 `PLACE_UNSUPPORTED`。
- 紫微 `time_scope` 一次最多 10 个流年；`topic` 只能是 `overall | career | wealth | relationship`。
- npm 包名 `xuanxue-mcp`，MIT；包内 `excerpts.jsonl` 不得含 `ocr_text`、`corrected_text`、`correction_notes`。
- MCP 只用 stdio；不联网，不需要 API Key，不保存输入。
- 不发布到 npm：发布由仓库所有者手动执行（Task 13 只准备好清单）。
- `package.json` 声明 `"engines": { "node": ">=22.12" }`。
- 每个任务结束时 `npm test` 全过；改动 ziwei 相关文件的任务还要跑 `npm run test:ziwei-knowledge`。

## Review Focus

1. **23:00–23:59 出生**：八字按"夜子时算当日"，紫微按"晚子时算次日"，两边日期不同是预期行为；`conventions.zi_hour` 必须如实标注（Task 5、Task 6 有测试）。
2. **同名地名**：`朝阳区` 同时匹配北京和长春，必须返回 `PLACE_AMBIGUOUS` 并列出候选，不能悄悄选第一个；唯一匹配时也要在 `input.solar_time.place_label` 写出匹配到的完整地名（Task 3）。
3. **非法日期时间**：`1990-02-30`、`24:00`、`14:60` 必须报 `BIRTH_INCOMPLETE`，不能被 `Date.UTC` 自动进位成下个月或下一天（Task 3）。
4. **带时区的起局时间**：`cast_time: "2026-11-05T01:00:00Z"` 要换算成北京时间 09:00 起局；不带时区的 ISO 字符串按 `timezone` 参数理解（Task 1）。
5. **夏令时年份**：1986–1991 年中国大陆出生，没传 location 时按钟表时间排盘、不做任何修正（只给 warning）；传了 location 时 `solar_time.daylight_saving_minutes` 必须是 -60（Task 3）。注意这与网页端不同：网页端未勾选真太阳时也会自动减夏令时。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `scripts/qimen_cli.cjs` | 新建。奇门 `run(input)` + CLI 入口 |
| `scripts/qimen_cli.test.cjs` | 新建。parity + 起局时间测试 |
| `.claude/skills/qimen-dunjia/SKILL.md`、`.agents/skills/qimen-dunjia/SKILL.md` | 新建（两份内容相同），取代 `docs/skills/qimen-dunjia/SKILL.md` |
| `lib/birthInput.cjs` + `.test.cjs` | 新建。`parseBirth`、旧格式兼容、真太阳时、地名解析 |
| `lib/cliEnvelope.cjs` + `.test.cjs` | 新建。`ok()`、`fail()`、`toFailure()`、错误码与 hint 表 |
| `schemas/xuanxue-output.schema.json` | 新建。统一输出外层的 JSON Schema |
| `scripts/calendar_cli.cjs` + `.test.cjs` | 新建。convert / true_solar / jieqi |
| `scripts/bazi_cli.cjs`、`scripts/ziwei_skill_cli.cjs` | 修改。接入 birthInput 与 envelope，导出 `run` |
| `packages/xuanxue-mcp/` | 新建。MCP server、工具、prompts、prepack、测试 |
| 根 `package.json` | 修改。`workspaces`、`engines`、`test` 脚本加入新测试路径 |

`package.json` 的 `test` 脚本当前为 `node --test lib/*.test.js scripts/*.test.cjs src/**/*.test.mjs`。Task 3 起改为 `node --test lib/*.test.js lib/*.test.cjs scripts/*.test.cjs src/**/*.test.mjs packages/xuanxue-mcp/test/*.test.mjs`（`packages/...` 部分在 Task 10 才加入）。

---

## 第 1 阶段：修复奇门技能

### Task 1: `scripts/qimen_cli.cjs`

**Files:**
- Create: `scripts/qimen_cli.cjs`
- Test: `scripts/qimen_cli.test.cjs`

**Interfaces:**
- Consumes: `buildQimenEvidence`（`lib/qimenPipeline.js`）；`classifyByRules`（`lib/divinationRouter.js`）；`normalizeDivinationRoute`（`lib/divinationCategories.js`）；`QIMEN_RULESET_VERSION`（`lib/qimenClassicalRules.js`）。
- Produces:
  - `resolveCastTime(castTime?: string, timezone = 'Asia/Shanghai', now = new Date()) -> { year, month, day, hour, minute, source: 'now' | 'custom' }`
  - `run(input: { mode?: 'chart' | 'question', question?: string, cast_time?: string, timezone?: string, bazi_info?: string }) -> object`（本任务返回引擎原始结构，见 Step 3；Task 7 再套统一外层）
  - CLI：stdin JSON、`--file`、flags `--mode --question --cast-time --timezone`，输出与 `bazi_cli.cjs` 相同的 `{ ok:false, code, error }` 错误格式，退出码 1。

- [ ] **Step 0: 安装依赖**

Run: `npm ci`
Expected: 成功；如果 lockfile 因 npm 版本被改写，执行 `git checkout -- package-lock.json`，不要提交这类改动。

- [ ] **Step 1: 写失败的测试**

```js
// scripts/qimen_cli.test.cjs
test('run(question) 与直接调用 buildQimenEvidence 结果一致', () => {
  const input = { mode: 'question', question: '下周面试能过吗', cast_time: '2026-11-05T09:30:00+08:00' };
  const intent = normalizeDivinationRoute(classifyByRules(input.question, { forceBranch: 'qimen' }));
  const ref = buildQimenEvidence({ year: 2026, month: 11, day: 5, hour: 9, minute: 30,
    panTimeParts: { year: 2026, month: 11, day: 5, hour: 9, minute: 30 }, question: input.question, intent });
  const out = run(input);
  assert.deepEqual(out.chart.qimenData, ref.qimenData);
  assert.deepEqual(out.judgments.score, ref.backendScoreAudit);
  assert.deepEqual(out.judgments.formations, ref.backendFormationTags);
  assert.deepEqual(out.judgments.timing, ref.timingAnalysis);
  assert.deepEqual(out.judgments.yongshen, ref.yongshenRule);
  assert.equal(out.ruleset, 'dunjia-yanyi-siku-v1');
});
test('resolveCastTime: Z 时间换算为北京时间', () => {
  assert.deepEqual(resolveCastTime('2026-11-05T01:00:00Z'), { year: 2026, month: 11, day: 5, hour: 9, minute: 0, source: 'custom' });
});
test('resolveCastTime: 无时区按 timezone 理解', () => {
  assert.equal(resolveCastTime('2026-11-05T23:10:00', 'Asia/Shanghai').hour, 23);
});
test('resolveCastTime: 缺省取 now 的北京时间', () => {
  const r = resolveCastTime(undefined, 'Asia/Shanghai', new Date('2026-11-05T16:30:00Z'));
  assert.deepEqual([r.day, r.hour, r.minute, r.source], [6, 0, 30, 'now']);
});
test('mode=chart 不需要 question', () => {
  const out = run({ mode: 'chart', cast_time: '2026-11-05T09:30:00+08:00' });
  assert.equal(out.chart.palaces.length, 9);
  assert.equal(out.judgments, undefined);
});
test('mode=question 缺 question → 子进程 ok:false QUESTION_REQUIRED，退出码 1', () => { /* execFileSync，同 bazi_cli.test.cjs 写法 */ });
test('非法 cast_time → CAST_TIME_INVALID', () => {
  assert.throws(() => run({ mode: 'chart', cast_time: 'abc' }), { code: 'CAST_TIME_INVALID' });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test scripts/qimen_cli.test.cjs`
Expected: FAIL，`Cannot find module './qimen_cli.cjs'`

- [ ] **Step 3: 实现 `scripts/qimen_cli.cjs`**

- `resolveCastTime`：用 `Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year/month/day/hour/minute: 'numeric' }).formatToParts()` 取墙上时间。带时区后缀（`Z` 或 `±hh:mm`）的字符串直接 `new Date()`；不带后缀的按 `timezone` 理解（`Asia/Shanghai` 固定 UTC+8，其他时区先用 `Intl` 求偏移）。解析失败抛 `code: 'CAST_TIME_INVALID'`。
- `run`：给定 `cast_time` 时同时把解析结果作为 `panTimeParts` 传入（与 worker 一致，`qimenData.pan_time_source` 为 `custom`）。intent 只走规则路由 `normalizeDivinationRoute(classifyByRules(question, { forceBranch: 'qimen' }))`，不调 LLM。chart 模式也用默认问题跑一次 pipeline，只返回盘面部分。
- 返回结构（本任务）：

```js
{
  ok: true, system: 'qimen', mode, ruleset: QIMEN_RULESET_VERSION,
  input: { cast_time: { year, month, day, hour, minute, source }, timezone, question },
  chart: { qimenData, palaces: ev.timingPalaces, palacesText: ev.palacesText, juResult: ev.juResult,
           xunHead: ev.xunHead, zhiFuStar: ev.zhiFuStar, zhiShiDoor: ev.zhiShiDoor,
           ganzhiDay: ev.ganzhiDay, ganzhiHour: ev.ganzhiHour },
  // 仅 question 模式：
  judgments: { intent: ev.intent, yongshen: ev.yongshenRule, score: ev.backendScoreAudit,
               formations: ev.backendFormationTags, timing: ev.timingAnalysis, polarity: ev.polarityOverrides }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test scripts/qimen_cli.test.cjs && npm test`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/qimen_cli.cjs scripts/qimen_cli.test.cjs
git commit -m "feat(qimen): 新增 qimen_cli.cjs，封装 buildQimenEvidence 供技能调用"
```

### Task 2: 重写并注册奇门技能，修正 README

**Files:**
- Create: `.claude/skills/qimen-dunjia/SKILL.md`、`.agents/skills/qimen-dunjia/SKILL.md`（内容相同）
- Delete: `docs/skills/qimen-dunjia/SKILL.md`（`git mv` 到 `.claude/skills/qimen-dunjia/` 后再改，保留历史）
- Modify: `README.md:40`、`README.md:203`、`docs/readme/README.en.md:32,187`、`docs/readme/README.zh-TW.md:32,183`

**Interfaces:**
- Consumes: Task 1 的 CLI（stdin JSON 与 flags）。
- Produces: 技能名 `qimen-dunjia`，可被 Agent 自动触发。

- [ ] **Step 1: 改写 SKILL.md**

保留：frontmatter 的 `name` 与 `description`、"核心定位"、四条底线、报告落盘 `tmp/qimen-report-{ts}.md`、开头渲染洛书九宫格、`palace_depth_reading`、格局渲染必须带落宫和受影响角色、反填充约束。
修改：
- 规则集改为 `dunjia-yanyi-siku-v1`；定局说明改为"时家转盘 · 拆补法 · 天禽寄坤"。
- 所有 `python scripts/*.py` 命令替换为 `node scripts/qimen_cli.cjs`，给出 chart 和 question 两个调用示例（stdin JSON 写法）。
- 字段引用改为 Task 1 的输出字段（`chart.palaces[i].stem_relation`、`judgments.formations[].palace` 等）。
- 删除依赖 `route_question.py`、`evaluate_chart.py`、`scan_timing.py` 的段落；"择时扫描"改为说明"v1 不支持多时辰择时；应期以 `judgments.timing` 为准"。

- [ ] **Step 2: 校验**

Run: `grep -rnE "\.py\b|mainline-cn-v1" .claude/skills/qimen-dunjia .agents/skills/qimen-dunjia; diff .claude/skills/qimen-dunjia/SKILL.md .agents/skills/qimen-dunjia/SKILL.md && echo same`
Expected: grep 无输出；打印 `same`

- [ ] **Step 3: 手动跑通技能里的两条命令**

Run: SKILL.md 中 chart 与 question 示例命令原样执行
Expected: 两条都输出 `"ok": true`

- [ ] **Step 4: 修正三语 README**

表格中奇门行的计算内核改为 `scripts/qimen_cli.cjs`（时家转盘，Node；英文版 `Node`，繁体版同理），技能定义链接改为 `.claude/skills/qimen-dunjia/SKILL.md`。

Run: `grep -rn "qimen_cli.py\|docs/skills/qimen-dunjia" README.md docs/readme`
Expected: 无输出

- [ ] **Step 5: 提交**

```bash
git add -A .claude/skills/qimen-dunjia .agents/skills/qimen-dunjia docs/skills README.md docs/readme
git commit -m "fix(qimen): 奇门技能改为调用 qimen_cli.cjs 并注册到 skills 目录"
```

---

## 第 2 阶段：统一契约与真太阳时

### Task 3: `lib/birthInput.cjs`

**Files:**
- Create: `lib/birthInput.cjs`
- Test: `lib/birthInput.test.cjs`
- Modify: 根 `package.json`（`engines`、`test` 脚本加 `lib/*.test.cjs`）

**Interfaces:**
- Consumes: `require('../src/utils/baziProfileInput.mjs').getSolarTimeAdjustment`；`require('../src/utils/birthplaceSearch.mjs').searchBirthplaces`（Node 22 `require(esm)`）。
- Produces:
  - `parseBirth(raw: object) -> NormalizedBirth`
  - `NormalizedBirth = { date: 'YYYY-MM-DD', time: 'HH:mm', gender: '男' | '女', time_basis: 'clock' | 'true_solar', clock: {year,month,day,hour,minute}, effective: {year,month,day,hour,minute}, solar_time: SolarTime | null, warnings: string[] }`
  - `SolarTime = { place_label: string | null, longitude: number, daylight_saving_minutes: number, longitude_minutes: number, equation_minutes: number, total_minutes: number, adjusted: 'YYYY-MM-DD HH:mm' }`
  - `resolvePlace(place: string) -> { label, longitude, country, admin1 }`
  - 所有错误抛 `Error` 并带 `code`（`BIRTH_INCOMPLETE`、`TIME_REQUIRED`、`CALENDAR_UNSUPPORTED`、`PLACE_NOT_FOUND`、`PLACE_AMBIGUOUS`、`PLACE_UNSUPPORTED`）；`PLACE_AMBIGUOUS` 额外带 `candidates: [{ label, longitude }]`（最多 5 个）。

- [ ] **Step 1: 写失败的测试**

```js
test('新格式：杭州 1990-05-01 14:00，含 1990 夏令时', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州' } });
  assert.equal(b.solar_time.place_label, '浙江 - 杭州市');
  assert.equal(b.solar_time.daylight_saving_minutes, -60);
  assert.equal(b.solar_time.total_minutes, -56);
  assert.deepEqual(b.effective, { year: 1990, month: 5, day: 1, hour: 13, minute: 4 });
});
test('乌鲁木齐 -187 分钟', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '女', location: { place: '乌鲁木齐' } });
  assert.equal(b.solar_time.total_minutes, -187);
});
test('换算跨日：乌鲁木齐 1990-05-01 01:00 → 前一天', () => {
  assert.equal(parseBirth({ date: '1990-05-01', time: '01:00', gender: '男', location: { place: '乌鲁木齐' } }).effective.day, 30);
});
test('无 location：按钟表时间且给 warning，不做夏令时', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男' });
  assert.equal(b.solar_time, null);
  assert.deepEqual(b.effective, b.clock);
  assert.ok(b.warnings.some((w) => w.includes('未做真太阳时校正')));
});
test('time_basis=true_solar：不再换算', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', time_basis: 'true_solar', location: { place: '杭州' } });
  assert.deepEqual(b.effective, b.clock);
});
test('longitude 优先于 place', () => {
  assert.equal(parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '杭州', longitude: 87.6 } }).solar_time.longitude, 87.6);
});
test('朝阳区 → PLACE_AMBIGUOUS，带北京与长春候选', () => {
  assert.throws(() => resolvePlace('朝阳区'), (e) => e.code === 'PLACE_AMBIGUOUS'
    && e.candidates.some((c) => c.label.includes('北京')) && e.candidates.some((c) => c.label.includes('长春')));
});
test('纽约 → PLACE_UNSUPPORTED；经度 -74 → PLACE_UNSUPPORTED', () => {
  assert.throws(() => resolvePlace('纽约'), { code: 'PLACE_UNSUPPORTED' });
  assert.throws(() => parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { longitude: -74 } }), { code: 'PLACE_UNSUPPORTED' });
});
test('香港可用并带港台夏令时 warning', () => {
  const b = parseBirth({ date: '1990-05-01', time: '14:00', gender: '男', location: { place: '香港' } });
  assert.ok(b.warnings.some((w) => w.includes('夏令时')));
});
test('查无此地 → PLACE_NOT_FOUND', () => { assert.throws(() => resolvePlace('不存在的地方xyz'), { code: 'PLACE_NOT_FOUND' }); });
test('缺 time → TIME_REQUIRED（新旧格式都是）', () => {
  assert.throws(() => parseBirth({ date: '1990-05-01', gender: '男' }), { code: 'TIME_REQUIRED' });
  assert.throws(() => parseBirth({ calendar: 'solar', year: 1990, month: 5, day: 1, gender: '男' }), { code: 'TIME_REQUIRED' });
});
test('非法日期时间 → BIRTH_INCOMPLETE', () => {
  for (const [date, time] of [['1990-02-30', '10:00'], ['1990-05-01', '24:00'], ['1990-05-01', '14:60'], ['1990/5/1', '14:00']]) {
    assert.throws(() => parseBirth({ date, time, gender: '男' }), { code: 'BIRTH_INCOMPLETE' }, `${date} ${time}`);
  }
});
test('旧格式兼容：year/month/day/hour/minute 与新格式等价', () => {
  assert.deepEqual(parseBirth({ calendar: 'solar', year: 1990, month: 5, day: 1, hour: 14, minute: 0, gender: 'male' }).clock,
    parseBirth({ date: '1990-05-01', time: '14:00', gender: '男' }).clock);
});
test('农历 → CALENDAR_UNSUPPORTED；性别非法 → BIRTH_INCOMPLETE', () => { /* 两条 assert.throws */ });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test lib/birthInput.test.cjs`
Expected: FAIL，`Cannot find module './birthInput.cjs'`

- [ ] **Step 3: 实现 `lib/birthInput.cjs`**

- 日期时间校验：正则 `^\d{4}-\d{2}-\d{2}$` / `^\d{2}:\d{2}$`，再用 `Date.UTC` 构造并回读年月日时分，与输入不一致即 `BIRTH_INCOMPLETE`。
- 性别归一：`男 | M | male | 乾造 | 乾 | 1` → `男`；`女 | F | female | 坤造 | 坤 | 0` → `女`；其余 `BIRTH_INCOMPLETE`。
- `resolvePlace`：`searchBirthplaces(place, 50)`；`score >= 120` 的为精确候选。精确候选恰好 1 个 → 使用；多个 → `PLACE_AMBIGUOUS`；0 个但有模糊结果 → `PLACE_AMBIGUOUS`（候选取前 5）；完全没有 → `PLACE_NOT_FOUND`。选中地点 `country !== '中国'` → `PLACE_UNSUPPORTED`。
- 港澳台：`admin1` 为 `港澳台` 或 label 含香港/澳门/台湾时，追加 warning `港澳台历史夏令时未校正`。
- 换算调用 `getSolarTimeAdjustment({ ...clock, longitude, country: '中国', admin1, mode: 'apparent' })`；直接传经度时 `admin1` 留空。字段映射：`daylightSavingMinutes → daylight_saving_minutes` 等。

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test lib/birthInput.test.cjs && npm test`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/birthInput.cjs lib/birthInput.test.cjs package.json
git commit -m "feat(input): 新增统一出生信息解析与真太阳时换算（复用网页端函数）"
```

### Task 4: 输出外层与错误码

**Files:**
- Create: `lib/cliEnvelope.cjs`、`schemas/xuanxue-output.schema.json`
- Test: `lib/cliEnvelope.test.cjs`

**Interfaces:**
- Produces:
  - `ok({ system, mode, engine_version, ruleset, input, conventions, chart, judgments, evidence, confidence, limitations, warnings }) -> Envelope`：缺省字段补默认值（`judgments: {}`、`evidence: []`、`limitations: []`、`warnings: []`、`confidence: null`、`engine_version`/`ruleset` 为 `null`）。
  - `fail(code: string, message: string, extra?: object) -> { ok: false, code, message, hint }`：`hint` 从 `ERROR_HINTS[code]` 取；`PLACE_AMBIGUOUS` 时 hint 中列出 `extra.candidates`。
  - `toFailure(err: Error, { engine_version?, input_summary? }) -> Failure`：有 `err.code` 且在 `ERROR_HINTS` 中 → `fail`；否则 `ENGINE_ERROR`，message 不含堆栈，附 `engine_version` 和 `input_summary`。
  - `validateEnvelope(obj) -> { valid: boolean, errors }`：ajv 编译 schema。
  - `ERROR_HINTS`：覆盖 spec 第 4.4 节全部错误码，外加 `CAST_TIME_INVALID`。

- [ ] **Step 1: 写失败的测试**

```js
test('ok() 补全默认字段并通过 schema', () => {
  const env = ok({ system: 'bazi', mode: 'chart', input: {}, conventions: {}, chart: {} });
  assert.deepEqual([env.evidence, env.limitations, env.warnings], [[], [], []]);
  assert.equal(validateEnvelope(env).valid, true);
});
test('schema 拒绝未知 system 和非法 confidence', () => { /* system:'tarot' 与 confidence:'very' 均 valid:false */ });
test('fail(TIME_REQUIRED) 带中文 hint', () => {
  assert.match(fail('TIME_REQUIRED', '缺少出生时间').hint, /出生时辰/);
});
test('ERROR_HINTS 覆盖 spec 列出的全部错误码', () => {
  for (const c of ['NO_INPUT','BAD_JSON','BIRTH_INCOMPLETE','CALENDAR_UNSUPPORTED','QUESTION_REQUIRED','TOPIC_UNSUPPORTED',
    'TIME_SCOPE_INVALID','TIME_SCOPE_TOO_WIDE','TIME_REQUIRED','PLACE_NOT_FOUND','PLACE_UNSUPPORTED','PLACE_AMBIGUOUS','ENGINE_ERROR','CAST_TIME_INVALID'])
    assert.ok(ERROR_HINTS[c], c);
});
test('toFailure：无 code 的异常 → ENGINE_ERROR，不含堆栈', () => {
  const f = toFailure(new TypeError('x is undefined'), { engine_version: '1.8.29' });
  assert.equal(f.code, 'ENGINE_ERROR');
  assert.doesNotMatch(JSON.stringify(f), /at .*\.cjs:\d+/);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test lib/cliEnvelope.test.cjs`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现**

Schema：`ok:true` 分支要求 spec 第 4.3 节全部顶层字段，`system` 枚举 `bazi | ziwei | qimen | calendar`，`confidence` 枚举 `high | medium | low | null`，`evidence` 项要求 `rule_id`（string），可选 `source_id`、`title`、`printed_page`、`section`，`additionalProperties: false`（只针对 evidence 项，防止原文混进去）。`ok:false` 分支要求 `code`、`message`、`hint`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test lib/cliEnvelope.test.cjs && npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/cliEnvelope.cjs lib/cliEnvelope.test.cjs schemas/xuanxue-output.schema.json
git commit -m "feat(contract): 统一输出外层、错误码与 JSON Schema"
```

### Task 5: 八字 CLI 接入统一契约

**Files:**
- Modify: `scripts/bazi_cli.cjs`
- Modify: `scripts/bazi_cli.test.cjs`
- Modify: `.claude/skills/bazi/SKILL.md`、`.agents/skills/bazi/SKILL.md`（输入输出示例）

**Interfaces:**
- Consumes: `parseBirth`（Task 3）；`ok`、`toFailure`（Task 4）。
- Produces: `run(input: { birth, mode?: 'chart' | 'question', question?, current_year?, route? }) -> Envelope`，新增到 `module.exports`；原有导出保留。

字段映射：`chart` = 现有 `buildChart()` 结果；`judgments` = 现有 `buildStatic()` 结果，question 模式再加 `question: buildQuestionSection(...)`；`limitations` = question 段的 `limitations`；`engine_version` = `detail.engine_version`；`conventions.zi_hour = '夜子时算当日'`；`input` = `parseBirth` 结果。排盘用 `effective` 时间。`confidence`：question 模式取 `target_spec.confidence`，没有就取 `null`。

- [ ] **Step 1: 补失败的测试**（现有 parity 用例保留，`BIRTHS` 改为经 `run` 调用后对 `chart`、`judgments` 比对）

```js
test('run 输出通过 schema，conventions.zi_hour 为夜子时算当日', () => {
  const env = run({ birth: { date: '2001-02-04', time: '23:10', gender: '男' } });
  assert.equal(validateEnvelope(env).valid, true);
  assert.equal(env.conventions.zi_hour, '夜子时算当日');
});
test('带 location 时用真太阳时排盘：乌鲁木齐 1990-05-01 01:00（-187 分钟 → 4/30 21:53）时柱为丁亥', () => { /* 对比 Solar.fromYmdHms(1990,4,30,22,13) 的时柱 */ });
test('旧格式缺 hour → 子进程 ok:false TIME_REQUIRED', () => {});
test('flags 路径仍可用：--date 1990-05-01 --time 14:00 --gender 男', () => {});
```

- [ ] **Step 2: 运行，确认新用例失败**

Run: `node --test scripts/bazi_cli.test.cjs`
Expected: 新增 4 条 FAIL，原有用例 PASS

- [ ] **Step 3: 实现**：`buildProfile` 改为接收 `NormalizedBirth`；`main()` 调用 `run()` 并用 `toFailure` 输出错误。删掉 `hour == null ? 12` 的默认值。

- [ ] **Step 4: 更新 bazi SKILL.md 中的输入示例与字段路径；两份 SKILL.md 保持一致**

Run: `diff .claude/skills/bazi/SKILL.md .agents/skills/bazi/SKILL.md && echo same`
Expected: `same`

- [ ] **Step 5: 运行全部测试**

Run: `npm test`
Expected: PASS；`eval/bazi-skill` 的触发与路由评测脚本不受影响（只改了示例字段路径）。

- [ ] **Step 6: 提交**

```bash
git add scripts/bazi_cli.cjs scripts/bazi_cli.test.cjs .claude/skills/bazi .agents/skills/bazi
git commit -m "refactor(bazi): CLI 接入统一出生信息与输出外层，时辰改为必填"
```

### Task 6: 紫微 CLI 接入统一契约

**Files:**
- Modify: `scripts/ziwei_skill_cli.cjs`、`scripts/ziwei_skill_cli.test.cjs`
- Modify: `.claude/skills/ziwei/SKILL.md`、`.agents/skills/ziwei/SKILL.md`

**Interfaces:**
- Consumes: `parseBirth`、`ok`、`toFailure`。
- Produces: `run(input: { birth, mode?: 'chart' | 'evidence', topic?, time_scope?, current_year? }) -> Envelope`（替换现有 `run`；`buildBoard`、`normalizeRoute`、`toProfileSnapshot` 保留导出）。

映射：`toProfileSnapshot` 改为接收 `NormalizedBirth`：有 `solar_time` 或 `time_basis === 'true_solar'` 时传 `adjusted_birth_date = effective` 且 `solar_time_mode: 'apparent'`；否则只传 `birth_date`。`conventions.zi_hour = '晚子时算次日'`。现有输出中的盘面进 `chart`，证据报告的结论进 `judgments`；证据项映射成 `{ rule_id, source_id, title, printed_page, section }`，**丢弃任何正文字段**。旧输入 `mode: 'natal'` 视为 `chart`。

- [ ] **Step 1: 补失败的测试**

```js
test('run(evidence) 通过 schema，evidence 项不含正文字段', () => {
  const env = run({ birth: { date: '1990-05-01', time: '14:00', gender: '女' }, mode: 'evidence', topic: 'career' });
  assert.equal(validateEnvelope(env).valid, true);
  assert.ok(env.evidence.length > 0);
  for (const e of env.evidence) for (const k of ['ocr_text', 'corrected_text', 'correction_notes']) assert.equal(e[k], undefined);
});
test('conventions.zi_hour 为晚子时算次日', () => {});
test('time_scope 11 年 → TIME_SCOPE_TOO_WIDE；topic=health → TOPIC_UNSUPPORTED', () => {});
test('带 location：传给引擎的 adjusted_birth_date 等于 effective', () => {});
```

- [ ] **Step 2: 运行，确认新用例失败**

Run: `node --test scripts/ziwei_skill_cli.test.cjs`
Expected: 新用例 FAIL

- [ ] **Step 3: 实现**

- [ ] **Step 4: 更新两份 ziwei SKILL.md 并 diff 一致**

- [ ] **Step 5: 运行测试**

Run: `npm test && npm run test:ziwei-knowledge`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add scripts/ziwei_skill_cli.cjs scripts/ziwei_skill_cli.test.cjs .claude/skills/ziwei .agents/skills/ziwei
git commit -m "refactor(ziwei): CLI 接入统一出生信息与输出外层"
```

### Task 7: 奇门 CLI 接入统一契约

**Files:**
- Modify: `scripts/qimen_cli.cjs`、`scripts/qimen_cli.test.cjs`、两份 `qimen-dunjia/SKILL.md`

**Interfaces:**
- Consumes: `ok`、`toFailure`、`parseBirth`。
- Produces: `run(input: { mode?, question?, cast_time?, timezone?, birth? }) -> Envelope`。`birth` 存在时，用 `parseBirth` 后的 `effective` 时间经 lunar-javascript 算出四柱字符串（格式同网页端 `currentBaziString`：`庚午 庚辰 丙午 乙未`），作为 `baziInfo` 传入；`bazi_info` 旧字段删除。

映射：`chart` 保持 Task 1 的字段；`judgments` 保持；`evidence` = `backendFormationTags` 与 `score.adjustments` 中每项映射为 `{ rule_id: item.signal, section: item.layer }`；`confidence` = `backendScoreAudit.confidence`；`conventions = { timezone, qimen_method: '时家转盘 · 拆补法 · 天禽寄坤' }`；`engine_version` 为 `null`（奇门引擎无版本号）。

- [ ] **Step 1: 改测试**：Task 1 的 parity 断言改走新字段路径；新增"通过 schema"、"带 birth 时 judgments 中用到的 baziInfo 等于该生辰四柱"两条。
- [ ] **Step 2: 运行，确认失败** — Run: `node --test scripts/qimen_cli.test.cjs`，Expected: 新增用例 FAIL
- [ ] **Step 3: 实现**
- [ ] **Step 4: 更新两份 SKILL.md 的字段路径并 diff 一致**
- [ ] **Step 5: `npm test`，PASS**
- [ ] **Step 6: 提交** — `git commit -m "refactor(qimen): CLI 接入统一输出外层，支持可选生辰背景"`

### Task 8: `scripts/calendar_cli.cjs`

**Files:**
- Create: `scripts/calendar_cli.cjs`、`scripts/calendar_cli.test.cjs`

**Interfaces:**
- Consumes: `parseBirth`、`resolvePlace`、`ok`、`toFailure`；lunar-javascript 的 `Solar`、`Lunar`、`getJieQiTable()`。
- Produces: `run(input: { action: 'convert' | 'true_solar' | 'jieqi', date?, time?, location?, year? }) -> Envelope`，`system: 'calendar'`、`mode = action`。
  - convert：`{ date, time }` → `chart = { solar, lunar: '庚午年四月初七', ganzhi: { year, month, day, time } }`，`conventions.zi_hour = '夜子时算当日'`
  - true_solar：`{ date, time, location }` → `chart = { solar_time }`（`SolarTime` 结构）
  - jieqi：`{ year }` → `chart.jieqi = [{ name, datetime }]`（该年 24 节气，北京时间）；或 `{ date }` → `chart = { previous: {name, datetime}, next: {name, datetime} }`

- [ ] **Step 1: 写失败的测试**

```js
test('convert 1990-05-01 14:00 → 四柱 庚午 庚辰 丙寅 乙未，农历 庚午年四月初七', () => {});
test('true_solar 杭州 → total_minutes -56', () => {});
test('jieqi 2026 → 24 项，含立春', () => {});
test('jieqi date=2026-02-04 → previous 或 next 为立春', () => {});
test('action 缺失 → BAD_JSON；通过 schema', () => {});
```

- [ ] **Step 2–4:** 运行确认失败 → 实现 → `npm test` PASS
- [ ] **Step 5: 提交** — `git commit -m "feat(calendar): 新增历法 CLI（公农转换、真太阳时、节气）"`

---

## 第 3 阶段：MCP 打包

### Task 9: 子包骨架与引擎定位

**Files:**
- Create: `packages/xuanxue-mcp/package.json`、`packages/xuanxue-mcp/src/engine.mjs`、`packages/xuanxue-mcp/test/engine.test.mjs`、`packages/xuanxue-mcp/.gitignore`（内容 `engine/`）
- Modify: 根 `package.json`（`"workspaces": ["packages/*"]`；`test` 脚本加 `packages/xuanxue-mcp/test/*.test.mjs`）

**Interfaces:**
- Produces: `loadEngine() -> { bazi: run, ziwei: run, qimen: run, calendar: run, schemaPath: string }`。优先找 `new URL('../engine/', import.meta.url)`（发布后），不存在就退回仓库根目录 `../../../`（开发时）。用 `createRequire(import.meta.url)` 加载四个 `scripts/*_cli.cjs`。

子包 `package.json`：`name: xuanxue-mcp`，`version: 0.1.0`，`type: module`，`bin: { "xuanxue-mcp": "src/server.mjs" }`，`files: ["src/", "engine/", "prompts/", "README.md", "LICENSE"]`，`engines.node: ">=22.12"`，`license: MIT`；`dependencies`：`@modelcontextprotocol/sdk`、`zod`、`lunar-javascript`、`iztro`、`ajv`、`yaml`（后四个与根 `package.json` 当前版本范围一致）；`scripts.prepack: "node scripts/prepack.mjs"`（Task 12 实现，本任务先不加）。

- [ ] **Step 1: 测试** — `loadEngine()` 返回的四个 run 都是函数；`loadEngine().bazi({ birth: { date: '1990-05-01', time: '14:00', gender: '男' } }).ok === true`
- [ ] **Step 2: 运行，确认失败** — `node --test packages/xuanxue-mcp/test/engine.test.mjs`
- [ ] **Step 3: 实现；`npm install` 安装 workspace 依赖**（这次 lockfile 的改动属于本任务，要提交）
- [ ] **Step 4: `npm test` PASS**
- [ ] **Step 5: 提交** — `git commit -m "feat(mcp): 新增 xuanxue-mcp 子包骨架与引擎加载"`

### Task 10: MCP server 与四个工具

**Files:**
- Create: `packages/xuanxue-mcp/src/server.mjs`（带 `#!/usr/bin/env node`）、`packages/xuanxue-mcp/src/tools.mjs`
- Test: `packages/xuanxue-mcp/test/server.e2e.test.mjs`

**Interfaces:**
- Consumes: `loadEngine()`（Task 9）。
- Produces:
  - `TOOLS: Array<{ name: 'bazi' | 'ziwei' | 'qimen' | 'calendar', description: string, inputSchema: ZodRawShape, run: (args) => Envelope }>`
  - `toToolResult(env) -> { content: [{ type: 'text', text: JSON.stringify(env, null, 2) }], structuredContent: env, isError: env.ok === false }`
  - `createServer() -> McpServer`（注册 TOOLS；Task 11 再注册 prompts）；`server.mjs` 被直接执行时用 `StdioServerTransport` 连接。

zod schema 与 spec 第 4.1、4.2 节完全对应；`birth.time` 用 `z.string().regex(/^\d{2}:\d{2}$/)`，`mode`、`topic`、`action` 用 `z.enum`。参数校验失败时也返回 `fail('BAD_JSON', ...)` 结构，而不是 SDK 默认的错误文本：用 `safeParse` 自己处理。工具描述用中英双语，内容如下：
- `bazi`：「四柱八字排盘与问事：命局结构、性格禀赋、旺衰喜忌、大运流年、问事应期。Bazi (Four Pillars) chart and question analysis.」
- `ziwei`：「紫微斗数排盘与证据：十二宫、主星、四化、大限流年。Zi Wei Dou Shu chart and evidence.」
- `qimen`：「时家奇门起局与问事：具体事件成败、时机、方位。不需要生辰。Qimen Dunjia for concrete events, timing and direction.」
- `calendar`：「历法工具：公历转农历与四柱、真太阳时换算、节气查询。Calendar conversion, true solar time, solar terms.」

- [ ] **Step 1: 写失败的 e2e 测试**（SDK `Client` + `StdioClientTransport`，`command: process.execPath`，`args: [serverPath]`）

```js
test('listTools 返回 4 个工具', async () => { assert.deepEqual(names.sort(), ['bazi', 'calendar', 'qimen', 'ziwei']); });
test('bazi chart 正常', async () => { /* structuredContent.ok === true */ });
test('bazi 缺 time → isError true，code TIME_REQUIRED', async () => {});
test('ziwei evidence 正常；topic=health → TOPIC_UNSUPPORTED', async () => {});
test('qimen question 正常；mode=question 缺 question → QUESTION_REQUIRED', async () => {});
test('calendar true_solar 纽约 → PLACE_UNSUPPORTED', async () => {});
```

- [ ] **Step 2: 运行，确认失败** — `node --test packages/xuanxue-mcp/test/server.e2e.test.mjs`
- [ ] **Step 3: 实现**
- [ ] **Step 4: `npm test` PASS**
- [ ] **Step 5: 提交** — `git commit -m "feat(mcp): stdio server 与 bazi/ziwei/qimen/calendar 四个工具"`

### Task 11: 解读守则 prompts，并与 SKILL.md 共用

**Files:**
- Create: `packages/xuanxue-mcp/prompts/common.md`、`bazi_reading.md`、`ziwei_reading.md`、`qimen_reading.md`
- Modify: `packages/xuanxue-mcp/src/server.mjs`（注册 prompts）；六份 SKILL.md（加一行引用对应守则文件）
- Test: `packages/xuanxue-mcp/test/prompts.test.mjs`

**Interfaces:**
- Produces: `PROMPTS: Array<{ name, description, file }>`；prompt 消息正文 = `common.md` + 对应体系文件，不带参数。

内容要求：
- `common.md`：盘面事实只能引用工具结果，不许自行推算；`limitations` 与 `confidence: low` 必须如实告诉用户；`warnings` 中的真太阳时与夏令时说明要转述；安全规则取 `knowledge/ziwei/policies/safety.yaml` 的 `principles` 与 `blocked_phrases`，改写成三套体系通用的表述；`conventions` 中的口径差异遇到时要说明。
- 各体系文件：从对应 SKILL.md 提炼"访谈要问什么 → 调用哪个工具、什么参数 → 解读顺序"，字段路径用统一外层。
- SKILL.md 中原有的同类段落改为"见 `packages/xuanxue-mcp/prompts/<name>.md`"，避免两份内容。

- [ ] **Step 1: 测试** — `listPrompts` 返回 `bazi_reading`、`ziwei_reading`、`qimen_reading`；`getPrompt('bazi_reading')` 正文同时包含 `common.md` 首行和"limitations"；`common.md` 包含 safety.yaml 中的每一个 `blocked_phrases`（作为禁用示例出现）。
- [ ] **Step 2: 运行，确认失败**
- [ ] **Step 3: 写 prompt 文件并注册；修改 SKILL.md 引用**
- [ ] **Step 4: `npm test` PASS；六份 SKILL.md 两两 diff 一致**
- [ ] **Step 5: 提交** — `git commit -m "feat(mcp): 三套解读守则 prompt，与技能共用同一份正文"`

### Task 12: prepack 与打包测试

**Files:**
- Create: `packages/xuanxue-mcp/scripts/prepack.mjs`
- Modify: `packages/xuanxue-mcp/package.json`（加 `scripts.prepack`）
- Test: `packages/xuanxue-mcp/test/pack.test.mjs`

**Interfaces:**
- Produces: 运行后 `packages/xuanxue-mcp/engine/` 下按仓库原相对路径存放：`lib/`（依赖闭包）、`scripts/{bazi,ziwei_skill,ziwei,qimen,calendar}_cli.cjs` 及其 `require` 到的 `scripts/*.cjs`、`knowledge/ziwei/`（不含 `fixtures/`、`reports/`）、`src/utils/{baziProfileInput,birthplaceSearch}.mjs`、`src/data/birthplaces.mjs`、`schemas/`。

- 依赖闭包：从四个 CLI 入口出发，正则扫描 `require('...')` 和 `import ... from '...'` 中的相对路径，递归收集；不要整目录复制 `lib/`。
- `sources/*/excerpts.jsonl`：逐行 JSON 解析，删除 `ocr_text`、`corrected_text`、`correction_notes` 后写回。
- 每次运行先清空 `engine/`。

- [ ] **Step 1: 写失败的测试**（超时设 120s）

```js
test('npm pack 产物可在临时目录独立运行', async () => {
  // 1. 在 packages/xuanxue-mcp 执行 npm pack --pack-destination <tmp>
  // 2. 在 <tmp>/app 执行 npm init -y && npm install <tgz>
  // 3. 用 StdioClientTransport 启动 <tmp>/app/node_modules/xuanxue-mcp/src/server.mjs
  // 4. 调用 ziwei evidence，断言 structuredContent.ok === true 且 evidence.length > 0
});
test('包内所有 excerpts.jsonl 都不含正文字段', () => {});
test('包内不含 fixtures/、reports/、.test. 文件', () => {});
```

- [ ] **Step 2: 运行，确认失败** — `node --test packages/xuanxue-mcp/test/pack.test.mjs`
- [ ] **Step 3: 实现 prepack.mjs**
- [ ] **Step 4: 运行，确认通过；`npm test` PASS**（如果紫微证据依赖正文字段导致失败，按 spec 风险表处理：给 `ziwei_report_evidence` 加"正文可选"分支，并在本任务内补测试）
- [ ] **Step 5: 提交** — `git commit -m "feat(mcp): prepack 复制引擎并剥离古籍正文，新增打包冒烟测试"`

### Task 13: README、CHANGELOG、发布清单

**Files:**
- Create: `packages/xuanxue-mcp/README.md`、`packages/xuanxue-mcp/LICENSE`（复制根 LICENSE）、`packages/xuanxue-mcp/CHANGELOG.md`、`packages/xuanxue-mcp/RELEASING.md`
- Modify: 根 `README.md` 与两份翻译版（在"Agent Skills"一节后加一段 MCP 介绍和链接）

README 必须包含 spec 第 7.4 节列出的全部内容。四个客户端的配置写法：
- Claude Code：`claude mcp add xuanxue -- npx -y xuanxue-mcp`
- Claude Desktop / Cursor：`{"mcpServers": {"xuanxue": {"command": "npx", "args": ["-y", "xuanxue-mcp"]}}}`
- Codex：`~/.codex/config.toml` 中 `[mcp_servers.xuanxue]`，`command = "npx"`，`args = ["-y", "xuanxue-mcp"]`

CHANGELOG `0.1.0` 写明：时辰必填（旧行为是默认 12 点）、v1 只支持中国（含港澳台）出生地、子时口径差异。

RELEASING.md：发布前用 `npm view xuanxue-mcp` 再确认包名（被占用就改用 `@oceanjustinlin/xuanxue-mcp`）→ `npm test` → `npm pack --dry-run` 检查文件列表 → `npm publish`（由仓库所有者手动执行）。

- [ ] **Step 1: 写文档**
- [ ] **Step 2: 校验** — Run: `cd packages/xuanxue-mcp && npm pack --dry-run 2>&1 | grep -E "README|LICENSE|engine/"`，Expected: 三类文件都在列表中
- [ ] **Step 3: 手动验收**（spec 成功标准第 3 条的本地版）：用 Claude Code 执行 `claude mcp add xuanxue -- node <绝对路径>/packages/xuanxue-mcp/src/server.mjs`，分别问一次八字、紫微、奇门问题，三个都能拿到 `ok: true` 的结果；把结果截图或记录写进 PR 描述
- [ ] **Step 4: 提交** — `git commit -m "docs(mcp): README、CHANGELOG 与发布清单"`
