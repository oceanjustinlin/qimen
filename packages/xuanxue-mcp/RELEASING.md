# 发布清单

由仓库所有者手动执行；不要在自动化流程中运行 `npm publish`。

1. 再确认包名：`npm view xuanxue-mcp`。若名称已被占用，改用 `@oceanjustinlin/xuanxue-mcp`（同步修改 `package.json` 的 `name` 与 README 中的所有 `npx` 配置，scoped 包首次发布需 `--access public`）。
2. 在仓库根目录运行 `npm test`，必须全部通过。
3. `cd packages/xuanxue-mcp && npm pack --dry-run`，检查文件列表：应包含 `README.md`、`LICENSE`、`src/`、`prompts/`、`engine/`，且 `engine/` 下的 `excerpts.jsonl` 不含 `ocr_text`、`corrected_text`、`correction_notes`。`prepack` 会生成 `engine/`（已 gitignore），检查完后删除该目录，避免影响开发时的引擎加载路径。
4. 真实客户端验收（发布前必做，需人工）：`claude mcp add xuanxue -- node <绝对路径>/packages/xuanxue-mcp/src/server.mjs`，在 Claude Code 里分别问一次八字、紫微、奇门问题，三个都应拿到 `ok: true` 的结果。发布后再用 `npx -y xuanxue-mcp` 在干净环境接入 Claude Desktop 复验。
5. `cd packages/xuanxue-mcp && npm publish`。
6. 打 tag 并更新 CHANGELOG。
