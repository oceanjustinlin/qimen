// prepack：把仓库引擎的依赖闭包复制到 packages/xuanxue-mcp/engine/，并剥离古籍正文字段。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '../..');
const outRoot = join(pkgRoot, 'engine');

const ENTRIES = [
  'scripts/bazi_cli.cjs',
  'scripts/ziwei_skill_cli.cjs',
  'scripts/qimen_cli.cjs',
  'scripts/calendar_cli.cjs',
  'lib/cliEnvelope.cjs',
];
const STRIP_FIELDS = ['ocr_text', 'corrected_text', 'correction_notes'];
const ALLOWED_BARE = new Set(['@modelcontextprotocol/sdk', 'zod', 'lunar-javascript', 'iztro', 'ajv', 'yaml']);
const EXTS = ['', '.cjs', '.js', '.mjs', '.json', '/index.cjs', '/index.js', '/index.mjs'];

const SPEC_RES = [
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
];

const PATH_JOIN_RE = /\brequire\s*\(\s*path\.(?:join|resolve)\(\s*__dirname\s*,((?:\s*['"][^'"]*['"]\s*,?)+)\s*\)\s*\)/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

function resolveFile(from, spec) {
  const base = resolve(dirname(from), spec);
  for (const ext of EXTS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const isBuiltin = (s) => s.startsWith('node:') || builtinModules.includes(s.split('/')[0]);
const barePackage = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);

export function collectClosure(entries = ENTRIES) {
  const files = new Set();
  const bare = new Set();
  const queue = entries.map((e) => join(repoRoot, e));
  while (queue.length) {
    const f = queue.pop();
    if (files.has(f)) continue;
    files.add(f);
    if (!/\.(cjs|js|mjs)$/.test(f)) continue;
    const src = stripComments(readFileSync(f, 'utf8'));
    // require(path.join(__dirname, '..', 'lib', 'x.cjs')) 形式
    for (const m of src.matchAll(PATH_JOIN_RE)) {
      const segs = [...m[1].matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1]);
      const r = resolveFile(f, './' + segs.join('/'));
      if (!r) throw new Error(`无法解析 path.join 依赖 ${segs.join('/')}（来自 ${relative(repoRoot, f)}）`);
      queue.push(r);
    }
    for (const m of src.matchAll(/\brequire\s*\(\s*(?!['"]|path\.(?:join|resolve)\(\s*__dirname)([^)]{0,60})/g)) {
      console.error(`prepack 警告：${relative(repoRoot, f)} 存在动态 require(${m[1]})`);
    }
    for (const re of SPEC_RES) {
      for (const m of src.matchAll(re)) {
        const spec = m[1];
        if (spec.startsWith('.')) {
          const r = resolveFile(f, spec);
          if (!r) throw new Error(`无法解析相对依赖 ${spec}（来自 ${relative(repoRoot, f)}）`);
          queue.push(r);
        } else if (!isBuiltin(spec)) {
          bare.add(`${barePackage(spec)}\t${relative(repoRoot, f)}`);
        }
      }
    }
  }
  return { files: [...files], bare };
}

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function walk(dir, skip = () => false) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!skip(p)) out.push(...walk(p, skip));
    } else out.push(p);
  }
  return out;
}

function main() {
  const { files, bare } = collectClosure();
  const badBare = [...bare].filter((b) => !ALLOWED_BARE.has(b.split('\t')[0]));
  if (badBare.length) {
    throw new Error(`引擎依赖了非白名单的裸模块（疑似 web 专用代码）：\n${badBare.join('\n')}`);
  }

  rmSync(outRoot, { recursive: true, force: true });
  for (const f of files) copyFile(f, join(outRoot, relative(repoRoot, f)));

  // 运行时按路径读取的目录
  copyDir('schemas', () => false);
  const zw = join(repoRoot, 'knowledge/ziwei');
  // fixtures/ 是测试数据不发布；reports/ 是运行时必读的报告模板（几百字节的 YAML），必须保留
  const skipDir = (p) => relative(zw, p) === 'fixtures';
  for (const f of walk(zw, skipDir)) {
    const rel = relative(repoRoot, f);
    const dest = join(outRoot, rel);
    if (/knowledge\/ziwei\/sources\/[^/]+\/excerpts\.jsonl$/.test(rel.split(sep).join('/'))) {
      mkdirSync(dirname(dest), { recursive: true });
      const lines = readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
        const o = JSON.parse(l);
        for (const k of STRIP_FIELDS) delete o[k];
        return JSON.stringify(o);
      });
      writeFileSync(dest, lines.join('\n') + '\n');
    } else copyFile(f, dest);
  }
  // 子包是 type:module，引擎的 .js 文件是 CommonJS，需在 engine/ 内显式声明
  writeFileSync(join(outRoot, 'package.json'), JSON.stringify({ private: true, type: 'commonjs' }, null, 2) + '\n');
  console.error(`prepack: ${files.length} 个闭包文件；裸模块 ${[...new Set([...bare].map((b) => b.split('\t')[0]))].join(', ')}`);
}

function copyDir(rel, skip) {
  for (const f of walk(join(repoRoot, rel), skip)) copyFile(f, join(outRoot, relative(repoRoot, f)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
