# ziwei_skill_cli.cjs 输入/输出解读指南

脚本源码：`scripts/ziwei_skill_cli.cjs`。它只把仓库里已有的确定性模块串成一次调用：

```text
ziwei_cli.cjs（iztro 排盘）→ ziweiFeatureDeriver / ziweiDynamicFeatures（派生特征）
→ ziwei_report_evidence.cjs（命盘不变量校验 + 已审核命题匹配）
```

脚本只算，不写文案；文案由你产出。它不新增任何安星、四化或断语逻辑。

## 输入 schema

```jsonc
{
  "birth": {
    "date": "1990-05-01",       // 公历 YYYY-MM-DD；农历须先换算
    "time": "14:00",            // HH:mm，必填；缺失返回 BIRTH_INCOMPLETE，绝不默认午时
    "gender": "男",             // 男/女/M/F/乾造/坤造；影响大限顺逆
    "time_basis": "clock"       // 可选：clock（默认，民用时间）| true_solar（用户给的已是真太阳时）
  },
  "question": "……",            // 可选，原样回显，便于报告引用
  "route": {
    "topic": "career",          // overall | career | wealth | relationship
    "time_scope": {             // 省略 = natal
      "type": "cross_period",   // natal | decadal | yearly | cross_period
      "start_year": 2026,       // 缺省 = currentYear
      "end_year": 2027          // 缺省 = start_year；区间最多 10 年
    }
  },
  "currentYear": 2026,          // 缺省 = 系统当前年
  "options": { "include_raw_horoscope": false }  // 调试用：附带 iztro 原始运限快照
}
```

也可以直接传 `profile_snapshot`（与 `ziwei_cli.cjs` 同形，含 `adjusted_birth_date` 等字段）替代 `birth`。

## 输出 schema

### 顶层

- `ok`、`schema_version`（`ziwei-skill/v1`）、`engine`（库名、版本、口径）。
- `input`：`solar_datetime`、`time_index`、`time_label`（如"未时""晚子时"）、`time_source`。
- `route`：最终采用的 `topic`、`time_scope` 与展开后的 `years`。
- `warnings`：如 `ZIWEI_USING_UNADJUSTED_PROFILE_TIME`（按钟表时间排盘）。
- `limitations`：脚本自报的局限，如"该主题没有命中已审核命题""流年层暂无已审核命题"。**必须写进报告的限制部分。**

### `chart`（B 级：盘面事实）

- `five_elements_class` 五行局；`soul_star` 命主；`body_star` 身主。
- `soul_palace_branch` / `body_palace_branch` 命宫、身宫地支。
- `natal_mutagens`：生年四化，`{禄:星, 权:星, 科:星, 忌:星}`。
- `board`：4×4 命盘，行优先，`null` 为中宫。每格 `branch`、`palace_key`、`stem_branch`、`is_body_palace`、`major_stars`、`minor_stars`（已格式化为"星名(亮度)化X"）、`decadal`（大限岁数区间）。**报告开头的命盘只用它渲染。**
- `palaces`：十二宫完整对象（含 `adjective_stars` 杂曜、`changsheng12`/`boshi12`/`jiangqian12`/`suiqian12`、`ages` 小限岁数、`relations`）。需要杂曜或长生十二神时读这里。

宫名注意：盘面用"仆役宫"，知识库与特征层用"交友宫"，二者是同一宫。

### `natal_features`（派生特征）

`features[]` 每项有 `feature`、`palace`、`value`、`method.status`。按方法状态分级：

| feature | 方法状态 | 证据级别 | value 示例 |
| --- | --- | --- | --- |
| `palace_star_system` | reviewed | B | `{stars:["破军"], empty:false}` |
| `relation_set` | reviewed | B | `{self, opposite, trine:[..], adjacent:[..]}` |
| `brightness_state` | pending_source | C | `{label:"得", rank:5}`（rank 越大越亮） |
| `sanfang_aggregate` | pending_source | C | 三方四正内的 `auspicious`、`malefic`、`lucun`、`horse`、`mutagens`，每项带所在宫与关系 |
| `jia_palace` | pending_source | C | `{before, after, pairs:[..]}`，`pairs` 非空才构成夹宫 |
| `flying_mutagen` | pending_source | C | 宫干飞化：`{stem, mutagen, star, to_palace, self, clash_palace}` |
| `empty_palace_borrow` | pending_source | C | `{borrowed_from, stars}`，当前只借主星 |

`pending_source` 不代表算错，只代表"分组口径或解读口径尚未完成原书复核"。这些特征可以用来组织解读，但措辞要标成结构推断。

### `evidence.topic_report`（A 级：已审核命题）

- `conclusions[]`：每条有 `proposition_id`、`palace`、`context_role`（`exact_topic` 主题宫命中 / `overall_context` 背景宫命中）、`text`（已审核原文）、`matched_facts`、`evidence_ids`（书名页码 ID）、`confidence`、`applied_modifiers`。
- `methodology.palace_priority` / `reading_order`：该主题的宫位优先级与阅读次序，可直接作为报告组织顺序。
- `warnings` 含 `ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED` 时，说明 A 级为空，全部解读降为 B + C。
- 出错时为 `{error:{code,message}}`（如命盘不变量失败），此时停止解读并报告。

命题 `text` 是方法性、倾向性表述（如"更偏向打破旧结构、承受调整成本并重建新局面"），可直接转述，但要放回具体宫位与会照里讲，不要孤立罗列。

### `periods[]`（运限，time_scope 非 natal 时）

每年一项：

- `year`、`target_datetime`（固定取当年 7 月 1 日）。
- `decadal` / `yearly`：
  - `stem_branch`：该运限干支。
  - `life_palace_maps_to`：该运限命宫落在本命哪一宫（如流年命宫 = 本命财帛宫）。
  - `role_to_natal`：运限十二宫职 → 本命宫，如 `{"官禄宫":"命宫", ...}` 表示"流年官禄落本命命宫"。
  - `mutagens`：该层四化 `{禄,权,科,忌}`。
- `dynamic_features[]`：
  - `overlay_map`（B）：与 `role_to_natal` 同义的逐宫事实。
  - `period_mutagen`（B）：运限四化星落在本命哪宫、该宫在运限中的宫职。
  - `mutagen_stack`（C）：同一颗星在本命、大限、流年多层被化（如本命化忌、流年化禄）。
- `annual_overview`：流年总览模板的已审核命题匹配结果。目前流年层命题尚未审核，通常为空并带 `ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED`。

## 解读次序建议

1. `chart` 定盘：五行局、命身宫、命主身主、生年四化。
2. 主题宫：`palace_star_system` + `brightness_state` + `palaces[i].minor_stars`；空宫看 `empty_palace_borrow`。
3. `relation_set` + `sanfang_aggregate` 讲三方四正，`jia_palace` 讲夹。
4. 生年四化落宫（B）→ `flying_mutagen` 宫干飞化（C），重点看化忌与 `clash_palace`。
5. 把 `evidence.topic_report.conclusions` 放进上述结构中引用。
6. 运限：`life_palace_maps_to` → `role_to_natal` 找主题宫在运限中变成什么宫职 → `period_mutagen` 看运限四化是否落入主题宫或其三方四正 → `mutagen_stack` 看多层叠化。
7. 把 `limitations` 与 `warnings` 写进报告的限制部分。

## 错误码

`{"ok":false,"code":...,"error":...}` 且退出码 1：

| code | 含义 | 处理 |
| --- | --- | --- |
| `BIRTH_INCOMPLETE` | 缺日期、时间或性别 | 追问；不默认午时 |
| `PROFILE_BIRTH_TIME_INVALID` | 时间格式或取值非法 | 请用户核对 |
| `PROFILE_GENDER_INVALID` | 性别无法识别 | 追问 |
| `TOPIC_UNSUPPORTED` | topic 不在四类内 | 归入最接近的一类重跑 |
| `TIME_SCOPE_INVALID` | 年份非整数或区间颠倒 | 修正参数 |
| `TIME_SCOPE_TOO_WIDE` | 区间超过 10 年 | 缩小区间或分段 |
| `TARGET_BEFORE_BIRTH` | 运限年份早于出生 | 修正年份 |
| `TARGET_OUT_OF_DECADAL_RANGE` | 年份超出十二个大限 | 修正年份 |
| `BAD_JSON` / `NO_INPUT` | 输入问题 | 修正调用 |
