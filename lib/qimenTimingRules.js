const { Solar } = require('lunar-javascript');
const U = require('./QimenUtils');
const { SAN_QI_TOMB_BRANCH, EXPLICIT_STEM_TOMB_BRANCH } = require('./qimenClassicalRules');
const { buildQimenChart, buildEvidencePalaces, buildSymbolContext } = require('./qimenChart');
const { matchesSymbol: matchesQimenSymbol, resolveSymbolStem, isCenterPalace } = require('./qimenSymbols');

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCH_HOURS = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 };
const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const PALACE_BRANCHES = {
  0: ['辰', '巳'],
  1: ['午'],
  2: ['未', '申'],
  3: ['卯'],
  4: [],
  5: ['酉'],
  6: ['丑', '寅'],
  7: ['子'],
  8: ['戌', '亥']
};

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function atBranchHour(date, branch) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), BRANCH_HOURS[branch], 0, 0);
  return next;
}

function normalizePalace(palace) {
  return {
    ...palace,
    branches: palace.branches || PALACE_BRANCHES[palace.index] || [],
    isKong: Boolean(palace.isKong || palace.kong_wang?.is_kong),
    hasMa: Boolean(palace.hasMa || palace.ma_xing?.has_ma)
  };
}

function findTargetPalace(chart, target) {
  const palaces = (chart.palaces || []).filter((palace) => palace && !isCenterPalace(palace));
  return palaces.map(normalizePalace).find((palace) => matchesQimenSymbol(palace, target.symbol, chart.symbolContext || {}));
}

function buildP1Candidates({ chart, targetSymbols = [], eventMode = 'success' }) {
  const candidates = [];

  for (const target of targetSymbols) {
    const palace = findTargetPalace(chart, target);
    if (!palace) continue;

    const common = {
      target_symbol: target.symbol,
      target_role: target.role || '',
      target_palace: palace.name || '',
      target_palace_index: palace.index,
      event_mode: eventMode
    };

    if (palace.isKong) {
      const branches = [...new Set([...(chart.dayKongBranches || []), ...(chart.hourKongBranches || [])])];
      candidates.push({
        ...common,
        timing_type: 'kongwang_fill_or_clash',
        priority: 1,
        branches,
        trigger: '填实空亡或冲空',
        basis: [`${target.symbol}为${target.role || '核心用神'}`, `${palace.name || '目标宫'}逢空亡`, '第26章定应期以空亡冲填为最高优先级'],
        confidence: 'medium'
      });
      continue;
    }

    if (palace.hasMa) {
      candidates.push({
        ...common,
        timing_type: 'horse_star_activated',
        priority: 2,
        branches: palace.branches,
        trigger: '马星当令或被冲动',
        basis: [`${target.symbol}所在${palace.name || '目标宫'}临马星`, '用神不空时，马星动为应期'],
        confidence: 'medium'
      });
      continue;
    }

    const targetStem = resolveSymbolStem(target.symbol, palace, chart.symbolContext || {});
    const tombBranch = SAN_QI_TOMB_BRANCH[targetStem] || EXPLICIT_STEM_TOMB_BRANCH[targetStem];
    if (tombBranch && palace.branches.includes(tombBranch)) {
      candidates.push({
        ...common,
        timing_type: 'tomb_store_clash',
        priority: 3,
        branches: [tombBranch],
        trigger: '冲墓或入墓',
        basis: [`${target.symbol}取${targetStem || '目标干'}，墓库在${tombBranch}`, `${palace.name || '目标宫'}含墓库支`, '不空不临马时，入墓以冲墓或入墓为应'],
        confidence: 'low'
      });
      continue;
    }

    candidates.push({
      ...common,
      timing_type: 'branch_relation_trigger',
      priority: 4,
      branches: palace.branches,
      trigger: '逢合解冲或冲开合局',
      basis: [`${target.symbol}所在${palace.name || '目标宫'}未命中空亡、马星、墓库`, '按刑冲逢合、逢合以冲的后续层级观察'],
      confidence: 'low'
    });
  }

  return candidates.sort((a, b) => a.priority - b.priority);
}

function buildFuturePoint(date, branch, solarFactory) {
  const pointDate = atBranchHour(date, branch);
  const solar = solarFactory
    ? solarFactory(pointDate)
    : Solar.fromYmdHms(pointDate.getFullYear(), pointDate.getMonth() + 1, pointDate.getDate(), pointDate.getHours(), 0, 0);
  const lunar = solar.getLunar();
  const dayGanzhi = lunar.getDayInGanZhi();
  const hourGanzhi = lunar.getTimeInGanZhi();
  return {
    date: formatDate(pointDate),
    hour: pointDate.getHours(),
    time_branch: branch,
    day_ganzhi: dayGanzhi,
    day_branch: U.extractDiZhi(dayGanzhi),
    hour_ganzhi: hourGanzhi,
    hour_branch: U.extractDiZhi(hourGanzhi),
    raw_date: pointDate
  };
}

function candidateTriggers(candidate, point) {
  const branches = candidate.branches || [];
  const hits = [];
  const addHit = (trigger, branchType, matchedBranch, basis) => {
    hits.push({
      trigger,
      branch_type: branchType,
      matched_branch: matchedBranch,
      basis
    });
  };

  for (const branch of branches) {
    if (candidate.timing_type === 'kongwang_fill_or_clash') {
      if (point.day_branch === branch) addHit('fill_kongwang', 'day', branch, `${point.day_ganzhi}日填实${branch}空`);
      if (point.hour_branch === branch) addHit('fill_kongwang', 'hour', branch, `${point.hour_ganzhi}时填实${branch}空`);
      if (point.day_branch === CHONG[branch]) addHit('clash_kongwang', 'day', branch, `${point.day_ganzhi}日冲${branch}空`);
      if (point.hour_branch === CHONG[branch]) addHit('clash_kongwang', 'hour', branch, `${point.hour_ganzhi}时冲${branch}空`);
    } else if (candidate.timing_type === 'horse_star_activated') {
      if (point.day_branch === branch || point.hour_branch === branch) addHit('horse_arrives', point.day_branch === branch ? 'day' : 'hour', branch, `${branch}临日/时，马星当令`);
      if (point.day_branch === CHONG[branch] || point.hour_branch === CHONG[branch]) addHit('horse_clashed', point.day_branch === CHONG[branch] ? 'day' : 'hour', branch, `${CHONG[branch]}冲动${branch}马`);
    } else if (candidate.timing_type === 'tomb_store_clash') {
      if (point.day_branch === CHONG[branch] || point.hour_branch === CHONG[branch]) addHit('tomb_clashed', point.day_branch === CHONG[branch] ? 'day' : 'hour', branch, `${CHONG[branch]}冲${branch}墓`);
      if (point.day_branch === branch || point.hour_branch === branch) addHit('tomb_arrives', point.day_branch === branch ? 'day' : 'hour', branch, `${branch}墓库临日/时`);
    } else {
      if (point.day_branch === LIUHE[branch] || point.hour_branch === LIUHE[branch]) addHit('liuhex_relation', point.day_branch === LIUHE[branch] ? 'day' : 'hour', branch, `${LIUHE[branch]}合${branch}`);
      if (point.day_branch === CHONG[branch] || point.hour_branch === CHONG[branch]) addHit('clash_relation', point.day_branch === CHONG[branch] ? 'day' : 'hour', branch, `${CHONG[branch]}冲${branch}`);
    }
  }

  return hits;
}

// 一个时辰按 2 小时计；结束时刻不晚于起局时刻的时辰视为已过去，不进入应期窗口（P0-9）。
const BRANCH_SPAN_MS = 2 * 60 * 60 * 1000;

function scanFutureTriggers({ startDate = new Date(), days = 30, p1Candidates = [], maxHits = 12, solarFactory }) {
  const hits = [];
  const seenDayHits = new Set();
  const startMs = startDate.getTime();

  for (let offset = 0; offset <= days && hits.length < maxHits; offset++) {
    const date = addDays(startDate, offset);
    for (const branch of BRANCHES) {
      if (hits.length >= maxHits) break;
      const point = buildFuturePoint(date, branch, solarFactory);
      // 子时取 0 点为中点，覆盖前一日 23 点起的一个时辰
      if (point.raw_date.getTime() + BRANCH_SPAN_MS / 2 <= startMs) continue;
      for (const candidate of p1Candidates) {
        const triggers = candidateTriggers(candidate, point);
        for (const trigger of triggers) {
          // 日级命中与时辰无关：同一天同一用神同一触发只记一次，不随 12 个时辰重复。
          if (trigger.branch_type === 'day') {
            const key = [point.day_ganzhi, candidate.target_symbol, candidate.timing_type, trigger.trigger, trigger.matched_branch].join('|');
            if (seenDayHits.has(key)) continue;
            seenDayHits.add(key);
          }
          hits.push({
            scan_method: 'branch_trigger_scan',
            date: point.date,
            hour: point.hour,
            time_branch: trigger.branch_type === 'day' ? null : point.time_branch,
            branch_type: trigger.branch_type,
            day_ganzhi: point.day_ganzhi,
            hour_ganzhi: point.hour_ganzhi,
            trigger: trigger.trigger,
            target_symbol: candidate.target_symbol,
            target_role: candidate.target_role,
            matched_rule: candidate.timing_type,
            basis: `${candidate.target_symbol}：${trigger.basis}`,
            confidence: trigger.branch_type === 'day' ? candidate.confidence : 'low'
          });
          if (hits.length >= maxHits) break;
        }
        if (hits.length >= maxHits) break;
      }
    }
  }

  return hits.slice(0, maxHits);
}

// 复核：在候选时刻按同一套 buildQimenChart 重新起局（同一晚子时口径、寄宫），用同一套符号匹配找用神。
// 找不到用神时返回 target_found=false、target_is_kong=null，不能当作“不再空亡”的转吉依据（P0-10）。
function calculateRecheckChart(date, targetSymbol, solarFactory) {
  const solar = solarFactory
    ? solarFactory(date)
    : Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), 0, 0);
  const chart = buildQimenChart({
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    hour: solar.getHour(),
    minute: solar.getMinute()
  });
  const palaces = buildEvidencePalaces(chart);
  const palace = findTargetPalace({ palaces, symbolContext: buildSymbolContext(chart) }, { symbol: targetSymbol });
  const found = Boolean(palace);

  return {
    structure: chart.qimen_structure,
    ganzhi: { day: chart.ganzhiDay, hour: chart.ganzhiHour },
    target_symbol: targetSymbol,
    target_found: found,
    target_palace: palace?.name || '',
    target_is_kong: found ? Boolean(palace.isKong) : null,
    target_door: palace?.door || '',
    target_star: palace?.star || '',
    target_god: palace?.god || ''
  };
}

function recheckCandidates(candidates, { limit = 5, solarFactory } = {}) {
  return candidates.slice(0, limit).map((candidate) => {
    const date = new Date(`${candidate.date}T${String(candidate.hour).padStart(2, '0')}:00:00`);
    return {
      candidate,
      recheck: calculateRecheckChart(date, candidate.target_symbol, solarFactory)
    };
  });
}

function buildTimingAnalysis({ generatedAt = new Date(), chart, targetSymbols = [], eventMode = 'success', scanDays = 30, scanMaxHits = 12, recheckLimit = 5, solarFactory }) {
  const p1 = buildP1Candidates({ chart, targetSymbols, eventMode });
  const p2Candidates = scanFutureTriggers({
    startDate: generatedAt,
    days: scanDays,
    p1Candidates: p1,
    maxHits: scanMaxHits,
    solarFactory
  });

  return {
    method: 'qimen-timing-v1',
    theory: {
      priority: ['空亡', '马星', '墓库', '刑冲', '逢合'],
      event_modes: ['success', 'failure', 'capture_search_block']
    },
    event_mode: eventMode,
    range_days: scanDays,
    p1_candidates: p1,
    p2_scan: {
      method: 'branch_trigger_scan',
      candidates: p2Candidates
    },
    p3_recheck: recheckCandidates(p2Candidates, { limit: recheckLimit, solarFactory })
  };
}

// 地支时辰 → 现实钟点区间与昼夜性质，供 LLM 判断「这个兑现时间是否合常理」
const BRANCH_CLOCK = {
  子: { range: '23:00-01:00', period: '深夜', daytime: false },
  丑: { range: '01:00-03:00', period: '凌晨', daytime: false },
  寅: { range: '03:00-05:00', period: '凌晨', daytime: false },
  卯: { range: '05:00-07:00', period: '清晨', daytime: true },
  辰: { range: '07:00-09:00', period: '上午', daytime: true },
  巳: { range: '09:00-11:00', period: '上午', daytime: true },
  午: { range: '11:00-13:00', period: '中午', daytime: true },
  未: { range: '13:00-15:00', period: '下午', daytime: true },
  申: { range: '15:00-17:00', period: '下午', daytime: true },
  酉: { range: '17:00-19:00', period: '傍晚', daytime: true },
  戌: { range: '19:00-21:00', period: '晚上', daytime: false },
  亥: { range: '21:00-23:00', period: '夜间', daytime: false }
};

function describeBranchClock(branch) {
  const info = BRANCH_CLOCK[branch];
  if (!info) return '';
  return `${info.period}约${info.range}${info.daytime ? '' : '·非常规时段'}`;
}

// 映期/应期落到现实时间时的通用常理约束。首轮问事与反问追问共用，保证两条链路口径一致。
const TIMING_REALISM_RULES = `映期要符合现实常理（务必遵守）：
- 等待周期要贴合事件本身的自然节奏，再结合当前问题域判断：面试结果/对方回复/消息答复通常在 1 天到 1 周内见分晓；签约、谈判、收款多在数日到数周；诉讼、搬家、置业、调动等大事可拉长到数周到数月。不要把短周期事件硬套到一个月后的窗口，也不要把大事压缩成“今明两天”。若候选窗口明显超出事件应有的等待周期，应优先在更贴近的窗口里取用，或直接说明“多半在更早的某天就有动静”。
- 报给用户的兑现时间要符合生活常识：面试、回信、见面、签约、谈事等日常事务默认发生在白天工作或社交时段（约辰时到酉时，7:00–19:00）。遇到夜间时辰（子、丑、寅、戌、亥，即深夜与凌晨），不要直接对用户说“凌晨 2 点会有结果”这类不合常理的话；应转译为“当天内”“当天稍晚”或就近的白天时段来表达，把地支时辰落到用户能懂、且合乎场景的时间段上。
- 给时间时用“某月某日前后/上午/下午”这类用户能直接对照的说法，可附上大致钟点区间，避免只甩一个地支时辰让用户看不懂。`;

function buildTimingPromptSection(timingAnalysis) {
  const candidates = timingAnalysis.p1_candidates || [];
  const scanCandidates = timingAnalysis.p2_scan?.candidates || [];
  const rechecks = timingAnalysis.p3_recheck || [];
  const ruleLines = candidates.length
    ? candidates.slice(0, 5).map((item, index) => {
      const basis = (item.basis || []).join('；') || '未提供额外依据';
      return `${index + 1}. ${item.target_symbol}（${item.target_role || '核心用神'}）落${item.target_palace || '目标宫'}，命中“${item.trigger || item.timing_type}”。依据：${basis}。`;
    }).join('\n')
    : '未命中明确的空亡、马星、墓库、刑冲或逢合规则，只能保守描述为观察窗口不足。';
  const scanLines = scanCandidates.length
    ? scanCandidates.slice(0, 6).map((item, index) => {
      const clock = item.time_branch ? `（${describeBranchClock(item.time_branch)}）` : '';
      const dayOnly = !item.time_branch && item.branch_type === 'day' ? `（${item.day_ganzhi || ''}日，当日皆可）` : '';
      return `${index + 1}. ${item.date}${item.time_branch ? ` ${item.time_branch}时${clock}` : dayOnly}：${item.basis || item.trigger || '触发应期规则'}，置信度${item.confidence || 'medium'}。`;
    }).join('\n')
    : '未来扫描未找到明确触发点，不要自行新增日期或时辰。';
  const recheckLines = rechecks.length
    ? rechecks.slice(0, 5).map((item, index) => {
      const c = item.candidate || {};
      const r = item.recheck || {};
      const status = r.target_found === false || r.target_is_kong == null
        ? '复核盘未定位到该用神，不能作为转吉依据，语气必须保守'
        : r.target_is_kong ? '复核时目标用神仍空亡，语气必须降低' : '复核时目标用神不再空亡，可作为观察窗口';
      const extra = [r.target_palace, r.target_door, r.target_star, r.target_god].filter(Boolean).join('，');
      return `${index + 1}. ${c.date || ''}${c.time_branch ? ` ${c.time_branch}时` : ''}：${status}${extra ? `；复核落象：${extra}` : ''}。`;
    }).join('\n')
    : '暂无重新起局复核结果，不能把触发窗口说成确定结果。';

  return `
**【结构化定应期】**
以下内容由后端规则引擎基于第26章定应期法预先整理。定应期先看空亡，再看马星，再看墓库、刑冲、逢合；你只负责把这些依据组织成用户能理解的话，不要自行新增日期、时辰或触发条件。

事件类型参考：${timingAnalysis.event_mode || 'success'}。

当前盘判断：
${ruleLines}

未来触发窗口：
${scanLines}

复核提示：
${recheckLines}

输出要求：
- qimen_report.m4_guidance.timing_behavior 必须说明“为什么按这个应期规则看”以及“哪些窗口值得观察”，并优先使用上方前 1-3 个未来触发窗口。
- 若复核提示显示目标用神仍空亡，必须降低语气，只说“观察窗口”，不要说“必成”。
- 即使复核不空，也只能说“有催动/沟通/兑现的机会窗口”，不能保证现实必然发生。

${TIMING_REALISM_RULES}`;
}

module.exports = {
  buildTimingAnalysis,
  buildTimingPromptSection,
  scanFutureTriggers,
  TIMING_REALISM_RULES
};
