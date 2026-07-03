import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';
import pkg from 'lunar-javascript';
import { scoreCase, summarizeRows } from '../eval/baziprofile-accuracy/scorer.mjs';

const { Solar } = pkg;
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { buildCompleteBaziDetail } = require(resolve(ROOT, 'lib/baziCore.js'));
const C = require(resolve(ROOT, 'lib/BaziConstants.js'));

const DEFAULT_FIXTURES = [
  'fixtures/classical-golden-cases/qiongtong-high-confidence.json',
  'fixtures/classical-golden-cases/ziping-high-confidence.json',
];

const FULL_TO_SHORT = {
  比肩: '比',
  劫财: '劫',
  食神: '食',
  伤官: '伤',
  正财: '财',
  偏财: '才',
  正官: '官',
  七杀: '杀',
  偏官: '杀',
  正印: '印',
  偏印: '枭',
  印绶: '印',
};

const ZHI_HOURS = {
  子: 0,
  丑: 2,
  寅: 4,
  卯: 6,
  辰: 8,
  巳: 10,
  午: 12,
  未: 14,
  申: 16,
  酉: 18,
  戌: 20,
  亥: 22,
};

function genderToMale(gender) {
  if (gender === 'female' || gender === '坤造' || gender === false) return false;
  return true;
}

function getStemByShen(dayGan, fullShen) {
  const short = FULL_TO_SHORT[fullShen];
  if (!short) return null;
  return Object.keys(C.SHISHEN[dayGan] || {}).find(stem => C.SHISHEN[dayGan][stem] === short) || null;
}

function getWuxingByFullShen(dayGan, fullShen) {
  const stem = getStemByShen(dayGan, fullShen);
  return stem ? C.GAN5[stem] : null;
}

function findSolar(pillars, startYear = 1500, span = 800) {
  const [yearPillar, monthPillar, dayPillar, timePillar] = pillars;
  const targetHour = ZHI_HOURS[timePillar.charAt(1)] ?? 12;
  for (let year = startYear; year <= startYear + span; year += 1) {
    const midYear = Solar.fromYmd(year, 7, 1);
    if (midYear.getLunar().getYearInGanZhi() !== yearPillar) continue;

    let current = Solar.fromYmd(year - 1, 11, 1);
    const end = Solar.fromYmd(year + 1, 3, 1);
    while (current.toYmd() <= end.toYmd()) {
      const probe = Solar.fromYmdHms(current.getYear(), current.getMonth(), current.getDay(), targetHour, 30, 0);
      const eightChar = probe.getLunar().getEightChar();
      if (
        eightChar.getYear() === yearPillar
        && eightChar.getMonth() === monthPillar
        && eightChar.getDay() === dayPillar
        && eightChar.getTime() === timePillar
      ) {
        return {
          year: current.getYear(),
          month: current.getMonth(),
          day: current.getDay(),
          hour: targetHour,
          minute: 30,
        };
      }
      current = current.next(1);
    }
  }
  return null;
}

function summarizeImage(detail = {}) {
  const image = detail.image_analysis || {};
  const candidate = image.override_candidate || image.primary_candidate || {};
  const patternFinal = detail.pattern_analysis?.final_pattern?.name
    || detail.pattern_analysis?.final_pattern?.subtype
    || detail.pattern_analysis?.final_pattern
    || '';
  return {
    image_category: candidate.category || image.category || '',
    image_subtype: candidate.subtype || image.subtype || '',
    image_match_score: candidate.match_score ?? image.match_score ?? null,
    pattern_final: typeof patternFinal === 'string' ? patternFinal : JSON.stringify(patternFinal),
  };
}

function extractActual(detail, baZi) {
  const fs = detail.five_shens || {};
  const favorableShens = detail.favorable_gods || fs.favorable || [];
  const unfavorableShens = detail.unfavorable_gods || fs.unfavorable || [];
  const dayGan = baZi.getDayGan();
  const yong = fs.yong || '';
  return {
    day_gan: dayGan,
    geju: detail.geju || '',
    chengge: detail.chengge_detail?.chengGe || '',
    strong_weak: detail.strong_weak || '',
    strength_band: detail.strength_detail?.band || '',
    yong,
    yong_wuxing: getWuxingByFullShen(dayGan, yong),
    yong_stem: getStemByShen(dayGan, yong),
    xi: fs.xi || [],
    ji: fs.ji || [],
    chou: fs.chou || [],
    xian: fs.xian || [],
    favorable_shens: favorableShens,
    unfavorable_shens: unfavorableShens,
    favorable_wuxing: detail.wuxing?.favorable || favorableShens.map(shen => getWuxingByFullShen(dayGan, shen)).filter(Boolean),
    unfavorable_wuxing: detail.wuxing?.unfavorable || unfavorableShens.map(shen => getWuxingByFullShen(dayGan, shen)).filter(Boolean),
    decision_chain: (detail.decision_chain || []).map(item => `${item.layer || ''}：${item.reason || item.text || item.conclusion || ''}`),
    favorable_verdict: detail.favorable_verdict || '',
    strength_basis: detail.strength_basis || '',
    tiaohou_primary: (detail.tiaohou_detail?.primary_gods || []).map(item => `${item.gan}${item.wuxing || ''}${item.shen ? `(${item.shen})` : ''}`),
    wuxing_ratio: detail.wuxing_ratio || {},
    scoring_details: detail.scoring_details || {},
    dimension_breakdown: detail.dimension_breakdown || {},
    ...summarizeImage(detail),
  };
}

function loadCases() {
  const fixtureFiles = process.env.CLASSICAL_FIXTURES
    ? process.env.CLASSICAL_FIXTURES.split(',').map(item => item.trim()).filter(Boolean)
    : DEFAULT_FIXTURES;

  return fixtureFiles.flatMap(file => {
    const fixture = require(resolve(ROOT, file));
    return (fixture.cases || []).map(item => ({
      ...item,
      fixture: fixture._meta?.source_title || file,
    }));
  });
}

function summarizeByFixture(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.fixture || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return Object.fromEntries([...grouped.entries()].map(([key, items]) => [key, summarizeRows(items)]));
}

function summarizeByScope(rows) {
  const scopes = ['geju', 'image', 'yong', 'xiji', 'method', 'strength'];
  return Object.fromEntries(scopes.map(scope => {
    const items = rows.filter(row => row.dimension_scores?.[scope]?.ratio != null);
    const avg = items.length
      ? items.reduce((sum, row) => sum + row.dimension_scores[scope].ratio, 0) / items.length
      : null;
    return [scope, { count: items.length, accuracy: avg }];
  }));
}

function coreScoreWithoutMethod(row) {
  const weights = { yong: 35, xiji: 25, strength: 15, geju: 15, image: 15 };
  let availableWeight = 0;
  let earned = 0;
  for (const [scope, weight] of Object.entries(weights)) {
    const dimension = row.dimension_scores?.[scope];
    if (!dimension || dimension.ratio == null) continue;
    availableWeight += weight;
    earned += dimension.ratio * weight;
  }
  return availableWeight > 0 ? Math.round((earned / availableWeight) * 100) : null;
}

function summarizeCore(rows) {
  const scored = rows
    .map(row => ({ ...row, core_score_without_method: coreScoreWithoutMethod(row) }))
    .filter(row => row.core_score_without_method != null);
  const avg = scored.length
    ? scored.reduce((sum, row) => sum + row.core_score_without_method / 100, 0) / scored.length
    : null;
  return {
    total: scored.length,
    weighted_accuracy_without_method: avg,
    pass_count: scored.filter(row => row.core_score_without_method >= 85).length,
    minor_count: scored.filter(row => row.core_score_without_method >= 60 && row.core_score_without_method < 85).length,
    major_count: scored.filter(row => row.core_score_without_method < 60).length,
  };
}

const rows = [];
const failures = [];
const cache = new Map();

for (const caseDef of loadCases()) {
  const pillars = caseDef.input.pillars;
  const key = pillars.join(' ');
  const cached = cache.get(key);
  const hit = cached || findSolar(pillars, caseDef.input.searchFromYear || 1500, caseDef.input.searchSpan || 800);
  if (hit) cache.set(key, hit);
  if (!hit) {
    failures.push({ id: caseDef.id, label: caseDef.label, error: 'solar date not found', pillars });
    continue;
  }

  const solar = Solar.fromYmdHms(hit.year, hit.month, hit.day, hit.hour, hit.minute, 0);
  const baZi = solar.getLunar().getEightChar();
  const isMale = genderToMale(caseDef.input.gender);
  const yun = baZi.getYun(isMale ? 1 : 0);
  const detail = buildCompleteBaziDetail({ baZi, yun, isMale, currentYear: 2026 });
  const actual = {
    pillars: key,
    solar: `${hit.year}-${String(hit.month).padStart(2, '0')}-${String(hit.day).padStart(2, '0')} ${String(hit.hour).padStart(2, '0')}:${hit.minute}`,
    ...extractActual(detail, baZi),
  };
  const row = scoreCase({ caseDef, actual });
  row.fixture = caseDef.fixture;
  rows.push(row);
}

const result = {
  generated_at: new Date().toISOString(),
  engine: 'buildCompleteBaziDetail',
  total_fixtures: new Set(rows.map(row => row.fixture)).size,
  summary: summarizeRows(rows),
  core_summary_without_method: summarizeCore(rows),
  fixture_summary: summarizeByFixture(rows),
  scope_summary: summarizeByScope(rows),
  failures,
  rows: rows.map(row => ({ ...row, core_score_without_method: coreScoreWithoutMethod(row) })),
};

const outDir = resolve(ROOT, 'eval/baziprofile-accuracy/results');
mkdirSync(outDir, { recursive: true });
const outFile = process.env.RESULTS_FILE || 'classical-golden-cases.json';
writeFileSync(resolve(outDir, outFile), JSON.stringify(result, null, 2), 'utf8');

console.log(JSON.stringify({
  result_file: resolve(outDir, outFile),
  summary: result.summary,
  core_summary_without_method: result.core_summary_without_method,
  scope_summary: result.scope_summary,
  fixture_summary: result.fixture_summary,
  failures: result.failures,
}, null, 2));
