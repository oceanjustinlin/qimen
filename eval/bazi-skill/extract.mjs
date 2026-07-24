/**
 * eval/bazi-skill/extract.mjs — 从解读 prose 抽取结构化断言。
 * 优先读机器可读块 <CLAIMS>{...}</CLAIMS>（解读器按要求在末尾附）；
 * 缺失时退回 prose 正则兜底（身强弱 / X格 / 用神X）。
 * 纯函数，无 IO。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { normalizeShen } = await import(resolve(__dirname, '..', 'baziprofile-accuracy', 'scorer.mjs'));

const SHISHEN_FULL = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const SHISHEN_SHORT = ['比', '劫', '食', '伤', '才', '财', '杀', '官', '枭', '印'];
const STRENGTH_WORDS = ['从强', '从弱', '从财', '从官', '从杀', '从儿', '专旺', '化气', '身强', '身弱', '偏强', '偏弱', '太强', '太弱', '身旺', '中和', '均衡'];

function toShenList(raw) {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return [...new Set(arr.map((x) => normalizeShen(String(x).trim())).filter(Boolean))];
}

// 从一段文本里挖十神（用于 prose 兜底）
function findShishenIn(text) {
  const hits = [];
  for (const s of SHISHEN_FULL) if (text.includes(s)) hits.push(s);
  if (!hits.length) for (const s of SHISHEN_SHORT) if (text.includes(s)) hits.push(normalizeShen(s));
  return [...new Set(hits)];
}

export function extractClaims(reading = '') {
  const text = String(reading);
  const claims = { geju: null, strength: null, yong: [], source: 'prose' };

  // 1) 机器可读块优先
  const block = text.match(/<CLAIMS>\s*([\s\S]*?)\s*<\/CLAIMS>/i);
  if (block) {
    try {
      const j = JSON.parse(block[1]);
      claims.geju = j.geju || null;
      claims.strength = j.strength || null;
      claims.yong = toShenList(j.yong);
      claims.source = 'block';
      return claims;
    } catch (_) { /* 落到 prose 兜底 */ }
  }

  // 2) prose 兜底
  // 身强弱：取最后一次明确表述（结论常在后）
  for (const w of STRENGTH_WORDS) {
    if (text.includes(w)) { claims.strength = w; break; }
  }
  // 格局：「…格」，排除「格局」二字本身
  const geMatches = [...text.matchAll(/([一-龥]{1,3})格(?!局)/g)].map((m) => `${m[1]}格`);
  if (geMatches.length) claims.geju = geMatches[0];
  // 用神：「用神…」后就近的十神
  const yongCtx = text.match(/用神[为是:：]?\s*([^。；\n]{0,12})/);
  if (yongCtx) claims.yong = findShishenIn(yongCtx[1]);
  return claims;
}

export { toShenList };
