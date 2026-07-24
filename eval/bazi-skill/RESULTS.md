# 八字 skill Eval — Phase 0 结果（触发 + 路由预判）

> 数据集：`triggering-cases.js`（51 例，其中严格 47 + 模糊 3）、`route-cases.js`（39 例）
> Harness：`run.mjs`。门禁只对 **llm arm** 生效；**baseline arm 仅作对照基线**。

## 如何跑

```bash
# baseline（确定性，无需 API，立即可跑）
node eval/bazi-skill/run.mjs

# llm arm（skill 真实决策层，需 key）
GEMINI_API_KEY=xxx node eval/bazi-skill/run.mjs --arm llm
GEMINI_API_KEY=xxx node eval/bazi-skill/run.mjs --arm both   # 对照
```

## 门禁

| 维度 | 指标 | 阈值 |
| --- | --- | --- |
| D1 | 触发 F1 | ≥ 0.90 |
| D1 | 紫微/奇门误触发 | = 0 |
| D2 | analysis_mode 准确率 | ≥ 0.85 |
| D2 | timing 的 time_scope 准确率 | ≥ 0.80 |

## Baseline 基线（2026-07-23，对照参考）

| | 指标 | 值 | 门禁 |
| --- | --- | --- | --- |
| D1 | F1 | **88.9%** | ❌ |
| D1 | 硬负例误触发 | **3** | ❌ |
| D2 | mode 准确率 | **53.8%** | ❌ |
| D2 | timing scope 准确率 | **60.0%** | ❌ |

### 关键发现（Phase 0 的核心产出）

1. **关键词触发无法消歧共享词汇。** 3 个误触发全部来自八字与其他体系的共享术语：
   - 「紫微斗数**命盘**」「斗数**十二宫**」→ `命盘` 是共享词
   - 「**奇门**里这个局的**用神**」→ `用神` 是共享词
   → 触发判定必须理解「体系归属」，不能靠词表。这是 **D1 需要 LLM arm** 的直接证据。

2. **脚本路由启发式 `inferBaziRouteFromQuestion` 只有 53.8%。** 主要错向：
   - `pattern → status`（6）：问格局/成格被判成看当下状态
   - `character → status/pattern`（5）：问性格被误归
   - `timing → status`（4）：问「哪一年」被判成 status（含已知边界 `r_mix_01`「今年到明年能成吗」）
   → 直接支撑 SKILL.md 的结论：**路由应由 LLM 预判并显式传给 CLI**，脚本启发式仅作缺省兜底。近半误判说明「显式传 route」不是可选优化，而是准确度前提。

3. baseline 召回漏 1 例（`pos_15`「今年犯太岁吗？从命理角度看」——只含 `命理`，不在词表）；模糊例 `amb_02`「帮我算算命」baseline 判不触发（无体系线索）。这些留给 llm arm 检验。

## LLM arm

待配置 `GEMINI_API_KEY` 后运行。预期 llm arm 应：
- 触发：消解共享词汇歧义，硬负例误触发归 0，F1 过 0.90。
- 路由：pattern/character/timing 区分显著优于 53.8%，过 0.85。

llm arm 的 prompt 蒸馏自 `.claude/skills/bazi/SKILL.md`（触发范围 + 第 2 步路由表）。跑出后把数字补到本表，并与 baseline 并列，量化「LLM 决策层相对脚本启发式的净提升」。

---

# Phase 1 — D3a 忠实度（解读断言 vs CLI static）

> skill 存在意义的直接度量：解读**不得**与确定性盘冲突。
> 检测器：`extract.mjs`（prose→断言）+ `faithfulness.mjs`（矛盾判定）；解读器：`reader.mjs`（LLM）。

## 矛盾类型与门禁

| 类型 | 严重度 | 判据 |
| --- | --- | --- |
| `strength_flip` | 硬 | 解读身强↔static 身弱（或反） |
| `yong_is_ji` | 硬 | 解读的用神 ∈ static 忌神/不喜（把忌神当用神，最严重） |
| `geju_mismatch` | 软 | 格局名不一致（别名多，仅提示，不进硬门禁） |

**门禁：硬矛盾率 = 0**（`strength_flip`/`yong_is_ji` 任一出现即 fail）。从格（从强/从弱/专旺）不做硬翻转。

## 如何跑

```bash
# 检测器确定性自证（无需 API，立即可跑）
node eval/bazi-skill/run-phase1.mjs --selftest

# gold 子集真解读（需 key；默认前 20 例）
GEMINI_API_KEY=xxx node eval/bazi-skill/run-phase1.mjs --n 20
```

## 检测器自证结果（2026-07-23，确定性，✅ 8/8）

`phase1-fixtures.js` 覆盖：忠实(block/prose) · 身强弱翻转 · 用神=忌神 · 格局软不一致 · 从格不硬翻 · 双硬矛盾 · prose 兜底抽取。全部按期望命中，证明检测器逻辑正确。

**上游半程已去风险**：gold 四柱→反查公历（1500/800 口径，同 baseline eval）→ `bazi_cli` static，前 5 例 5/5 解析成功、用神/忌神齐备。故 llm arm 只差一次 API 调用（`reader.mjs`）即可全量跑。

## LLM arm（待 key）

配置 `GEMINI_API_KEY` 后跑 gold 子集，产出：硬矛盾率（门禁=0）、软提示数、逐例矛盾明细 → `results/phase1-<model>.json`。这是「LLM 解读是否忠实于确定性核心」的正式数字。

---

## 结果文件

`results/phase0-<arm>.json`、`results/phase1-<model>.json`（逐次留存，含逐例误判/矛盾、混淆矩阵、门禁明细）。
