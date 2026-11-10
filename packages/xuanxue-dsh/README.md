# xuanxue-dsh

**English summary.** `xuanxue-dsh` is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin bundle. It is a thin shell over [`xuanxue-mcp`](../xuanxue-mcp/): the bundle patch mounts dsh's built-in MCP client to run `xuanxue-mcp` over stdio (tools `mcp__xuanxue__bazi` / `ziwei` / `qimen` / `astro` / `calendar`), and the plugin registers the four reading guides as dsh skills, because dsh's MCP client does not support MCP prompt templates. Everything runs locally. Requires dsh ≥ 0.2.2-rc.1 (Node ≥ 24.9).

## 它做什么

把八字、紫微斗数、奇门遁甲、西洋星盘的确定性排盘引擎接进 DeepSeek Harness。本包不含引擎代码，只是一层薄壳：

| 组合包行（`cordis.patch.yml`） | 作用 |
| --- | --- |
| `xuanxue-mcp` | 用 dsh 自带的 `@deepseek-ai/dsh-mcp-client` 以 stdio 启动 `npx -y xuanxue-mcp@<版本>`。模型看到的工具名是 `mcp__xuanxue__bazi`、`mcp__xuanxue__ziwei`、`mcp__xuanxue__qimen`、`mcp__xuanxue__astro`、`mcp__xuanxue__calendar`。 |
| `xuanxue-skills` | 本包 `index.js`，把 4 份解读守则注册为 skill：`xuanxue-bazi`、`xuanxue-ziwei`、`xuanxue-qimen`、`xuanxue-astro`。正文与 xuanxue-mcp 的 MCP prompts 同源，并在开头补一段工具名对照。 |

dsh 的 MCP 客户端不支持 MCP prompt 模板，所以守则改走 skill：模型在命中八字、紫微等话题时按需加载，平时不占上下文。

工具参数、输出外层与隐私承诺见 [xuanxue-mcp 的 README](../xuanxue-mcp/README.md)。

## 安装

需要 DeepSeek Harness 0.2.2-rc.1 或更高版本（Node ≥ 24.9）。

```bash
dsh plugin --profile web add xuanxue-dsh
dsh --profile web --dump-config | grep -A8 xuanxue   # 应能看到 xuanxue-mcp 与 xuanxue-skills 两行
dsh web
```

首次启动时 `npx` 会下载 `xuanxue-mcp`，之后走缓存。

## 自定义

在 profile 的 `cordis.patch.yml`（`$DSH_HOME/profiles/<名称>/cordis.patch.yml`）里按 id 覆盖。例如改用本地仓库里的 server（开发调试，或不想走 npx）：

```yaml
- id: xuanxue-mcp
  config:
    serverName: xuanxue
    transport: stdio
    command: node
    args: ['/绝对路径/qimen/packages/xuanxue-mcp/src/server.mjs']
    failOnStartupError: true
```

注意：覆盖 `config` 会替换整段配置，`serverName` 和 `transport` 要一起写上；`serverName` 改了之后 skill 里的工具名对照会对不上，建议保持 `xuanxue`。

dsh-mcp-client 默认 `failOnStartupError: false`：server 启动失败时 harness 照常运行，只是没有 `mcp__xuanxue__*` 工具（stderr 会有一条错误）。排查时可像上面那样打开它。

## 开发

- 测试：仓库根目录 `npm test`（含 `packages/xuanxue-dsh/test/plugin.test.mjs`）。
- `cordis.patch.yml` 里 `xuanxue-mcp@<版本>` 钉的是 `packages/xuanxue-mcp/package.json` 的版本，测试会检查两者一致；xuanxue-mcp 升版时同步改这里。
- `prepack` 把 `../xuanxue-mcp/prompts/` 复制进本包的 `prompts/`（已 gitignore）。开发时 `index.js` 自动退回读取仓库里的那份。
- 本地联调：`dsh plugin --profile <名称> add <仓库绝对路径>/packages/xuanxue-dsh` 会以 `link:` 方式安装，再按上面的“自定义”把 server 指向本地 `server.mjs`。

## 发布

见 [RELEASING.md](./RELEASING.md)。必须先发布 `xuanxue-mcp`，再发布本包。

## 许可

MIT
