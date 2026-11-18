#!/usr/bin/env node
// 生成 lib/i18n/t2s.js：繁→简字符级映射（i18n spec T1.3）。
// 来源：opencc-js 的 TSCharacters（繁→简）+ TWVariantsRev / HKVariantsRev（台/港异体 → 标准繁体）。
// 每个字只取第一个候选；只收 BMP 汉字。Worker 里不引入 opencc 运行时，只用这份表。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TSCharacters from 'opencc-js/dict/TSCharacters';
import TWVariantsRev from 'opencc-js/dict/TWVariantsRev';
import HKVariantsRev from 'opencc-js/dict/HKVariantsRev';
import STCharacters from 'opencc-js/dict/STCharacters';

const parse = (dict) => dict.split('|').map((row) => row.split(' ')).filter(([k, v]) => k && v);
const isBmpHan = (c) => c && c.length === 1 && /[㐀-鿿豈-﫿]/.test(c);

const ts = new Map(parse(TSCharacters).map(([k, v]) => [k, v]));
const variantToStd = new Map([...parse(TWVariantsRev), ...parse(HKVariantsRev)].map(([k, v]) => [k, v]));

// 这些字在简体里也是正常用字（乾宫、乾造、著名、沈阳），不做映射。
// 另外：本身就是简体字（出现在 STCharacters 简→繁表左侧）的字也不映射，比如「么」不能变「幺」。
const KEEP = new Set(['乾', '著', '沈']);
for (const [simp] of parse(STCharacters)) KEEP.add(simp);
const map = new Map();
for (const [trad, simp] of ts) {
  if (KEEP.has(trad)) continue;
  if (isBmpHan(trad) && isBmpHan(simp) && trad !== simp) map.set(trad, simp);
}
for (const [variant, std] of variantToStd) {
  if (!isBmpHan(variant) || KEEP.has(variant)) continue;
  const simp = ts.get(std) || std;
  if (isBmpHan(simp) && simp !== variant && !map.has(variant)) map.set(variant, simp);
}

const keys = [...map.keys()].sort();
const from = keys.join('');
const to = keys.map((k) => map.get(k)).join('');

const out = `'use strict';
// 繁体输入归一（i18n spec T1.3）。由 scripts/generate_t2s_map.mjs 生成，勿手改。
// 繁→简字符级映射，共 ${keys.length} 字。只用于规则路由、出生地搜索等「匹配用的副本」，
// 用户原文照旧保存、显示、交给 LLM。

const FROM = '${from}';
const TO = '${to}';

let table = null;
function getTable() {
  if (table) return table;
  table = new Map();
  for (let i = 0; i < FROM.length; i += 1) table.set(FROM[i], TO[i]);
  return table;
}

const HAN = /[\\u3400-\\u9fff\\uf900-\\ufaff]/;

function toSimplified(text) {
  if (typeof text !== 'string' || !text || !HAN.test(text)) return text;
  const t = getTable();
  let out = '';
  for (const ch of text) out += t.get(ch) || ch;
  return out;
}

module.exports = { toSimplified };
`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  // Worker 与 node 测试用（CommonJS）
  ['lib/i18n/t2s.js', out],
  // 浏览器端出生地搜索用（ESM）。src/ 与 public/ 两份 birthplaceSearch.mjs 内容相同，各自 import 同目录的这份。
  ['src/utils/t2s.mjs', toEsm(out)],
  ['public/utils/t2s.mjs', toEsm(out)],
];
for (const [rel, content] of targets) {
  writeFileSync(path.join(root, rel), content);
  console.log(`写入 ${rel}：${keys.length} 字，${Buffer.byteLength(content)} 字节`);
}

function toEsm(cjs) {
  return cjs
    .replace("'use strict';\n", '')
    .replace('function toSimplified(', 'export function toSimplified(')
    .replace('\nmodule.exports = { toSimplified };\n', '\n');
}
