# 紫微正向推理 Pipeline：分阶段职责与契约规格

> 配套 PRD：`prd-ziwei-forward-reasoning-pipeline.md`
> 状态：设计稿，不包含实现代码
> 默认口径：`sanhe-core` 主体，`feixing-aux` 辅助；首期支持本命、大限、流年

## 1. 目的

本规格把 Pipeline 的每个阶段定义为独立、可测试、可版本化的组件。每层只接受声明过的上游契约，不读取下游状态，也不得通过 LLM 补齐缺失事实。

统一成功信封至少包含：

```json
{
  "schema_version": "component-contract/v1",
  "trace_id": "opaque-trace-id",
  "pipeline_version": "ziwei-reasoning/v1",
  "warnings": [],
  "limitations": []
}
```

统一原则：

- 排盘事实由锁定版本的 CLI 引擎拥有；
- 原书证据由知识库命题拥有；
- 静态与动态对象分开保存；
- 零命中通常是有效结果，不等于系统错误；
- 每个输出必须能通过 `trace_id`、版本和 ID 重放；
- 以下 JSON 均为合法的最小节选，不代表完整业务对象。

## 2. 阶段总览

| Stage | 组件 | 核心产物 |
| --- | --- | --- |
| 0 | Request Normalizer | `ZiweiReasoningRequest/v1` |
| 1 | Chart Engine | `ziwei-cli/v1` |
| 2 | Fact Validator | `ValidatedZiweiChart/v1` |
| 3 | Topic Router | `ZiweiTopicRoute/v1` |
| 4 | Static Projector | `ZiweiFactGraph/v1` |
| 5 | Proposition Matcher | `MatchedPropositionSet/v1` |
| 6 | Static Synthesizer | `StaticAssessment/v1` |
| 7 | Dynamic Overlay | `DynamicOverlay/v1` |
| 8 | Activation Resolver | `ActivationSet/v1` |
| 9 | State Delta Synthesizer | `StateDeltaSet/v1` |
| 10 | Conclusion Builder | `ConclusionSet/v1` |
| 11 | Evidence & Safety Gate | `GatedConclusionSet/v1` |
| 12 | Verbalizer & Response Validator | `ZiweiReasoningReport/v1` |

## 3. Stage 0：Request Normalizer

**具体分工：** 验证用户和 profile 所有权；归一显式 `topic`、`time_scope`、`report_preset`、流派选项；生成 trace；只把最小 profile 引用交给下游。

**设计缘由：** 将授权、隐私和语法校验放在最外层，避免非法请求进入排盘引擎；本层不做紫微语义判断。

**输入 sample：**

```json
{
  "profile_id": "profile-uuid",
  "topic": "career",
  "question": "未来两年事业结构有什么变化？",
  "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027},
  "report_preset": "standard"
}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-reasoning-request/v1",
  "trace_id": "trace-001",
  "profile_ref": {"profile_id": "profile-uuid", "authorized": true},
  "request": {"topic": "career", "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027}},
  "school_policy": "sanhe-core-with-feixing-aux"
}
```

**禁止/失败：** 不读取命盘和知识库；无权 profile 返回 `PROFILE_FORBIDDEN`；动态请求缺少年份返回 `ZIWEI_TIME_SCOPE_MISSING`。

## 4. Stage 1：Chart Engine

**具体分工：** 复用 `ziweiProfileAdapter` 与 `ziwei_cli`，由校正后的出生时间生成本命盘；按请求生成大限、流年快照；记录引擎和时间口径。

**设计缘由：** 安星、四化和运限必须来自可信、可复现引擎，不能由知识库或 LLM 手推。

**输入 sample：**

```json
{
  "trace_id": "trace-001",
  "profile_snapshot": {"gender": "男", "adjusted_birth_date": "1998-07-26 18:29:00"},
  "requested_scopes": ["natal", "decadal", "yearly"]
}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-cli/v1",
  "engine": {"library": "iztro", "library_version": "2.5.8", "school": "iztro-default"},
  "input": {"time_source": "profile_adjusted", "time_index": 9},
  "natal": {"five_elements_class": "木三局", "palaces": []},
  "horoscope": {"decadal": {}, "yearly": {}}
}
```

**禁止/失败：** 不加载解释知识；不输出吉凶；库异常返回 `ZIWEI_LIBRARY_ERROR`，不返回半张盘。

## 5. Stage 2：Fact Validator

**具体分工：** 校验十二宫唯一完整、命身宫存在、索引与关系闭合、本命/动态四化隔离、运限命宫映射、Schema 和引擎版本。

**设计缘由：** JSON 能解析不代表盘面语义自洽；本层是第三方排盘引擎与推理系统之间的语义防火墙。

**输入 sample：**

```json
{"trace_id": "trace-001", "chart_ref": "chart:sha256:abc", "required_scopes": ["natal", "yearly"]}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-validated-chart/v1",
  "trace_id": "trace-001",
  "chart_ref": "chart:sha256:abc",
  "validated": true,
  "invariants": ["twelve_palaces_unique", "life_body_present", "period_mapping_consistent"]
}
```

**禁止/失败：** 不修复或猜测盘面；任一关键不变量失败返回 `ZIWEI_FACT_INVARIANT_FAILED` 并终止推理。

## 6. Stage 3：Topic Router

**具体分工：** 将显式参数和问题映射为相互独立的 `topic`、`time_scope`、`report_preset`、路由状态和置信度；选择主题模板。

**设计缘由：** 事业/财富属于现实主题，流年属于时间维度；拆开后同一主题可复用本命和动态 Pipeline。

**输入 sample：**

```json
{
  "request_ref": "request:trace-001",
  "question": "未来两年事业结构有什么变化？",
  "explicit": {"topic": "career", "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027}}
}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-topic-route/v1",
  "topic": "career",
  "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027},
  "report_preset": "standard",
  "routing_status": "matched",
  "confidence": "high",
  "template_id": "report.career.v1"
}
```

**禁止/失败：** `annual` 不得作为 topic；歧义返回 `ambiguous`；不支持主题返回 `unsupported`，不得静默退化为 `overall`。

## 7. Stage 4：Static Projector

**具体分工：** 4A 投影本命节点；4B 把对宫、三方、邻宫拆成类型边；4C 按主题标记 `focus/supporting/global_context`。

**设计缘由：** 将第三方对象转换成稳定、可查询的事实图，同时把事实组织与解释命题彻底分离。

**输入 sample：**

```json
{
  "validated_chart_ref": "chart:sha256:abc",
  "route_ref": "route:trace-001",
  "allowed_scope": "natal"
}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-fact-graph/v1",
  "topic": "career",
  "scope": "natal",
  "focus_palace": "官禄宫",
  "facts": [{"fact_id": "fact.guanlu.tianji", "feature": "palace_has_star", "palace": "官禄宫", "star": "天机", "topic_role": "focus", "origin": {"path": "natal.palaces[2].major_stars[0]"}}],
  "relations": [{"from": "官禄宫", "relation": "trine", "to": "命宫"}]
}
```

**禁止/失败：** 禁止读取 `horoscope`、生成 `period_activates` 或解释吉凶；未知宫名返回 `ZIWEI_STATIC_PROJECTION_INVALID`。

## 8. Stage 5：Proposition Matcher

**具体分工：** 用 FactGraph 匹配主题、流派、scope、状态和条件均合格的解释命题；返回实际命中的 fact ID 与原书证据 ID。

**设计缘由：** 事实与知识分开后，更换知识版本或流派不会改变盘面事实；每条解释都能重放。

**输入 sample：**

```json
{"fact_graph_ref": "fact-graph:trace-001", "proposition_pack": "ziwei-interpretations/v1", "school_order": ["sanhe-core", "feixing-aux"]}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-matched-propositions/v1",
  "matches": [{"proposition_id": "interp.tianji.career.v1", "matched_fact_ids": ["fact.guanlu.tianji"], "evidence_ids": ["source.example.p1"], "school": "sanhe-core", "scope": "natal", "confidence": "medium"}],
  "unmatched_reasons": []
}
```

**禁止/失败：** 只读 FactGraph，不回读原始 CLI；不综合命题；零命中返回空数组和 `ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED`，不是系统错误。

## 9. Stage 6：Static Synthesizer

**具体分工：** 按主题角色和流派整理命题，形成基础倾向、支持、压力、反证、冲突、覆盖状态和限制。

**设计缘由：** Matcher 只产生零散命中；本层把它们整理成本命状态，供动态层比较，但不创造新命理命题。

**输入 sample：**

```json
{"fact_graph_ref": "fact-graph:trace-001", "matched_set_ref": "matches:trace-001", "template_id": "report.career.v1"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-static-assessment/v1",
  "topic": "career",
  "coverage": {"status": "conflicted", "exact_topic_count": 2, "supporting_count": 1},
  "baseline_tendencies": [{"proposition_ids": ["interp.tianji.career.v1"]}],
  "supporting_factors": [],
  "pressure_factors": [],
  "conflicts": [{"resolution_status": "unresolved"}],
  "limitations": []
}
```

**禁止/失败：** 不读取运限；不做神秘总分；没有审核过的组合命题时只能保留冲突，不能自行写出调和结论。

## 10. Stage 7：Dynamic Overlay

**具体分工：** 从已验证命盘提取大限、流年命宫映射、动态宫位、动态星曜、动态四化和各层作用域；按年份生成独立快照。

**设计缘由：** 原书要求运限重新立命宫并使用相应四化；动态数据必须与本命事实物理隔离。

**输入 sample：**

```json
{"validated_chart_ref": "chart:sha256:abc", "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027}, "static_assessment_ref": "static:trace-001"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-dynamic-overlay/v1",
  "snapshots": [{"period": "yearly", "year": 2026, "life_palace_maps_to": "迁移宫", "mutagens": [{"star": "天机", "mutagen": "权"}], "origin": {"path": "horoscope.yearly"}}],
  "unsupported_scopes": []
}
```

**禁止/失败：** 不解释动态事实；首期拒绝流月、流日、流时用户级解释；缺少所需快照返回 `ZIWEI_DYNAMIC_SNAPSHOT_MISSING`。

## 11. Stage 8：Activation Resolver

**具体分工：** 将 Dynamic Overlay 与本命主题 FactGraph 对齐，只识别 `same_palace/opposite/trine/adjacent/mutagen_hits/repeated_focus`。

**设计缘由：** “外因通过内因”只作为方法框架；紫微作用点必须来自紫微宫位与四化关系，不能移植八字应局算法。

**输入 sample：**

```json
{"fact_graph_ref": "fact-graph:trace-001", "dynamic_overlay_ref": "dynamic:trace-001", "operator_pack": "ziwei-activation/v1"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-activation-set/v1",
  "activations": [{"activation_id": "activation.2026.career.1", "period": "yearly", "target_palace": "官禄宫", "relation": "trine", "dynamic_fact_ids": ["dynamic.2026.life-palace"], "natal_fact_ids": ["fact.guanlu.role"]}],
  "limitations": []
}
```

**禁止/失败：** 不判断增强或削弱；不支持的连接不得降级为相似规则；零作用点是有效空结果。

## 12. Stage 9：State Delta Synthesizer

**具体分工：** 将 Activation 与动态命题作用于 StaticAssessment，输出 `strengthened/weakened/redirected/conflicted/unchanged/insufficient_evidence`。

**设计缘由：** 时间判断应表达为相对本命的状态变化，而不是让动态星曜脱离本命直接断事。

**输入 sample：**

```json
{"static_assessment_ref": "static:trace-001", "activation_set_ref": "activations:trace-001", "dynamic_matches_ref": "dynamic-matches:trace-001"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-state-delta-set/v1",
  "deltas": [{"delta_id": "delta.2026.career.1", "baseline_proposition_ids": ["interp.tianji.career.v1"], "activation_ids": ["activation.2026.career.1"], "change": "conflicted", "dynamic_proposition_ids": ["interp.dynamic.example.v1"], "limitations": []}]
}
```

**禁止/失败：** 没有动态命题时最多报告“主题被激活”，状态必须为 `insufficient_evidence`，不得补写具体事件。

## 13. Stage 10：Conclusion Builder

**具体分工：** 把静态状态和可用的动态变化封装成最小结论单元，绑定事实、命题、证据、流派、置信度和限制。

**设计缘由：** 在语言生成前先形成机器可审计的正式结论，确保自然语言不是产品真相源。

**输入 sample：**

```json
{"route_ref": "route:trace-001", "static_assessment_ref": "static:trace-001", "state_delta_ref": "deltas:trace-001"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-conclusion-set/v1",
  "conclusions": [{"conclusion_id": "conclusion.career.2026.1", "topic": "career", "time_scope": "yearly", "change": "conflicted", "matched_fact_ids": ["fact.guanlu.tianji"], "proposition_ids": ["interp.tianji.career.v1"], "evidence_ids": ["source.example.p1"], "school": "sanhe-core", "confidence": "medium"}]
}
```

**禁止/失败：** 不新增 claim；不同主题或流派不得无标注合并；没有可发布结论时返回空集合。

## 14. Stage 11：Evidence & Safety Gate

**具体分工：** 复核事实存在、命题为 `reviewed`、证据视觉复核、scope 一致、流派优先级和安全语言；分别记录接受与拒绝原因。

**设计缘由：** 即使上游有缺陷，用户出口前仍需 fail-closed 的独立门禁；LLM不能成为修复器。

**输入 sample：**

```json
{"conclusion_set_ref": "conclusions:trace-001", "fact_graph_ref": "fact-graph:trace-001", "source_catalog": "ziwei-sources/v1", "safety_policy": "ziwei-safety/v1"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-gated-conclusions/v1",
  "accepted": ["conclusion.career.2026.1"],
  "rejected": [{"conclusion_id": "conclusion.invalid.1", "codes": ["EVIDENCE_NOT_VISUALLY_VERIFIED"]}],
  "gate_status": "partial"
}
```

**禁止/失败：** 被拒绝结论不得交给 LLM；高风险、伪造事实和跨层冒用直接拦截；全部拒绝仍返回合法空报告。

## 15. Stage 12：Verbalizer & Response Validator

**具体分工：** 按报告模板把通过门禁的结论转写成用户文本；逐段绑定 `conclusion_id`；转写后验证没有新增星曜、宫位、四化、事件、年份或置信度。

**设计缘由：** LLM 擅长表达而不应拥有事实权；输出校验保证自然语言只是结构化结论的视图。

**输入 sample：**

```json
{"gated_conclusions_ref": "gated:trace-001", "report_template": "report.career.v1", "language": "zh-CN", "style": "conditional"}
```

**输出 sample：**

```json
{
  "schema_version": "ziwei-reasoning-report/v1",
  "topic": "career",
  "time_scope": {"type": "yearly", "start_year": 2026, "end_year": 2027},
  "sections": [{"title": "事业结构", "text": "当前证据显示……", "conclusion_ids": ["conclusion.career.2026.1"]}],
  "response_validation": {"valid": true, "added_fact_count": 0},
  "limitations": []
}
```

**禁止/失败：** 不把未通过门禁的内容放入 prompt；校验失败时丢弃 LLM 文本，回退为模板化结构报告并返回 `ZIWEI_NARRATIVE_VALIDATION_FAILED`。

## 16. 跨阶段不变量

1. Stage 1 之后不得修改盘面事实；Stage 4 之后不得修改静态事实图。
2. Stage 4 不得包含动态事实；Stage 7 不得覆盖 `natal`。
3. Stage 5 是唯一可以把知识命题与事实绑定的阶段。
4. Stage 6、9、10 只能组合已有命题，不得创造新命理 claim。
5. Stage 11 是唯一线上发布门禁；Stage 12 不能绕过它。
6. 每个结论必须能沿 `conclusion → proposition → matched facts → engine/source` 双向追溯。
7. 任一阶段版本变化都必须进入输出版本快照和回归测试。

## 17. 最低测试矩阵

| Stage | 必测内容 |
| --- | --- |
| 0–3 | 权限、输入枚举、时间范围、歧义和 unsupported |
| 4 | 静动态隔离、宫名规范化、四化去重、关系拆边、topic role |
| 5 | reviewed/source/school/scope 门禁、零命中 |
| 6 | 主次排序、重复合并、冲突保留、coverage |
| 7–9 | 时间层隔离、作用点、无动态命题时证据不足 |
| 10–11 | 事实/命题/证据完整性、高风险拦截、流派隔离 |
| 12 | 新增事实检测、段落绑定、LLM 失败回退 |
