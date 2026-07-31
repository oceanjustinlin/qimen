# 紫微斗数知识库

本目录保存能够与 `ziwei-cli/v1` 稳定衔接的紫微斗数知识。CLI 和锁定版本的排盘引擎是盘面事实的唯一来源；知识库只负责规则推导、解释检索、证据追溯和报告编排。

## 分层

| 层级 | 目录 | 职责 |
| --- | --- | --- |
| 来源证据 | `sources/` | 书目、页码映射和经过校订的最短摘录 |
| 术语本体 | `ontology/` | 宫位、星曜、四化、主题、流派和别名 |
| 确定性规则 | `rules/` | 关系、运限、四化和组合推导 |
| 解释命题 | `interpretations/` | 带条件、修正项和证据的结构倾向 |
| 报告编排 | `reports/` | 不同问事主题的读取顺序和证据排序 |

完整 PDF、页面图片和整书 OCR 不进入 Git。仓库只保存规则所需的短摘录、页码定位、校订内容和内容哈希。

## 权威边界

- `iztro-default`：当前 CLI 的排盘事实口径。
- `sanhe-core`：默认解释口径，以命身、三方四正、宫位和星情为主。
- `feixing-aux`：四化飞星辅助观察，不静默覆盖三合主体。
- `classical-reference`：古籍研究和交叉验证，默认不生成用户结论。

Agent 不得重新安星、改写宫位或用书籍口诀覆盖 CLI 输出。针对用户命盘的解释必须同时具备实际命中的盘面事实和正式来源证据。

## 报告证据链

`reports/*.yaml` 定义整体、职业、财富、关系和流年五类报告的宫位优先级、流派顺序与阅读顺序。`scripts/ziwei_report_evidence.cjs` 将 `ziwei-cli/v1` 投影为结构化事实，只选择满足以下条件的命题：

1. 命题状态为 `reviewed`，并属于报告主题或明确标注为通用背景；
2. 命题条件在当前命盘真实命中，且命中宫位在报告的优先范围内；
3. 来源 ID 已登记、完成原页视觉复核，并与该命题直接关联；
4. 输出使用已审核命题原文，且未触发确定性、高风险或性别刻板安全策略。

输出中的每条 `conclusion` 都携带 `proposition_id`、`context_role`、`matched_facts` 和 `evidence_ids`。流年报告要求运限快照；在年度解释命题尚未完成审核时返回空结论和 `ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED`，不会用本命倾向冒充流年判断。

## 审核状态

知识只能按以下方向推进：

```text
draft_ocr → extracted → visually_verified → cross_checked → reviewed → deprecated
```

只有 `reviewed` 内容可进入线上检索。高风险断语必须经过独立安全审核。

## 文件格式

`schemas/` 使用 JSON Schema Draft 7。当前 `ontology/*.yaml` 采用 JSON 兼容 YAML，既可由 YAML 解析器读取，也可在基础测试中直接以 JSON 解析，避免本体引入额外的运行时依赖。
