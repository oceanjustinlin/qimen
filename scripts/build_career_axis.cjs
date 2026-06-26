'use strict';

/**
 * scripts/build_career_axis.cjs
 * 用真引擎 (lib/baziCareer.assessCareer) 为一个样本命盘生成逐年事业轴数据，
 * 导出 public/career-axis-data.json 供 demo 渲染。
 *
 * 样本：gold case A —— 壬寅 辛亥 戊辰 癸丑（戊土，1962 男，起运 5，阳男顺行）。
 * 已知事件：2017 丁酉年（丁巳大运，55 岁）当选学会主席 → 引擎曲线应在此抬升。
 *
 * 运行：node scripts/build_career_axis.cjs
 */

const path = require('path');
const fs = require('fs');
const L = (f) => require(path.join(__dirname, '..', 'lib', f));
const { assessCareer } = L('baziCareer');
const baziCore = L('baziCore');
const { BaziRuleEngine } = L('BaziRuleEngine');
const { assessBaziImage } = L('baziImageAssessor');
const { buildCareerPicture } = L('baziCareerPicture');
const { correctCareerYongshen } = L('baziCareerYongshen');

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

/** 命局喜忌五行（接 baziCore 取格 + getFavorableUnfavorable）。 */
function getYongShenWuxing(pillars) {
  const gans = [pillars.year[0], pillars.month[0], pillars.day[0], pillars.hour[0]];
  const zhis = [pillars.year[1], pillars.month[1], pillars.day[1], pillars.hour[1]];
  const dayGan = gans[2], monthZhi = zhis[1];
  const geju = baziCore.getGeJu({ year: pillars.year, month: pillars.month, day: pillars.day, time: pillars.hour });
  const strength = BaziRuleEngine.calculateStrength(dayGan, gans, zhis);
  const img = assessBaziImage({ dayGan, gans, zhis, monthZhi });
  let fav = {};
  try { fav = BaziRuleEngine.getFavorableUnfavorable(dayGan, monthZhi, geju.geju, strength, zhis, gans, geju, img); } catch (e) { /* noop */ }
  const engine = {
    favorable: (fav.wuxing && fav.wuxing.favorable) || [],
    unfavorable: (fav.wuxing && fav.wuxing.unfavorable) || [],
  };
  // 制化取用校正（Gap1）：七杀/伤官透干时去病神补制化神，纠正引擎约 1/3 反的喜忌
  const pic = buildCareerPicture({ pillars });
  const corrected = correctCareerYongshen({
    dayMaster: dayGan,
    transparentShishen: pic.transparent_shishen,
    engine,
    hasYangRen: pic.career_star_config.has_yangren,
    strongWeak: pic.strength && pic.strength.strongWeak,
  });
  return {
    favorable: corrected.favorable,
    unfavorable: corrected.unfavorable,
    engine_favorable: engine.favorable,
    corrected: corrected.corrected,
    geju: geju.geju,
  };
}

/** 干支五行相对喜忌的净值：+喜 / -忌，范围约 -2..+2。 */
function ganzhiFavor(ganzhi, ys) {
  let s = 0;
  for (const w of [GAN_WX[ganzhi[0]], ZHI_WX[ganzhi[1]]]) {
    if (ys.favorable.includes(w)) s += 1;
    if (ys.unfavorable.includes(w)) s -= 1;
  }
  return s;
}

function liunian(year) {
  const g = ((year - 4) % 10 + 10) % 10;
  const z = ((year - 4) % 12 + 12) % 12;
  return TIANGAN[g] + DIZHI[z];
}

// 大运：从月柱起，阳男顺行
function buildDayun(monthGz, startAge, forward = true, count = 9) {
  let gi = TIANGAN.indexOf(monthGz[0]);
  let zi = DIZHI.indexOf(monthGz[1]);
  const out = [];
  for (let i = 0; i < count; i++) {
    gi = (gi + (forward ? 1 : -1) + 10) % 10;
    zi = (zi + (forward ? 1 : -1) + 12) % 12;
    out.push({
      ganzhi: TIANGAN[gi] + DIZHI[zi],
      startAge: startAge + i * 10,
      endAge: startAge + i * 10 + 9,
    });
  }
  return out;
}

function dayunAt(dayunList, age, startAge) {
  if (age < startAge) return null;
  return dayunList.find((d) => age >= d.startAge && age <= d.endAge) || dayunList[dayunList.length - 1];
}

// ── 样本配置 ──
// eventHints：原文判定的结构性年份（结构坍塌/用神被破等需 hint，按框架设计不自动）。
const SAMPLES = {
  A: {
    key: 'A',
    label: 'A · 壬寅辛亥戊辰癸丑（戊土·1962·男）',
    pillars: { year: '壬寅', month: '辛亥', day: '戊辰', hour: '癸丑' },
    birthYear: 1962, gender: 'male', startAge: 5, forward: true,
    note: '陆致极《动态分析教程》命例81。2017 丁酉年·丁巳大运当选全美学会主席（吉案）。',
    eventHints: {},
  },
  D: {
    key: 'D',
    label: 'D · 丙申甲午庚戌乙酉（庚金·1956·男）',
    pillars: { year: '丙申', month: '甲午', day: '庚戌', hour: '乙酉' },
    birthYear: 1956, gender: 'male', startAge: 8, forward: true,
    note: '陆致极《动态分析教程》命例111。某省副省长，2015 乙未年·庚子大运因"地支接连无闲"连环刑冲落马（凶案）。',
    // 落马年：庚子大运(58+)逢乙未流年，午未申酉戌亥子丑八连支 → 结构坍塌；
    // 落马后审查/入狱亦为事业坍塌低谷，故 2015-2017 连续标记。
    eventHints: {
      2015: { structural_collapse: true },
      2016: { structural_collapse: true },
      2017: { structural_collapse: true },
    },
  },
  F: {
    key: 'F',
    label: 'F · 癸未辛酉乙酉丁亥（乙木·阎锡山·1883·男）',
    pillars: { year: '癸未', month: '辛酉', day: '乙酉', hour: '丁亥' },
    birthYear: 1883, gender: 'male', startAge: 6, forward: false, // 癸阴男逆行
    note: '陆致极《动态分析教程》命例60。七杀旺，中年丁巳丙辰火运引食神制杀、化杀为权，称霸山西（掌权型·吉）。',
    eventHints: {},
  },
  K: {
    key: 'K',
    label: 'K · 甲申甲戌甲寅甲戌（甲木·示意1944·男）',
    pillars: { year: '甲申', month: '甲戌', day: '甲寅', hour: '甲戌' },
    birthYear: 1944, gender: 'male', startAge: 3, forward: true, // 甲阳男顺行；生年示意
    note: '滴天髓"天全一气"。秋木休囚、七杀无制；早运衣食颇丰，交庚辰运杀元神透出，破家不禄（破败型·凶）。',
    // 庚辰大运(约53起)杀无制攻身、辰戌冲助杀 → 结构坍塌
    eventHints: { 1997: { structural_collapse: true }, 1998: { structural_collapse: true }, 1999: { structural_collapse: true } },
  },
  U: {
    key: 'U',
    label: 'U · 癸亥癸亥戊午甲寅（戊土·示意1923·男）',
    pillars: { year: '癸亥', month: '癸亥', day: '戊午', hour: '甲寅' },
    birthYear: 1923, gender: 'male', startAge: 5, forward: false, // 癸阴男逆行；生年示意
    note: '滴天髓·反局（仓提督）。财杀肆逞，赖寅午合印、以杀化印，运走木火，武职超群（武贵型·吉）。',
    eventHints: {},
  },
};

const clamp = (v, lo = 2, hi = 98) => Math.max(lo, Math.min(hi, v));

function build(SAMPLE) {
  const dayunList = buildDayun(SAMPLE.pillars.month, SAMPLE.startAge, SAMPLE.forward);
  const ys = getYongShenWuxing(SAMPLE.pillars); // 命局喜忌五行

  // 大运段：评估方向 + 大运喜忌→十年基线位移（喜运抬、忌运压，这是命运曲线的十年起伏来源）
  const decadeShift = {};
  const dayun_segments = dayunList.map((d) => {
    const r = assessCareer({ pillars: SAMPLE.pillars, transitGz: d.ganzhi, layer: 'dayun', age: d.startAge });
    const favor = ganzhiFavor(d.ganzhi, ys);     // -2..+2
    const shift = favor * 8;                       // ±16
    decadeShift[d.ganzhi] = shift;
    return {
      ganzhi: d.ganzhi,
      start_age: d.startAge,
      end_age: d.endAge,
      start_year: SAMPLE.birthYear + d.startAge - 1,
      direction: r.direction.direction,
      rule: r.direction.rule,
      state_score: r.metrics.state_score,
      dayun_favor: favor,
      decade_shift: shift,
    };
  });

  // 逐年：流年触发（大运并入 reference 供应局）
  const years = [];
  let prevScore = null;
  const endYear = SAMPLE.birthYear + 82;
  for (let year = SAMPLE.birthYear; year <= endYear; year++) {
    const age = year - SAMPLE.birthYear + 1; // 虚岁
    const dy = dayunAt(dayunList, age, SAMPLE.startAge);
    const ln = liunian(year);
    const refStems = dy ? [dy.ganzhi[0]] : [];
    const refBranches = dy ? [dy.ganzhi[1]] : [];
    const yearHints = (SAMPLE.eventHints && SAMPLE.eventHints[year]) || {};
    const r = assessCareer({
      pillars: SAMPLE.pillars,
      transitGz: ln,
      layer: 'liunian',
      age,
      prevScore,
      hints: yearHints,
      referenceStems: refStems,
      referenceBranches: refBranches,
    });
    // 叠加大运十年基线 + 流年喜忌微调（让曲线有十年起伏、忌运能下探）
    let shift = dy ? (decadeShift[dy.ganzhi] || 0) : 0;
    // 结构坍塌年（原文判定，如落马）：强负基线，压过十年好运基线，硬崩
    if (yearHints.structural_collapse) shift = -20;
    const lnTint = ganzhiFavor(ln, ys) * 3;        // ±6
    const rawScore = r.metrics.state_score;
    const dispScore = clamp(rawScore + shift + lnTint);
    prevScore = dispScore;
    years.push({
      year,
      age,
      liunian: ln,
      dayun: dy ? dy.ganzhi : null,
      yunxian: r.yunxian ? r.yunxian.pillar : null,
      yunxian_career: r.yunxian ? r.yunxian.topic_career : null,
      direction: r.direction.direction,
      rule: r.direction.rule,
      reason: r.direction.reason,
      base_capacity: r.metrics.base_capacity,
      state_score: dispScore,
      state_score_engine: rawScore,
      decade_shift: shift,
      liunian_tint: lnTint,
      activation: r.metrics.activation,
      volatility: r.metrics.volatility,
      confidence: r.metrics.confidence,
      inducements: r.inducements.map((i) => ({ channel: i.channel, value: i.value, target: i.target.shishen || i.target.role })),
      evidence: r.evidence,
    });
  }

  const out = {
    _meta: {
      engine: 'lib/baziCareer.assessCareer（真引擎，非仿真）',
      domain: 'career',
      generated_at: new Date().toISOString(),
      sample: SAMPLE.label,
      note: SAMPLE.note,
      yongshen: ys,
      scoring: 'state_score = 引擎逐年分(base±方向×激活) + 大运喜忌十年基线(±16) + 流年喜忌微调(±6)。大运基线带来十年起伏。',
      caveat: '结构坍塌/用神被破等需原文判断的年份按 eventHints 注入（如 D 的落马年）；未注入处凶向偏少。注：引擎用神约1/3与原文相反，大运基线喜忌可能偏（如 D 身弱却判喜水火），仅作示意。',
      event_hints: SAMPLE.eventHints || {},
    },
    natal: {
      label: SAMPLE.label,
      pillars: SAMPLE.pillars,
      day_master: SAMPLE.pillars.day[0],
      birth_year: SAMPLE.birthYear,
      gender: SAMPLE.gender,
    },
    dayun_segments,
    range: { start_year: SAMPLE.birthYear, end_year: endYear },
    years,
  };

  return out;
}

function writeSample(sample, spotYears) {
  const out = build(sample);
  const dir = path.join(__dirname, '..', 'public');
  fs.writeFileSync(path.join(dir, `career-axis-${sample.key}.json`), JSON.stringify(out, null, 2));
  if (sample.key === 'A') fs.writeFileSync(path.join(dir, 'career-axis-data.json'), JSON.stringify(out, null, 2)); // 默认/兼容
  console.log(`\n[${sample.key}] ${sample.label} | years ${out.years.length} | 喜${out._meta.yongshen.favorable.join('')}忌${out._meta.yongshen.unfavorable.join('')}`);
  const sc = out.years.map((y) => y.state_score);
  console.log(`  分 min ${Math.min(...sc)} max ${Math.max(...sc)} <50 ${sc.filter((s) => s < 50).length}年`);
  for (const y of out.years.filter((v) => spotYears.includes(v.year))) {
    console.log(`  ${y.year}(${y.age}岁) ${y.liunian}/${y.dayun} → ${y.direction}(${y.rule}) 分${y.state_score} 激活${y.activation}`);
  }
}

writeSample(SAMPLES.A, [1968, 2016, 2017]);
writeSample(SAMPLES.D, [1990, 2014, 2015, 2016]);
writeSample(SAMPLES.F, [1900, 1925, 1940]);
writeSample(SAMPLES.K, [1970, 1996, 1997, 2000]);
writeSample(SAMPLES.U, [1945, 1960, 1975]);
