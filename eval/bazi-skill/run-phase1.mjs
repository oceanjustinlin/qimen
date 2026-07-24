/**
 * eval/bazi-skill/run-phase1.mjs — D3a 忠实度。
 *
 *   node eval/bazi-skill/run-phase1.mjs --selftest      # 确定性自证检测器（无需 API，立即可跑）
 *   GEMINI_API_KEY=xxx node eval/bazi-skill/run-phase1.mjs [--n 20]   # 跑 gold 子集真解读
 *
 * 门禁：硬矛盾率 = 0（strength_flip / yong_is_ji 任一出现即 fail）。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Solar } from 'lunar-javascript';
import { extractClaims } from './extract.mjs';
import { checkFaithfulness } from './faithfulness.mjs';
import { buildReading } from './reader.mjs';
import { LLM_AVAILABLE, EVAL_MODEL } from './llm.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const RESULTS_DIR = resolve(__dirname, 'results');
const { buildProfile, buildChart, buildStatic } = require(resolve(ROOT, 'scripts', 'bazi_cli.cjs'));

// ── 确定性自证 ───────────────────────────────────────────────────────────────
function selftest() {
  const { CASES } = require('./phase1-fixtures.js');
  let fail = 0;
  console.log('══════════ Phase 1 忠实度检测器 · 自证 ══════════');
  for (const c of CASES) {
    const claims = extractClaims(c.reading);
    const res = checkFaithfulness(claims, c.static);
    const gotTypes = res.contradictions.map((x) => x.type).sort();
    const wantTypes = [...c.expect.types].sort();
    const okHard = res.hard === c.expect.hard;
    const okTypes = JSON.stringify(gotTypes) === JSON.stringify(wantTypes);
    const ok = okHard && okTypes;
    if (!ok) fail += 1;
    console.log(`  ${ok ? '✅' : '❌'} ${c.id}  hard=${res.hard}(期望${c.expect.hard}) types=[${gotTypes}]${ok ? '' : ` 期望[${wantTypes}] claims=${JSON.stringify(claims)}`}`);
  }
  console.log(fail ? `\n❌ 自证失败 ${fail}/${CASES.length}` : `\n✅ 自证全通过 ${CASES.length}/${CASES.length}`);
  return fail === 0;
}

// ── gold 四柱 → 反查公历 ─────────────────────────────────────────────────────
const ZHI_HOURS = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 };
// 与 baseline eval 同口径（历史命例需宽区间）
function findSolar(pillars, startYear = 1500, span = 800) {
  const [yP, mP, dP, tP] = pillars;
  const targetHour = ZHI_HOURS[tP.charAt(1)] ?? 12;
  for (let year = startYear; year <= startYear + span; year += 1) {
    if (Solar.fromYmd(year, 7, 1).getLunar().getYearInGanZhi() !== yP) continue;
    let cur = Solar.fromYmd(year - 1, 11, 1);
    const end = Solar.fromYmd(year + 1, 3, 1);
    while (cur.toYmd() <= end.toYmd()) {
      const t = Solar.fromYmdHms(cur.getYear(), cur.getMonth(), cur.getDay(), targetHour, 30, 0);
      const ec = t.getLunar().getEightChar();
      if (ec.getYear() === yP && ec.getMonth() === mP && ec.getDay() === dP && ec.getTime() === tP) {
        return { calendar: 'solar', year: cur.getYear(), month: cur.getMonth(), day: cur.getDay(), hour: targetHour, minute: 30, gender: null };
      }
      cur = cur.next(1);
    }
  }
  return null;
}

async function runLLM(limit) {
  const { CASES } = require(resolve(ROOT, 'eval', 'baziprofile-accuracy', 'gold-cases.js'));
  const cases = CASES.slice(0, limit);
  const rows = [];
  let hardTotal = 0; let softTotal = 0; let skipped = 0;

  for (const cd of cases) {
    const birth = findSolar(cd.input.pillars, cd.input.searchFromYear || 1500, cd.input.searchSpan || 800);
    if (!birth) { skipped += 1; continue; }
    birth.gender = cd.input.gender === 'female' ? '女' : '男';
    const { detail, baziStr } = buildProfile(birth, 2026);
    const chart = buildChart(detail, baziStr);
    const staticBlock = buildStatic(detail);

    let reading;
    try { reading = await buildReading({ chart, static: staticBlock }); }
    catch (e) { skipped += 1; console.warn(`  [skip] ${cd.id}: ${e.message}`); continue; }

    const claims = extractClaims(reading);
    const ff = checkFaithfulness(claims, staticBlock);
    hardTotal += ff.hard;
    softTotal += ff.contradictions.filter((c) => c.severity === 'soft').length;
    const row = { id: cd.id, bazi: baziStr, claims, hard: ff.hard, contradictions: ff.contradictions };
    rows.push(row);
    if (ff.hard) console.log(`  ❌ ${cd.id} [${baziStr}] hard=${ff.hard}: ${ff.contradictions.filter((c) => c.severity === 'hard').map((c) => c.detail).join('；')}`);
  }

  const n = rows.length;
  const hardCaseRate = n ? rows.filter((r) => r.hard > 0).length / n : 0;
  console.log(`\n【D3a 忠实度】 n=${n}(跳过${skipped})  硬矛盾例数=${rows.filter((r) => r.hard > 0).length}  硬矛盾例率=${(hardCaseRate * 100).toFixed(1)}%  软提示=${softTotal}`);
  const pass = hardTotal === 0;
  console.log(`\n── 门禁 ── ${pass ? '✅' : '❌'} 硬矛盾率 = 0（实际硬矛盾 ${hardTotal} 处）`);

  mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = resolve(RESULTS_DIR, `phase1-${EVAL_MODEL}.json`);
  writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), model: EVAL_MODEL, n, skipped, hardTotal, softTotal, hardCaseRate, gate_pass: pass, rows }, null, 2));
  console.log(`→ 写入 ${outPath}`);
  return pass;
}

async function main() {
  if (process.argv.includes('--selftest')) {
    process.exit(selftest() ? 0 : 1);
  }
  // 默认：先跑自证（护栏），再按 key 决定是否跑真解读
  const stOk = selftest();
  if (!stOk) { console.error('\n自证未过，先修检测器再跑 LLM。'); process.exit(1); }
  if (!LLM_AVAILABLE) {
    console.log('\n[提示] 未设置 GEMINI_API_KEY：仅完成检测器自证。配置后可跑 gold 子集真解读。');
    process.exit(0);
  }
  const nArg = process.argv.indexOf('--n');
  const limit = nArg > -1 ? Number(process.argv[nArg + 1]) : 20;
  const pass = await runLLM(limit);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
