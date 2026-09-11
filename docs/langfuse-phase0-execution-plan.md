# Langfuse v4 可观测性执行说明

> 前置文档：[langfuse-prompt-inventory.md](langfuse-prompt-inventory.md)、[langfuse-migration-plan.md](langfuse-migration-plan.md)
>
> 当前目标：Langfuse Cloud JP（`https://jp.cloud.langfuse.com`），使用 v4 observations-first 数据模型。

## 已实现

- Worker 使用 `@langfuse/tracing`、`@langfuse/otel` 和 OpenTelemetry tracer provider，不再直接发送 legacy `trace-create` / `generation-create` ingestion 事件。
- 每次 LLM 调用创建一个承载整体输入/输出的 root span，并在其下创建带 model、model parameters、usage 的 generation。
- 用户 ID、追问 session ID、environment、tag 和低基数 metadata 通过 trace attributes 传播。
- 流式调用在流完成后结束 observation；`exportMode: "immediate"` 配合 `ctx.waitUntil(forceFlush())`，避免 Worker 返回后数据仍停留在内存。
- Langfuse 初始化、记录或 flush 失败均为 fail-open，不影响主业务响应。
- prompt/output 继续使用 `redactForTrace` 截断；定盘纠偏继续只记录 `{ profileId, promptLength }` 摘要，不上传原始人生大事描述。
- production/preview 分别使用 `LANGFUSE_TRACING_ENVIRONMENT` 标记，base URL 均为 JP 区域。

## 配置

本地开发从已被 git 忽略的 `worker/.dev.vars` 读取：

```dotenv
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://jp.cloud.langfuse.com
LANGFUSE_TRACING_ENVIRONMENT=preview
```

部署环境的两个 key 必须作为 Cloudflare secrets 配置；base URL 和 environment 已在 `worker/wrangler.toml` 中声明。不要把密钥写入仓库。

## 代码验证

```bash
npm test
npm run build
cd worker && npx wrangler deploy --dry-run --env=preview
```

## 项目侧验收

代码验证不能替代项目侧 canary。部署 preview 后至少验证：

- 奇门主问、八字主问和两种追问都产生 root observation + generation。
- 追问的多次调用按 `recordId` / `requestId` 或 `profileId` 聚合为同一 session。
- production 与 preview 可按 environment 区分，user、tag、model、usage 和脱敏 I/O 正确。
- 错误 key 或 Langfuse 暂时不可用时，主业务仍正常返回。
- Migration Assistant 中没有仍在使用的 legacy evaluator；dataset evaluator、export/integration consumer 已逐项复核。

项目侧改动必须先复制为 disabled 版本、再用 canary 验证，最后才切换；保留旧规则到新 observation 数据稳定后，作为回滚路径。
