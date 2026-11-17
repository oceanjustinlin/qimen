#!/usr/bin/env node
'use strict';
/**
 * 合盘引擎分布校准（spec §10、T1.6、T1.7）。
 *
 * 用固定种子生成随机配对（1950–2010 年出生，两成时辰不详），跑完整引擎，
 * 由分布确定归一化分母与朋友合盘八档的分数线：
 *   - 写 lib/synastry/norms.json（引擎读取）
 *   - 写 eval/synastry/distribution.json（分布摘要，改权重后重跑以对比漂移）
 *
 * 用法：node scripts/synastry_calibrate.cjs [--pairs 10000] [--seed 20261117] [--check]
 *   --check 只用现有 norms.json 评估分布，不改写任何文件。
 */

const fs = require('fs');
const path = require('path');
const { normalizePerson, toView } = require('../lib/synastry/input');
const { buildSynastryReport } = require('../lib/synastry');
const { scoreFourQuestions, classifyStructure } = require('../lib/synastry/score');
const { rawSources, projectFromSources, SOURCES, CENTERED } = require('../lib/synastry/friendDims');
const W = require('../lib/synastry/weights');

const ROOT = path.join(__dirname, '..');
const NORMS_PATH = path.join(ROOT, 'lib/synastry/norms.json');
const DIST_PATH = path.join(ROOT, 'eval/synastry/distribution.json');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const PAIRS = Number(arg('--pairs', 10000));
const SEED = Number(arg('--seed', 20261117));
const CHECK = process.argv.includes('--check');
const CURRENT_YEAR = 2026;

function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const START = Date.UTC(1950, 0, 1);
const END = Date.UTC(2010, 11, 31);
function randomProfile() {
  const t = new Date(START + Math.floor(rand() * ((END - START) / 86400000 + 1)) * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    birth_date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    hour_index: rand() < 0.2 ? -1 : Math.floor(rand() * 12),
    gender: rand() < 0.5 ? 'M' : 'F',
  };
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const sortNum = (xs) => [...xs].sort((a, b) => a - b);
const r3 = (x) => Math.round(x * 1000) / 1000;
function summary(xs) {
  const s = sortNum(xs);
  return { p05: r3(quantile(s, 0.05)), p25: r3(quantile(s, 0.25)), p50: r3(quantile(s, 0.5)), p75: r3(quantile(s, 0.75)), p95: r3(quantile(s, 0.95)), mean: r3(xs.reduce((a, b) => a + b, 0) / (xs.length || 1)) };
}
function shares(labels) {
  const out = {};
  for (const l of labels) out[l] = (out[l] || 0) + 1;
  for (const k of Object.keys(out)) out[k] = r3(out[k] / labels.length);
  return out;
}

function main() {
  const t0 = Date.now();
  const types = ['friend', 'romance'];
  const rows = { friend: [], romance: [] };
  for (let i = 0; i < PAIRS; i += 1) {
    const pA = normalizePerson(randomProfile(), { currentYear: CURRENT_YEAR });
    const pB = normalizePerson(randomProfile(), { currentYear: CURRENT_YEAR });
    const vA = toView(pA), vB = toView(pB);
    for (const rt of types) {
      const rep = buildSynastryReport({ A: pA, B: pB, relationType: rt, norms: {} });
      const row = {
        evidence: rep.evidence,
        baselines: { A: { stability: rep.baseline.A }, B: { stability: rep.baseline.B } },
        raw: rep.raw,
      };
      if (rt === 'friend') row.src = rawSources(rep.evidence, { A: vA, B: vB });
      rows[rt].push(row);
    }
    if ((i + 1) % 1000 === 0) process.stderr.write(`  ${i + 1}/${PAIRS} pairs, ${Math.round((Date.now() - t0) / 1000)}s\n`);
  }

  let norms;
  if (CHECK) {
    norms = JSON.parse(fs.readFileSync(NORMS_PATH, 'utf8'));
  } else {
    norms = { engineVersion: W.engineVersion, seed: SEED, pairs: PAIRS };
    for (const rt of types) {
      const tie = sortNum(rows[rt].map((r) => r.raw.tie));
      const strain = sortNum(rows[rt].map((r) => r.raw.strain));
      const babs = sortNum(rows[rt].flatMap((r) => [Math.abs(r.raw.benefitA), Math.abs(r.raw.benefitB)]));
      norms[rt] = {
        tie: { p50: r3(quantile(tie, 0.5)), p95: r3(quantile(tie, 0.95)) },
        strain: { p50: r3(quantile(strain, 0.5)), p95: r3(quantile(strain, 0.95)) },
        benefitAbs: { p50: r3(quantile(babs, 0.5)), p95: r3(quantile(babs, 0.95)) },
      };
    }
    // 朋友五维度：各来源的中位数与 P95
    const dims = {};
    for (const k of SOURCES) {
      const xs = rows.friend.map((r) => r.src[k]);
      const center = CENTERED.has(k) ? quantile(sortNum(xs), 0.5) : 0;
      const dev = sortNum(xs.map((x) => Math.abs(x - center)));
      dims[k] = { center: r3(center), p95: r3(Math.max(quantile(dev, 0.95), 1e-6)) };
    }
    norms.friend.dims = dims;
    const weighted = rows.friend.map((r) => projectFromSources(r.src, { friend: { dims } }).weighted);
    const totalP95 = quantile(sortNum(weighted.map(Math.abs)), 0.95);
    norms.friend.total = { p95: r3(totalP95) };
    const totals = sortNum(rows.friend.map((r) => projectFromSources(r.src, { friend: { dims, total: { p95: totalP95 } } }).total));
    let cum = 0;
    const cuts = [];
    for (const share of W.friend.tierShares.slice(0, -1)) {
      cum += share;
      cuts.push(Math.round(quantile(totals, 1 - cum)));
    }
    norms.friend.tierCuts = cuts;
  }

  // 用定好的 norms 评估分布
  const dist = { engineVersion: W.engineVersion, seed: SEED, pairs: PAIRS, generatedBy: 'scripts/synastry_calibrate.cjs' };
  for (const rt of types) {
    const fqs = rows[rt].map((r) => scoreFourQuestions(r.evidence, r.baselines, rt, norms));
    dist[rt] = {
      raw: {
        tie: summary(rows[rt].map((r) => r.raw.tie)),
        strain: summary(rows[rt].map((r) => r.raw.strain)),
        benefit: summary(rows[rt].flatMap((r) => [r.raw.benefitA, r.raw.benefitB])),
      },
      tie: summary(fqs.map((f) => f.tie.score)),
      ease: summary(fqs.map((f) => f.ease.score)),
      benefit: summary(fqs.flatMap((f) => [f.benefit.A, f.benefit.B])),
      lasting: summary(fqs.map((f) => f.lasting.score)),
      tieGrade: shares(fqs.map((f) => f.tie.grade)),
      easeGrade: shares(fqs.map((f) => f.ease.grade)),
      benefitGrade: shares(fqs.map((f) => f.benefit.grade)),
      lastingGrade: shares(fqs.map((f) => f.lasting.grade)),
      structure: shares(fqs.map((f) => classifyStructure(f))),
    };
  }
  const friendDims = rows.friend.map((r) => projectFromSources(r.src, norms));
  dist.friend.dims = {};
  for (const d of ['d1', 'd2', 'd3', 'd4', 'd5', 'total']) dist.friend.dims[d] = summary(friendDims.map((f) => f[d]));
  dist.friend.tier = shares(friendDims.map((f) => f.tier));
  dist.friend.tierTarget = Object.fromEntries(W.friend.tierLabels.map((l, i) => [l, W.friend.tierShares[i]]));
  dist.elapsedSec = Math.round((Date.now() - t0) / 1000);

  if (!CHECK) {
    fs.writeFileSync(NORMS_PATH, `${JSON.stringify(norms, null, 2)}\n`);
    fs.mkdirSync(path.dirname(DIST_PATH), { recursive: true });
    fs.writeFileSync(DIST_PATH, `${JSON.stringify(dist, null, 2)}\n`);
  }
  console.log(JSON.stringify({ norms, structure: { friend: dist.friend.structure, romance: dist.romance.structure }, tier: dist.friend.tier, tieMedian: { friend: dist.friend.tie.p50, romance: dist.romance.tie.p50 } }, null, 2));
}

main();
