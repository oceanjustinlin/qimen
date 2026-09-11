# bazi_cli.cjs 输入/输出解读指南

脚本源码：`scripts/bazi_cli.cjs`。它是**确定性计算内核**，复用生产同源函数
（`lib/baziCore.buildCompleteBaziDetail` + `lib/baziQuestionCore.buildBaziQuestionPrompt`）。
脚本只算，不写文案；文案由你（LLM 层）产出。

## 输入 schema

```jsonc
{
  "mode": "question",          // "chart"=只排盘静态；"question"=排盘+动态问事。缺省：有 question 则 question，否则 chart
  "birth": {
    "calendar": "solar",       // v1 仅 solar（公历）；传 lunar 会被拒（CALENDAR_UNSUPPORTED）
    "year": 1990, "month": 5, "day": 1,
    "hour": 14, "minute": 0,   // 缺省 hour=12,minute=0（对齐生产；准确度下降，需向用户说明）
    "gender": "男"             // 男/女/M/F/乾造/坤造；只影响大运顺逆
  },
  "currentYear": 2026,         // 缺省=系统当前年
  "question": "……",           // mode=question 必填
  "route": {                   // 可选但强烈建议：你预判的分析类型
    "analysis_mode": "timing", // timing | status | pattern | character
    "time_scope": {"type": "next_5_years"}  // timing/status 用；也可 {start_year,end_year}
  }
}
```

- 不传 `route`：脚本用 `inferBaziRouteFromQuestion` 启发式兜底（偏保守，"今年到明年"常被判成 status 而非 timing）。**要应期扫描务必显式传 `analysis_mode:"timing"`。**

## 输出 schema

### `chart`（排盘，②）
- `bazi_str` 四柱，`day_master` 日主，`ri_zhu` 日柱，`qi_yun` 起运。
- `pillars[]` 每柱：`gan/zhi/star(主星)/hidden_stems(藏干+十神)/shi(十二长生)/zizuo(自坐)/nayin/kong(空亡)/shensha[]`。
- `dayun_list[]` 大运列（精简：`start_year/end_year/start_age/end_age/gan/zhi/shi_shen`）。
- `current_dayun` / `current_liunian` 当前大运、流年（完整柱结构）。

### `static`（原局静态决策，③，确定性）
- `strong_weak` 身强/身弱等；`strength_detail` 旺衰依据明细。
- `geju` 格局名；`geju_info` 格局释义。
- `five_shens`：`yong`(用神) / `xi`(喜) / `ji`(忌) / `chou`(仇) / `xian`(闲)，及 `favorable`/`unfavorable`、`yong_confidence`。
- `favorable_gods` / `unfavorable_gods` 喜忌十神。
- `tiaohou_detail` 调候；`chengge_detail` 成格/败格；`image_analysis` 象法（从格/专旺/化气等）。
- `decision_chain` 可审计的喜忌决策摘要；`classic_verdict` 《三命通会》断语。

### `question`（动态问事，④⑤，仅 mode=question）
- `route` 最终采用的语义路由（`analysis_mode/secondary_mode/target_source/time_scope`）。
- `engine_ran`：布尔。**false** = `llm_derived`/legacy，引擎未定出后端目标元素 → 你依 `static` 自行推导，并标明为结构推断。
- `target_spec` 用神落点（`primary_shishen`/`dynamic_focus`/`anchor_kind` 等）——推演的锚。
- `state_report` 原局针对目标元素的状态评估。
- `dynamic_report` 动态机制（伏吟/反吟/开库/三刑、大运 field 分类、合动/冲动等）。
- `timing_candidates[]` 应期候选年，已排序，含 `year`/`quality` 等；配合 `scanned_years` 看扫描范围。
- `limitations[]` 引擎自报的局限（如"无目标元素，跳过应期扫描"）。

## 解读次序建议

1. 先 `static` 定底色（旺衰→格局→喜忌五神）。
2. 再 `question.target_spec` 明确"这件事看哪个十神/宫位"。
3. 用 `state_report` + `dynamic_report` 讲当前大运流年对目标的引动（吉凶方向与力度）。
4. `timing` 类问题落到 `timing_candidates` 的高分年，给"为什么是这几年"。
5. 全程凶象转译为风险/课题；结论以上述确定性产物为据。

## 错误码

`{"ok":false,"code":...,"error":...}` 且退出码 1：
- `BIRTH_INCOMPLETE` 生辰缺失/非法 → 追问。
- `CALENDAR_UNSUPPORTED` 传了农历 → 先换算成公历。
- `QUESTION_REQUIRED` mode=question 缺 question。
- `BAD_JSON` / `NO_INPUT` 输入问题。
