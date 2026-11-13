// 把本包导出为独立仓库 oceanjustinlin/xuanxue-dsh 的内容（dsh 社区目录要求插件在仓库根目录）。
// 用法：node packages/xuanxue-dsh/scripts/export-repo.mjs <独立仓库的本地目录>
// 只覆盖下列文件，不动目标目录里的 .git 等其他内容。源头始终是 qimen 仓库这份。
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const prompts = fileURLToPath(new URL('../../xuanxue-mcp/prompts/', import.meta.url));
const out = process.argv[2] && resolve(process.argv[2]);
if (!out) {
  console.error('用法：node packages/xuanxue-dsh/scripts/export-repo.mjs <目标目录>');
  process.exit(1);
}

const COPY = ['index.js', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'LICENSE', 'locale'];
mkdirSync(out, { recursive: true });
for (const f of COPY) cpSync(join(pkgRoot, f), join(out, f), { recursive: true });
// 独立仓库直接提交 prompts/，从 git 安装时无需构建
rmSync(join(out, 'prompts'), { recursive: true, force: true });
cpSync(prompts, join(out, 'prompts'), { recursive: true });

const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
delete pkg.scripts; // prepack 依赖 monorepo 目录结构，独立仓库不需要
writeFileSync(join(out, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(join(out, '.gitignore'), 'node_modules/\n*.tgz\n');
console.log(`已导出到 ${out}`);
