/**
 * eval/bazi-skill/faithfulness.mjs — D3a 忠实度：解读断言 vs CLI static。
 * 只判「矛盾」（不是准确度）：解读说的是否与确定性盘直接冲突。
 *   - strength_flip（硬）：身强↔身弱 翻转。
 *   - yong_is_ji（硬）：解读的用神 ∈ static 忌神/不喜（把忌神当用神，最严重）。
 *   - geju_mismatch（软/警告）：格局名不一致（别名多，仅提示，不进硬门禁）。
 * 纯函数。硬矛盾任一出现即该例 fail。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { normalizeShen } = await import(resolve(__dirname, '..', 'baziprofile-accuracy', 'scorer.mjs'));

const STRONG = ['身强', '偏强', '太强', '身旺', '旺'];
const WEAK = ['身弱', '偏弱', '太弱'];
const FOLLOW = ['从强', '从弱', '从财', '从官', '从杀', '从儿', '专旺', '化气', '从格']; // 特殊格，不做硬翻转
const NEUTRAL = ['中和', '均衡'];

function strengthFamily(s) {
  const v = String(s || '');
  if (!v) return 'unknown';
  if (FOLLOW.some((w) => v.includes(w))) return 'follow';
  if (STRONG.some((w) => v.includes(w))) return 'strong';
  if (WEAK.some((w) => v.includes(w))) return 'weak';
  if (NEUTRAL.some((w) => v.includes(w))) return 'neutral';
  return 'unknown';
}

function stripGe(name) {
  return String(name || '').replace(/格$/, '').trim();
}
// 常见别名归一（软判用）
const GEJU_ALIAS = {
  月刃: '羊刃', 阳刃: '羊刃', 建禄: '建禄', 禄格: '建禄',
};
function normalizeGeju(name) {
  const core = stripGe(name);
  return GEJU_ALIAS[core] || core;
}

function jiSet(staticBlock) {
  const fs = staticBlock?.five_shens || {};
  const raw = [
    ...(Array.isArray(fs.ji) ? fs.ji : [fs.ji]),
    ...(Array.isArray(fs.unfavorable) ? fs.unfavorable : [fs.unfavorable]),
    ...(Array.isArray(staticBlock?.unfavorable_gods) ? staticBlock.unfavorable_gods : [staticBlock?.unfavorable_gods]),
  ].filter(Boolean);
  return new Set(raw.map((x) => normalizeShen(String(x))));
}

/**
 * @param {object} claims  extractClaims 输出 {geju, strength, yong[]}
 * @param {object} staticBlock  bazi_cli 输出的 output.static
 * @returns {{contradictions:Array, notes:Array, hard:number}}
 */
export function checkFaithfulness(claims, staticBlock) {
  const contradictions = [];
  const notes = [];

  // 1) 身强弱翻转
  const cf = strengthFamily(claims.strength);
  const sf = strengthFamily(staticBlock?.strong_weak);
  if ((cf === 'strong' && sf === 'weak') || (cf === 'weak' && sf === 'strong')) {
    contradictions.push({
      type: 'strength_flip', severity: 'hard',
      detail: `解读称「${claims.strength}」，static 为「${staticBlock?.strong_weak}」`,
    });
  } else if (cf !== 'unknown' && sf !== 'unknown' && cf !== sf) {
    notes.push(`strength 口径差异（非硬翻转）：解读 ${cf} vs static ${sf}`);
  }

  // 2) 用神 = 忌神（最严重）
  const ji = jiSet(staticBlock);
  for (const y of claims.yong || []) {
    const yn = normalizeShen(String(y));
    if (ji.has(yn)) {
      contradictions.push({
        type: 'yong_is_ji', severity: 'hard',
        detail: `解读把「${yn}」当用神，但 static 忌神含「${yn}」`,
      });
    }
  }

  // 3) 格局不一致（软）
  if (claims.geju && staticBlock?.geju) {
    const cg = normalizeGeju(claims.geju);
    const sg = normalizeGeju(staticBlock.geju);
    if (cg && sg && cg !== sg && !sg.includes(cg) && !cg.includes(sg)) {
      contradictions.push({
        type: 'geju_mismatch', severity: 'soft',
        detail: `解读格局「${claims.geju}」≠ static「${staticBlock.geju}」`,
      });
    }
  }

  const hard = contradictions.filter((c) => c.severity === 'hard').length;
  return { contradictions, notes, hard };
}
