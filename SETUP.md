# 新设备开发环境搭建

## 1. 拉代码 & 安装依赖

```bash
git clone <repo-url>
cd qimen
npm install
```

## 2. 创建 Worker 本地密钥文件

在项目根目录创建 `worker/.dev.vars`（此文件被 gitignore，不会提交）：

```
LLM_API_KEY=你的 DeepSeek API Key
SUPABASE_URL=你的 Supabase 项目 URL
SUPABASE_SERVICE_KEY=同一项目的服务端密钥
```

`SUPABASE_SERVICE_KEY` 使用 Supabase 项目的 secret/service-role 密钥，仅供 Worker 使用，
不要放入前端环境变量或提交到仓库。`LLM_API_KEY` 从模型服务商获取。

## 3. 配置 Supabase

在项目根目录的 `.env.local` 中设置 `VITE_SUPABASE_URL` 和
`VITE_SUPABASE_ANON_KEY`。前端 URL 和 `worker/.dev.vars` 中的
`SUPABASE_URL`、`SUPABASE_SERVICE_KEY` 必须属于同一个 Supabase 项目。

全新项目的 `public` 模式为空时，在该项目的 SQL Editor 中执行
[初始化数据库脚本](docs/sql/initial-application-schema.sql)。脚本创建应用表和行级安全策略；
它仅用于空项目，不要在已有应用表或数据的项目中直接运行。已有项目应使用
`docs/sql/` 中对应的增量脚本。初始化脚本中的合盘会话只允许服务端访问，不向匿名客户端开放。

数据库权限测试见 [test-initial-supabase-schema.sql](scripts/test-initial-supabase-schema.sql)，
仅在具备 Supabase 认证模式和角色的隔离测试库中运行。

## 4. 启动前端开发服务

```bash
API_PROXY_TARGET=http://127.0.0.1:8787 npm run dev
```

未设置 `API_PROXY_TARGET` 时，前端默认连接远程 preview Worker，而不是本地 Worker。

## 5. 启动 Worker 本地服务（需要 wrangler）

```bash
cd worker
npx wrangler dev
```

## 6. 常用命令

| 命令 | 说明 |
|------|------|
| `API_PROXY_TARGET=http://127.0.0.1:8787 npm run dev` | 使用本地 Worker 的前端开发服务器 |
| `npm run build` | 构建生产包 |
| `npm test` | 运行测试 |
| `git push origin main` | 推送到主分支 |

## 被 gitignore 的本地文件（换设备需手动补）

| 文件 | 说明 |
|------|------|
| `.env.local` | 前端 Supabase 项目地址和公开密钥 |
| `worker/.dev.vars` | Worker 本地密钥，必须手动创建 |
| `node_modules/` | 依赖，`npm install` 生成 |
| `dist/` | 构建产物，`npm run build` 生成 |
