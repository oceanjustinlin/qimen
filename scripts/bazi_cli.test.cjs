'use strict';

/**
 * bazi_cli.test.cjs — parity 冒烟测试（不是准确度 eval）
 * ──────────────────────────────────────────────────────────────────────────────
 * 只锁一个不变量：CLI 是「引擎的无损封装」。
 *   - buildProfile 的换算 == 生产同源路径（Solar→getEightChar→getYun→buildCompleteBaziDetail）
 *   - buildChart / buildStatic 是引擎 detail 的忠实投影（不改写、不丢字段）
 *   - buildQuestionSection 忠实透传 buildBaziQuestionPrompt 的 pipelineResult
 *   - 错误码路径（子进程端到端）返回 ok:false + code + 退出码 1
 * 命理准确度由 eval/baziprofile-accuracy 与 lib/*.test.js 覆盖，此处不重复。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Solar } = require('lunar-javascript');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(__dirname, 'bazi_cli.cjs');
const { buildCompleteBaziDetail } = require(path.join(ROOT, 'lib', 'baziCore'));
const { buildBaziQuestionPrompt, inferBaziRouteFromQuestion, normalizeBaziSemanticRoute } = require(path.join(ROOT, 'lib', 'baziQuestionCore'));
const { buildProfile, buildChart, buildStatic, buildQuestionSection, run } = require(CLI);
const { validateEnvelope } = require(path.join(ROOT, 'lib', 'cliEnvelope.cjs'));

// 代表性生辰：男/女、不同时辰、跨节气月份
const BIRTHS = [
  { calendar: 'solar', year: 1990, month: 5, day: 1, hour: 14, minute: 0, gender: '男' },
  { calendar: 'solar', year: 1985, month: 11, day: 20, hour: 3, minute: 30, gender: '女' },
  { calendar: 'solar', year: 2001, month: 2, day: 4, hour: 23, minute: 10, gender: '男' }, // 立春/夜子时边界
];
const CURRENT_YEAR = 2026;

// 独立复算「生产同源」引擎结果，作为 parity 基准
function engineRef(birth) {
  const isMale = ['男', 'M', 'male', '乾造'].includes(birth.gender);
  const solar = Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour, birth.minute, 0);
  const baZi = solar.getLunar().getEightChar();
  const yun = baZi.getYun(isMale ? 1 : 0);
  return buildCompleteBaziDetail({ baZi, yun, isMale, currentYear: CURRENT_YEAR });
}

test('buildProfile 换算与生产同源（detail 全等）', () => {
  for (const birth of BIRTHS) {
    const ref = engineRef(birth);
    const { detail, baziStr } = buildProfile(birth, CURRENT_YEAR);
    assert.deepEqual(detail, ref, `detail 应与同源引擎全等: ${JSON.stringify(birth)}`);
    const gz = ref.pillars.ganzhi;
    assert.equal(baziStr, [gz.year, gz.month, gz.day, gz.time].join(' '));
  }
});

test('buildChart 是引擎 detail 的忠实投影', () => {
  const birth = BIRTHS[0];
  const { detail, baziStr } = buildProfile(birth, CURRENT_YEAR);
  const chart = buildChart(detail, baziStr);
  assert.equal(chart.bazi_str, baziStr);
  assert.equal(chart.day_master, detail.ri_zhu.charAt(0));
  assert.equal(chart.ri_zhu, detail.ri_zhu);
  assert.equal(chart.qi_yun, detail.base_info.qi_yun);
  assert.deepEqual(chart.pillars, detail.matrix.pillars); // 藏干/十神/神煞逐字段不丢
  assert.equal(chart.dayun_list.length, detail.matrix.dayun_list.length);
  // 精简后仍保留关键锚点字段
  chart.dayun_list.forEach((d, i) => {
    const src = detail.matrix.dayun_list[i];
    assert.equal(d.gan, src.gan);
    assert.equal(d.zhi, src.zhi);
    assert.equal(d.start_year, src.start_year);
    assert.equal(d.shi_shen, src.shi_shen);
  });
});

test('buildStatic 逐字段等于引擎产物（无改写）', () => {
  for (const birth of BIRTHS) {
    const { detail } = buildProfile(birth, CURRENT_YEAR);
    const s = buildStatic(detail);
    assert.equal(s.geju, detail.geju);
    assert.deepEqual(s.five_shens, detail.five_shens);
    assert.deepEqual(s.favorable_gods, detail.favorable_gods);
    assert.deepEqual(s.unfavorable_gods, detail.unfavorable_gods);
    assert.deepEqual(s.tiaohou_detail, detail.tiaohou_detail);
    assert.deepEqual(s.chengge_detail, detail.chengge_detail);
    assert.deepEqual(s.image_analysis, detail.image_analysis);
    assert.equal(s.strong_weak, detail.strong_weak);
  }
});

test('buildQuestionSection 忠实透传 pipelineResult（timing）', () => {
  const birth = BIRTHS[0];
  const { profile } = buildProfile(birth, CURRENT_YEAR);
  const question = '未来五年事业哪年最有机会突破';
  const route = { analysis_mode: 'timing', time_scope: { type: 'next_5_years' } };

  const section = buildQuestionSection(profile, question, route);
  // 独立复算引擎，比对
  const ref = buildBaziQuestionPrompt({ profile, question, route: { branch: 'bazi', ...route } });
  assert.equal(section.engine_ran, Boolean(ref.pipelineResult));
  assert.equal(section.route.analysis_mode, 'timing');
  assert.ok(section.engine_ran, '显式 timing route 应命中引擎');
  assert.deepEqual(section.target_spec, ref.pipelineResult.targetSpec);
  assert.deepEqual(section.timing_candidates, ref.pipelineResult.timingCandidates);
  assert.ok(Array.isArray(section.timing_candidates) && section.timing_candidates.length > 0);
});

test('route 缺省时脚本启发式兜底与引擎一致', () => {
  const birth = BIRTHS[1];
  const { profile } = buildProfile(birth, CURRENT_YEAR);
  const question = '我的性格适合创业还是打工';
  const section = buildQuestionSection(profile, question, undefined);
  const expected = normalizeBaziSemanticRoute(inferBaziRouteFromQuestion(question, { branch: 'bazi' }));
  assert.equal(section.route.analysis_mode, expected.analysis_mode);
});

// ── 错误码路径：子进程端到端（统一失败外层 {ok:false, code, message, hint}）──────
function runCliExpectFail(input, args = []) {
  try {
    execFileSync('node', [CLI, ...args], { input: input === undefined ? '' : JSON.stringify(input), encoding: 'utf8' });
    assert.fail('应以非 0 退出');
  } catch (e) {
    assert.ok(e.status === 1, `退出码应为 1，实际 ${e.status}`);
    const out = JSON.parse(e.stdout);
    assert.equal(out.ok, false);
    assert.equal(typeof out.message, 'string');
    assert.ok(out.hint && out.hint.length > 0, '失败外层应带 hint');
    assert.equal(validateEnvelope(out).valid, true);
    return out;
  }
}

test('错误码：BIRTH_INCOMPLETE / CALENDAR_UNSUPPORTED / QUESTION_REQUIRED', () => {
  assert.equal(runCliExpectFail({ mode: 'chart', birth: {} }).code, 'BIRTH_INCOMPLETE');
  assert.equal(
    runCliExpectFail({ mode: 'chart', birth: { calendar: 'lunar', year: 1990, month: 5, day: 1, hour: 12, gender: '男' } }).code,
    'CALENDAR_UNSUPPORTED',
  );
  assert.equal(
    runCliExpectFail({ mode: 'question', birth: { calendar: 'solar', year: 1990, month: 5, day: 1, hour: 12, gender: '男' } }).code,
    'QUESTION_REQUIRED',
  );
});

test('旧格式缺 hour → 子进程 ok:false TIME_REQUIRED', () => {
  const out = runCliExpectFail({ mode: 'chart', birth: { calendar: 'solar', year: 1990, month: 5, day: 1, gender: '男' } });
  assert.equal(out.code, 'TIME_REQUIRED');
});

test('run 输出通过 schema，conventions.zi_hour 为夜子时算当日', () => {
  const env = run({ birth: { date: '2001-02-04', time: '23:10', gender: '男' } });
  assert.equal(validateEnvelope(env).valid, true);
  assert.equal(env.conventions.zi_hour, '夜子时算当日');
  assert.equal(env.system, 'bazi');
  assert.equal(env.mode, 'chart');
  assert.ok(env.warnings.some((w) => w.includes('未做真太阳时校正') || w.includes('未提供出生地')), 'warnings 应含 parseBirth 的提示');
  assert.equal(env.input.date, '2001-02-04');
  assert.equal(env.input.mode, 'chart');
  assert.ok(Number.isInteger(env.input.current_year));
});

test('run 与 parity：chart / judgments 是引擎 detail 的无损投影', () => {
  for (const birth of BIRTHS) {
    const env = run({ birth, current_year: CURRENT_YEAR });
    const { detail, baziStr } = buildProfile(birth, CURRENT_YEAR);
    assert.deepEqual(env.chart, buildChart(detail, baziStr));
    assert.deepEqual(env.judgments, buildStatic(detail));
    assert.equal(env.engine_version, detail.engine_version || null);
    assert.deepEqual(detail, engineRef(birth));
  }
});

test('run question 模式：judgments.question 透传，limitations/confidence 取自问事段', () => {
  const route = { analysis_mode: 'timing', time_scope: { type: 'next_5_years' } };
  const env = run({
    birth: BIRTHS[0], mode: 'question', question: '未来五年事业哪年最有机会突破', route, current_year: CURRENT_YEAR,
  });
  assert.equal(validateEnvelope(env).valid, true);
  assert.equal(env.mode, 'question');
  assert.equal(env.input.question, '未来五年事业哪年最有机会突破');
  assert.equal(env.input.current_year, CURRENT_YEAR);
  assert.ok(env.judgments.question.engine_ran);
  assert.deepEqual(env.limitations, env.judgments.question.limitations);
  const c = env.judgments.question.target_spec && env.judgments.question.target_spec.confidence;
  assert.equal(env.confidence, ['high', 'medium', 'low'].includes(c) ? c : null);
  assert.throws(() => run({ birth: BIRTHS[0], mode: 'question' }), (e) => e.code === 'QUESTION_REQUIRED');
  assert.throws(() => run({ birth: BIRTHS[0], mode: 'bogus' }), (e) => e.code === 'MODE_INVALID');
});

test('带 location 时用真太阳时排盘：乌鲁木齐 1990-05-01 01:00（-187 分钟 → 4/30 21:53）时柱为丁亥', () => {
  const env = run({
    birth: { date: '1990-05-01', time: '01:00', gender: '男', location: { place: '乌鲁木齐' } },
    current_year: CURRENT_YEAR,
  });
  assert.equal(validateEnvelope(env).valid, true);
  assert.equal(env.input.solar_time.total_minutes, -187);
  assert.equal(env.input.solar_time.adjusted, '1990-04-30 21:53');
  const ref = Solar.fromYmdHms(1990, 4, 30, 22, 13, 0).getLunar().getEightChar();
  assert.equal(env.chart.pillars[3].gan + env.chart.pillars[3].zhi, '丁亥');
  assert.equal(env.chart.bazi_str.split(' ')[3], ref.getTime());
  assert.equal(env.chart.bazi_str.split(' ')[2], ref.getDay());
  assert.ok(!env.warnings.some((w) => w.includes('未提供出生地')), '带 location 不应再有未校正提示');
});

test('flags 路径仍可用：--date 1990-05-01 --time 14:00 --gender 男', () => {
  const out = JSON.parse(execFileSync('node', [CLI, '--date', '1990-05-01', '--time', '14:00', '--gender', '男', '--currentYear', '2026'], {
    input: '', encoding: 'utf8',
  }));
  assert.equal(out.ok, true);
  assert.equal(out.system, 'bazi');
  assert.equal(out.input.current_year, 2026);
  assert.equal(validateEnvelope(out).valid, true);
  const gz = engineRef(BIRTHS[0]).pillars.ganzhi;
  assert.equal(out.chart.bazi_str, [gz.year, gz.month, gz.day, gz.time].join(' '));
});

test('flags 缺 --time → TIME_REQUIRED（不再默认 12 点）', () => {
  assert.equal(runCliExpectFail(undefined, ['--date', '1990-05-01', '--gender', '男']).code, 'TIME_REQUIRED');
});

test('子进程 chart 模式端到端可用', () => {
  const out = JSON.parse(execFileSync('node', [CLI], {
    input: JSON.stringify({ mode: 'chart', birth: BIRTHS[0], currentYear: CURRENT_YEAR }), // 旧字段 currentYear 仍兼容
    encoding: 'utf8',
  }));
  assert.equal(out.ok, true);
  assert.equal(out.chart.bazi_str, engineRef(BIRTHS[0]).pillars.ganzhi.year + ' ' + engineRef(BIRTHS[0]).pillars.ganzhi.month + ' ' + engineRef(BIRTHS[0]).pillars.ganzhi.day + ' ' + engineRef(BIRTHS[0]).pillars.ganzhi.time);
});
