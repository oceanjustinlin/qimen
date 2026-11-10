# Changelog

## 0.1.0（未发布）

首个版本：DeepSeek Harness 组合包，薄壳包装 `xuanxue-mcp@0.1.0`。

- `xuanxue-mcp` 行：dsh-mcp-client 以 stdio 启动 xuanxue-mcp，提供 `mcp__xuanxue__bazi` / `ziwei` / `qimen` / `astro` / `calendar` 五个工具。
- `xuanxue-skills` 行：注册 `xuanxue-bazi`、`xuanxue-ziwei`、`xuanxue-qimen`、`xuanxue-astro` 四个解读守则 skill（dsh 不支持 MCP prompts）。
- 已在 dsh 0.2.2-rc.1 的 headless profile 上端到端验证（模拟模型端点）：skill 目录可见、skill 可加载、`mcp__xuanxue__bazi` 返回 `ok: true`。
