/**
 * eval/bazi-skill/run.mjs — Phase 0 harness：D1 触发 + D2 路由预判。
 *
 * 用法：
 *   node eval/bazi-skill/run.mjs                 # baseline arm（确定性，立即可跑）
 *   GEMINI_API_KEY=xxx node eval/bazi-skill/run.mjs --arm llm     # LLM arm
 *   GEMINI_API_KEY=xxx node eval/bazi-skill/run.mjs --arm both    # 两个 arm 对照
 *
 * 产物：控制台报表 + results/phase0-<arm>.json；末尾打印门禁 PASS/FAIL。
 * 门禁只对 llm arm 生效（skill 的真实决策层）；baseline 仅作对照基线。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  baselineTrigger, baselineRoute, llmTrigger, llmRoute, LLM_AVAILABLE,
} from './classifiers.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { CASES: TRIGGER_CASES } = require('./triggering-cases.js');
const { CASES: ROUTE_CASES } = require('./route-cases.js');
const RESULTS_DIR = resolve(__dirname, 'results');

const GATES = {
  trigger_f1: 0.9,
  hard_negative_false_trigger: 0,
  route_mode_acc: 0.85,
  timing_scope_acc: 0.8,
};

// ── D1 触发评分 ──────────────────────────────────────────────────────────────
async function scoreTrigger(classify) {
  const strict = TRIGGER_CASES.filter((c) => !c.ambiguous);
  let tp = 0; let fp = 0; let fn = 0; let tn = 0;
  const hardNeg = []; // 紫微/奇门被误触发
  const misses = [];
  for (const c of strict) {
    const pred = await classify(c.prompt);
    if (c.should_trigger && pred) tp += 1;
    else if (!c.should_trigger && pred) {
      fp += 1;
      if (c.kind === 'ziwei' || c.kind === 'qimen') hardNeg.push(c.id);
      misses.push({ id: c.id, kind: c.kind, expected: false, pred: true });
    } else if (c.should_trigger && !pred) { fn += 1; misses.push({ id: c.id, kind: c.kind, expected: true, pred: false }); } else tn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  const ambiguous = [];
  for (const c of TRIGGER_CASES.filter((x) => x.ambiguous)) {
    ambiguous.push({ id: c.id, prompt: c.prompt, label: c.should_trigger, pred: await classify(c.prompt) });
  }
  return {
    n: strict.length, tp, fp, fn, tn, precision, recall, f1,
    hard_negative_false_trigger: hardNeg.length, hard_negative_ids: hardNeg, misses, ambiguous,
  };
}

// ── D2 路由评分 ──────────────────────────────────────────────────────────────
async function scoreRoute(classify) {
  let modeHit = 0;
  let scopeTotal = 0; let scopeHit = 0;
  const confusion = {}; // `${exp}->${pred}` : count
  const misses = [];
  for (const c of ROUTE_CASES) {
    const pred = await classify(c.question);
    const expMode = c.expected.analysis_mode;
    if (pred.analysis_mode === expMode) modeHit += 1;
    else {
      const key = `${expMode}->${pred.analysis_mode}`;
      confusion[key] = (confusion[key] || 0) + 1;
      misses.push({ id: c.id, q: c.question, expected: expMode, pred: pred.analysis_mode });
    }
    // time_scope 仅在期望值非 null 时计入
    if (c.expected.time_scope_type != null) {
      scopeTotal += 1;
      if (pred.time_scope_type === c.expected.time_scope_type) scopeHit += 1;
    }
  }
  // timing 专项 scope 准确率
  const timingCases = ROUTE_CASES.filter((c) => c.expected.analysis_mode === 'timing' && c.expected.time_scope_type != null);
  let tScopeHit = 0;
  for (const c of timingCases) {
    const pred = await classify(c.question);
    if (pred.time_scope_type === c.expected.time_scope_type) tScopeHit += 1;
  }
  return {
    n: ROUTE_CASES.length,
    mode_acc: modeHit / ROUTE_CASES.length,
    scope_acc: scopeTotal ? scopeHit / scopeTotal : null,
    timing_scope_acc: timingCases.length ? tScopeHit / timingCases.length : null,
    confusion, misses,
  };
}

function pct(x) { return x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`; }

function report(arm, trig, route) {
  console.log(`\n══════════ arm = ${arm} ══════════`);
  console.log('【D1 触发】 n=%d  P=%s  R=%s  F1=%s', trig.n, pct(trig.precision), pct(trig.recall), pct(trig.f1));
  console.log('  硬负例误触发(紫微/奇门): %d  %s', trig.hard_negative_false_trigger, trig.hard_negative_ids.join(',') || '—');
  if (trig.misses.length) console.log('  误判:', trig.misses.map((m) => `${m.id}(${m.kind}:${m.expected}->${m.pred})`).join('  '));
  console.log('  模糊例:', trig.ambiguous.map((a) => `${a.id}:label=${a.label},pred=${a.pred}`).join('  '));

  console.log('【D2 路由】 n=%d  mode准确率=%s  scope准确率=%s  timing-scope=%s',
    route.n, pct(route.mode_acc), pct(route.scope_acc), pct(route.timing_scope_acc));
  if (Object.keys(route.confusion).length) console.log('  mode 混淆:', JSON.stringify(route.confusion));
  if (route.misses.length) console.log('  mode 误判:', route.misses.map((m) => `${m.id}(${m.expected}->${m.pred})`).join('  '));
}

function checkGates(arm, trig, route) {
  const results = [
    ['trigger_f1', trig.f1, GATES.trigger_f1, trig.f1 >= GATES.trigger_f1],
    ['hard_negative_false_trigger', trig.hard_negative_false_trigger, GATES.hard_negative_false_trigger, trig.hard_negative_false_trigger <= GATES.hard_negative_false_trigger],
    ['route_mode_acc', route.mode_acc, GATES.route_mode_acc, route.mode_acc >= GATES.route_mode_acc],
    ['timing_scope_acc', route.timing_scope_acc, GATES.timing_scope_acc, route.timing_scope_acc == null || route.timing_scope_acc >= GATES.timing_scope_acc],
  ];
  const isRef = arm === 'baseline';
  console.log(`\n── 门禁 (${arm}${isRef ? '，仅对照参考，不阻断' : ''}) ──`);
  let allPass = true;
  for (const [name, val, thr, pass] of results) {
    if (!pass) allPass = false;
    console.log(`  ${pass ? '✅' : '❌'} ${name} = ${typeof val === 'number' ? val.toFixed(3) : val} (阈值 ${thr})`);
  }
  return { allPass, results };
}

async function runArm(arm) {
  const triggerFn = arm === 'llm' ? llmTrigger : baselineTrigger;
  const routeFn = arm === 'llm' ? llmRoute : baselineRoute;
  const trig = await scoreTrigger(triggerFn);
  const route = await scoreRoute(routeFn);
  report(arm, trig, route);
  const gates = checkGates(arm, trig, route);

  mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = resolve(RESULTS_DIR, `phase0-${arm}.json`);
  writeFileSync(outPath, JSON.stringify({
    arm, at: new Date().toISOString(), model: arm === 'llm' ? (process.env.EVAL_MODEL || 'gemini-3-flash-preview') : null,
    gates, trigger: trig, route,
  }, null, 2));
  console.log(`\n→ 写入 ${outPath}`);
  return gates;
}

async function main() {
  const argArm = (process.argv.find((a) => a.startsWith('--arm=')) || '').split('=')[1]
    || (process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm') + 1] : '');
  let arms;
  if (argArm === 'both') arms = ['baseline', 'llm'];
  else if (argArm) arms = [argArm];
  else arms = LLM_AVAILABLE ? ['baseline', 'llm'] : ['baseline'];

  if (arms.includes('llm') && !LLM_AVAILABLE) {
    console.error('[跳过 llm arm] 未设置 GEMINI_API_KEY');
    arms = arms.filter((a) => a !== 'llm');
    if (!arms.length) arms = ['baseline'];
  }

  const gateByArm = {};
  for (const arm of arms) gateByArm[arm] = await runArm(arm);

  // 退出码：只有 llm arm 未过门禁才非 0（baseline 仅参考）
  if (gateByArm.llm && !gateByArm.llm.allPass) {
    console.log('\n❌ llm arm 未通过门禁');
    process.exit(1);
  }
  console.log('\n✅ 完成');
}

main().catch((e) => { console.error(e); process.exit(2); });
