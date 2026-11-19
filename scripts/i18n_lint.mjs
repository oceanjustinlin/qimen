#!/usr/bin/env node
// 硬编码中文守门脚本（i18n spec T0.4）。
//
// 扫描 src/**/*.{vue,js,mjs}，统计每个文件「模板与脚本中、非注释、含 CJK 字符」的行数，与基线比较：
//   - 任何文件的计数高于基线 → 退出码 1，并列出该文件含中文的行；
//   - 低于基线 → 提示运行 --update 刷新基线（退出码 0）。
// 行尾注释 `// i18n-ignore`（或 `<!-- i18n-ignore -->`）的行不计数，用于盘面符号常量等确实不该翻译的行；
// `// i18n-ignore-start` 与 `// i18n-ignore-end` 之间的整块不计数（开发用 mock 数据等）。
//
// 用法：
//   node scripts/i18n_lint.mjs            检查
//   node scripts/i18n_lint.mjs --update   按当前代码重写基线
//   --root <dir>  --baseline <file>       测试用
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const IGNORE_MARK = /i18n-ignore/;

// 非目标页面（spec §3.2）与数据目录
const EXCLUDE_PATTERNS = [
  /(^|\/)node_modules\//,
  /\.test\.m?js$/,
  /^src\/data\//,
  /^src\/i18n\/locales\//,
  /^src\/i18n\/content\//, // 英文内容数据，键为简体原文
  /^src\/utils\/t2s\.mjs$/, // 生成的繁→简字表
  /^src\/views\/AdminView\.vue$/,
  /^src\/components\/BaziStaticPanelDemo\.vue$/,
  /^src\/components\/BaziDynamicPanelDemo\.vue$/,
  /^src\/views\/BaziStaticPanelDemo\.vue$/,
  /^src\/views\/BaziDynamicPanelDemo\.vue$/,
];

function parseArgs(argv) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const opts = {
    root: path.resolve(scriptDir, '..'),
    baseline: null,
    update: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--update') opts.update = true;
    else if (a === '--root') opts.root = path.resolve(argv[++i]);
    else if (a === '--baseline') opts.baseline = path.resolve(argv[++i]);
  }
  if (!opts.baseline) opts.baseline = path.join(opts.root, 'docs/i18n/hardcoded-baseline.json');
  return opts;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(vue|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

// 把注释内容替换成空格（保留换行，行号不变）。
// mode 'js'：处理 // 与 /* */，跳过字符串与模板字符串里的内容。
// mode 'html'：处理 <!-- -->。
export function stripComments(text, mode) {
  const out = text.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  if (mode === 'html') {
    let i = 0;
    while (i < text.length) {
      const start = text.indexOf('<!--', i);
      if (start < 0) break;
      const end = text.indexOf('-->', start + 4);
      const stop = end < 0 ? text.length : end + 3;
      // 保留 i18n-ignore 标记本身，便于按行豁免
      if (!IGNORE_MARK.test(text.slice(start, stop))) blank(start, stop);
      i = stop;
    }
    return out.join('');
  }
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      else if (c === '\n' && quote !== '`') quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue; }
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      if (!IGNORE_MARK.test(text.slice(i, stop))) blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      if (!IGNORE_MARK.test(text.slice(i, stop))) blank(i, stop);
      i = stop;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

// 返回含中文的行号（1 起）。.vue 文件只看 <template> 与 <script>，<style> 不计。
export function findCjkLines(source, filename) {
  let text;
  if (filename.endsWith('.vue')) {
    // 按块处理：style 块整体置空；template 去 HTML 注释；script 去 JS 注释。
    text = source.replace(/^<style[^>]*>[\s\S]*?^<\/style>/gm, (m) => m.replace(/[^\n]/g, ' '));
    text = text.replace(/^(<script[^>]*>)([\s\S]*?)^(<\/script>)/gm, (m, open, body, close) => open + stripComments(body, 'js') + close);
    text = stripComments(text, 'html');
  } else {
    text = stripComments(source, 'js');
  }
  const lines = text.split('\n');
  const rawLines = source.split('\n');
  const hits = [];
  let inIgnoredBlock = false;
  lines.forEach((line, idx) => {
    // 整块豁免：// i18n-ignore-start … // i18n-ignore-end（开发用 mock、盘面符号表等）
    const raw = rawLines[idx] || '';
    if (/i18n-ignore-start/.test(raw)) { inIgnoredBlock = true; return; }
    if (/i18n-ignore-end/.test(raw)) { inIgnoredBlock = false; return; }
    if (inIgnoredBlock) return;
    if (!CJK.test(line)) return;
    if (IGNORE_MARK.test(line)) return;
    hits.push(idx + 1);
  });
  return hits;
}

export function scan(root) {
  const files = walk(path.join(root, 'src'));
  const result = {};
  for (const full of files.sort()) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (EXCLUDE_PATTERNS.some((re) => re.test(rel))) continue;
    const lines = findCjkLines(readFileSync(full, 'utf8'), rel);
    if (lines.length) result[rel] = lines;
  }
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const current = scan(opts.root);
  const counts = Object.fromEntries(Object.entries(current).map(([f, lines]) => [f, lines.length]));

  if (opts.update) {
    mkdirSync(path.dirname(opts.baseline), { recursive: true });
    writeFileSync(opts.baseline, `${JSON.stringify(counts, null, 2)}\n`);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`i18n:lint 基线已更新：${Object.keys(counts).length} 个文件，${total} 行。`);
    return 0;
  }

  const baseline = existsSync(opts.baseline) ? JSON.parse(readFileSync(opts.baseline, 'utf8')) : {};
  const grown = [];
  const shrunk = [];
  for (const [file, count] of Object.entries(counts)) {
    const base = baseline[file] ?? 0;
    if (count > base) grown.push({ file, count, base });
    else if (count < base) shrunk.push({ file, count, base });
  }
  for (const [file, base] of Object.entries(baseline)) {
    if (!(file in counts) && base > 0) shrunk.push({ file, count: 0, base });
  }

  if (grown.length) {
    console.error('i18n:lint 发现新增的硬编码中文（请改用词条，或对盘面符号行加 // i18n-ignore）：');
    for (const { file, count, base } of grown) {
      console.error(`\n  ${file}：${base} → ${count}`);
      const source = readFileSync(path.join(opts.root, file), 'utf8').split('\n');
      for (const n of current[file].slice(0, 300)) {
        console.error(`    ${file}:${n}  ${source[n - 1].trim().slice(0, 100)}`);
      }
    }
    return 1;
  }
  if (shrunk.length) {
    console.log('i18n:lint 通过。以下文件的中文行数比基线少，请运行 `npm run i18n:lint -- --update` 刷新基线：');
    for (const { file, count, base } of shrunk) console.log(`  ${file}：${base} → ${count}`);
    return 0;
  }
  console.log('i18n:lint 通过。');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
