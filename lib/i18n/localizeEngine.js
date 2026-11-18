'use strict';
// Worker 出口本地化（i18n spec T4.3）。只处理 paths 命中的引擎字符串；LLM 字段不碰。
// 查找顺序：离线词条 → 翻译记忆 → 实时翻译（一次批量，受 budgetMs 限制；超时保留原文，后台补完写回）。
// zh-CN 立即返回同一引用，不调用 tm / translate。

const glossary = require('./glossary.js');

const CJK_RE = /[㐀-鿿]/;
const SYMBOLISH_RE = /^[\s\d\p{P}\p{S}·•/|+\-–—]*$/u;

/** 路径语法：'a.b', 'list.*.text', '*'（数组下标通配）。返回 [{ path: [...keys], value }] */
function collectByPath(obj, pattern) {
  const parts = String(pattern).split('.');
  const out = [];
  (function walk(node, i, trail) {
    if (node === undefined || node === null) return;
    if (i === parts.length) {
      if (typeof node === 'string') out.push({ path: trail, value: node });
      else if (Array.isArray(node)) node.forEach((v, k) => typeof v === 'string' && out.push({ path: [...trail, k], value: v }));
      return;
    }
    const key = parts[i];
    if (key === '*') {
      if (Array.isArray(node)) node.forEach((v, k) => walk(v, i + 1, [...trail, k]));
      else if (typeof node === 'object') Object.keys(node).forEach((k) => walk(node[k], i + 1, [...trail, k]));
      return;
    }
    if (typeof node === 'object') walk(node[key], i + 1, [...trail, key]);
  })(obj, 0, []);
  return out;
}

/** 按路径写回：沿途浅拷贝，不改入参 */
function setByPath(root, path, value) {
  const copy = Array.isArray(root) ? root.slice() : { ...root };
  let cur = copy;
  let src = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const k = path[i];
    const next = src[k];
    const cloned = Array.isArray(next) ? next.slice() : { ...next };
    cur[k] = cloned;
    cur = cloned;
    src = next;
  }
  cur[path[path.length - 1]] = value;
  return copy;
}

/** 全部由术语表字符与标点数字组成：不走翻译，直接双语化 */
function isPureSymbol(text) {
  const value = String(text).trim();
  if (!value || !CJK_RE.test(value)) return false;
  if (glossary.lookup(value)) return true;
  return [...value].every((ch) => !CJK_RE.test(ch) ? SYMBOLISH_RE.test(ch) : !!glossary.lookup(ch));
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const subtle = (globalThis.crypto && globalThis.crypto.subtle) || require('node:crypto').webcrypto.subtle;
  const buf = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function catalogLookup(catalog, text) {
  const hit = catalog && catalog[text];
  if (!hit) return null;
  return typeof hit === 'string' ? hit : hit.en || null;
}

const withTimeout = (promise, ms) => new Promise((resolve) => {
  let done = false;
  const timer = setTimeout(() => { if (!done) { done = true; resolve({ timedOut: true }); } }, ms);
  promise.then(
    (value) => { if (!done) { done = true; clearTimeout(timer); resolve({ value }); } },
    (error) => { if (!done) { done = true; clearTimeout(timer); resolve({ error }); } },
  );
});

async function localizeEnginePayload(payload, {
  contentLocale = 'zh-CN',
  paths = [],
  catalog = {},
  tm = null,
  translate = null,
  budgetMs = 2500,
  waitUntil = null,
} = {}) {
  const stats = { catalogHits: 0, tmHits: 0, translated: 0, fallback: 0, symbols: 0 };
  if (contentLocale !== 'en-US' || !payload || typeof payload !== 'object') return { payload, stats };

  // 1. 收集命中路径上的含汉字字符串
  const slots = [];
  for (const pattern of paths) {
    for (const hit of collectByPath(payload, pattern)) {
      if (CJK_RE.test(hit.value)) slots.push(hit);
    }
  }
  if (!slots.length) return { payload, stats };

  const resolved = new Map(); // 原文 → 译文
  const pending = new Set();
  for (const { value } of slots) {
    if (resolved.has(value) || pending.has(value)) continue;
    if (isPureSymbol(value)) { resolved.set(value, glossary.formatBilingual(value)); stats.symbols += 1; continue; }
    const fromCatalog = catalogLookup(catalog, value);
    if (fromCatalog) { resolved.set(value, fromCatalog); stats.catalogHits += 1; continue; }
    pending.add(value);
  }

  // 2. 翻译记忆
  let hashes = new Map();
  if (pending.size && tm && typeof tm.getMany === 'function') {
    const list = [...pending];
    const hs = await Promise.all(list.map(sha256Hex));
    hashes = new Map(list.map((t, i) => [t, hs[i]]));
    try {
      const rows = (await tm.getMany(hs)) || {};
      for (const t of list) {
        const got = rows instanceof Map ? rows.get(hashes.get(t)) : rows[hashes.get(t)];
        if (got) { resolved.set(t, got); pending.delete(t); stats.tmHits += 1; }
      }
    } catch (_) { /* 记忆不可用：继续走实时翻译 */ }
  }

  // 3. 实时翻译：一次批量，受预算限制
  if (pending.size && typeof translate === 'function') {
    const list = [...pending];
    const job = Promise.resolve().then(() => translate(list));
    const writeBack = async (translatedList) => {
      if (!tm || typeof tm.putMany !== 'function' || !Array.isArray(translatedList)) return;
      const rows = [];
      for (let i = 0; i < list.length; i += 1) {
        const en = translatedList[i];
        if (typeof en !== 'string' || !en.trim()) continue;
        const hash = hashes.get(list[i]) || await sha256Hex(list[i]);
        rows.push({ source_hash: hash, locale: 'en-US', glossary_version: glossary.GLOSSARY_VERSION, source_text: list[i], translated_text: en });
      }
      if (rows.length) await tm.putMany(rows);
    };
    const outcome = await withTimeout(job, budgetMs);
    if (outcome.value && Array.isArray(outcome.value)) {
      list.forEach((t, i) => {
        const en = outcome.value[i];
        if (typeof en === 'string' && en.trim()) { resolved.set(t, en); pending.delete(t); stats.translated += 1; }
      });
      const wb = writeBack(outcome.value).catch(() => {});
      if (typeof waitUntil === 'function') waitUntil(wb);
    } else if (outcome.timedOut && typeof waitUntil === 'function') {
      waitUntil(job.then(writeBack).catch(() => {}));
    }
  }
  stats.fallback = slots.filter((s) => !resolved.has(s.value)).length;

  // 4. 写回新对象
  let out = payload;
  for (const { path, value } of slots) {
    if (resolved.has(value)) out = setByPath(out, path, resolved.get(value));
  }
  return { payload: out, stats };
}

module.exports = { localizeEnginePayload, collectByPath, setByPath, isPureSymbol, sha256Hex };
