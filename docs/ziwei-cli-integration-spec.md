# 紫微 CLI 接入规格：从用户档案到十二宫数据

> 状态：CLI 已实现；Worker、UI 与持久化尚未接入
> 日期：2026-07-26
> 目标版本：v1（本命盘 + 可选运限快照）

## 1. 结论

紫微排盘应复用现有 `bazi_profiles` 中已经校正过的出生信息，而不是让用户重复建档；CLI 只做确定性排盘，不访问数据库、不调用 LLM、不写回档案。

建议将 [`iztro`](https://github.com/SylarLong/iztro) 固定到 `2.5.8`，以 `astro.withOptions()` 的公历输入模式生成本命盘。该库支持早、晚子时（`timeIndex` 为 `0..12`）、十二宫、星曜、四化与运限；项目为 MIT 许可证。具体 API 以 [官方文档](https://docs.iztro.com/quick-start) 为准。

```mermaid
flowchart LR
  A["已授权的 bazi_profiles 行"] --> B["Worker：选取最小字段并校验所有权"]
  B --> C["ZiweiProfileAdapter\n规范化为 CLI 输入快照"]
  C --> D["scripts/ziwei_cli.cjs\niztro 确定性排盘"]
  D --> E["稳定 JSON 契约\n十二宫 / 星曜 / 本命四化"]
  E --> F["后续 UI、报告或解读层"]
```

本规格不新增 UI、HTTP 路由、数据库迁移或解读文案；这些均留给后续实现任务。

## 2. 范围与非目标

### v1 范围

- 从一个已授权用户档案构造紫微本命盘输入。
- 输出完整十二宫及其主星、辅星、杂曜、宫干支、身宫标记、大限区间与本命四化。
- 可选按指定公历日生成大限、流年、流月、流日、流时快照。
- 输出足以供前端渲染与后续规则/LLM 解读使用的稳定、可审计 JSON。

### 非目标

- 不根据 `bazi_str` 或四柱反推出生日期。
- 不自行实现安星诀；排盘以锁定版 `iztro` 的默认口径为唯一计算源。
- 不生成吉凶解释、健康/财务建议、格局断语、合盘或真太阳时二次修正。
- 不把完整出生地点、姓名或原始 profile 直接透传到 CLI 输出。
- v1 不缓存、不向 `bazi_profiles` 写入 `ziwei_detail`，也不新增数据库列。

## 3. 口径决策

| 主题 | v1 决策 | 原因 |
| --- | --- | --- |
| 排盘库 | `iztro@2.5.8` | 与当前 Node/Vue/Worker 栈匹配，支持十二宫与运限。 |
| 日历输入 | 校正后的公历日期 | `iztro` 的 `bySolar/withOptions` 直接接收公历；用户不必再处理农历和闰月。 |
| 时区 | `Asia/Shanghai` | 当前档案与产品的默认出生时间口径。跨时区档案须先在档案层明确转换。 |
| 真太阳时 | 只复用档案的 `adjusted_birth_date` | 现有档案已计算平/真太阳时；CLI 禁止再以经纬度重复修正。 |
| 子时 | 使用 `iztro` 的早子时 `0` / 晚子时 `12` | 避免把 23:00 与 00:00 合并而改变命、身宫；日期不由适配层额外加减。 |
| 闰月 | `fixLeap: true` | 与 `iztro` 默认值一致；公历入口下仅作为锁定配置和审计字段保留。 |
| 流派配置 | `iztro-default`，不载入插件 | v1 先保证单一可复现口径；四化表或亮度差异以后以显式版本化配置扩展。 |

`iztro` 将子时拆成早子时（00:00–01:00）与晚子时（23:00–24:00），因此本产品不得沿用八字模块的“夜子时”推断去擅自改日期。输入的民用日期由 `adjusted_birth_date` 决定，时段由 `timeIndex` 决定。

## 4. 档案字段映射

### 4.1 读取原则

Worker 必须先按 `profileId` 查询档案并验证 `profile.user_id === user.id`，再把最小化快照传给 CLI。CLI 不持有 Supabase 凭据，也不接受未经服务端验证的数据库 ID。

建议新增专用选择字段常量，而不是复用包含八字解读内容的全量 select：

```text
id, user_id, gender, birth_date, adjusted_birth_date,
birth_location, birth_latitude, birth_longitude,
solar_time_mode, solar_time_adjustment_minutes
```

### 4.2 映射表

| `bazi_profiles` 字段 | CLI 输入字段 | 规则 |
| --- | --- | --- |
| `id` | `source.profile_id` | 仅作为审计引用；不得进入排盘计算或公开结果。 |
| `gender` | `birth.gender` | 归一为 `男` / `女`；`M`、`male`、`乾造` 映射为男，`F`、`female`、`坤造` 映射为女。其他值拒绝。 |
| `adjusted_birth_date` | `birth.solar_datetime` | 存在且合法时优先使用；这是本命盘唯一的首选时间。 |
| `birth_date` | `birth.original_solar_datetime` | 始终仅作审计展示；仅当旧档案没有 `adjusted_birth_date` 时作为计算回退。 |
| `birth_longitude`、`solar_time_mode`、`solar_time_adjustment_minutes` | `source.time_correction` | 只记录来源与差值，绝不在 CLI 再计算。 |
| `birth_location`、`birth_latitude` | 无 | 默认不传给 CLI/输出；仅由上游在错误提示或审计日志中使用。 |
| `bazi_str`、`bazi_detail` | 无 | 禁止作为紫微输入，避免四柱口径、子时口径与真实出生信息相互污染。 |

### 4.3 选择出生时间

```text
effective_datetime =
  adjusted_birth_date（合法且字段存在）
  ?? birth_date（仅旧档案兼容）

time_source =
  "profile_adjusted" | "profile_legacy_clock"
```

若回退到 `birth_date`，输出必须附带 `warnings: ["ZIWEI_USING_UNADJUSTED_PROFILE_TIME"]`。该警告不是静默容错：当民用时间接近时辰边界、或业务端要求真太阳时一致性时，调用方应要求用户补齐/重新保存出生地与太阳时设置。

## 5. 时间到 `timeIndex` 的映射

在所有区间使用左闭右开语义。归一后的 `solar_datetime` 已经可能因档案太阳时修正跨日，必须先完成该日期归一化，再算索引。

| `timeIndex` | 时段 | 显示名称 |
| ---: | --- | --- |
| 0 | `[00:00, 01:00)` | 早子时 |
| 1 | `[01:00, 03:00)` | 丑时 |
| 2 | `[03:00, 05:00)` | 寅时 |
| 3 | `[05:00, 07:00)` | 卯时 |
| 4 | `[07:00, 09:00)` | 辰时 |
| 5 | `[09:00, 11:00)` | 巳时 |
| 6 | `[11:00, 13:00)` | 午时 |
| 7 | `[13:00, 15:00)` | 未时 |
| 8 | `[15:00, 17:00)` | 申时 |
| 9 | `[17:00, 19:00)` | 酉时 |
| 10 | `[19:00, 21:00)` | 戌时 |
| 11 | `[21:00, 23:00)` | 亥时 |
| 12 | `[23:00, 24:00)` | 晚子时 |

分钟不参与本命排盘；其唯一作用是可靠地决定所属时段。若入参只含日期、没有时分，或时间不是可验证的 `00:00..23:59`，CLI 必须返回错误，不能静默默认为午时。

## 6. CLI 契约

### 6.1 调用形式

目标文件为 `scripts/ziwei_cli.cjs`，调用方式与现有八字 CLI 对齐：标准输入 JSON、`--file`，以及面向人工诊断的 flags。生产 Worker 只使用 stdin JSON，防止参数转义与隐私泄露。

```text
echo '<input-json>' | node scripts/ziwei_cli.cjs
node scripts/ziwei_cli.cjs --file ziwei-input.json
```

CLI 不读取、也不写入任何 profile 表。输入可以是 Worker 构造的 `profile_snapshot`，也可由测试直接提供同形状的 `birth`。

### 6.2 输入 JSON

```json
{
  "mode": "natal",
  "profile_snapshot": {
    "profile_id": "uuid-only-for-trace",
    "gender": "女",
    "birth_date": "2000-08-16 03:30:00",
    "adjusted_birth_date": "2000-08-16 03:18:00",
    "solar_time_mode": "apparent",
    "solar_time_adjustment_minutes": -12
  },
  "options": {
    "language": "zh-CN",
    "school": "iztro-default",
    "include_horoscope": false
  }
}
```

当 `options.include_horoscope` 为 `true` 时，必须额外提供 `target_datetime`（`YYYY-MM-DD` 或含时分的 ISO 本地时间）。它只影响 `horoscope` 段，绝不改写 `natal` 段。

### 6.3 `iztro` 调用边界

适配层生成以下等价参数，而不是让业务层散落直接调用：

```text
astro.withOptions({
  type: "solar",
  dateStr: effective_datetime 的 YYYY-M-D,
  timeIndex,
  gender: "male" | "female",
  fixLeap: true,
  language: "zh-CN"
})
```

`astro.config()` 是全局配置。v1 不调用它；若未来支持其他流派，必须将配置名、配置内容哈希和库版本写入 `engine`，并在一个 CLI 进程中只加载一种配置。

## 7. 输出 JSON：宫位信息的稳定模型

输出应是对第三方对象的归一化快照，不能把可调用的 `FunctionalAstrolabe` 或未筛选的原始对象序列化给前端。`palaces` 固定为 12 项，按地支顺序 `寅 → 卯 → … → 丑` 排列；业务查找应使用 `palace_key`，不得依赖数组下标。

```json
{
  "ok": true,
  "schema_version": "ziwei-cli/v1",
  "engine": {
    "library": "iztro",
    "library_version": "2.5.8",
    "school": "iztro-default",
    "calendar": "solar",
    "language": "zh-CN",
    "fix_leap": true
  },
  "input": {
    "time_source": "profile_adjusted",
    "solar_datetime": "2000-08-16 03:18:00",
    "time_index": 2,
    "time_label": "寅时",
    "gender": "女",
    "time_correction_minutes": -12
  },
  "natal": {
    "solar_date": "2000-8-16",
    "lunar_date": "二〇〇〇年七月十七",
    "chinese_date": "庚辰 甲申 丙午 庚寅",
    "five_elements_class": "木三局",
    "soul": "破军",
    "body": "文昌",
    "soul_palace_branch": "午",
    "body_palace_branch": "戌",
    "natal_mutagens": { "禄": "", "权": "", "科": "", "忌": "" },
    "palaces": []
  },
  "horoscope": null,
  "warnings": []
}
```

`natal_mutagens` 的值必须取自本次锁定库版本的实际结果；上例中的空字符串只是结构占位，不是固定规则。

每项 `palaces[]` 的必备字段如下：

| 字段 | 说明 |
| --- | --- |
| `palace_key` | 稳定键：`命宫`、`兄弟宫`、…、`父母宫`；源库无“宫”字时由适配层统一补齐。 |
| `index` | `0..11`，仅表示地支顺序位置。 |
| `heavenly_stem` / `earthly_branch` | 该宫的干支，不自行推导。 |
| `is_body_palace` / `is_original_palace` | 身宫及来因宫标记，按源库结果输出。 |
| `major_stars` / `minor_stars` / `adjective_stars` | 星曜对象数组，至少保留 `name`、`type`、`scope`、`brightness`（若源库提供）。 |
| `changsheng12` / `boshi12` / `jiangqian12` / `suiqian12` | 本命辅助手段；源库无值时为 `null`，不猜测。 |
| `decadal` | `{ start_age, end_age, heavenly_stem }`，由源库 `stage` 归一而来。 |
| `ages` | 小限年龄数组；仅输出源库已有值。 |
| `relations` | `{ opposite, trine }`，值为其他 `palace_key`；由固定十二地支相对位置导出。 |

`relations.opposite` 必须为相隔六宫，`relations.trine` 必须为相隔四、八宫的两个宫位。它只是方便 UI/规则读取的结构化关系，不替代第三方库的星曜查询能力。

### 7.1 可选运限快照

当请求带 `target_datetime`，输出：

```json
{
  "target_datetime": "2026-07-26 12:00:00",
  "decadal": { "index": 0, "heavenly_stem": "", "earthly_branch": "", "palace_keys": [], "mutagens": [] },
  "yearly": { "index": 0, "heavenly_stem": "", "earthly_branch": "", "palace_keys": [], "mutagens": [] },
  "monthly": null,
  "daily": null,
  "hourly": null
}
```

除 `target_datetime` 外，所有动态星曜与四化都必须来自同一次 `astrolabe.horoscope()`；不得把本命四化与流年四化混为同一字段。

## 8. 校验、错误与隐私

### 8.1 错误契约

错误使用非零退出码，stdout 只输出一条 JSON：

```json
{
  "ok": false,
  "error": {
    "code": "PROFILE_BIRTH_TIME_MISSING",
    "message": "紫微排盘需要精确的出生日期、时间与性别。"
  }
}
```

| 错误码 | 触发条件 |
| --- | --- |
| `BAD_JSON` | stdin 或 `--file` 不是合法 JSON。 |
| `PROFILE_INCOMPLETE` | 缺少 profile snapshot、日期或性别。 |
| `PROFILE_BIRTH_TIME_MISSING` | 只有日期、没有合法的时分。 |
| `PROFILE_BIRTH_TIME_INVALID` | 时分越界或不能解析。 |
| `PROFILE_GENDER_INVALID` | 不能归一为男/女。 |
| `TARGET_DATETIME_INVALID` | 请求运限但目标时间不合法。 |
| `ZIWEI_LIBRARY_ERROR` | 第三方库异常；仅记录安全的错误摘要。 |
| `ZIWEI_CHART_INVALID` | 未得到完整十二宫、命宫或身宫等基本不变量。 |

### 8.2 数据最小化

- CLI 输入、stdout、测试 fixture 禁止出现姓名、详细出生地、经纬度、用户 ID、token 或原始 profile 全量数据。
- Worker 审计日志仅可记录 `profileId`、引擎/模式、schema 版本、输入时间来源与错误码；禁止记录出生日期时间的原文。
- CLI 输出不持久化。未来如做缓存，必须保存 `input_fingerprint`（非可逆哈希）、`engine` 和 `schema_version`，并按档案的访问控制读取。

## 9. 验收与回归基线

实现时至少建立以下自动化测试；所有测试 fixture 使用公开或虚构生日，禁止使用真实用户档案。

1. **档案优先级**：有 `adjusted_birth_date` 时，CLI 输入必须选它；没有时回退 `birth_date` 并产生唯一警告。
2. **跨日校正**：太阳时修正令日期跨日的 fixture，必须使用校正后的日期与时段。
3. **双子时**：同一民用日期的 `00:30` 和 `23:30` 分别映射 `0`、`12`，且不由适配层更改日期。
4. **时辰边界**：01:00、03:00、23:00 的 `timeIndex` 归类稳定，分钟不影响同一时段内结果。
5. **性别**：男、女及历史别名都归一正确；未知值硬失败。
6. **盘面不变量**：恰好 12 宫；宫名无重复；命宫恰好一项；身宫恰好一项；每宫都有地支与大限范围。
7. **关系不变量**：每个对宫互为对宫；每个三合恰为两个不同宫位。
8. **库版本锁定**：输出 `engine.library_version` 与锁文件一致；升级依赖须重新跑全部 fixture。
9. **外部对照**：从 NotebookLM 的《紫微斗数全书》名人盘中补录可确认出生信息的案例，先核对口径，再纳入 golden cases；资料未给完整生日或流派口径的案例不得强行入库。

## 10. 后续实现清单（不在本次变更）

| 顺序 | 产物 | 责任 |
| ---: | --- | --- |
| 1 | `iztro@2.5.8` 依赖与 lockfile 更新 | 已完成 |
| 2 | `lib/ziweiProfileAdapter`：profile 最小快照、时间选择、性别/时辰归一 | 已完成 |
| 3 | `scripts/ziwei_cli.cjs`：stdin/文件/flags、稳定 JSON、错误码 | 已完成 |
| 4 | CLI 与适配层单元测试、golden fixtures | 已完成基础契约测试；名人 golden cases 待补 |
| 5 | Worker 的只读 `profileId → CLI input` 调用与授权检查 | 服务端 |
| 6 | 紫微本命盘 UI 与显示字段 | 前端 |
| 7 | 可选缓存、运限页、规则解读与 LLM 文案 | 后续产品阶段 |

在第 5 步之前，CLI 可独立验证，但不应对外暴露为允许任意 profile ID 查询的接口。

## 11. 代码位置映射

| 现有位置 | 本规格依赖的事实 |
| --- | --- |
| `src/utils/baziProfileInput.mjs` | `birth_date`、`adjusted_birth_date`、地点与太阳时字段的生成规则。 |
| `src/baziProfileFields.mjs` | 当前档案选择字段与最小读取策略。 |
| `scripts/bazi_cli.cjs` | 现有确定性 CLI 的 stdin/file/flags、JSON 错误输出风格。 |
| `worker/src/index.js` | 既有 profile 所有权校验与 Worker 调用模式。 |
| `docs/birthplace-data.md` | 出生地与经纬度的来源、隐私边界。 |

## 12. 待确认项

- 是否将 v1 的默认口径正式命名为“iztro 默认口径”，还是在产品中标注某一传统流派名称；在决定前不得混用现有紫微 skill 的三合派默认表。
- 用户选择“民用时”与“平/真太阳时”后，是否允许以不同时间版本并存两张紫微盘；本规格暂时只读取档案当前保存的校正时间。
- 未来 `ziwei_detail` 的缓存粒度与数据库迁移；必须先确定 profile 更新时的失效规则。
- NotebookLM 的《紫微斗数全书》目前主要适合作为界面/结果校验材料，尚缺完整安星诀章节；需要补充可公开引用的理论与案例基线。
