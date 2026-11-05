// detail: "summary"（默认）时在 MCP 层精简已知的大块字段，避免超出客户端的 MCP 输出上限
// （Claude Code 默认 MAX_MCP_OUTPUT_TOKENS = 25000）。CLI 输出不受影响；detail: "full" 原样返回。

export const TRIM_WARNING = '已精简输出；如需完整数据请传 detail: "full"';
export const TIMING_KEEP = 5;

const clone = (v) => structuredClone(v);

// 同一份免责说明在 bazi 应期候选里重复上百次：只保留每种文字的第一次出现
function dedupeModelNotes(root) {
  const seen = new Set();
  let removed = 0;
  const visit = (v) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (!v || typeof v !== 'object') return;
    for (const k of Object.keys(v)) {
      if (k === 'model_note' && typeof v[k] === 'string') {
        if (seen.has(v[k])) { delete v[k]; removed += 1; continue; }
        seen.add(v[k]);
      }
      visit(v[k]);
    }
  };
  visit(root);
  return removed;
}

// 干支关系对象（六冲、半合、天干相克……）改成一行文字：note 已写明双方与关系，后缀补强度
const RELATION_KEYS = new Set(['relationships', 'zhi_relations', 'gan_relations']);
const relationLine = (r) => {
  if (!r || typeof r !== 'object' || typeof r.note !== 'string') return r;
  const tags = [r.strength_label, r.effective_strength].filter((x) => x !== undefined && x !== null && x !== '');
  return tags.length ? `${r.note}［${tags.join(' ')}］` : r.note;
};
// 通根记录 {pillar, zhi, gan, qi, is_kong} → “日辰藏气癸”
const rootLine = (r) => (r && typeof r === 'object' && 'pillar' in r && 'zhi' in r && 'gan' in r && 'qi' in r
  ? `${r.pillar}${r.zhi}${r.qi}${r.gan}${r.is_kong ? '（空亡）' : ''}`
  : r);

function compactBaziDetail(root) {
  let changed = false;
  const visit = (v) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (!v || typeof v !== 'object') return;
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (RELATION_KEYS.has(k) && Array.isArray(x) && x.some((r) => r && typeof r === 'object' && typeof r.note === 'string')) {
        v[k] = x.map(relationLine);
        changed = true;
      } else if (k === 'roots' && Array.isArray(x) && x.some((r) => rootLine(r) !== r)) {
        v[k] = x.map(rootLine);
        changed = true;
      } else visit(x);
    }
  };
  visit(root);
  return changed;
}

function summarizeBazi(env) {
  const q = env.judgments && env.judgments.question;
  let trimmed = false;
  if (q && Array.isArray(q.timing_candidates)) {
    const all = q.timing_candidates;
    if (all.length > TIMING_KEEP) {
      // 保留引擎排序的前 5 个完整候选；其余只留年份与评分，方便说明“还扫描过哪些年”
      q.timing_candidates = all.slice(0, TIMING_KEEP);
      q.timing_candidates_omitted = all.slice(TIMING_KEEP).map((c) => ({
        year: c.year,
        ganzhi: c.ganzhi,
        dayun_ganzhi: c.dayun_ganzhi,
        quality: c.quality,
        rank_score: c.rank_score,
        is_major_window: c.is_major_window,
        event_type: c.event_type,
      }));
      trimmed = true;
    }
    // 同一大运的 dayun_impact 在多个候选年里完全相同：重复的改为指向首次出现的年份
    const firstYear = new Map();
    for (const c of q.timing_candidates) {
      const d = c && c.dynamicReport && c.dynamicReport.dayun_impact;
      if (!d || typeof d !== 'object') continue;
      const key = JSON.stringify(d);
      if (firstYear.has(key)) {
        c.dynamicReport.dayun_impact = { same_as_candidate_year: firstYear.get(key) };
        trimmed = true;
      } else firstYear.set(key, c.year);
    }
  }
  // 只在问事模式压缩关系明细：排盘模式本身不大，保持原样
  if (q) {
    if (dedupeModelNotes(env.judgments) > 0) trimmed = true;
    if (compactBaziDetail(q)) trimmed = true;
    // 未入选的成象候选只留结论，打分维度明细省略
    const img = env.judgments.image_analysis;
    if (img && Array.isArray(img.alternatives) && img.alternatives.length) {
      img.alternatives = img.alternatives.map((a) => (a && typeof a === 'object'
        ? { category: a.category, subtype: a.subtype, match_score: a.match_score, match_label: a.match_label, status: a.status }
        : a));
      trimmed = true;
    }
  }
  return trimmed;
}

// ── ziwei ────────────────────────────────────────────────────────────────
function compactSanfang(v) {
  const out = {};
  for (const [k, list] of Object.entries(v || {})) {
    if (!Array.isArray(list) || !list.length) continue;
    out[k] = list.map((x) => (x && typeof x === 'object' ? `${x.mutagen ? `${x.star}化${x.mutagen}` : x.star}@${x.palace}` : x));
  }
  return out;
}

function compactFlying(v) {
  let s = `${v.mutagen}:${v.star}→${v.to_palace}`;
  if (v.self) s += '（自化）';
  if (v.clash_palace) s += `（冲${v.clash_palace}）`;
  return s;
}

// relation_set 与 brightness_state 在 chart.palaces（relations、各星 brightness）里已有，摘要不重复
const NATAL_SKIP = new Set(['relation_set', 'brightness_state']);

function natalSummary(nf) {
  const byPalace = {};
  const add = (palace, key, val, many = false) => {
    const p = (byPalace[palace] ??= {});
    if (many) (p[key] ??= []).push(val);
    else p[key] = val;
  };
  for (const f of nf.features || []) {
    if (!f || !f.palace) continue;
    byPalace[f.palace] ??= {};
    if (NATAL_SKIP.has(f.feature)) continue;
    const v = f.value || {};
    switch (f.feature) {
      case 'palace_star_system': add(f.palace, 'stars', v.empty ? [] : (v.stars || [])); break;
      case 'sanfang_aggregate': add(f.palace, 'sanfang', compactSanfang(v)); break;
      case 'jia_palace': if (Array.isArray(v.pairs) && v.pairs.length) add(f.palace, 'jia', v.pairs); break;
      case 'flying_mutagen': add(f.palace, 'flying', compactFlying(v), true); break;
      case 'empty_palace_borrow': add(f.palace, 'borrow', { from: v.borrowed_from, stars: v.stars }); break;
      default: add(f.palace, f.feature, f.value);
    }
  }
  return {
    note: '按宫位精简的命盘派生特征：stars=主星系，sanfang=三方四正会照（星@宫），flying=宫干飞化（化:星→宫），borrow=空宫借星，jia=夹宫。三方四正关系与亮度见 chart.palaces；各特征的方法审核状态见 methods。完整 feature 列表请传 detail: "full"',
    methods: nf.methods,
    schema_version: nf.schema_version,
    by_palace: byPalace,
  };
}

function periodSummary(features) {
  const out = {};
  for (const f of features || []) {
    if (!f) continue;
    const v = f.value || {};
    const scope = f.scope || 'period';
    let s;
    switch (f.feature) {
      // overlay_map 与 decadal/yearly.role_to_natal 重复
      case 'overlay_map': continue;
      case 'period_mutagen': s = `${scope}化${v.mutagen}:${v.star}@${v.natal_palace}（运限${v.period_role}）`; break;
      case 'mutagen_stack': s = `${v.star}@${v.natal_palace}：${(v.layers || []).map((l) => `${l.scope}化${l.mutagen}`).join('+')}${(v.repeated_mutagens || []).length ? `（重叠${v.repeated_mutagens.join('、')}）` : ''}`; break;
      default: s = `${f.palace ? `${f.palace} ` : ''}${JSON.stringify(v)}`;
    }
    (out[f.feature] ??= []).push(s);
  }
  return out;
}

function summarizeZiwei(env) {
  const chart = env.chart;
  if (!chart || typeof chart !== 'object') return false;
  let trimmed = false;
  if (chart.natal_features && typeof chart.natal_features === 'object') {
    chart.natal_features_summary = natalSummary(chart.natal_features);
    delete chart.natal_features;
    trimmed = true;
  }
  if (Array.isArray(chart.periods)) {
    for (const p of chart.periods) {
      if (p && Array.isArray(p.dynamic_features)) {
        p.dynamic_features_summary = periodSummary(p.dynamic_features);
        delete p.dynamic_features;
        trimmed = true;
      }
    }
  }
  return trimmed;
}

const SUMMARIZERS = { bazi: summarizeBazi, ziwei: summarizeZiwei };

// 只处理成功外层；失败外层与未知工具原样返回
export function summarizeEnvelope(name, env) {
  const fn = SUMMARIZERS[name];
  if (!fn || !env || env.ok !== true) return env;
  const out = clone(env);
  if (fn(out)) out.warnings = [...(Array.isArray(out.warnings) ? out.warnings : []), TRIM_WARNING];
  return out;
}
