'use strict';
/**
 * 证据条目（spec §4.1）。所有层的产出都是这一种结构。
 */

const LAYERS = ['baseline', 'complement', 'bond', 'role', 'timing', 'aux'];
const DIRS = ['A<-B', 'B<-A', 'mutual'];
const BASES = ['book', 'derived', 'tradition_unverified', 'folk'];
const CONFIDENCES = ['high', 'mid', 'low'];

function fail(msg) {
  throw new Error(`[synastry] invalid evidence: ${msg}`);
}

function inRange(v, lo, hi) {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * 校验并补齐一条证据。非法时抛错。
 * folk 条目的 tie、strain、benefit 强制为 0。
 */
function makeEvidence(fields) {
  const f = fields || {};
  const ev = {
    id: f.id,
    layer: f.layer,
    kind: f.kind,
    dir: f.dir == null ? 'mutual' : f.dir,
    locus: f.locus || {},
    chars: f.chars || {},
    tie: f.tie == null ? 0 : f.tie,
    strain: f.strain == null ? 0 : f.strain,
    benefit: { A: (f.benefit && f.benefit.A) || 0, B: (f.benefit && f.benefit.B) || 0 },
    basis: f.basis || 'derived',
    confidence: f.confidence || 'high',
    needsHour: Boolean(f.needsHour),
    seed: f.seed || '',
  };
  if (typeof ev.id !== 'string' || !ev.id) fail('id required');
  if (!LAYERS.includes(ev.layer)) fail(`layer ${ev.layer}`);
  if (typeof ev.kind !== 'string' || !ev.kind) fail('kind required');
  if (!DIRS.includes(ev.dir)) fail(`dir ${ev.dir}`);
  if (!inRange(ev.tie, 0, 3)) fail(`tie ${ev.tie}`);
  if (!inRange(ev.strain, 0, 3)) fail(`strain ${ev.strain}`);
  if (!inRange(ev.benefit.A, -3, 3)) fail(`benefit.A ${ev.benefit.A}`);
  if (!inRange(ev.benefit.B, -3, 3)) fail(`benefit.B ${ev.benefit.B}`);
  if (!BASES.includes(ev.basis)) fail(`basis ${ev.basis}`);
  if (!CONFIDENCES.includes(ev.confidence)) fail(`confidence ${ev.confidence}`);
  if (typeof ev.seed !== 'string') fail('seed must be string');
  if (ev.basis === 'folk') {
    ev.tie = 0;
    ev.strain = 0;
    ev.benefit = { A: 0, B: 0 };
  }
  ev.tie = round2(ev.tie);
  ev.strain = round2(ev.strain);
  ev.benefit = { A: round2(ev.benefit.A) || 0, B: round2(ev.benefit.B) || 0 };
  return ev;
}

const clamp3 = (x) => Math.max(-3, Math.min(3, x));

/** 交换 A 与 B 后的同一条证据，用于对称性处理 */
function swapEvidence(ev) {
  const dir = ev.dir === 'A<-B' ? 'B<-A' : ev.dir === 'B<-A' ? 'A<-B' : 'mutual';
  return {
    ...ev,
    dir,
    locus: { a: ev.locus.b, b: ev.locus.a },
    chars: { a: ev.chars.b, b: ev.chars.a },
    benefit: { A: ev.benefit.B, B: ev.benefit.A },
  };
}

/** 置信度取较低者 */
function minConfidence(...xs) {
  const order = { high: 2, mid: 1, low: 0 };
  return xs.filter(Boolean).reduce((m, c) => (order[c] < order[m] ? c : m), 'high');
}

module.exports = { makeEvidence, swapEvidence, minConfidence, clamp3, LAYERS, DIRS, BASES };
