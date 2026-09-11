# Prompt 迁移到 Langfuse 方案

> 前置材料：[langfuse-prompt-inventory.md](langfuse-prompt-inventory.md)（函数级 prompt 清单）
> 目标：解决当前"分场景分 chunk 的 prompt 全是 JS 硬编码字符串，版本管理靠 git commit 记忆、看不到实际拼装结果"的问题。
>
> 2026-09 v4 更新：仓库观测层已经迁移到 `@langfuse/tracing` + `@langfuse/otel` 的 observations-first 模型；当前 Cloud 目标为 JP。项目侧 evaluator、dataset evaluator 和 export/integration 仍需在目标项目中用 Migration Assistant 复核。执行和回滚步骤见 [langfuse-phase0-execution-plan.md](langfuse-phase0-execution-plan.md)。

---

## 0. 先决决策：Langfuse 在这个项目里扮演什么角色

这个仓库有一个硬约束：`lib/`、`worker/src/index.js` 改动后**无 CI，需要手动 `wrangler deploy` 才生效**。这决定了 Langfuse 只有两条可选路线，必须先选一条，否则后面的埋点工作方向会反复：

| | **方案 A：观测 + 离线版本管理**（推荐起点） | 方案 B：运行时模板托管 |
|---|---|---|
| 做法 | Worker 仍用代码里的字符串模板；每次调用 Gemini 时把渲染后的最终 prompt 上报给 Langfuse 做 trace 记录；prompt 源文件的版本对比通过 Langfuse 的 Prompt 对象手动同步 + git 历史共同完成 | Worker 在请求时从 Langfuse API 拉取模板内容并渲染，代码里不再硬编码 prompt 文案 |
| 工程量 | 小：只需在 LLM 调用出口插桩上报 | 大：需要引入拉取超时、缓存、Langfuse 服务不可用时的降级到本地兜底模板，且要重新设计"逻辑重"chunk 和"纯静态"chunk 的组合方式 |
| 对现有"改 lib/ 需手动部署"流程的影响 | 无影响，完全兼容现状 | 打破现状——理论上编辑 Langfuse 模板可以不经过部署直接生效，但这对一个命理规则和文案紧耦合的系统风险很高（规则表在代码里，模板在 Langfuse，两边一旦不同步，输出会出现"证据对不上文案"的错误） |
| 适合本仓库的原因 | 本清单里"纯静态"的 chunk 占比不高（多数是混合/逻辑重），大部分 prompt 的正确性依赖规则表联动，脱离代码单独热更新的收益有限，风险却不小 | 仅当团队希望非工程人员（比如产品/命理顾问）能独立改文案且不经过代码评审时才有意义 |

**建议：先做方案 A，把方案 B 作为观察一段时间后再评估的二期选项。** 本方案后续的 Phase 划分都基于方案 A。

---

## Phase 0：基础设施搭建（建议先做，约 1-2 天）

> 已确定采用 **Langfuse Cloud 免费层**（不自托管）。详细可执行步骤见 [langfuse-phase0-execution-plan.md](langfuse-phase0-execution-plan.md)，下面只保留要点。

1. **Cloud 目标**：使用 Langfuse Cloud JP；项目凭证保留在本地 `.dev.vars` / Cloudflare secrets，不进入 git。
2. **统一 instrumentation**：5 个 LLM wrapper 通过 `beginLangfuseGeneration` 进入同一个 SDK adapter。每次调用建立 root span + nested generation，不再调用 legacy ingestion API。
3. **trace 边界**：root observation 保存经过截断/脱敏的整体输入输出，generation 保存模型、temperature 和 token usage；业务场景通过 name、tag、user、session、environment 和 metadata 检索。
4. **异步上报**：Cloudflare Worker 使用 immediate export，并通过 `ctx.waitUntil(forceFlush())` 完成发送。
5. **脱敏策略**：用户自由文本统一经过截断；定盘纠偏的高隐私描述只记录 `{profileId, promptLength}` 摘要。

**验收标准**：随便发起一次真实的奇门或八字问事请求，能在 Langfuse UI 里看到这次请求完整的 trace，包括最终发给 Gemini 的完整 prompt 文本、各 chunk 是否命中、模型返回内容。

---

## Phase 1：高优先级——纳入 Langfuse 版本管理的模板

判断标准：**改动频率高 + 内容偏静态（不依赖规则表联动）**，是"版本管理"收益最大、风险最小的一批。做法是把这些函数的输出内容同步注册为 Langfuse Prompt 对象（打版本 tag），后续每次改动这些函数时同步更新 Langfuse 里的版本记录，用于可视化 diff——**不改变 Worker 运行时行为**，只是多一份可视化版本历史。

**执行方式**：[scripts/sync-langfuse-prompts.mjs](../scripts/sync-langfuse-prompts.mjs)，`node scripts/sync-langfuse-prompts.mjs` 跑一次即可把下面 P0/P1 全部同步成 Langfuse Prompt 对象（每次跑都会创建新版本，Langfuse UI 里能直接 diff）。凭证读 `worker/.dev.vars` 或环境变量。**改了下面列出的任一函数后，重跑这个脚本**即可让 Langfuse 里的版本历史跟上代码。

| 优先级 | 目标 | 原因 | 状态 |
|---|---|---|---|
| P0 | `lib/divinationRouter.js` 的 `buildGeminiRoutePrompt`、`buildBaziSemanticRoutePrompt` | 路由 prompt，few-shot 案例随语义路由体系每次迭代都要跟着改（近 11 次提交里 3-5 次），且是全链路的入口，改坏了影响所有下游分支 | ✅ 已同步（`router/gemini-route-l1`、`router/bazi-semantic-route-l2`） |
| P0 | `lib/wenshiFollowup.js` 的 `buildFollowupClassifierPrompt`/`buildFollowupPatchPrompt`/`buildBaziFollowupPrompt` | 近 7 次提交 100% 是 prompt/证据叙述器改动，是收益密度最高的单一文件 | ✅ 已同步（`followup/classifier`、`followup/qimen-patch`、`followup/bazi-decide`）；用示例参数渲染，动态证据块部分（`buildQimenEvidenceNarrative` 等，逻辑重）不纳入模板同步，保持 Phase 3 的"只观测不模板化" |
| P1 | 奇门 4 个纯静态 section：`buildSummaryPromptSection`/`buildReportSchemaPromptSection`/`buildQimenInferenceRulesSection`/`buildFrontendCopyProtocolSection`（`lib/qimenPromptSections.js`） | 无参数、纯静态，且所在文件群近 20 次提交 80-90% 是 prompt 直接调整，是全库改动最频繁的一组文件 | ✅ 已同步 |
| P1 | `SENTINEL_INSTRUCTION`（`worker/src/index.js`，奇门哨兵协议） | 纯静态大块文案（~3800 字符），改动驱动因素（前后端协议变更）与命理逻辑改动是两条不同节奏的线，单独管理版本意义大 | ✅ 已同步（`qimen/sentinel-instruction`）——用源码文本提取而非 `require`，因为 `worker/src/index.js` 是 Cloudflare Worker ESM 入口（含 `export default { fetch }`），不能在纯 Node 脚本里安全加载 |
| P1 | 八字对应的 `WRAP` 常量（`worker/src/index.js:convertPromptToTextMode`） | 同上，但内容依赖 `mode`（拼了 `baziTextFields(mode)` 生成的动态段） | ⏸️ 暂缓——不是纯静态（`mode` 相关的 `proseBlocks` 是动态拼接），拆出纯静态部分单独同步的收益/复杂度比不划算，先跳过 |
| P2 | `buildReadingsSchema`（`lib/baziQuestionCore.js:1015-1135`） | 5 个 mode 分支各自是独立静态 JSON 片段，无跨分支耦合，是"按变量切换模板"的天然候选 | ✅ 已同步——加进 `module.exports` 后按 5 个 mode 分别推送为 `bazi/readings-schema-{status,timing,pattern,character,profile_driven}` |
| P2 | `buildPipelineContextBlock`/`buildGroundingConstraintBlock`（`lib/baziQuestionCore.js:1405-1425`） | 五个 mode prompt 共用的纯静态复用块 | ✅ 已同步（`bazi/pipeline-context-block`、`bazi/grounding-constraint-block`） |

---

## Phase 2：混合型——先打观测点，暂缓模板化

这批函数框架部分是静态说明文案，但拼了大段动态证据块，**不建议现在就拆模板**（拆了以后框架和证据块要分两处维护，容易脱节），先在 Phase 0 的 trace 里能看到完整渲染结果即可，观察 3-4 周实际改动模式后再决定是否细分：

- `lib/baziQuestionCore.js` 的 7 个 mode-specific `build*Prompt`（`buildStatusPrompt`/`buildTimingPrompt`/`buildPatternPrompt`/`buildCharacterPrompt`/`buildProfileDrivenPrompt`/`buildLlmDerivedTargetPrompt`/`buildLegacyBaziQuestionPrompt`）
- 奇门 `finalPrompt` 骨架本体（`worker/src/index.js:2216-2264`）
- `lib/wenshiFollowup.js` 里已经在 Phase 1 纳管的函数中，动态证据渲染部分（`buildQimenEvidenceNarrative`/`buildBaziEvidenceNarrative`）保持代码内实现，只是外层框架进 Langfuse
- `lib/fortuneDailyCore.js`/`lib/fortuneMonthlyInterpretationCore.js` 的运势解读 prompt（此前未被专门提及的第二条产品线，同样调用 Gemini，不要遗漏，但优先级低于问事主链路）
- `lib/baziLlmSections.js` 的 `buildBaziProfileSectionPrompt`（八字档案首次生成，命中率高但改动少）

---

## Phase 3：逻辑重——只做输出观测，不做模板迁移

这批函数内容完全由规则表/计算结果决定，文本只是"把字段 push 成字符串"，拆成模板没有意义，**长期只在渲染完成后的输出处打观测点**（记录渲染前的结构化输入 + 渲染后文本，方便排查"LLM 说漏了某条证据"是不是证据块本身没生成对）：

- `formatStateReportForPrompt`（`lib/baziStateAssessor.js`）、`formatDynamicReportForPrompt`（`lib/baziDynamicAssessor.js`）、`formatTargetSpecForPrompt`（`lib/baziTargetElement.js`）、`formatSizhuDetailBlock`（`lib/baziQuestionCore.js`）
- `buildYongshenPromptSection`/`buildDomainViewPromptSection`（`lib/qimenYongshenRules.js`，规则表驱动）、`buildTimingPromptSection`（`lib/qimenTimingRules.js`）、`buildPolarityPromptSection`（`lib/qimenPolarityRules.js`）
- `buildScoreAuditPromptSection` 及其内部 3 个 narrative 函数（`lib/qimenPromptSections.js`）

**规则表本身（`QIMEN_YONGSHEN_RULES` 等 1398 行规则定义）继续留在代码里做版本管理，不要试图把规则表也搬进 Langfuse**——规则表的迭代节奏和"prompt 说明文案"是耦合的，拆开会导致两边不同步。

---

## Phase 4：特殊架构处理

### 4.1 定盘纠偏（`src/utils/buildCalibrationPrompt.mjs`）

这是唯一一处 prompt 在**前端**拼好后整段发给后端的路径，`handleBaziCalibrate`（`worker/src/index.js:1536`）只是转发。两个选项：

- **选项一（低成本）**：只在 `handleBaziCalibrate` 记录收到的成品 prompt 字符串做 trace，不做模板管理，文档里注明"这条链路的模板版本管理发生在前端 git 历史里"。
- **选项二**：把 prompt 构建逻辑迁移到后端（架构改动，超出本次迁移范围，建议单独立项评估）。

**建议选项一**，先解决可视化，架构改动留到后面单独讨论。

### 4.2 敏感字段脱敏

`e.description`（用户填写的人生大事描述，见清单第 7 节）优先级最高——上报到 Langfuse 前需要做打码或截断处理，避免隐私信息明文躺在第三方可视化平台里（即使是自托管，也要考虑访问权限控制）。

---

## 优先级总表

| Phase | 内容 | 工作量估计 | 前置依赖 |
|---|---|---|---|
| 0 | Langfuse Cloud v4 SDK instrumentation + 埋点 + 脱敏策略 | ✅ 代码完成，待项目侧 canary | 无 |
| 1 | 6 组高频纯静态模板纳管（P0/P1/P2） | 每组 0.5-1 天，共约 3-4 天 | Phase 0 |
| 2 | 混合型框架打观测点 | 与 Phase 0 埋点同步完成，无需额外大改 | Phase 0 |
| 3 | 逻辑重输出观测 | 与 Phase 0 埋点同步完成 | Phase 0 |
| 4 | 定盘纠偏 trace + 脱敏落地 | 0.5 天 | Phase 0 |

**建议实施顺序**：先做 Phase 0（这一步做完就已经解决"看不到实际拼装结果"的核心痛点），再挑 Phase 1 里的 P0（`wenshiFollowup.js` + 两个路由 prompt）验证 Langfuse 模板对象的使用方式，跑顺了再逐步把 P1/P2 补齐。Phase 2/3 不需要额外排期，是 Phase 0 埋点工作的自然覆盖范围。

---

## 风险与注意事项

1. **Worker runtime 兼容性需要 preview canary**：SDK 基于 OpenTelemetry，代码测试和 dry-run bundle 通过后仍要用真实 Worker 请求确认 observation 能 flush 到 JP 项目。
2. **不要把"上报到 Langfuse"和"用户输入脱敏"搞反**：`worker/src/index.js:173-181` 的 `sanitizeUserText` 是清洗 LLM 输出（防内部指标泄漏），跟这里说的"用户自由文本上报前脱敏"是反方向的两件事，实现时容易混淆复用。
3. **两套哨兵协议尚未统一**（`<<<SEC:key>>>` vs `<<<SECTION:key>>>`），迁移方案不强制统一，但如果 Phase 1 做到 `SENTINEL_INSTRUCTION` 时顺手讨论一下是否合并，属于低成本顺带收益。
4. **方案 A 不解决"改 prompt 还要手动部署"的问题**——这是当前部署架构的既有约束（见 memory：`lib/` 改动需手动 `wrangler deploy`），Langfuse 迁移不改变这一点，只是让"这次线上到底发了什么 prompt"变得可查、可 diff。
