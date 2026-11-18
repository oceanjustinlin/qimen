# 英文输出评测结果（i18n T3.6 / T3.7）

M3 上线门槛：
- **T3.6 路由**：branch ≥ 85%，category ≥ 80%。
- **T3.7 输出**：自动检查 20 例里，结构与语言两项全部通过；术语、忠实、长度、禁用语各项 ≥ 90%；人工对读中英两版没有方向性矛盾。

## 状态

**未运行。** 开发容器里没有 LLM key，两项评测都要在有 key 的机器上手工跑：

```bash
# T3.6 路由（OpenAI 兼容接口；用线上同款快模型时把 URL / 模型换成 DeepSeek）
GEMINI_API_KEY=<key> LLM_API_URL=https://api.deepseek.com/v1/chat/completions EVAL_MODEL=<快模型名> \
  node eval/i18n-en/run-route.mjs

# T3.7 输出：先起本地 Worker（worker/.dev.vars 里有 LLM key），再跑
cd worker && npx wrangler dev   # 另开终端
EVAL_WORKER=http://127.0.0.1:8787 EVAL_AUTH_TOKEN=<测试账号 access token> EVAL_PROFILE_ID=<测试档案 id> \
  node eval/i18n-en/run.mjs
```

成本说明（T3.6）：英文问事每次比中文多一次快模型分类调用。纯英文问题不走中文规则关键词，直接交给快模型。

## T3.6 路由结果

| 模型 | branch | category | 分类调用 | 日期 |
| --- | --- | --- | --- | --- |
| （待跑） | | | | |

## T3.7 输出结果

| 项 | 通过率 | 门槛 |
| --- | --- | --- |
| 结构 | | 100% |
| 语言 | | 100% |
| 术语 | | ≥ 90% |
| 忠实 | | ≥ 90% |
| 长度 | | ≥ 90% |
| 禁用语 | | ≥ 90% |

人工对读（结论方向、行动建议、应期窗口一致）：（待做）

失败样例：（待填）
