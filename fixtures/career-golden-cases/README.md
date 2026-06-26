# 事业线 golden case fixture

`career-golden-cases.json` — 事业线 MVP 的机制回归测试集，19 例，全部经教材/古籍**原文逐字核实**（四柱已修正）。

- 出处与完整解读、核验记分牌：[docs/bazi-career-golden-cases.md](../../docs/bazi-career-golden-cases.md)
- 分析框架（机制 P1–P10、缺失项 G1–G4）：[docs/bazi-career-mvp-framework.md](../../docs/bazi-career-mvp-framework.md)

## 字段

| 字段 | 说明 |
|---|---|
| `pillars` | `[年, 月, 日, 时]` 四柱干支 |
| `day_master` | 日主天干（=日柱首字） |
| `analysis_mode` | `dynamic`（带大运流年应期）/ `static`（只验原局结构） |
| `expected_direction` | `吉` / `凶` / `转折`（同盘先吉后凶）。**方向 ≠ 激活强度** |
| `key_luck` | 关键大运/流年（动态案） |
| `mechanism_tags` | 机制标签，P1–P10 见 `_meta.mechanism_legend` |
| `source` / `source_text` | 出处；古籍为公版原文摘录，陆致极案仅记四柱+机制（版权） |

## 测试建议（两层断言）

1. **方向层**：引擎对该年/该运判出的方向是否等于 `expected_direction`。
2. **机制层**：引擎是否识别出 `mechanism_tags` 对应机制（如 A 须识别"禄引动+应局"，T 须识别"用神被冲"）。

## 注意

- 固化前建议用项目排盘引擎复核每例四柱/十神/藏干/禄（OCR 教材风险）。
- N（丙火午月阳刃·掌兵刑）四柱待扫描版精定，暂未入集；G/H/L/M/O/P/S/W/X 未通过原文核验，已剔除。
