# 八字分析 skill — Eval 方案

> 被测：`.claude/skills/bazi/`（访谈 → `scripts/bazi_cli.cjs` → LLM 解读）
> 日期：2026-07-23 · 状态：方案（未落地 harness）

## 1. 目标与非目标

**只评 skill 特有、且未被现有基建覆盖的部分**：

| 已覆盖，不重复评 | 覆盖者 |
| --- | --- |
| 排盘/格局/旺衰/喜忌 命理准确度 | `eval/baziprofile-accuracy/`（gold-cases + scorer） |
| 引擎模块行为 | `lib/*.test.js`、`lib/classicalGoldCases.test.js` |
| CLI 封装无损（换算/投影/透传/错误码） | `scripts/bazi_cli.test.cjs`（parity 冒烟） |

**本方案评三件事**（skill 引入的新决策/新表达面）：

- **D1 触发准确度**：`bazi` skill 该不该在这个 prompt 上启动。
- **D2 路由预判准确度**：LLM 把问题归到的 `analysis_mode` + `time_scope` 是否正确（决定引擎跑 timing/status/pattern/character）。
- **D3 解读质量**：拿到 CLI 的确定性 JSON 后，LLM 的解读是否**忠实**（不与确定性盘矛盾）、命中、达标。

**最高优先级 = D3 忠实度**：skill 的全部价值在于「确定性核心 + LLM 转译」。若解读凭空说出与 `static.five_shens`/`geju` 相矛盾的用神/格局，等于把确定性优势丢掉。忠实度矛盾率必须为 0（硬门禁）。

## 2. 被测对象如何 headless 跑（关键设计）

skill 跑在交互式 Claude Code 里，但**可自动化的部分只有两次 LLM 调用**，无需驱动整个交互 harness——与 `eval/gemini-flash-accuracy` 同思路（headless LLM 跑在引擎输出之上）：

1. **route 分类器**：把 SKILL.md「第 2 步」的判定规则抽成一个 headless prompt，输入问题 → 输出 `{analysis_mode, time_scope}`。→ 评 D2。
2. **解读器**：把 SKILL.md「第 4 步」+ `references/reading-guide.md` 抽成一个 headless prompt，输入 CLI JSON → 输出解读 prose。→ 评 D3。

触发（D1）不需要跑引擎，只需一个分类判断：给定 prompt，skill 是否应触发。用 skill 的 `description` + 一组带标签样本评。

> 计算链（bazi_cli.cjs）在 eval 里当**固定夹具**：确定性、已 parity 测过，不进入被评范围。

## 3. 三个维度的数据集、打分与门禁

### D1 触发准确度
- **数据**：`triggering-cases.js`，≥60 条带标签 prompt。
  - 正例：八字/四柱/日主/大运流年/喜用神/「用八字看…」等。
  - 硬负例（易混）：紫微斗数、奇门遁甲、纯闲聊玄学、其他命理体系、无命理意图的日常问题。
- **打分**：precision / recall / F1。硬负例误触发单列（与 `ziwei-doushu`、`qimen-dunjia` 抢触发是主要风险）。
- **门禁**：F1 ≥ 0.9；紫微/奇门硬负例误触发率 = 0。

### D2 路由预判准确度
- **数据**：`route-cases.js`，≥50 条问题，人工标注 `expected.analysis_mode`（timing/status/pattern/character）+ `expected.time_scope`。
- **打分**：analysis_mode 精确匹配率；time_scope 匹配率（timing 类才计）。混淆矩阵看 status↔timing 混淆（已知启发式弱点：「今年到明年」易判 status）。
- **门禁**：analysis_mode 准确率 ≥ 0.85；timing 类的 time_scope 准确率 ≥ 0.8。
- **对照基线**：脚本内 `inferBaziRouteFromQuestion` 启发式作为 baseline，量化「LLM 预判比启发式好多少」，为 SKILL.md「强烈建议显式传 route」提供证据。

### D3 解读质量（跑在 `gold-cases.js` 上）
对每个 gold case：反查生辰 → `bazi_cli.cjs` 出 JSON → 解读器出 prose → **抽取结构化断言**（`extract.mjs`：从 prose 解析出所断的 geju/strong_weak/yong/xi/ji）→ 三层评分：

- **D3a 忠实度（deterministic，最高优先）**：抽取的断言 vs **CLI 的 `static`**。
  - 矛盾 = 解读断言的用神/格局/旺衰与 `static.five_shens`/`static.geju`/`static.strong_weak` 直接冲突。
  - `faithfulness.mjs`：逐例输出 `contradictions[]`。
  - **门禁：矛盾率 = 0**（任一矛盾即 fail，需人工复核）。
- **D3b 命中率（复用现有 scorer）**：抽取的断言 vs gold 标签，直接调 `eval/baziprofile-accuracy/scorer.mjs` 的 `scoreCase`（yong35/geju15/strength15 权重）。
  - 意义：LLM 有没有把引擎已算对的结论**读出来**（上界≈引擎准确度）。
  - **门禁**：命中分 ≥ `baziprofile-accuracy` 引擎分 × 0.9（即解读损耗 ≤10%）。
- **D3c 软质量（LLM-judge，rubric）**：仿 `backend_judge.mjs`，对 prose 逐条打分：
  1. 结构完整（四柱/旺衰格局/喜忌/十神性格/所问推演/总结齐备）
  2. 凶象转译（风险/课题措辞，无「注定/必败」宿命语）
  3. 边界免责（健康/法律/财务出现现实建议提醒）
  4. 术语首现有一句现代汉语解释
  5. `engine_ran===false` 时是否正确标明「结构推断」
  - **门禁**：均分 ≥ 4/5；第 2、3 项为硬项（任一 case 触雷即标记）。

## 4. 复用清单

| 复用 | 来源 |
| --- | --- |
| 200 gold 用例 + 标签 | `eval/baziprofile-accuracy/gold-cases.js` |
| 用神/格局/旺衰打分 | `eval/baziprofile-accuracy/scorer.mjs`（`scoreCase`/`scoreYongTop1`…） |
| 反查生辰→排盘的 harness 骨架 | `eval/baziprofile-accuracy/run.mjs`（pillars→solar 扫描 + buildCompleteBaziDetail） |
| LLM-judge 形态 + results 写盘 | `eval/gemini-flash-accuracy/backend_judge.mjs` |
| 确定性计算夹具 | `scripts/bazi_cli.cjs` |

## 5. 目录与产物

```
eval/bazi-skill/
  PLAN.md                （本文件）
  triggering-cases.js    D1 数据
  route-cases.js         D2 数据（含 expected 标签）
  run.mjs                主 harness：跑 route 分类器 + 解读器，落 results
  extract.mjs            prose → 结构化断言
  faithfulness.mjs       D3a 矛盾检测（vs CLI static）
  rubric-judge.mjs       D3c LLM-judge
  results/               *.json 逐次结果（对齐 baziprofile-accuracy/results 约定）
  RESULTS.md             汇总与门禁看板
```
`extract.mjs`/`route 分类器`/`解读器`/`rubric-judge` 的 LLM 供应商沿用项目现有配置（见 `eval/gemini-flash-accuracy`）。

## 6. 分期落地

- **Phase 0（先做，便宜，无需 gold 全跑）**：D1 触发 + D2 路由。纯分类，样本量小，快速验证 skill 边界与 route 预判价值，顺带产出「显式 route vs 启发式」证据。
- **Phase 1（最高价值）**：D3a 忠实度。抽取器 + 矛盾检测，跑 gold 子集（先 20–30 例）。这是 skill 存在意义的直接度量。
- **Phase 2（可选）**：D3b 命中（接 scorer）+ D3c rubric。全量 gold，成本最高，定位为回归看板而非阻断门。

## 7. 风险与取舍

- **抽取可靠性**：D3 依赖从 prose 抽结构化断言。缓解：解读器输出末尾附一个机器可读的「断语摘要」块（geju/strong_weak/yong），抽取只读该块；prose 与摘要一致性另由 rubric 第 1 项兜。
- **judge 方差**：D3c LLM-judge 有噪声。缓解：硬项（凶象/边界）用规则/关键词预筛，rubric 只判软项；固定 judge 模型与温度，记录版本。
- **上界受引擎约束**：D3b 命中率天花板 = 引擎准确度，不要误读为「解读差」。故 D3b 用相对门禁（对引擎分打折），不用绝对分。
- **成本**：全量 200 例 × 多次 LLM 调用不便宜。按 Phase 递增，日常只跑 Phase 0 + Phase 1 子集，Phase 2 全量仅在改 SKILL.md 解读逻辑时触发。
- **与产品 eval 的关系**：本 eval 评「skill 的 SKILL.md 解读」，`gemini-flash-accuracy` 评「产品后端 prompt」。两者解读逻辑若趋同可共享数据集，但 prompt 来源不同，结果分开记。

## 8. 门禁汇总（CI/回归可挂）

| 维度 | 指标 | 门禁 |
| --- | --- | --- |
| D1 | 触发 F1 | ≥ 0.90 |
| D1 | 紫微/奇门误触发 | = 0 |
| D2 | analysis_mode 准确率 | ≥ 0.85 |
| D3a | 忠实度矛盾率 | = 0（硬） |
| D3b | 命中分 / 引擎分 | ≥ 0.90 |
| D3c | rubric 均分 | ≥ 4/5；凶象/边界为硬项 |
