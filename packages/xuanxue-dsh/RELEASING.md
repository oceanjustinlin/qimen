# 发布清单

由仓库所有者手动执行；不要在自动化流程中运行 `npm publish`。

1. **先发布 xuanxue-mcp**（见 `../xuanxue-mcp/RELEASING.md`），确认 `npm view xuanxue-mcp version` 能查到。本包运行时通过 `npx -y xuanxue-mcp@<版本>` 拉取它。
2. 确认 `cordis.patch.yml` 中钉的 `xuanxue-mcp@<版本>` 与刚发布的版本一致（`npm test` 会检查与 `packages/xuanxue-mcp/package.json` 是否一致）。
3. 再确认包名：`npm view xuanxue-dsh`。若已被占用，改用 `@oceanjustinlin/xuanxue-dsh`（同步修改 `package.json` 的 `name`、`cordis.patch.yml` 里 `xuanxue-skills` 行的 `name`、README；scoped 包首次发布需 `--access public`）。
4. 仓库根目录 `npm test`，必须全部通过。
5. `cd packages/xuanxue-dsh && npm pack --dry-run`：文件列表应包含 `index.js`、`cordis.patch.yml`、`prompts/`（5 个 .md）、`locale/`、`README.md`、`LICENSE`。检查完删除生成的 `prompts/`。
6. 真实 dsh 验收（需人工、需要 DeepSeek API Key）：
   - `dsh plugin --profile web add xuanxue-dsh@<版本>`（或先用 `npm pack` 出的 tarball 路径）。
   - `dsh --profile web --dump-config` 能看到 `xuanxue-mcp`、`xuanxue-skills` 两行。
   - `dsh web` 里分别问一次八字、紫微、奇门、星盘问题，模型应先加载对应 `xuanxue-*` skill，再调用 `mcp__xuanxue__*` 工具拿到 `ok: true`。
7. `cd packages/xuanxue-dsh && npm publish`，打 tag 并更新 CHANGELOG。
