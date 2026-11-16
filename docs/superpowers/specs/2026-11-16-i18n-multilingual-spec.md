# 多语言适配 Spec（简体 / 繁體 / English）

- 日期：2026-11-16
- 状态：待拍板（见 §10），未实现
- 取代：`docs/superpowers/plans/2026-07-26-i18n-english-rollout.md`（下称「旧计划」）。旧计划保留作历史参考，实现一律以本文为准。
- 读者：负责实现的工程代理（按任务独立执行）与评审人。每个任务都写了文件、接口、验收用例，可以单独开 PR。

---

## 1. 一页结论

1. **语言集合定为三种**：`zh-CN`（基准，线上现状）、`zh-TW`（繁體）、`en-US`。旧计划只有中英两种，但仓库 README 已是三语，issue #24 是繁体用户提的，繁体的成本又远低于英文，所以加进来并排在英文前面。
2. **繁体不翻译，只在展示层做简转繁**。存储、引擎、Prompt、缓存、LLM 输出全部保持简体，浏览器里把整页文字转成繁体，加一份命理术语保护词表。这样繁体可以先于英文独立上线，不拆缓存、不改 Prompt、不多花一分钱 LLM。
3. **英文分四层处理**：界面文案走 `vue-i18n` 词条；干支、十神、门星神这类符号走统一术语表；LLM 断语在 system prompt 尾部追加固定的「输出语言 + 术语」块，直接生成英文；规则引擎自己写的中文断语（旧计划漏掉的最大一块，`lib/` 下 7,700 多行含中文）走「离线词条 + 运行时翻译记忆」。
4. **盘面上的字保持汉字**。九宫格、四柱表、紫微十二宫、方印、十二时辰格里的干支和门星神不翻译；英文释义出现在点宫详情、卡片正文和图例里，格式统一为 `Open Door (开门)`。PR #41 的版式因此不用为英文重排。
5. **已生成的内容不回头翻译**。每条记录记下生成语言，历史记录按原语言显示，追问沿用那一局的语言；想要新语言的八字断语，用现有的「重新生成」按钮。
6. **不砍功能、不加步骤、不动主题**。唯一新增的控件是账号菜单里「主题」下面的一行「语言」，交互与主题行相同（单击循环）。所有新样式只用现有 token，深浅两套主题逐页截图验收。
7. **五个里程碑，各自可上线**：M0 地基 → M1 繁體 → M2 英文界面 → M3 英文 LLM 输出 → M4 英文引擎断语 → M5 搜索引擎与外围。建议上线顺序就是这个顺序；M1 做完即可对外说「支持繁體」，M3 做完才可以对外说「支持英文」。

---

## 2. 旧计划重审

旧计划写于 2026-07-26，11 个任务、两个里程碑（A 英文界面，B 英文生成内容）。实际落地的只有 Task 1 的一小部分。

### 2.1 已落地的部分（可直接复用）

| 内容 | 位置 | 现状 |
| --- | --- | --- |
| `vue-i18n@^11.4.0` 依赖 | `package.json` | 已安装 |
| locale 运行时 | `src/i18n/index.mjs` | 有 `normalizeLocale`、`getInitialLocale`、`persistLocale`、`createI18n`；只支持 `zh-CN`、`en-US`；没有 `setLocale` |
| 词条文件 | `src/i18n/locales/{zh-CN,en-US}.mjs` | 各 7 行，只有 `nav.qimen/bazi/fortune` 三个键 |
| 挂载 | `src/main.js` | `app.use(i18n)` 已有 |
| 实际使用 | 全部 `.vue` | **0 处**调用 `t()` / `$t()`，所有界面文字仍是硬编码中文 |
| 路由英文元信息 | `src/router/index.js`、`functions/_middleware.js` | 部分路由已有 `titleEn` / `descriptionEn`，但没有任何代码读取 |

### 2.2 旧计划里仍然成立的决定（本文沿用）

- 业务 code 永不翻译：`career_business`、`M`、`positive`、`engine_ready` 等保持为 API 和数据库标识。
- 汉字符号是原始数据：格式化函数可以显示 `Jia (甲)`，但交给引擎和入库的永远是 `甲`。
- 动态拼接翻译键只允许出现在一个适配器文件里，且必须走显式映射表。
- 请求显式携带 `locale`，Worker 把不认识的值归一到 `zh-CN`。
- 英文请求绝不能命中中文生成内容的缓存。
- 不批量改写数据库里已有的中文内容。
- 英文法律文本未经审核不得当作正式条款上线。

### 2.3 已经过时的部分

| 旧计划内容 | 现状 | 本文处理 |
| --- | --- | --- |
| Task 2 把 `LocaleMenu.vue` 挂到「全局 header」 | `App.vue` 没有全局 header，只有底部导航；各页右上角是 `AccountMenu`，主题切换就在里面 | 语言入口放进 `AccountMenu`，不新建全局 header（T0.2） |
| Task 2/3 提到的 `InstallPrompt.vue`、`UPDATE_PANEL_MATRIX`、更新提示 | 这些已不存在 | 删除相关步骤 |
| Task 5 的组件清单 | PR #29 新增 `ZiweiChartPanel.vue`；PR #41 改了结果页（方印、刻度条、九宫点宫详情）、问事首页（命主栏、最近问过）、运势页（十二时辰格）；PR #44 换了 loading 动画（`WenshiOrb.vue` 转盘）；PR #45（在途）重做八字原局/动态面板与结果页九宫 | 清单按现状重列（§4、T2.x）；PR #45 合并后再做 T2.5b |
| Task 8 写「给 `lib/fortune*Core.js` 加输出语言指令」 | 周运、年运、月运评分是纯规则产出，根本不过 LLM，加指令没用 | 归入「引擎断语」单独处理（M4） |
| Task 8 的 prompt 清单 | PR #46/#47 把奇门拆成 system/user 两段并依赖 DeepSeek 前缀缓存；奇门 user prompt 现在直接写在 `worker/src/index.js` 里 | 输出语言块必须是固定文字、追加在 system 末尾，保护前缀缓存（T3.2） |
| Task 8 新建 `localized_reports` 表 | 现有内容分散在 `qimen_records.qimen_data`、`bazi_profiles`、`fortune_cache` 三处，新表要求所有读路径双读 | 不建新表：记录内记生成语言，缓存键加语言后缀（T3.5） |
| Task 9 英文路由别名 `/en/...` | 仍可行，但与产品功能无关 | 降到 M5，且需拍板（§10） |

### 2.4 旧计划漏掉的部分（本文新增）

1. **繁體中文**，以及繁体用户输入的归一（规则路由的关键词全是简体）。
2. **引擎断语**。`lib/` 里有 7,714 行含中文（不含古籍原文数据），其中相当一部分是直接给用户看的确定性句子：格局断语库 `baziPatternStatements.js`、周运事件预告 `fortuneWeeklyCore.js` 的 `EVENT_FORECAST`、奇门评分命中理由 `qimenScoringEngine.js`、神煞说明 `constants/shensha.js` 等。旧计划对这一块没有方案。
3. **Prompt 里的字数要求**（如「35-80 字」）在英文下没有意义，需要英文长度规则。
4. **输出语言校验**。DeepSeek 在中文 prompt 下偶尔会无视「用英文写」，需要检测与重试。
5. **Worker 里依赖中文字符串的逻辑**：`error.message.includes('额度')` 出现 3 处；`sanitizeUserText` 用中文正则清洗；前端按中文原值拼 CSS 类名（`.ss-吉`、`.nature-凶`、`.mu-禄`）。
6. **英文提问的路由**：规则路由关键词全是中文，英文问题会全部落到 LLM 兜底分类，需要验证并记入成本。
7. **追问的语言一致性**：追问是在原文上打补丁，语言必须跟那一局走。
8. **紫微盘**（PR #29）、**紫微 LLM 解读**（PR #48 设计中）、**双人合盘重设计**（PR #49 设计中）与多语言的关系。
9. **深浅主题不受影响**的验收方法。

---

## 3. 目标、非目标、原则

### 3.1 目标

- 用户可以在账号菜单里切换 简体 / 繁體 / English，刷新后保持。
- 繁體：全站界面、盘面、引擎断语、LLM 断语、历史记录都以繁体显示，术语用字符合台港命理习惯（`日干` 不是 `日幹`，`丑` 不是 `醜`，`斗君` 不是 `鬥君`）。
- English：界面、表单、错误提示、加载步骤、LLM 断语、引擎断语、出生地搜索均为英文；盘面符号保留汉字并有英文释义。
- 三种语言 × 深浅两套主题，布局不破、无溢出。

### 3.2 非目标

- 不做日文、韩文等第四种语言；但所有接口按「可再加语言」设计。
- 不翻译引擎内部数据、数据库字段、日志、审计快照、Langfuse trace。
- 不翻译管理员页 `AdminView.vue`、两个内部演示页 `BaziStaticPanelDemo.vue` / `BaziDynamicPanelDemo.vue`、`public/m3-mockup.html`。
- 不改 `public/wrapped.html`（朋友合盘）。它将被 PR #49 的重设计替换，届时按 §5.11 的契约接入。
- 不改 `packages/xuanxue-mcp`、`packages/xuanxue-dsh`（它们面向终端里的模型，输出语言由宿主模型决定）。
- 不改任何排盘、取用神、评分算法；不改任何颜色 token。
- 不为历史记录做批量翻译或回填。

### 3.3 原则（实现时每个 PR 都要对照）

1. **不砍既有功能**。任何语言下，简体现有的每个控件、每块信息都必须存在。某块内容暂时没有译文时，显示原文，不隐藏。
2. **不加线上没有的交互步骤**。不弹语言选择框，不加「翻译此内容」按钮，不加确认弹窗。语言行是唯一新控件。
3. **简体零回归**。`zh-CN` 下的 DOM 文字、请求体（除多一个 `locale` 字段）、缓存键、数据库写入内容与改造前逐字一致。每个任务的验收都含这一条。
4. **深浅主题同时验收**。新样式只引用 `src/styles/global.css` 里的现有 token（`--ink`、`--paper`、`--line`、`--gold`、`--chrome` 等），不写死颜色值，不新增 token。
5. **英文一期不要求 100% 无中文**。符号保留汉字是设计决定，不是遗留问题。

---

## 4. 现状盘点

统计口径：非测试文件里含 CJK 字符的行数（含注释）。

### 4.1 前端 `src/`（45 个文件，3,108 行）

| 文件 | 含中文行 | 说明 |
| --- | --- | --- |
| `views/HomeView.vue`（6,841 行） | 933 | 模板 112 行；脚本 568 行，其中大量是拼 HTML 字符串的结果卡（`buildCardHTML` 等，经 `v-html="resultHtml"` 输出）、加载步骤文案、示例问题 21 条、分类标签 |
| `views/BaziView.vue`（7,303 行） | 679 | 模板 194 行（档案表单、档案管理、断事笔记、基调、命局面板）；脚本 394 行 |
| `components/BaziStaticPanel.vue` | 212 | 原局面板，脚本里有 109 行映射表与说明 |
| `views/FortuneView.vue` | 173 | 日/周/月/年四个页签 |
| `utils/baziShensha.mjs` | 159 | 浏览器端的神煞表与说明 |
| `components/BaziDynamicPanel.vue` | 83 | 岁运面板 |
| `views/EngineeringView.vue` | 75 | 「关于」页 |
| `views/LegalView.vue` | 75 | 用户协议、隐私政策全文 |
| `components/ZiweiChartPanel.vue` | 65 | 紫微盘（PR #29），`utils/ziweiChart.mjs` 里 `iztro` 固定 `language: 'zh-CN'` |
| `components/WenshiOrb.vue` | 47 | loading 转盘上的地支、八门、十干、五行（属于盘面符号，不翻译） |
| `utils/baziLocalMatrix.mjs`、`baziProfileInput.mjs`、`baziTransit.mjs`、`ziweiChart.mjs`、`monthlyScoreHits.mjs`、`qimenCardFallbacks.mjs` | 13–47 | 浏览器端计算与兜底文案 |
| `components/BaziBackingPanel.vue`、`BaziPillarTable.vue`、`AccountMenu.vue`、`TimePickerSheet.vue`、`OpenSourceLinks.vue`、`AfdianSupportLink.vue` | 3–39 | 共享组件 |
| `views/ReportView.vue`、`FeedbackView.vue`、`ResetPasswordView.vue` | 11–18 | 次要页面 |
| `router/index.js`、`main.js`、`App.vue` | 2–24 | 路由元信息、默认标题、底部导航四个标签 |

注意三处「中文原值当 CSS 类名」：`BaziView.vue` 的 `.ss-吉/.ss-凶/.ss-中性`、`.nature-吉/…`，`BaziBackingPanel.vue` 的 `.nature-*`，`ZiweiChartPanel.vue` 的 `.mu-禄/.c-权/.s-科/.f-忌`。类名绑定的是原始数据，翻译只能改显示文字，不能改绑定值。

### 4.2 Worker `worker/src/index.js`（2,993 行，272 行含中文）

16 个接口。按是否过 LLM 分：

| 接口 | 过 LLM | 用户可见中文的来源 |
| --- | --- | --- |
| `POST /api/qimen` | 是（流式 9 段哨兵） | SSE 进度 chip（`初分 72`、`发现 3 个窗口`）、`engine_complete.tags`、LLM 8 段正文 + `data_json`、后处理兜底句、`verdict_label`（大吉/小吉/平/凶）、`formation_tags` |
| `POST /api/qimen-followup` | 是 | 补丁正文、错误提示 |
| `POST /api/bazi-question` | 是（流式哨兵） | 同奇门，另有引擎面板数据 |
| `POST /api/bazi-followup` | 是 | 补丁正文 |
| `POST /api/bazi` | 是（3 段：`yuanju_core`、`current_dayun`、`current_liunian`） | 步骤 label、引擎先出的 `engine_*` 三段中文断语、LLM 三段；写入 `bazi_profiles` |
| `POST /api/bazi-calibrate` | 是 | 纠偏文字 |
| `/api/fortune-daily-interpretation` | 是（JSON） | 断语，写入 `fortune_cache`（`dimension='day'`） |
| `/api/fortune-monthly-interpretation` | 是（JSON） | 断语，写入 `fortune_cache`（`dimension='month_interpretation'`） |
| `/api/fortune-daily`、`-weekly`、`-monthly`、`-annual` | 否 | 纯规则：周运标签与事件预告、评分命中理由、层名 |
| `POST /api/bazi-panel` | 否 | 面板数据 |
| `POST /api/divination-route` | 分类用（输出是 code） | `reason` 字段 |
| `/api/context-notes` | 否 | 用户自己写的内容 |
| `POST /api/compatibility/init` | 否 | 合盘（PR #49 将重做） |

缓存与持久化：

- 进程内存缓存 `qimenMemoryCache`，键为 `年-月-日-时辰干支-问题-八字前15字`，**不含语言**。
- `fortune_cache` 表，唯一键 `(user_id, dimension, period_key)`，**不含语言**。
- 浏览器 `localStorage`：`qimen:fortune-cache:v1`，键 `userId::date::profileId`，**不含语言**。
- `qimen_records.qimen_data`（前端写）存整份结果 JSON，含 LLM 正文与追问。
- `bazi_profiles` 的 `bazi_summary`、`display_*`、`llm_*`、`engine_*` 列与 `bazi_detail` JSON 存八字断语；`bazi_summary` 还会作为运势 prompt 的输入。

### 4.3 Prompt 构建函数（`lib/`）

| 函数 | 文件 | 输出给用户看 |
| --- | --- | --- |
| `buildQimenSystemPrompt()`（固定文字，吃前缀缓存）+ Worker 内联的 user prompt | `qimenPromptSections.js` | 是 |
| `buildBaziQuestionPrompt()` + Worker 的 `convertPromptToTextMode()` | `baziQuestionCore.js` | 是 |
| `buildBaziProfileSectionPrompt()` | `baziLlmSections.js` | 是 |
| `buildCalibrationPrompt()` | `baziCalibrationPrompt.js` | 是 |
| `buildInterpretationPrompt()` | `fortuneDailyCore.js` | 是 |
| `buildMonthlyInterpretationPrompt()` | `fortuneMonthlyInterpretationCore.js` | 是 |
| `buildFollowupPatchPrompt()`、`buildBaziFollowupPrompt()` | `wenshiFollowup.js` | 是 |
| `buildLlmRoutePrompt()`、`buildBaziSemanticRoutePrompt()`、`buildFollowupClassifierPrompt()` | `divinationRouter.js`、`wenshiFollowup.js` | 否（输出 code，保持中文不动） |

所有 prompt 当前都写死「用自然成段的中文」以及按「字」计的长度。

### 4.4 繁体转换实测

用 `opencc-js@1.4.2` 的 `cn → tw` 预设对约 200 个本项目术语做了转换，通用词没有问题，但命理用字有系统性错误：

| 简体 | OpenCC 输出 | 应为 |
| --- | --- | --- |
| 时干 / 月干 / 藏干 | 時幹 / 月幹 / 藏幹 | 時干 / 月干 / 藏干 |
| 年干落宫 | 年乾落宮 | 年干落宮 |
| 日干克时干 | 日干克時幹 | 日干剋時干 |
| 丑未冲 | 醜未衝 | 丑未沖 |
| 斗君 | 鬥君 | 斗君 |
| 空亡冲填 | 空亡衝填 | 空亡沖填 |
| 天冲星 | 天衝星 | 天沖星（待拍板，见 §10） |

`相冲→相沖`、`相克→相剋`、`农历→農曆`、`紫微斗数→紫微斗數`、`咸池→咸池`、`七杀→七殺` 等是对的。结论：通用转换可用，但必须先过一份命理保护词表。体积：`cn2t` 包 1.1 MB，gzip 后 452 KB，只能在繁体下懒加载；反向的 `t2cn` 109 KB（gzip 52 KB）。

---

## 5. 总体设计

### 5.1 两个语言概念

| 概念 | 取值 | 含义 | 谁用 |
| --- | --- | --- | --- |
| 界面语言 `uiLocale` | `zh-CN` / `zh-TW` / `en-US` | 用户在菜单里选的 | 前端全部展示逻辑 |
| 内容语言 `contentLocale` | `zh-CN` / `en-US` | 内容实际以什么语言生成和存储 | Worker、Prompt、缓存键、记录 |

映射固定为：`zh-CN → zh-CN`，`zh-TW → zh-CN`，`en-US → en-US`。繁体没有自己的内容语言，这是整个设计省成本的关键。

### 5.2 四类文字 × 三种语言

| 类别 | 例子 | zh-CN | zh-TW | en-US |
| --- | --- | --- | --- | --- |
| A 界面文案 | 按钮、标签、占位符、提示、空状态 | 词条 `zh-CN.mjs` | 同简体词条，展示层转繁 | 词条 `en-US.mjs` |
| B 确定性符号与枚举 | 干支、五行、十神、门星神、宫名、分类、吉凶档位 | 原值 | 原值，展示层转繁 | 盘面内保留汉字；盘面外经术语表显示为 `English (汉字)` |
| C 引擎断语 | 格局断语、周运预告、评分理由、神煞说明 | 原文 | 原文，展示层转繁 | 离线词条 → 翻译记忆 → 实时翻译，超时回退原文（M4） |
| D LLM 断语 | 奇门/八字解读、运势断语、追问补丁 | 现状 | 生成简体，展示层转繁 | 直接生成英文（M3） |

用户自己写的内容（问题、档案昵称、断事笔记、基调、反馈）在任何语言下都原样显示，不转换、不翻译。

### 5.3 繁体：展示层整页转换

做法：在 `#app` 根节点挂一个转换器，`uiLocale === 'zh-TW'` 时把所有文本节点和 `placeholder` / `title` / `aria-label` / `alt` 属性从简体转成繁体，并用 `MutationObserver` 跟踪后续变化。

为什么不走「繁体词条 + 逐处调用转换函数」：

- 结果卡是字符串拼出来经 `v-html` 输出的，LLM 正文是流式 `innerHTML` 写入的，引擎断语散落在十几个接口的 JSON 里。逐处接入要改上千处，漏一处就是简繁混排。
- 简转繁是纯字形映射，不涉及语义，在 DOM 层做是安全的；Vue 的 diff 比较的是虚拟节点而不是真实 DOM，转换后的文本不会被误判。
- 一个转换点同时覆盖 A、B、C、D 四类文字和全部历史记录，M1 不依赖 M2 的词条抽取，可以最先上线。

规则：

1. 转换管线：先用保护词表做最长匹配替换（命中的片段锁定），其余文字交给 OpenCC `cn → tw`。保护词表放在 `lib/i18n/hantProtect.js`，前后端共用。
2. 不用 `twp`（台湾惯用词）预设。它会把 `登录→登入`、`默认→預設`、`信息→資訊`，但对命理正文可能做出不可预期的替换；界面上确实需要台湾惯用词的少数几个词（登入、預設、註冊），写进保护词表显式指定。
3. 跳过：`<input>` / `<textarea>` 的值、`[data-i18n-skip]` 子树、`<script>` / `<style>`、`contenteditable`。用户内容所在的元素加 `data-i18n-skip`（清单见 T1.2）。
4. 幂等：对已是繁体的文字再转一次结果不变；转换器对每个文本节点缓存「上次输出」，自己触发的变更不再处理。
5. `document.title`、`<meta>`、Canvas 上画的字（分享图水印 `奇门遁甲 AI 推演`、`WenshiOrb`）不在 DOM 文本里，要显式调用转换函数。
6. 切回简体或英文时不做反向转换，直接让 Vue 重新渲染（通过给 `<router-view>` 换 `key`）。
7. 繁体用户的输入：问题文本原样保存和显示，原样交给 LLM；只在 Worker 的规则路由前复制一份做繁转简，保证关键词规则可用（T1.3）。出生地搜索同理。

### 5.4 英文：四层各走各的路

**A 界面文案**：`vue-i18n` 词条，键名分层（§T2.1）。`HomeView` 里拼 HTML 的函数通过参数接收 `t`，不直接读全局。

**B 符号与枚举**：一份共享术语表 `lib/i18n/glossary.js`（CommonJS，Worker 和前端都能引），前端适配器 `src/i18n/domainLabels.mjs` 负责显示。显示规则只有两种：

- 紧凑位（盘面格子、方印、四柱表、chip、时辰格、loading 转盘）：只显示汉字。
- 展开位（卡片标题、点宫详情、图例、列表项、提示）：`English (汉字)`，例如 `Day Master (日主)`、`Open Door (开门)`、`Jia (甲)`。

**C 引擎断语**：见 §5.7。

**D LLM 断语**：见 §5.6。

### 5.5 术语规范

术语表是 B、C、D 三层共同的事实来源：前端用它显示，Worker 用它拼进 prompt，离线翻译脚本用它约束译文。

数据形状：

```js
// lib/i18n/glossary.js
module.exports = {
  GLOSSARY_VERSION: 'g1',
  // 每个条目：zh 为简体原值（唯一键），en 为英文正式名，hant 仅在通用转换会出错时填写
  entries: [
    { zh: '甲', group: 'stem', en: 'Jia' },
    { zh: '丑', group: 'branch', en: 'Chou', hant: '丑' },
    { zh: '正财', group: 'shishen', en: 'Direct Wealth' },
    { zh: '开门', group: 'door', en: 'Open Door' },
    // ...
  ],
};
```

核心译名（实现时以此为准；紫微部分直接取 `iztro` 自带的 `en-US` 语言包，不另起译名）：

| 类别 | 译名 |
| --- | --- |
| 十天干 | Jia, Yi, Bing, Ding, Wu, Ji, Geng, Xin, Ren, Gui |
| 十二地支 | Zi, Chou, Yin, Mao, Chen, Si, Wu, Wei, Shen, You, Xu, Hai |
| 五行 | Wood, Fire, Earth, Metal, Water |
| 十神 | 比肩 Friend · 劫财 Rob Wealth · 食神 Eating God · 伤官 Hurting Officer · 偏财 Indirect Wealth · 正财 Direct Wealth · 七杀 Seven Killings · 正官 Direct Officer · 偏印 Indirect Resource · 正印 Direct Resource |
| 八门 | 休门 Rest Door · 生门 Life Door · 伤门 Harm Door · 杜门 Block Door · 景门 Scenery Door · 死门 Death Door · 惊门 Fear Door · 开门 Open Door |
| 九星 | 拼音：Tian Peng, Tian Rui, Tian Chong, Tian Fu, Tian Qin, Tian Xin, Tian Zhu, Tian Ren, Tian Ying |
| 八神 | 值符 Chief · 螣蛇 Serpent · 太阴 Moon · 六合 Harmony · 白虎 White Tiger · 玄武 Black Tortoise · 九地 Nine Earth · 九天 Nine Heaven（勾陈 Hook、朱雀 Red Phoenix 备用） |
| 九宫 | Kan 1, Kun 2, Zhen 3, Xun 4, Center 5, Qian 6, Dui 7, Gen 8, Li 9 |
| 八字通用 | 日主 Day Master · 用神 Useful God · 喜神 Favorable God · 忌神 Unfavorable God · 格局 Structure · 大运 Luck Pillar · 流年 Annual Pillar · 流月 Monthly Pillar · 身强 Strong Day Master · 身弱 Weak Day Master · 调候 Climate Balance · 神煞 Symbolic Stars · 藏干 Hidden Stems |
| 奇门通用 | 值使 Envoy Door · 空亡 Void · 驿马 Travelling Horse · 伏吟 Fu Yin · 反吟 Fan Yin · 应期 Timing Window · 旬首 Xun Leader · 阳遁/阴遁 Yang/Yin Dun · 入墓 Entering the Tomb · 击刑 Punishment |
| 吉凶档位 | 大吉 Highly Favorable · 小吉 Favorable · 平 Neutral · 凶 Unfavorable；中上吉 Above Average · 中平 Average · 偏凶 Below Average |
| 紫微 | 以 `iztro` `en-US` 为准（十四主星、十二宫、四化、辅星、杂曜） |

没有通行英文名的条目（多数神煞、有名格局、纳音）用「拼音 + 汉字」，例如 `Tian Yi Gui Ren (天乙贵人)`，不硬造意译。

### 5.6 LLM 输出语言契约

1. **Prompt 主体保持中文不动**。规则、步骤、材料都是为中文调过的，不翻译。
2. **在 system prompt 末尾追加一个固定文字块**，由 `buildOutputLanguageBlock(contentLocale)` 生成：
   - `zh-CN`：返回空字符串。简体下 prompt 与现在逐字相同，前缀缓存和线上行为都不变。
   - `en-US`：返回一段固定英文，内容包括：所有给用户看的文字用英文写；哨兵标记、JSON 键名、枚举值（`positive|mixed|warning` 等）原样不翻译；术语首次出现写成 `English (汉字)`，之后只写英文；prompt 里按「字」给的长度，换算为英文词数（N 字 ≈ 0.6 N 词），标题 4–9 个词；禁用绝对化措辞的规则同样适用于英文（不写 will definitely / guaranteed / 100%）；不出现 backend / system / engine / score 这类内部字眼；接着是从术语表生成的固定术语对照块。
   - 放在末尾的原因：DeepSeek 前缀缓存从头匹配，英文请求仍能复用中文主体那一大段前缀。
3. **user prompt 的最后一行**在英文下追加一句 `Respond in English.`。离输出最近的指令最有效。
4. **没有 system/user 拆分的 prompt**（八字问事、八字档案、运势、追问、纠偏）：语言块追加在 prompt 文本末尾。
5. **分类类 prompt 不加语言块**，输出本来就是 code；它们返回的 `reason` 只进日志和审计。
6. **输出语言校验**：`detectProseLocale(text)` 去掉括号内的汉字后统计 CJK 字符占比。英文请求下任一可见正文段占比超过 15% 视为语言不合格，走现有的「结构不合格 → 非流式重试一次」路径；重试仍不合格则照常返回，并在结果里记 `output_locale_actual: 'mixed'` 供排查。
7. **结果里记语言**：所有 LLM 接口的最终结果对象加 `output_locale`（即 `contentLocale`）。
8. **后处理兜底句**（如 `模型未给出额外复核意见…`、`综合用神状态、主客关系…`）走 `lib/i18n/serverMessages.js`，按 `contentLocale` 取。

### 5.7 引擎断语的英文化（M4）

引擎不改。在 Worker 出口处对「声明过的字段」做本地化：

```
引擎产出（简体） ──> localizeEnginePayload(payload, contentLocale, 字段路径清单)
                       │  zh-CN：原样返回
                       │  en-US：对每个字符串依次查
                       │    ① 离线词条 lib/i18n/catalog/en-US.engine.json（提交进仓库，可审校）
                       │    ② 翻译记忆表 i18n_translation_memory（Supabase）
                       │    ③ 快模型实时翻译（带术语表，temperature 0），结果写回 ②
                       │  ③ 设总时限；超时则该字符串保留简体原文，ctx.waitUntil 在后台补完
                       v
                  返回给前端
```

- ① 覆盖固定句子（格局断语库、事件预告、层名、神煞说明、固定理由句）。由脚本从 `lib/` 里的常量抽取、机器翻译、人工抽审后提交。
- ② ③ 覆盖带变量拼出来的句子（如 `命中有名格「青龙返首」，领域「求财」下评分 +6`）。变量空间有限，命中率会很快上去；每次未命中都记日志，可定期提升进 ①。
- 浏览器端自己算出来的文字（`baziShensha.mjs`、`baziLocalMatrix.mjs`、`ziweiChart.mjs`、`baziTransit.mjs` 里的固定说明）只查 ①，查不到显示原文。
- 回退是「显示简体原文」而不是报错或留空，符合「不砍功能」。

M4 之前，英文界面下这些位置显示简体原文。这是 M2、M3 的已知状态，不算缺陷。

### 5.8 请求与响应契约

**请求**：所有 `/api/*` 请求带界面语言。

- POST：请求体加 `locale` 字段（`zh-CN` / `zh-TW` / `en-US`）。
- GET：查询串加 `locale=`。
- Worker 入口统一解析：`resolveRequestLocale(request, body)` 返回 `{ uiLocale, contentLocale }`；缺失或不认识的值归为 `zh-CN`。**不读 `Accept-Language`**（旧计划读了），避免老客户端因浏览器语言是英文而突然收到英文内容。

**错误**：JSON 错误与 SSE `error` 事件都加稳定的 `code`，保留原有 `error` / `message` 中文文本做兼容。

```jsonc
{ "error": "未登录，请先登录", "code": "AUTH_REQUIRED" }
{ "type": "error", "message": "AI 推演暂时不可用，请稍后重试", "code": "LLM_UNAVAILABLE" }
```

code 清单（最小集）：`AUTH_REQUIRED`、`AUTH_FAILED`、`QUOTA_EXCEEDED`、`PROFILE_NOT_FOUND`、`SUMMARY_NOT_READY`、`LLM_UNAVAILABLE`、`FOLLOWUP_UNAVAILABLE`、`ENGINE_FAILED`、`METHOD_NOT_ALLOWED`、`BAD_REQUEST`。前端有 `code` 就用词条，没有就显示原文。Worker 内 3 处 `message.includes('额度')` 改为判断 `err.code === 'QUOTA_EXCEEDED'`。

**SSE 进度**：`step` 事件的 `chip` 与 `label` 加结构化字段，旧字段保留。

```jsonc
// 现在
{ "type": "step", "index": 4, "pct": 72, "chip": { "main": "初分 72", "sub": "中上吉" } }
// 之后
{ "type": "step", "index": 4, "pct": 72,
  "chip": { "main": "初分 72", "sub": "中上吉",
            "mainKey": "sse.chip.preScore", "mainParams": { "score": 72 },
            "subKey": "enum.scoreBand.aboveAverage" } }
```

前端规则：有 `*Key` 用词条渲染，没有就用 `main` / `sub` 原文。纯符号的 chip（局名、干支、用神符号）不给 key，直接显示汉字。

### 5.9 缓存、持久化与历史

| 存储 | 改动 | 简体是否受影响 |
| --- | --- | --- |
| `qimenMemoryCache` / `baziMemoryCache` 键 | `contentLocale === 'en-US'` 时键尾加 `-en-US` | 否，键不变 |
| `fortune_cache.period_key` | 同上，英文加后缀 `::en-US` | 否，不需要迁移 |
| 浏览器 `qimen:fortune-cache:v1` 的键 | 同上 | 否 |
| `qimen_records.qimen_data` | 结果对象里带 `output_locale`（Worker 写入，前端原样保存） | 旧记录没有该字段，视为 `zh-CN` |
| `bazi_profiles` | `bazi_detail.qualitative.output_locale` 记三段断语的语言；不加列、不建表 | 旧档案视为 `zh-CN` |
| 追问 | 请求带上原记录的 `output_locale`，Worker 用它而不是当前界面语言来决定补丁语言 | 否 |

显示规则：

- 记录的 `output_locale` 与当前界面语言的内容语言一致：正常显示（繁体下经展示层转换）。
- 不一致（例如英文界面打开一条中文历史）：原文照常显示，容器加 `lang` 属性；不提示、不拦截、不自动重算。
- 八字档案页：断语语言与界面不一致时，现有「重新生成」按钮（`requestAiSummary({ force: true })`）会按当前语言重写。不新增按钮。
- 运势断语：缓存键含语言，英文用户首次打开某日/某月会生成英文版并占用一次额度，与中文版互不覆盖。

`bazi_summary` 会被运势 prompt 当输入读。它可能是英文（档案在英文界面下生成），这对 LLM 输入没有影响，不需要处理。

### 5.10 主题与版式

- 语言与主题是两个独立维度：语言写 `<html lang>`，主题写 `<html data-theme>`，互不读取对方。
- 字体：`zh-TW` 下懒加载 `Noto Serif TC` 并排在字体栈首位；`en-US` 下正文沿用现有栈（`Noto Serif SC` 自带拉丁字形），只在 `:root[lang="en-US"]` 下把 `.nav-label` 等带 `letter-spacing` 的中文排版参数归零。不引入新的英文字体，不改颜色 token。
- 英文字符串平均比中文长 1.5–2.5 倍。底部导航、分段按钮、chip、表单标签必须在 390px 宽度下不换行不溢出：优先选短译名（`Ask` / `Bazi` / `Reports` / `Fortune`），其次允许该元素字号下调至多 1px，仍放不下才允许省略号。
- 盘面类组件（九宫、四柱、紫微十二宫、方印、时辰格、转盘）内部不出现英文，尺寸不变。

### 5.11 与在途工作的关系

| 在途项 | 关系 |
| --- | --- |
| PR #45 八字面板与结果页九宫重做 | T2.5b、T2.4b 中涉及这些组件的部分等 #45 合并后做；其余任务不受影响 |
| PR #48 紫微 LLM 解读设计 | 实现时须遵守 §5.6：prompt 主体中文，末尾调用 `buildOutputLanguageBlock`，结果带 `output_locale`，缓存键含内容语言；断语卡走 §5.7 |
| PR #49 双人合盘重设计 | 同上；新页面从第一天起用词条，不再写硬编码中文。`public/wrapped.html` 不做多语言 |
| PR #36 海外出生地时区 | 与 T2.9 都改出生地数据的使用方式，T2.9 在 #36 之后做 |
| `packages/xuanxue-mcp`、`xuanxue-dsh` | 不动。`lib/i18n/` 新文件如果被 `prepack` 打包范围误收，测试 `packages/xuanxue-mcp/test/prepack.test.mjs` 会失败，届时按测试提示排除 |

---

## 6. 里程碑

| 里程碑 | 内容 | 可对外的说法 | 依赖 |
| --- | --- | --- | --- |
| M0 地基 | 三语运行时、语言入口、术语表、守门脚本 | 无（菜单里可切换，但只有繁体会在 M1 后生效；M0 单独上线时语言行隐藏） | 无 |
| M1 繁體 | 展示层转换、保护词表、繁体输入归一、字体 | 「支持繁體中文」 | M0 |
| M2 英文界面 | 词条抽取、符号适配、全部页面、出生地 | 不对外；预览环境可用 | M0 |
| M3 英文 LLM | 请求契约、输出语言块、校验、缓存、追问、评测 | 「支持 English」（引擎断语位置暂显示中文） | M2 |
| M4 英文引擎断语 | 盘点、离线词条、翻译记忆、Worker 出口本地化 | 英文体验完整 | M3 |
| M5 外围 | 爬虫页与 hreflang、法律文本、邮件模板、manifest、文档 | 英文可被搜索引擎收录 | M2 |

语言行的可见选项由常量 `ENABLED_LOCALES` 控制：M1 上线时为 `['zh-CN','zh-TW']`，M3 上线时加入 `'en-US'`。预览环境可用查询串 `?locale=en-US` 强制进入未开放的语言，方便验收。

---

## 7. 任务分解

约定：

- 每个任务一个 PR，标题前缀 `i18n(Mx.y)`。
- 「验收」里的用例都要落成自动化测试，除非标注「手工」。测试用 Node 自带 runner（`node --test`），与仓库现有风格一致。
- `package.json` 的 `test` 脚本只匹配 `lib/*.test.js` 和 `src/**/*.test.mjs`。凡是在 `lib/i18n/` 下新增的测试，必须同时把 `lib/i18n/*.test.js` 加进 `test` 脚本（T0.3 做一次即可）。
- 每个任务的验收默认包含：`npm test && npm run build` 通过；`zh-CN` 下相关页面截图与改造前一致（深、浅各一张，390px 宽）。下面不再逐条重复。

### M0 地基

#### T0.1 三语运行时

**文件**：改 `src/i18n/index.mjs`、`src/i18n/index.test.mjs`、`src/main.js`。

**接口**：

```js
export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US'];
export const ENABLED_LOCALES = ['zh-CN'];            // 上线开关，M1/M3 时改
export function normalizeLocale(input): string;      // 见下表
export function contentLocaleOf(uiLocale): 'zh-CN' | 'en-US';
export function setLocale(input): string;            // 归一 → 写 localStorage → 改 i18n.global.locale → 写 <html lang> → 返回归一值
export function getInitialLocale(): string;          // 顺序：?locale= 查询串 → localStorage → navigator.language → zh-CN
```

归一规则：

| 输入 | 输出 |
| --- | --- |
| `zh`、`zh-CN`、`zh-Hans`、`zh-SG`、`zh-Hans-CN` | `zh-CN` |
| `zh-TW`、`zh-HK`、`zh-MO`、`zh-Hant`、`zh-Hant-TW` | `zh-TW` |
| `en`、`en-*` | `en-US` |
| 其他、空、非字符串 | `zh-CN` |

`getInitialLocale` 的结果若不在 `ENABLED_LOCALES` 内且不是来自查询串，回落到 `zh-CN`。`vue-i18n` 的 `messages['zh-TW']` 直接指向简体词条对象（繁体靠展示层转换），`fallbackLocale` 保持 `zh-CN`。

`main.js`：挂载前执行 `document.documentElement.lang = i18n.global.locale.value`。

**验收**：

1. `normalizeLocale` 对上表每一行返回预期值。
2. `contentLocaleOf('zh-TW') === 'zh-CN'`，`contentLocaleOf('en-US') === 'en-US'`。
3. `setLocale('zh-HK')` 返回 `zh-TW`，`localStorage['qimen-locale'] === 'zh-TW'`，`i18n.global.locale.value === 'zh-TW'`。
4. `navigator.language = 'en-GB'` 且 `ENABLED_LOCALES` 不含 `en-US` 时，`getInitialLocale()` 返回 `zh-CN`。
5. 现有 `src/i18n/index.test.mjs` 的用例全部保留并通过。

#### T0.2 语言入口

**文件**：改 `src/components/AccountMenu.vue`、`src/components/AccountMenu.test.mjs`；词条加 `account.language`。

**做法**：在「主题」行（`.theme-cycle-row`）正下方加一行同样式的按钮，左侧文字「语言」，右侧显示当前语言自称（`简体中文` / `繁體中文` / `English`，这三个字符串不翻译）。单击按 `ENABLED_LOCALES` 的顺序循环，调用 `setLocale`。复用 `.account-menu-link.theme-cycle-row` 与 `.theme-current` 两个类，不写新颜色。`ENABLED_LOCALES.length < 2` 时整行不渲染。

**验收**：

1. `ENABLED_LOCALES = ['zh-CN']` 时菜单 DOM 与改造前一致。
2. `ENABLED_LOCALES = ['zh-CN','zh-TW','en-US']` 时连续点击三次，`locale` 依次为 `zh-TW`、`en-US`、`zh-CN`。
3. 源码断言：新行使用 `theme-cycle-row` 类，`<style>` 块没有新增颜色字面量。
4. 手工：深、浅主题下新行与主题行对齐、间距一致；切换语言不改变 `data-theme`，切换主题不改变 `lang`。

#### T0.3 共享术语表

**文件**：新建 `lib/i18n/glossary.js`、`lib/i18n/glossary.test.js`；改 `package.json` 的 `test` 脚本（加入 `lib/i18n/*.test.js`）。

**接口**：

```js
module.exports = {
  GLOSSARY_VERSION,                 // 字符串，术语有改动就递增
  entries,                          // [{ zh, group, en, hant? }]
  lookup(zh),                       // → entry | undefined
  toEnglish(zh),                    // → 'Open Door' | undefined
  formatBilingual(zh),              // → 'Open Door (开门)'；查不到返回 zh 原值
  buildPromptGlossaryBlock(),       // → 固定文本，按 group、zh 排序，供 T3.2 拼进 prompt
};
```

`group` 取值：`stem`、`branch`、`element`、`shishen`、`door`、`star`、`deity`、`palace`、`bazi_term`、`qimen_term`、`score_band`、`shensha`、`pattern`、`nayin`、`jieqi`、`category`。紫微术语不进本表（用 `iztro`）。

**验收**：

1. 覆盖率：`lib/constants/core.js` 的天干、地支、五行、十神，`lib/QimenConstants.js` 的八门、九星、八神、九宫名，`lib/constants/shensha.js` 的全部神煞名，`lib/baziPatternStatements.js` 的全部格局名，`lib/divinationCategories.js` 的全部一级分类 label，每一个都能 `lookup` 到。测试直接从这些模块读取清单来断言，后续新增符号而忘记补术语时测试会失败。
2. `zh` 无重复。
3. `formatBilingual('开门') === 'Open Door (开门)'`；`formatBilingual('不存在') === '不存在'`。
4. `buildPromptGlossaryBlock()` 连续调用两次结果逐字相同（保证前缀缓存稳定），且包含 §5.5 表中每个译名。
5. §5.5 表里列出的每个译名与文件一致（测试里抄一份断言）。

#### T0.4 硬编码中文守门脚本

**文件**：新建 `scripts/i18n_lint.mjs`、`scripts/i18n_lint.test.cjs`、`docs/i18n/hardcoded-baseline.json`；`package.json` 加脚本 `"i18n:lint": "node scripts/i18n_lint.mjs"`。

**做法**：扫描 `src/**/*.{vue,js,mjs}`（排除测试、`src/data/`、`src/i18n/locales/`、非目标页面），统计每个文件「模板与脚本中、非注释、含 CJK 字符」的行数，与基线比较：任何文件的计数高于基线则退出码 1 并列出新增行；低于基线时提示运行 `--update` 刷新基线。白名单用行尾注释 `// i18n-ignore`（用于盘面符号常量等确实不该翻译的行）。

**验收**：

1. 对当前 `main` 生成的基线，脚本退出码 0。
2. 测试夹具：给某文件多加一行中文字符串，退出码 1 且输出包含该文件路径与行号。
3. 带 `// i18n-ignore` 的行不计数；`<!-- -->`、`//`、`/* */` 注释不计数。

### M1 繁體

#### T1.1 简繁转换模块与保护词表

**文件**：新建 `lib/i18n/hantProtect.js`、`lib/i18n/hantProtect.test.js`、`src/i18n/hant.mjs`、`src/i18n/hant.test.mjs`；`package.json` 加依赖 `opencc-js`。

**接口**：

```js
// lib/i18n/hantProtect.js —— 纯数据 + 纯函数，不依赖 opencc
module.exports = {
  PROTECT,            // [['时干','時干'], ['丑','丑'], ['斗君','斗君'], ['登录','登入'], ...]，按简体长度降序
  splitProtected(text) // → [{ text, locked: boolean, out?: string }]，最长匹配切分
};

// src/i18n/hant.mjs
export async function loadHantConverter(): Promise<(text: string) => string>; // 动态 import('opencc-js/cn2t')，只加载一次
export function toHantSync(text): string;  // 转换器未就绪时原样返回
export function isHantReady(): boolean;
```

保护词表必须包含（实现者用 §4.4 的方法把术语表全部条目过一遍 OpenCC，凡输出不符合预期的都加进来）：

- 所有含「干」且表示天干的词：`天干`、`日干`、`时干`、`月干`、`年干`、`十干`、`藏干`、`干支`、`宫干`、`年命干`，以及 `[甲乙丙丁戊己庚辛壬癸]干`。
- 地支 `丑` 的所有组合：单字 `丑`、`丑时`、`丑月`、`丑土`、`丑未`、`子丑`、`[甲乙丙丁戊己庚辛壬癸]丑`。注意普通词 `丑陋`、`出丑` 不保护（放在更长匹配里交给 OpenCC）。
- `斗`：`斗君`、`斗数`、`北斗`、`南斗`、`斗柄`。
- `冲`：凡命理语境统一为 `沖`（`相冲`、`六冲`、`冲克`、`冲填`、`冲开`、`冲动`、`逢冲`、`[子丑寅卯辰巳午未申酉戌亥]{2}冲`）。
- `克`：命理语境统一为 `剋`（`相克`、`受克`、`克制`、`生克`、`克我`、`我克`、`[干宫]克`）。
- 界面惯用词：`登录→登入`、`默认→預設`、`注册→註冊`、`反馈→回饋`（最后一项待拍板，见 §10）。
- 名称类：`螣蛇→螣蛇`、`咸池→咸池`、`复盘→覆盤`。

**验收**：

1. 表驱动测试，至少 120 组「简体 → 期望繁体」，必须包含 §4.4 表中全部 7 行，以及：`日干克时干→日干剋時干`、`地支藏干→地支藏干`、`乙丑→乙丑`、`丑未冲→丑未沖`、`紫微斗数→紫微斗數`、`化禄→化祿`、`农历→農曆`、`后天八卦→後天八卦`、`请先登录→請先登入`、`出丑→出醜`、`干净→乾淨`、`能干→能幹`。
2. 幂等：对每组期望繁体再转一次，结果不变。
3. 不含中文的字符串（英文、数字、标点、emoji）原样返回。
4. `toHantSync` 在转换器未加载时返回原文，不抛错。
5. 构建产物检查：`opencc-js` 只出现在懒加载 chunk 里，主入口 chunk 体积增量小于 5 KB。

#### T1.2 展示层转换器

**文件**：新建 `src/i18n/hantDom.mjs`、`src/i18n/hantDom.test.mjs`；改 `src/App.vue`（挂载与换 key）、`src/main.js`（标题与 meta）、`src/views/HomeView.vue`（分享图水印、给用户内容加 `data-i18n-skip`）、`src/views/BaziView.vue`、`src/views/FortuneView.vue`、`src/views/FeedbackView.vue`（同上，仅加属性）。

**接口**：

```js
export function startHantDom(root: Element, convert: (s: string) => string): () => void; // 返回 stop()
```

行为：

- 启动时遍历 `root` 下全部文本节点与 `placeholder`、`title`、`aria-label`、`alt` 属性并转换；之后用 `MutationObserver`（`childList`、`subtree`、`characterData`、上述属性）处理变化。
- 用 `WeakMap<Node, string>` 记每个文本节点上次写入的值；节点当前值等于记录值时跳过，避免自触发循环。
- 跳过 `[data-i18n-skip]` 子树、`script`、`style`、`textarea`、`input`、`[contenteditable]`。
- `App.vue`：`watch(locale)`，进入 `zh-TW` 时 `await loadHantConverter()` 后 `startHantDom(document.body, toHantSync)`（抽屉、弹层挂在 `body` 下的也要覆盖）；离开时 `stop()` 并递增 `<router-view>` 的 `key` 触发重渲染。
- `main.js` 的 `router.afterEach`：`zh-TW` 下对 `title`、description、og 标签的值调用 `toHantSync`。
- `HomeView.vue` 分享图：Canvas `fillText('奇门遁甲 AI 推演', …)` 与下载文件名经 `toHantSync`。
- 加 `data-i18n-skip` 的位置：用户问题原文（输入页最近问过、抽屉历史列表、结果页标题区、追问气泡里的问题）、档案昵称、断事笔记正文、长期/月度基调正文、反馈内容。结果卡里用户问题所在的元素在 `buildCardHTML` 的模板字符串里加属性。

**验收**（用 `linkedom` 或 Node 可用的轻量 DOM；若仓库不愿加开发依赖，则把「遍历与决策」逻辑抽成不依赖 DOM 的纯函数来测，观察器部分手工验收）：

1. 初始树中的 `时干落宫` 文本节点变为 `時干落宮`。
2. 之后追加的节点、被改写的文本、被改写的 `placeholder` 都会被转换。
3. `[data-i18n-skip]` 内的文字不变；`<textarea>` 的值不变。
4. 转换器自己的写入不会再次触发处理（对同一节点的处理次数为 1）。
5. `stop()` 之后新增的节点不再被转换。
6. 手工（深、浅各一遍，390px）：繁体下走完整流程：登录页 → 问事输入 → loading → 奇门结果（流式过程中正文即为繁体，无简体闪现超过一帧）→ 点宫详情 → 追问 → 保存分享图（图上文字为繁体）→ 历史抽屉 → 八字档案新建 → 基础排盘 / 专业细盘 / 紫微盘 / 断事笔记 → 运势日周月年。全程无简体字残留（用户自己输入的除外），无 `幹`、`醜`、`鬥` 误字。
7. 手工：繁体下输入框里打的简体字不被改写。
8. 手工：从繁体切回简体，整页恢复简体，无残留繁体。

#### T1.3 繁体输入归一

**文件**：新建 `lib/i18n/t2s.js`、`lib/i18n/t2s.test.js`；改 `lib/divinationRouter.js`（`normalizeQuestion`）、`lib/wenshiFollowup.js`（追问分类前的规则判断，如有）、`src/utils/birthplaceSearch.mjs` 与 `public/utils/birthplaceSearch.mjs`（两份内容相同，需同步）。

**接口**：`toSimplified(text): string`。实现为字符级映射表（由脚本从 OpenCC 的 `t2cn` 字典生成并提交，体积控制在 40 KB 以内；不在 Worker 里引入 opencc 运行时）。`lib/qimenPromptSections.js` 里已有一个 12 字的 `TRAD_TO_SIMP` 小表和 `qimenPipeline.toSimplified`，本任务不替换它们，避免影响盘面逻辑。

**做法**：`divinationRouter.normalizeQuestion` 在做关键词匹配前先 `toSimplified`。只影响规则匹配用的副本，`question` 原文照旧传给 LLM、写入审计与记录。出生地搜索在分词前对查询串做 `toSimplified`。

**验收**：

1. `toSimplified('這段感情還值得繼續嗎')` 返回 `这段感情还值得继续吗`。
2. 路由对照：取 `lib/divinationRouter.test.js` 现有的全部规则用例，把问题转成繁体后再跑 `classifyByRules`，`branch`、`category`、`subcategory`、`confidence` 与简体结果一致。
3. `searchBirthplaces('臺北')`、`searchBirthplaces('廈門市思明區')` 能命中与简体查询相同的记录 id。
4. 简体输入的路由结果与改造前逐字段一致（回归）。

#### T1.4 繁体字体

**文件**：改 `src/styles/global.css`、`src/App.vue`（或 `src/i18n/hant.mjs`）。

**做法**：进入 `zh-TW` 时动态插入 `Noto Serif TC` 的 `<link>`（权重与现有 SC 相同：300–700）；`global.css` 加 `:root[lang="zh-TW"]` 规则，把 `--font-serif`、`--font-display`、`--font-ganzhi`、`--font-body` 四个变量的首选改为 `'Noto Serif TC'`，其后保留原有回退栈。不改任何颜色变量。

**验收**：

1. 源码断言：`:root[lang="zh-TW"]` 块内只出现 `--font-*` 变量。
2. 简体与英文下不发起 `Noto Serif TC` 的网络请求（手工，看 Network）。
3. 手工：繁体下 `歲`、`祿`、`鸞`、`剋` 等字无缺字方块；深浅主题各截一张八字专业细盘。

**M1 上线动作**：`ENABLED_LOCALES = ['zh-CN', 'zh-TW']`。

### M2 英文界面

#### T2.1 词条结构与一致性测试

**文件**：改 `src/i18n/locales/zh-CN.mjs`、`en-US.mjs`；新建 `src/i18n/catalogueParity.test.mjs`、`docs/i18n/README.md`（词条约定）。

**键名约定**（两份词条的根结构必须相同）：

```
common.*      通用动词与状态：cancel, close, confirm, save, loading, retry, back, all, none, pending, generating
brand.*       name（奇门道 / Qimen Dao）, tagline
nav.*         ask, bazi, reports, fortune
account.*     identityGuest, identityAnonymous, about, changePassword, signIn, register, signOut, theme, themeLight, themeDark, themeSystem, language, feedback
auth.*        登录、注册、访客、忘记密码、协议提示、表单校验
home.*        输入页、命主栏、最近问过、示例问题、时间选择、分流说明、额度
result.*      结果页标题、卡片小标题、方印与刻度、点宫详情字段名、追问、分享、反馈抽屉
loading.*     奇门 6 步与八字 7 步的 name / tag / detail
bazi.*        档案表单、档案管理、四个页签、命局面板、断事笔记、基调
ziwei.*       紫微盘面板
fortune.*     日、周、月、年
report.* feedback.* reset.* legal.* about.*
sse.*         进度 chip 文案
error.*       以错误 code 为键
enum.*        category, subcategory, scoreBand, verdict, gender, lifeEventDomain, lifeEventImpact, tone …
seo.*         各路由 title / description
```

写法规则：

- 插值用具名参数：`'今日剩余 {left} / {limit}'`，不拼字符串。
- 复数用 `vue-i18n` 的管道写法，仅英文需要：`'{n} window | {n} windows'`。
- 词条值里不写 HTML。需要加粗或链接时拆成多个键，或用 `<i18n-t>` 组件。
- 简体词条的值必须与当前硬编码文字逐字相同（包括全角标点、省略号 `…`）。

**验收**：

1. 两份词条的叶子键集合完全相同。
2. 两份词条里同一个键的插值参数名集合相同（如 `{left}`、`{limit}`）。
3. `en-US` 的值不含 CJK 字符，以下键除外：`brand.name` 以及显式列入白名单的键（白名单写在测试文件里）。
4. `zh-CN` 的值不为空字符串。

#### T2.2 外壳与共享组件

**文件**：改 `src/App.vue`（底部导航 4 个标签）、`src/components/AccountMenu.vue`、`TimePickerSheet.vue`、`OpenSourceLinks.vue`、`AfdianSupportLink.vue`、`src/router/index.js`、`src/main.js`、`src/store.js`、`src/guestMode.mjs`、`src/auth/passwordReset.mjs`、`src/qimenFeedback.mjs`、`src/fortuneCache.mjs`（仅用户可见文案；`console.warn` 不动）。

**接口**：

```js
// src/router/index.js
export function resolveRouteMeta(route, locale): { title, description };
// 路由记录改用键：meta: { titleKey: 'seo.home.title', descriptionKey: 'seo.home.description', seoTitleKey?, seoDescriptionKey?, robots, ogImage }
```

`main.js` 的 `afterEach` 改为调用 `resolveRouteMeta`；另加对 `i18n.global.locale` 的监听，语言变化时对当前路由重算标题与 meta。现有 `titleEn` / `descriptionEn` 的文字搬进 `en-US` 词条后从路由记录里删除。

英文导航标签：`Ask`、`Bazi`、`Reports`、`Fortune`。

**验收**：

1. `resolveRouteMeta(homeRoute, 'en-US').title` 不含 CJK；`resolveRouteMeta(homeRoute, 'zh-CN').title` 等于改造前的 `seoTitle`。
2. `src/seoExposure.test.mjs` 现有断言在 `zh-CN` 下全部通过（必要时更新断言的取值方式，但期望文字不变）。
3. `i18n:lint` 对本任务涉及的文件计数为 0（盘面符号常量用 `// i18n-ignore`）。
4. 手工：英文下底部导航四个标签在 390px、360px 宽度都不换行；深浅主题各一张。

#### T2.3 符号适配器与格式化

**文件**：新建 `src/i18n/domainLabels.mjs`、`src/i18n/domainLabels.test.mjs`、`src/i18n/formatters.mjs`、`src/i18n/formatters.test.mjs`。

**接口**：

```js
// domainLabels.mjs —— 只负责显示，永不改写入参
export function symbolLabel(zh, locale, { compact = false } = {}): string;
//   zh-CN / zh-TW：返回 zh
//   en-US 且 compact：返回 zh
//   en-US 且非 compact：glossary.formatBilingual(zh)
export function ganzhiLabel(gz, locale, opts): string;        // '丙午' → 'Bing Wu (丙午)'
export function palaceLabel(name, locale, opts): string;      // '震3宫' → 'Zhen 3 (震3宫)'
export function categoryLabel(code, locale): string;          // 'career_business' → t('enum.category.career_business')；未知 code 原样返回
export function subcategoryLabel(category, code, locale): string;
export function scoreBandLabel(score, locale): string;        // 对应 Worker 的 QIMEN_SCORE_LABEL 三档
export function verdictLabel(zhOrScore, locale): string;      // 大吉/小吉/平/凶
export function genderLabel(code, locale, { zao = false }): string; // 'M' → 男 / Male；zao 时 乾造 / Male chart (乾造)
export function ziweiLabel(zh, kind, locale, opts): string;   // kind: 'star' | 'palace' | 'mutagen' | …，英文取 iztro en-US 语言包

// formatters.mjs
export function formatDate(value, locale, style = 'medium'): string;   // Intl.DateTimeFormat
export function formatDateTime(value, locale): string;
export function formatNumber(value, locale): string;
export function formatLunarDate(lunarObj, locale): string;             // 中文原样；英文 'Lunar 3rd month, day 12 (三月十二)'
```

显式映射表放在本文件内；禁止 `` t(`enum.${value}`) `` 这种直接拿外部值拼键的写法出现在其他文件。

**验收**：

1. `symbolLabel('开门','en-US') === 'Open Door (开门)'`；`symbolLabel('开门','en-US',{compact:true}) === '开门'`；`symbolLabel('开门','zh-TW') === '开门'`（繁体交给展示层）。
2. `categoryLabel('career_business','en-US') === 'Career'`；`categoryLabel('legacy_x','en-US') === 'legacy_x'`。
3. `ganzhiLabel('丙午','en-US') === 'Bing Wu (丙午)'`。
4. `formatDate('2026-11-16T04:00:00Z','en-US')` 含 `2026` 且不含 `年`；`zh-CN` 下输出与现有 `toLocaleDateString('zh-CN')` 一致。
5. 所有函数对 `undefined`、`null`、空串返回空串，不抛错。
6. 入参对象在调用后深比较不变。

#### T2.4 问事页 `HomeView.vue`

体量大，拆两个 PR。

**T2.4a 输入、登录、抽屉、弹层**

范围：模板 1–300 行与 473–660 行的全部可见文字（登录/注册、landing 介绍与 FAQ、命主栏、输入框、示例问题、时间选择、最近问过、历史抽屉与分类筛选、反馈抽屉、分流说明弹层、额度、重置时间确认、分享图弹层）；脚本里对应的 `alert`、校验提示、`categories` 数组、示例问题数组、`clockText` 等。

做法要点：

- `categories` 改为只存 `value`，显示时 `categoryLabel(value, locale)`。传给 Supabase 查询的值不变。
- 示例问题：词条里 `home.samples` 为数组，中英各 21 条，英文为意译而非直译（如 `Is now a good time to change jobs?`）。
- `乾造/坤造`：`genderLabel(code, locale, { zao: true })`。
- 日期显示全部改用 `formatDate`；`toLocaleDateString()` 无参调用一并替换。

**T2.4b 结果页、loading、追问**（PR #45 合并后做）

范围：`wenShiSteps` 两组步骤（奇门 6 步、八字 7 步）、流式骨架 `buildStreamingScaffoldHTML`、结果卡 `buildCardHTML` 及其调用的全部子函数、点宫详情、格局说明弹层、追问区 `renderFollowupBlockHTML`、反馈状态、保存分享。

做法要点：

- 所有拼 HTML 的函数增加一个参数 `i18n = { t, locale }`，由调用处传入；函数内部不 import 全局 `i18n`。这样函数仍可用纯字符串断言来测。
- 卡片小标题、字段名（如「求测人」「所问之事」「有利因素」「行动建议」）走 `t('result.*')`。
- 来自结果 JSON 的符号（宫名、门星神、干支）：盘面格子里用 `compact`，卡片正文与详情里用非 compact。
- 来自结果 JSON 的 LLM 正文原样输出；容器加 `lang` 属性，值取 `data.output_locale || 'zh-CN'`。
- SSE `step` 事件：有 `mainKey` / `subKey` 就用词条，否则显示原文（T3.4 之前一直走原文分支）。
- `src/utils/qimenCardFallbacks.mjs` 的兜底文案改为接收 `t`。
- 方印（`verdict_label`）：属于紧凑位，印面保持汉字；印旁或 `aria-label` 给出 `verdictLabel` 的英文。

**验收**（两个 PR 通用）：

1. `src/views/HomeView.domain-view.test.mjs` 现有用例全部通过。
2. 新增快照测试：用 `/?mock=qimen` 所用的同一份 mock 结果数据调用 `buildCardHTML(data, { t: zhT, locale: 'zh-CN' })`，输出与改造前的函数输出逐字相同（改造前先把输出存成夹具文件）。
3. 同一份数据以 `en-US` 调用：输出中，卡片小标题不含 CJK；九宫格子内的文字仍是汉字；点宫详情里出现 `Open Door (开门)` 形式；LLM 正文容器带 `lang="zh-CN"`。
4. 提交给 `/api/qimen` 的请求体，除新增的 `locale` 外，与改造前逐字段相同（断言 `category` 等仍是 code）。
5. `i18n:lint`：`HomeView.vue` 的计数降到只剩带 `// i18n-ignore` 的盘面符号行。
6. 手工（英文，深浅各一遍，390px）：输入页、历史抽屉、反馈抽屉、分流说明、loading 全程、结果页整页长截图、点宫详情、追问。无溢出、无重叠、按钮文字不被截断。

#### T2.5 八字页 `BaziView.vue` 与相关组件

**T2.5a 档案与笔记**

范围：`BaziView.vue` 模板里的档案切换与管理、新增排盘资料表单（公历/四柱两种输入、出生地、真太阳时、夏令时）、访客提示、推演状态条、断事笔记（事件表单、领域、性质）、长期基调与月度基调；`src/utils/baziProfileInput.mjs` 的校验提示；`src/baziProfileFields.mjs`。

做法要点：生活事件的领域与性质选项只保留 code，显示走 `enum.lifeEventDomain.*`、`enum.lifeEventImpact.*`；写库的值不变。`baziProfileInput.mjs` 里抛出或返回给界面的提示改为同时带稳定的 `code`（及 `params`），由调用处翻译；原中文 `message` 保留以兼容现有测试。

**T2.5b 命局面板**（PR #45 合并后做）

范围：`BaziView.vue` 的命局天机、天机锦囊、调候诊断、五行能量池、原局核心、岁运推演、古籍断语等面板的标题与字段名；`BaziStaticPanel.vue`、`BaziDynamicPanel.vue`、`BaziBackingPanel.vue`、`BaziPillarTable.vue`、`composables/useBaziColumns.js`；`utils/baziShensha.mjs`、`baziLocalMatrix.mjs`、`baziTransit.mjs`、`monthlyScoreHits.mjs`、`baziInterpretation.mjs` 中的标签。

做法要点：

- 四柱表、大运流年拖动条属于紧凑位，干支与十神简称（财、官、印…）保持汉字；表头（年柱/月柱/日柱/时柱、天干、地支、藏干、十神、纳音）翻译。
- 大运流年拖动组件的全部交互保持不变（这是既定原则，不得因英文排版而简化）。
- CSS 类名绑定（`.ss-吉`、`.nature-凶` 等）继续用原始中文值；显示文字另取。
- 引擎给出的说明性句子（判定说明、立格依据、调候说明、古籍断语）在 M4 之前显示原文，容器加 `lang="zh-CN"`。
- 古籍原文（`siziData.js`、《三命通会》引文）永远显示原文，英文下在其上方给一行 `Classical source (original text)` 标注，不翻译。

**验收**：

1. `src/views/BaziView.layout.test.mjs`、`src/utils/baziProfileInput.test.mjs` 现有用例通过。
2. 新增：`baziProfileInput.mjs` 的每种输入错误都带稳定的 `code`；`zh-CN` 下由 code 得到的文字与原 `message` 相同。
3. 新增源码断言：`.ss-`、`.nature-` 的 class 绑定表达式仍引用原始字段，而不是 `t()` 的结果。
4. 新建档案写入 `bazi_profiles` 的 payload 在 `zh-CN` 与 `en-US` 下逐字段相同。
5. 手工（英文，深浅各一遍）：新建档案全流程；四个页签；拖动大运与流年，面板随之更新；打开每一个二级弹层。

#### T2.6 紫微盘

**文件**：改 `src/components/ZiweiChartPanel.vue`、`src/utils/ziweiChart.mjs`、`src/utils/ziweiChart.test.mjs`。

**做法**：`iztro` 的计算语言保持 `zh-CN`（`ziweiChart.mjs` 里的后处理和 `.mu-禄` 等类名都依赖中文值）。十二宫盘面格子内星名、宫名、四化保持汉字。面板外围文字（看盘方式、三合/四化切换、运限选择、图例、身宫/命主/身主标签、错误提示）走词条。选中某宫后的详情区用 `ziweiLabel(…)` 显示 `English (汉字)`，英文名取自 `iztro` 的 `en-US` 语言包（通过其 i18n 导出读取；若该导出不可用，则在本任务内建一份静态映射，并写测试核对十四主星、十二宫、四化）。

**验收**：

1. `ziweiChart.test.mjs` 现有用例通过，且计算结果对象在三种语言下深比较相等。
2. `ziweiLabel('紫微','star','en-US')` 含 `Zi Wei` 或 `iztro` 给出的英文名，并以 `(紫微)` 结尾。
3. 手工：英文下十二宫盘的格子尺寸与简体一致（截图叠图比较），运限切换可用。

#### T2.7 运势页 `FortuneView.vue`

范围：四个页签的标题、指标名（行事指南、今日吉时、开运密码、七日走势、关键节点、月度曲线、流月节律、岁运简批等）、状态文案（推演中、生成中、暂无）、访客提示、评分架构弹层、基调入口；`src/styles/fortune-view.css` 不改颜色。

做法要点：

- 十二时辰格属于紧凑位：格内时辰名保持汉字，时间段数字照常；格外图例翻译。
- `年/月/日/分` 等单位后缀改用带参数的词条（`'{score} pts'` / `'{score} 分'`）。
- 引擎产出的周运标签、事件预告、评分命中理由在 M4 前显示原文并加 `lang`。
- 幸运色、方位、五行：走 `symbolLabel`。

**验收**：

1. `src/fortuneCache.test.mjs`、`src/fortuneWarmup.test.mjs` 现有用例通过。
2. 手工（英文，深浅各一遍）：日、周、月、年四个页签；月运切换四个维度；打开评分架构弹层。曲线图坐标轴标签不重叠。

#### T2.8 次要页面

范围：`ReportView.vue`、`FeedbackView.vue`、`ResetPasswordView.vue`、`EngineeringView.vue`（「关于」页）、`LegalView.vue`。

- `LegalView.vue`：把两份文档改为结构化数据 `{ title, sections: [{ title, paragraphs[] }] }` 放进词条。英文版在 §10 拍板前只放占位：页面顶部一行 `English translation is being prepared. The Chinese version below is the binding text.`，下面显示中文原文。
- `EngineeringView.vue`：正文较长，按段落进词条。

**验收**：`src/views/EngineeringView.test.mjs` 通过；`i18n:lint` 对这五个文件计数为 0（`LegalView` 的中文正文已移入词条）；手工英文深浅各一遍。

#### T2.9 出生地英文显示与搜索（PR #36 之后）

**文件**：改 `scripts/generate_birthplaces_from_geonames.mjs`、`src/data/birthplaces.mjs`（生成物）、`public/data/birthplaces.mjs`（同步）、`src/utils/birthplaceSearch.mjs`、`public/utils/birthplaceSearch.mjs`、`src/utils/birthplaceSearch.test.mjs`、`BaziView.vue`。

**做法**：记录新增可选字段 `nameEn`、`admin1En`、`countryEn`。来源：海外记录用 GeoNames 的 ASCII 名；中国县级记录用拼音（生成脚本里用现成的拼音库在生成时计算，不进运行时包），直辖市与省会优先取 `aliases` 里已有的英文名（如 `Beijing`）。`id`、`lat`、`lng`、原中文名、`aliases` 不变。

```js
export function formatPlaceLabel(place, locale = 'zh-CN'): string;   // 新增；把 BaziView 里现有的地点显示拼接收进来
//   zh：与 BaziView 现有显示逐字一致
//   en：'Siming, Xiamen, Fujian, China'；缺英文字段时回退中文字段
export function searchBirthplaces(query, limit = 8, locale = 'zh-CN'): Place[];   // 现有函数加第三个参数
```

搜索索引同时包含中文名、别名、英文名；不区分大小写。

**验收**：

1. `searchBirthplaces('Beijing', 1, 'en-US')[0].id === searchBirthplaces('北京', 1, 'zh-CN')[0].id`。
2. `searchBirthplaces('siming', 5, 'en-US')` 命中厦门思明区。
3. 英文下选中地点后写入档案的 `birthplace` 相关字段与中文下选中同一地点时逐字段相同。
4. `src/data/birthplaces.mjs` 体积增量不超过 35%（当前 60,484 行；若超过，把英文字段拆到单独的懒加载文件）。
5. 现有 `birthplaceSearch.test.mjs`、`baziProfileInput.test.mjs` 通过。

#### T2.10 英文版式验收

**文件**：新建 `scripts/i18n_screenshots.mjs`（Playwright，仓库已有依赖）、`docs/i18n/manual-acceptance.md`。

**做法**：脚本对预览构建依次以 3 种语言 × 2 种主题 × 390px 宽访问固定页面清单并截图到 `output/i18n-shots/`（该目录不入库）：`/`（未登录）、`/?mock=qimen`（loading 与结果）、`/bazi`（mock 档案）、`/fortune`、`/reports`、`/engineering`、`/feedback`、`/terms`。同时在页面里执行溢出检查：遍历可见元素，凡 `scrollWidth > clientWidth + 1` 且未设置 `overflow-x: auto|scroll` 的记为溢出。

**验收**：

1. 脚本对 `zh-CN` 报告 0 处溢出（先确认基线干净；若现状已有，列入豁免清单）。
2. `zh-TW`、`en-US` 报告 0 处新增溢出。
3. `manual-acceptance.md` 含 T1.2、T2.4–T2.7 的手工步骤，以及记录栏：日期、浏览器、预览地址、控制台是否有报错。

### M3 英文 LLM 输出

#### T3.1 请求语言与错误 code

**文件**：新建 `src/i18n/requestLocale.mjs`、`src/i18n/requestLocale.test.mjs`、`lib/i18n/requestLocale.js`、`lib/i18n/requestLocale.test.js`、`lib/i18n/serverMessages.js`；改 `worker/src/index.js`、`lib/accountQuota.js`、`HomeView.vue`、`BaziView.vue`、`FortuneView.vue`、`src/fortuneWarmup.mjs`；改 `src/workerBaziSse.test.mjs`、`src/workerQimenAudit.test.mjs`。

**接口**：

```js
// 前端
export function withLocale(body: object, locale = 当前界面语言): object;        // 返回 { ...body, locale }
export function withLocaleQuery(url: string, locale = 当前界面语言): string;    // 追加或覆盖 locale=

// Worker 侧（lib，CJS）
function resolveRequestLocale({ bodyLocale, queryLocale }): { uiLocale, contentLocale };
function apiError(code, { status, details } = {}): { body: { error, code, details? }, status };
//   error 文本取 serverMessages['zh-CN'][code]，保持与现有中文文案逐字一致
```

前端发往 Worker 的约 18 处 `fetch`（`HomeView`、`BaziView`、`FortuneView` 各 6 处左右，以 `grep "/api/"` 为准）全部经 `withLocale` / `withLocaleQuery`。发往 `functions/auth/*` 的不加。

Worker：每个 handler 开头解析一次语言并向下传；`json({ error: '…' })` 全部改为带 `code`；SSE `error` 事件同理；`accountQuota.js` 抛出的额度错误带 `err.code = 'QUOTA_EXCEEDED'`，3 处 `includes('额度')` 改判 code。

前端错误显示：`const msg = payload.code && te(`error.${payload.code}`) ? t(`error.${payload.code}`) : payload.error || payload.message`（这是允许动态拼键的第二处，仅限 `error.` 前缀，键存在性用 `te` 检查）。

**验收**：

1. `resolveRequestLocale({ bodyLocale: 'zh-TW' })` → `{ uiLocale: 'zh-TW', contentLocale: 'zh-CN' }`；`'en'` → `en-US / en-US`；`undefined`、`'fr'` → `zh-CN / zh-CN`。
2. 请求不带 `locale` 时，Worker 每个接口的响应与改造前相比只多出 `code` 字段（对 `/api/health`、未登录的 `/api/qimen`、错误方法的请求做断言）。
3. 额度用尽时返回 403 且 `code === 'QUOTA_EXCEEDED'`；源码断言 Worker 中不再出现 `includes('额度')`。
4. 源码断言：前端发往 Worker 的每个 `fetch` 调用点都出现 `withLocale` 或 `withLocaleQuery`。
5. `en-US` 词条包含 §5.8 列出的每个错误 code。

#### T3.2 输出语言块接入全部 prompt

**文件**：新建 `lib/i18n/outputLanguage.js`、`lib/i18n/outputLanguage.test.js`；改 `lib/qimenPromptSections.js`、`lib/baziQuestionCore.js`、`lib/baziLlmSections.js`、`lib/baziCalibrationPrompt.js`、`lib/fortuneDailyCore.js`、`lib/fortuneMonthlyInterpretationCore.js`、`lib/wenshiFollowup.js`、`worker/src/index.js`，以及各自的测试；改 `scripts/sync-langfuse-prompts.mjs`（同步时多推一份 `*-en` 版本）。

**接口**：

```js
function buildOutputLanguageBlock(contentLocale = 'zh-CN'): string;   // zh-CN → ''
function buildUserLanguageReminder(contentLocale = 'zh-CN'): string;  // zh-CN → ''；en-US → 'Respond in English.'
const OUTPUT_LANGUAGE_BLOCK_VERSION = 'ol1';
```

英文块的内容要求见 §5.6 第 2 条。块内文字全部是常量与 `glossary.buildPromptGlossaryBlock()` 的拼接，不含任何请求相关变量。

各 prompt 的接入方式（每个 builder 增加可选参数 `contentLocale`，默认 `'zh-CN'`）：

| 函数 | 接入点 |
| --- | --- |
| `buildQimenSystemPrompt(contentLocale)` | 数组末尾追加语言块（空串时不追加，保证简体输出与现在逐字相同） |
| Worker 内联的 `qimenUserPrompt` | 末尾追加 `buildUserLanguageReminder` |
| `buildBaziQuestionPrompt({ …, contentLocale })` + `convertPromptToTextMode(prompt, mode, contentLocale)` | 在 `WRAP` 之后追加语言块 |
| `buildBaziProfileSectionPrompt({ …, contentLocale })` | 末尾追加 |
| `buildCalibrationPrompt(profile, events, { now, contentLocale })` | 末尾追加 |
| `buildInterpretationPrompt(context)`（`context.contentLocale`） | 末尾追加 |
| `buildMonthlyInterpretationPrompt(profile, data, dimension, notes, { contentLocale })` | 末尾追加 |
| `buildFollowupPatchPrompt({ …, contentLocale })`、`buildBaziFollowupPrompt({ …, contentLocale })` | 末尾追加 |
| `buildLlmRoutePrompt`、`buildBaziSemanticRoutePrompt`、`buildFollowupClassifierPrompt` | 不改 |

月运 prompt 里的 few-shot 示例是中文；英文块里要有一句说明「示例是中文，只学它的结构与分寸，输出仍用英文」。

Worker 后处理中的三句中文兜底（`model_suggested_delta_reason`、`audit_reason` 默认值、`score_logic` 默认值）与 `QIMEN_CATEGORY_LABELS`、`QIMEN_SCORE_LABEL`、`scoreVerdictLabel`：前两句只进审计，不动；`score_logic` 默认值改从 `serverMessages` 按 `contentLocale` 取；三个标签保持中文原值写入结果（它们是符号，前端用 `scoreBandLabel` / `verdictLabel` 显示）。

`sanitizeUserText`：增加英文规则，去掉含 `backend`、`pre-score`、`audit delta`、`final score suggestion` 的分句；中文规则不动。

**验收**：

1. `buildOutputLanguageBlock()` 与 `buildOutputLanguageBlock('zh-CN')` 返回 `''`。
2. 对上表每个 builder：不传 `contentLocale` 的输出与改造前逐字相同（用改造前的输出做夹具）。这是简体零回归的硬门槛。
3. 对每个 builder：`contentLocale: 'en-US'` 的输出以英文语言块结尾，且 `zh-CN` 输出是它的严格前缀（证明前缀缓存可复用）。奇门的 system prompt 单独断言这一点。
4. 英文块连续生成两次逐字相同；包含 `<<<SEC:`（说明标记不翻译的那句）、`positive`、`mixed`、`warning`、`English (汉字)` 格式示例、长度换算规则。
5. 英文块不含任何 `${` 残留，长度小于 6,000 字符。
6. `sanitizeUserText('Timing is favorable. Backend pre-score 72 was adjusted.')` 返回 `'Timing is favorable.'`；对现有中文用例结果不变。

#### T3.3 输出语言校验与重试

**文件**：新建 `lib/i18n/detectProseLocale.js`、`lib/i18n/detectProseLocale.test.js`；改 `worker/src/index.js`（`qimenSectionsAreBad`、`baziSectionsAreBad` 的调用处，`requestLLMStreamSections` 之后，运势与纠偏 JSON 返回之后）。

**接口**：

```js
function cjkRatio(text): number;   // 先去掉全角/半角括号内的内容，再算 CJK 字符数 / 非空白字符数
function proseMatchesLocale(text, contentLocale, { maxCjkRatio = 0.15, minLatinRatio = 0.5 } = {}): boolean;
//   zh-CN：恒为 true（不校验中文输出，保持现状）
```

接入：英文请求下，可见正文段（奇门 7 段、八字问事的散文段、八字档案 3 段、追问补丁）任一段不匹配，即按「结构不合格」处理，复用现有的一次非流式重试；重试后仍不匹配则照常返回，结果加 `output_locale_actual: 'mixed'`，并 `console.warn` 一条带 trace 名的日志。JSON 型接口（日运、月运、纠偏）对其文本字段做同样检查，不匹配时重试一次。

**验收**：

1. `proseMatchesLocale('The Open Door (开门) sits in Zhen 3 (震3宫), which favors action.', 'en-US') === true`。
2. `proseMatchesLocale('日干落震三宫，临开门，利于行动。', 'en-US') === false`。
3. `proseMatchesLocale('任何中文', 'zh-CN') === true`。
4. 用桩替换 LLM 调用：第一次返回中文正文、第二次返回英文正文时，最终结果为英文且只发生一次重试；两次都返回中文时，结果带 `output_locale_actual: 'mixed'` 且不报错。
5. 简体请求下 LLM 调用次数与改造前相同（不会因校验多调一次）。

#### T3.4 SSE 进度文案结构化

**文件**：改 `worker/src/index.js`（`handleQimen`、`handleBaziQuestion`、`handleBazi`、两个 followup）、`HomeView.vue`、`BaziView.vue`、词条 `sse.*`；改 `src/workerBaziSse.test.mjs`。

按 §5.8 给下列事件补 key，旧字段原样保留：

| 事件 | 现文案 | key |
| --- | --- | --- |
| 奇门 step 0 | `事业运势` / `奇门遁甲`、`综合推演` | `mainKey: enum.category.<code>`，`subKey: sse.chip.branchQimen` / `branchHybrid` |
| 奇门 step 3 | `发现 N 个窗口` / `近日`、`暂无明确窗口` | `sse.chip.windowsFound {n}` / `sse.chip.windowSoon`、`sse.chip.noWindow` |
| 奇门 step 4 | `初分 N` / 三档 | `sse.chip.preScore {score}` / `enum.scoreBand.*` |
| `engine_complete.tags` | 四个 label | 每个 tag 加 `labelKey` / `labelParams`；局名 tag 不加 |
| 八字问事 step 0–4 | `八字命理`、`命盘就绪`、`命局推演`、`忌神已标记` 等 | `sse.bazi.*` |
| 八字档案 step 0–2 | `校验档案`、`排盘计算`、`AI 断语生成` | `labelKey: sse.profile.*` |
| `llm_retry` | `AI 重新推演中…` | `messageKey: sse.llmRetry` |
| `llm_error` | `AI 深度断语暂时不可用，已保留规则引擎结果` | `code: LLM_UNAVAILABLE_PARTIAL` |

`日主甲`、`喜木` 这类「词 + 符号」的 chip：`mainKey: sse.bazi.dayMaster`，`mainParams: { symbol: '甲' }`，前端英文渲染为 `Day Master 甲`。

**验收**：

1. 现有 SSE 测试对旧字段的断言全部通过。
2. 对上表每一行，断言事件对象同时含旧字段与新 key。
3. 前端渲染函数：给含 key 的事件，`en-US` 下输出不含 CJK（符号参数除外）；给不含 key 的旧事件，输出等于 `main` / `sub` 原文。

#### T3.5 缓存、记录与追问的语言

**文件**：改 `worker/src/index.js`、`lib/fortuneDailyCore.js`（`buildFortunePeriodKey`）、`lib/fortuneMonthlyInterpretationCore.js`（`buildMonthlyInterpretationPeriodKey`）、`src/fortuneCache.mjs`、`src/fortuneWarmup.mjs`、`HomeView.vue`、`BaziView.vue`；对应测试。

**做法**：按 §5.9 逐项实现。

```js
function localeCacheSuffix(contentLocale): '' | '::en-US';   // 放 lib/i18n/requestLocale.js
```

- 内存缓存键、`period_key`、浏览器缓存键都拼上 `localeCacheSuffix`。纯规则接口（`fortune-daily/weekly/monthly/annual`）的缓存在 M4 之前不加后缀（内容与语言无关）；M4 接入出口本地化后再加。
- 所有 LLM 接口的最终结果对象加 `output_locale`；八字档案写 `bazi_detail.qualitative.output_locale`。
- 追问请求体新增 `originLocale`，前端取自 `currentResultData.output_locale || 'zh-CN'`；Worker 用它作为该次追问的 `contentLocale`。
- `fortuneWarmup.mjs` 预热时带当前语言。

**验收**：

1. `buildFortunePeriodKey(date, pid)` 不传语言或传 `zh-CN` 时与改造前逐字相同；传 `en-US` 时以 `::en-US` 结尾。月运键同理。
2. 浏览器缓存：写入一条 `zh-CN` 日运后，用 `en-US` 读取同一天同一档案返回空。
3. 内存缓存：同一时辰同一问题，先 `zh-CN` 后 `en-US` 请求，第二次不命中缓存（用桩统计 LLM 调用次数为 2）。
4. 奇门结果对象含 `output_locale`；旧记录（无该字段）在前端被当作 `zh-CN`。
5. 追问：界面语言 `en-US`、`originLocale: 'zh-CN'` 时，生成的补丁 prompt 不含英文语言块；反之含。
6. 数据库无结构变更（本任务不产生 SQL 文件）。

#### T3.6 英文提问的路由

**文件**：改 `lib/divinationRouter.js`（仅在需要时）、新增 `eval/i18n-en/route-cases.js`、`eval/i18n-en/run-route.mjs`。

**做法**：英文问题不含中文关键词，`classifyByRules` 会给出 `confidence: 'low'`，从而进入现有的快模型兜底分类。本任务不新增英文关键词规则，只验证并固定这条路径：

- 确认 `detectExplicitBranchRequest` 对英文里的 `bazi`、`qimen`、`four pillars` 做大小写不敏感匹配（缺则补，这是唯一允许加的英文规则）。
- `buildLlmRoutePrompt` 的输入说明里加一句「问题可能是英文或繁体中文，分类标准不变，`reason` 用中文写」。

评测集：40 条英文问题（每个一级分类至少 5 条，另含 5 条应路由到八字、5 条应为综合），标注期望的 `branch` 与 `category`。

**验收**：

1. 单元测试（桩 LLM）：英文问题触发一次分类调用；返回的 code 经 `normalizeDivinationRoute` 后合法。
2. 评测（真实模型，手工运行，结果写入 `eval/i18n-en/RESULTS.md`）：`branch` 准确率不低于 85%，`category` 准确率不低于 80%。不达标时调整分类 prompt 后重跑，并确认中文路由评测（`eval/bazi-skill/route-cases.js`）不退步。
3. 记录成本：英文问事每次多一次快模型分类调用，写进 `RESULTS.md`。

#### T3.7 英文输出质量评测

**文件**：新建 `eval/i18n-en/cases.js`、`eval/i18n-en/run.mjs`、`eval/i18n-en/checks.mjs`、`eval/i18n-en/RESULTS.md`。

**做法**：20 个固定用例（奇门 8、八字问事 5、八字档案 3、日运 2、月运 2），用固定起局时间和固定测试档案，以 `en-US` 调用本地 Worker。自动检查：

| 检查 | 规则 |
| --- | --- |
| 结构 | 哨兵段齐全，`data_json` 可解析，枚举值未被翻译 |
| 语言 | 每个正文段 `proseMatchesLocale(…, 'en-US')` 为真 |
| 术语 | 正文中出现的术语表英文名拼写与术语表一致；出现的汉字都能在术语表或盘面数据里找到 |
| 忠实 | 正文提到的宫位、门、星、神、干支都存在于该局盘面数据中（复用 `eval/bazi-skill/faithfulness.mjs` 的思路） |
| 长度 | 各段英文词数在「中文字数上限 × 0.6」的 0.5–1.5 倍范围内 |
| 禁用语 | 不含 `definitely`、`guaranteed`、`100%`、`backend`、`engine`、`score of` |

另做人工对读：同一局的中文版与英文版，结论方向（有利/不利）、行动建议、应期窗口必须一致。

**验收（M3 上线门槛）**：自动检查 20 例全部通过结构与语言两项；术语、忠实、长度、禁用语各项通过率不低于 90%；人工对读 20 例无方向性矛盾。结果与失败样例写入 `RESULTS.md`。

**M3 上线动作**：`ENABLED_LOCALES = ['zh-CN', 'zh-TW', 'en-US']`；`wrangler deploy` 与前端同时发布。

### M4 英文引擎断语

#### T4.1 盘点

**文件**：新建 `scripts/i18n_engine_inventory.mjs`、`docs/i18n/engine-text-inventory.md`、`lib/i18n/enginePaths.js`。

**做法**：对每个返回引擎数据的接口，用固定输入各跑一批样本（奇门 30 局覆盖全部一级分类；八字 20 个档案；日/周/月/年运各 20 份），遍历响应 JSON，收集所有「含 CJK 且长度 ≥ 4 且不是纯符号」的字符串及其 JSON 路径，再对照前端代码确认该路径是否真的被渲染。产出：

- `enginePaths.js`：每个接口一份需要本地化的路径清单（支持 `*` 通配数组下标）。形状如下，具体路径以脚本产出为准：

  ```js
  module.exports = {
    'fortune-weekly': ['weekly_tag', 'event_forecast.career', 'event_forecast.wealth', 'event_forecast.relationship' /* … */],
    'qimen': [/* formation_tags、评分命中理由、应期窗口说明等 */],
    // …
  };
  ```

- `engine-text-inventory.md`：每条路径的样例、来源文件与函数、分类（固定句 / 模板句 / 自由拼接）、是否显示给用户。

**验收**：

1. 脚本可重复运行，输出稳定（固定随机种子与输入）。
2. 清单覆盖 §4.2 表里全部「否」与「是」接口中的引擎字段。
3. 文档里每条「显示给用户」的路径都标了前端渲染位置（文件 + 函数或模板区域）。
4. 评审人抽查 10 条路径，确认分类无误。

#### T4.2 离线词条

**文件**：新建 `scripts/i18n_extract_engine_strings.mjs`、`scripts/i18n_translate_catalog.mjs`、`lib/i18n/catalog/en-US.engine.json`、`lib/i18n/catalog.test.js`、`docs/i18n/catalog-review.md`。

**做法**：

- 抽取：从 `lib/` 的常量里直接取固定句子（`PATTERN_STATEMENT_LIBRARY`、`EVENT_FORECAST`、`DIMENSION_SHISHEN_COPY`、`constants/shensha.js` 的说明、各评分模块里不含插值的 `reason` 字面量），加上 T4.1 样本里分类为「固定句」的字符串；浏览器端 `src/utils/baziShensha.mjs` 等同样处理。
- 翻译：脚本调用快模型，system 里放术语表与 §5.6 的写作规则，按 50 条一批、JSON 进 JSON 出、`temperature: 0`。已有译文的键不重翻（除非加 `--force`）。
- 词条格式：`{ "<简体原文>": { "en": "<译文>", "g": "<术语表版本>", "reviewed": false } }`。
- 审校：`catalog-review.md` 记录抽审范围与结论；每个来源常量至少抽 10%，格局断语库与周运事件预告全量审。

**验收**：

1. 词条里每个键都是某个来源常量中真实存在的字符串（测试反查）。
2. 译文不含 CJK（括号内的术语汉字除外）；包含的术语英文名与术语表一致。
3. `PATTERN_STATEMENT_LIBRARY`、`EVENT_FORECAST` 的每个叶子字符串都有译文。
4. 词条文件 gzip 后小于 400 KB；超出则按来源拆文件懒加载。

#### T4.3 Worker 出口本地化与翻译记忆

**文件**：新建 `lib/i18n/localizeEngine.js`、`lib/i18n/localizeEngine.test.js`、`docs/sql/i18n-translation-memory.sql`；改 `worker/src/index.js`。

**接口**：

```js
async function localizeEnginePayload(payload, {
  contentLocale,            // zh-CN → 立即返回原对象（同一引用）
  paths,                    // 来自 enginePaths.js
  catalog,                  // en-US.engine.json
  tm: { getMany(hashes), putMany(rows) },   // Supabase 适配器
  translate,                // async (strings[]) => strings[]，快模型
  budgetMs = 2500,
  waitUntil,                // ctx.waitUntil
}): Promise<{ payload, stats: { catalogHits, tmHits, translated, fallback } }>;
```

规则：

- 只处理 `paths` 命中的字符串；返回新对象，不改入参。
- 纯符号字符串（全部字符都在术语表里或是标点数字）不走翻译，直接 `formatBilingual`。
- 查找顺序：词条 → 翻译记忆 → 实时翻译。实时翻译合并为一次批量调用；整体受 `budgetMs` 限制，超时的字符串保留原文，并用 `waitUntil` 在后台完成翻译与写回。
- 翻译记忆主键：`sha256(原文) + locale + GLOSSARY_VERSION`。
- 流式接口：`engine_complete` 事件发出前对 `engineOutput` 做一次；`complete` 事件前对最终结果里的引擎字段做一次（LLM 字段不碰）。
- 接入后，纯规则运势接口的缓存键加语言后缀（T3.5 留的口子）。

SQL：

```sql
create table if not exists public.i18n_translation_memory (
  source_hash text not null,
  locale text not null check (locale in ('en-US')),
  glossary_version text not null,
  source_text text not null,
  translated_text text not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (source_hash, locale, glossary_version)
);
alter table public.i18n_translation_memory enable row level security;
-- 只允许 service role 读写；不建面向匿名或登录用户的策略。
```

**验收**：

1. `contentLocale: 'zh-CN'` 时返回的 `payload` 与入参是同一引用，`translate` 与 `tm` 未被调用。
2. 全部命中词条时不调用 `tm` 与 `translate`。
3. 词条未命中、翻译记忆命中时不调用 `translate`。
4. 都未命中时 `translate` 只被调用一次（批量），结果写入 `tm`。
5. `translate` 耗时超过 `budgetMs`：函数在预算内返回，未完成的字段保留原文，`stats.fallback > 0`，`waitUntil` 收到一个 Promise，该 Promise 完成后 `tm.putMany` 被调用。
6. `translate` 抛错：函数不抛错，相关字段保留原文。
7. 入参对象调用前后深比较不变。
8. 简体请求下各接口响应与改造前逐字节相同。

#### T4.4 前端引擎文字

**文件**：新建 `src/i18n/engineText.mjs`、`src/i18n/engineText.test.mjs`；改 `BaziView.vue`、`BaziStaticPanel.vue`、`BaziDynamicPanel.vue`、`BaziBackingPanel.vue`、`FortuneView.vue`、`HomeView.vue`、`ZiweiChartPanel.vue` 中渲染浏览器端计算文字的位置。

**接口**：

```js
export async function loadEngineCatalog(locale): Promise<void>;   // en-US 时动态加载词条；其他语言空操作
export function et(zh, locale): string;                           // 查词条；查不到返回 zh
```

Worker 已本地化的字段前端直接显示；只有浏览器端自己算出来的说明文字（神煞说明、本地矩阵说明、紫微杂项说明）才用 `et`。移除 M2 时给这些容器加的 `lang="zh-CN"`（改为按是否命中决定）。

**验收**：

1. `et('不存在的句子', 'en-US')` 返回原文；`et(x, 'zh-CN') === x`。
2. 词条 chunk 只在 `en-US` 下加载。
3. 手工：英文下八字专业细盘的神煞说明、格局说明、周运事件预告为英文；断网重放（缓存清空）时这些位置显示中文原文而不是空白。

### M5 外围

#### T5.1 爬虫页、预渲染与 hreflang（需拍板，见 §10）

**文件**：改 `functions/_middleware.js`、`scripts/prerender.mjs`、`index.html`、`src/router/index.js`、`public/sitemap.xml`、`src/seoExposure.test.mjs`；新建 `functions/_middleware.test.js`。

**做法**：增加路径前缀别名 `/en/*` 与 `/zh-tw/*`，仅作为入口：命中前缀时以该语言初始化（优先级高于 `localStorage`，低于 `?locale=`），页面内容与无前缀路由相同。`ROUTE_META` 每条路由改为 `{ 'zh-CN': {…}, 'zh-TW': {…}, 'en-US': {…} }`，繁体条目由脚本从简体生成并提交。`buildBotHtml` 按语言输出 `<html lang>`、标题、描述、`h1`、导言、导航、`og:locale`，并输出三条 `hreflang` 与 `x-default`；每个语言 URL 以自身为 canonical。`index.html` 里的 JSON-LD 保持简体。

**验收**：

1. 以爬虫 UA 请求 `/en/`：`<html lang="en-US">`，`<h1>` 不含 CJK，含三条 `hreflang` 与 `x-default`。
2. 以爬虫 UA 请求 `/`：输出与改造前相比只多出 `hreflang` 标签。
3. 普通 UA 请求 `/en/bazi` 进入 SPA 后界面为英文，路由组件与 `/bazi` 相同。
4. `sitemap.xml` 每个可索引路由有三个语言条目。

#### T5.2 法律文本英文版（需拍板）

把 T2.8 的占位替换为审核后的英文条款；未审核不做。

#### T5.3 邮件模板、manifest、分享图

- Supabase 的重置密码与注册确认邮件模板在控制台配置，不在仓库里。产出 `docs/i18n/supabase-email-templates.md`：三语模板文本，以及按用户 `user_metadata.locale` 选择模板的配置步骤；注册与发起重置时把当前界面语言写入 `user_metadata.locale`（改 `HomeView.vue` 的注册调用与 `src/auth/passwordReset.mjs`）。
- `public/manifest.webmanifest`：PWA 名称保持「奇门道」，不做多语言（浏览器对 manifest 本地化的支持不一致）。
- 分享图：标题与水印已在 T1.2、T2.4b 处理；本任务只补验收截图。

**验收**：注册请求的 `options.data.locale` 等于当前界面语言（单元测试）；文档经评审。

#### T5.4 文档

改 `README.md`、`docs/readme/README.en.md`、`docs/readme/README.zh-TW.md`：支持的语言、如何加词条、「code 不翻译」规则、语言如何进入 Worker 请求、改 prompt 或术语表后要递增的版本号（`OUTPUT_LANGUAGE_BLOCK_VERSION`、`GLOSSARY_VERSION`）、如何跑 `i18n:lint` 与截图脚本。在旧计划文件顶部加一行指向本文的「已被取代」说明（本 PR 已做）。

---

## 8. 验收矩阵与发布门槛

每个里程碑上线前，在预览环境按下表逐格过一遍（`docs/i18n/manual-acceptance.md`）。

| 流程 | zh-CN 浅 | zh-CN 深 | zh-TW 浅 | zh-TW 深 | en-US 浅 | en-US 深 |
| --- | --- | --- | --- | --- | --- | --- |
| 登录 / 注册 / 访客进入 | M0 | M0 | M1 | M1 | M2 | M2 |
| 奇门问事：输入 → loading → 结果 → 点宫 → 追问 → 分享图 | M0 | M0 | M1 | M1 | M3 | M3 |
| 八字问事（综合路径） | M0 | M0 | M1 | M1 | M3 | M3 |
| 历史抽屉：打开旧记录、筛选、反馈 | M0 | M0 | M1 | M1 | M2 | M2 |
| 八字档案：新建 → 四个页签 → 拖动大运流年 → 重新生成 | M0 | M0 | M1 | M1 | M3 | M3 |
| 紫微盘：三合 / 四化、运限切换 | M0 | M0 | M1 | M1 | M2 | M2 |
| 运势：日 / 周 / 月（四维度）/ 年 | M0 | M0 | M1 | M1 | M3 | M3 |
| 关于、反馈、条款、重置密码 | M0 | M0 | M1 | M1 | M2 | M2 |

格内的里程碑表示「从这个里程碑起该格必须通过」。M0 列的含义是简体零回归。

发布门槛：

- 每个里程碑：`npm test && npm run build` 通过；`i18n:lint` 通过；截图脚本无新增溢出；上表对应格全部通过；浏览器控制台无新增报错。
- M1：T1.1 的术语表驱动测试全部通过；全流程无 `幹`、`醜`、`鬥` 误字。
- M3：T3.7 评测达标；简体下 prompt 与改造前逐字相同（T3.2 验收第 2 条）。
- M4：英文下引擎字段的词条 + 翻译记忆命中率不低于 80%（上线一周后复核，低于则把高频未命中项补进词条）。

回滚：语言入口由 `ENABLED_LOCALES` 控制，出问题时把对应语言移出数组并重新发布前端即可；已选该语言的用户会回落到简体。Worker 侧对 `zh-CN` 请求无行为变化，不需要单独回滚。

---

## 9. 风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| DOM 层简转繁与 Vue 更新互相干扰 | 闪现简体或重复转换 | 节点级缓存防自触发；`MutationObserver` 回调在绘制前执行；T1.2 手工用例专门看流式输出 |
| 保护词表不全 | 繁体出现错字 | 术语表全量过 OpenCC 的测试（T1.1）；上线后把用户反馈的词补进词表与测试 |
| 英文输出不稳定（夹中文、术语不一致） | 英文体验差 | 语言块 + 末尾提醒 + 校验重试（T3.3）；评测门槛（T3.7） |
| 英文 prompt 块改动打掉前缀缓存 | 成本上升 | 语言块放末尾且全为常量；测试断言中文 prompt 是英文 prompt 的严格前缀 |
| 引擎断语英文翻译质量 | 断语走样 | 固定句离线翻译并人工审校；模板句带术语表翻译；任何失败都回退原文 |
| `HomeView` / `BaziView` 改动面大，与在途 PR 冲突 | 合并成本 | 按区域拆 PR；涉及 PR #45 组件的任务排在其后；每个 PR 有逐字快照测试兜底 |
| 英文用户成本高于中文用户 | 每次问事多一次分类调用；运势缓存不与中文共享 | 已在 T3.6 记录；可接受 |
| 展示层转换的性能 | 低端机流式输出卡顿 | 只在繁体下启用；每次变更只处理变动节点；T1.2 手工验收含一台低端安卓机 |

---

## 10. 待拍板

以下几项需要 Justin 决定。每项都给了默认做法，不拍板就按默认做。

1. **英文是否要做到 M4。** 默认：做，但 M3 上线时就可以对外开放英文，M4 之前引擎断语位置显示中文原文。如果认为「英文界面里夹中文句子」不可接受，就把开放英文推迟到 M4 之后。
2. **`天冲星` 的繁体写法。** 默认 `天沖星`（与「相沖」「六沖」用字一致）。另一种是 `天衝星`。
3. **繁体界面惯用词。** 默认采用台湾习惯：`登入`、`預設`、`註冊`、`回饋`。如果主要面向香港用户，可改回 `登錄`、`默認`、`反饋`。
4. **英文十神译名。** 默认用 §5.5 的一套（Direct Wealth / Seven Killings / Eating God 等，海外八字圈最通行）。如果想用别的体系（例如 Joey Yap 体系的 Direct Officer → Direct Authority），在 T0.3 之前说。
5. **英文 URL 前缀与 hreflang（T5.1）。** 默认做 `/en/*` 与 `/zh-tw/*` 入口别名，为的是让英文和繁体页面能被搜索引擎单独收录。如果暂时不考虑海外搜索流量，这个任务可以不做。
6. **英文法律文本（T5.2）。** 默认不做，英文下显示中文条款并注明以中文为准。要做的话需要先有审核过的英文稿。
7. **英文产品名。** 默认 `Qimen Dao`，导航四个标签为 `Ask / Bazi / Reports / Fortune`。
