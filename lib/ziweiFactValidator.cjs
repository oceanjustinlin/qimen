'use strict';

/**
 * 紫微 Stage 2 Fact Validator（tasks/ziwei-forward-reasoning-pipeline-stage-contracts.md §5）。
 *
 * 第三方排盘引擎与推理系统之间的语义防火墙：JSON 能解析不代表盘面自洽。
 * 本层只校验、不修复、不猜测；任一关键不变量失败即抛出 ZIWEI_FACT_INVARIANT_FAILED，
 * 并在 details 中列出全部失败项，便于定位引擎升级或适配层回归。
 */

const crypto = require('node:crypto');
const { getMutagensByHeavenlyStem } = require('iztro/lib/utils');

const VALIDATED_SCHEMA_VERSION = 'ziwei-validated-chart/v1';
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 从命宫起按宫位索引递增方向的十二宫次序（iztro 索引 0 固定为寅宫）。
const ROLE_ORDER = ['命宫', '父母宫', '福德宫', '田宅宫', '官禄宫', '交友宫', '迁移宫', '疾厄宫', '财帛宫', '子女宫', '夫妻宫', '兄弟宫'];
const PALACE_ALIASES = { 仆役宫: '交友宫' };
const MUTAGENS = ['禄', '权', '科', '忌'];
const STAR_COLLECTIONS = ['major_stars', 'minor_stars', 'adjective_stars'];
const FIVE_ELEMENT_CLASS = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };
const DYNAMIC_SCOPES = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];
// 运限快照的地支与所落本命宫地支一致的层级；流月及以下的 earthly_branch 是时间干支，不做此校验。
const BRANCH_ALIGNED_SCOPES = ['decadal', 'yearly'];

function makeValidatorError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function canonical(name) {
  return PALACE_ALIASES[name] || name;
}

function mod12(value) {
  return ((value % 12) + 12) % 12;
}

function sameList(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function chartRef(chart) {
  return `chart:sha256:${crypto.createHash('sha256').update(JSON.stringify(chart)).digest('hex')}`;
}

/** 名称序列是否为 ROLE_ORDER 自命宫起的同一圈次序。 */
function followsRoleOrder(names, lifeIndex) {
  return names.every((name, index) => name === ROLE_ORDER[mod12(index - lifeIndex)]);
}

function checkEnvelope(chart) {
  const failures = [];
  if (chart?.schema_version !== 'ziwei-cli/v1') failures.push('schema_version 不是 ziwei-cli/v1');
  if (chart?.ok !== true) failures.push('ok 不为 true');
  if (chart?.engine?.library !== 'iztro' || typeof chart?.engine?.library_version !== 'string') {
    failures.push('engine 缺少 iztro 与版本号');
  }
  if (!Array.isArray(chart?.natal?.palaces)) failures.push('缺少 natal.palaces');
  return failures;
}

function checkTwelvePalaces(palaces) {
  const failures = [];
  if (palaces.length !== 12) return [`宫位数量为 ${palaces.length}`];
  palaces.forEach((palace, position) => {
    if (palace?.index !== position) failures.push(`palaces[${position}].index=${palace?.index}`);
    if (palace?.earthly_branch !== BRANCHES[mod12(position + 2)]) {
      failures.push(`palaces[${position}] 地支应为 ${BRANCHES[mod12(position + 2)]}，实际 ${palace?.earthly_branch}`);
    }
    if (!STEMS.includes(palace?.heavenly_stem)) failures.push(`palaces[${position}] 宫干无效：${palace?.heavenly_stem}`);
  });
  const names = palaces.map((palace) => canonical(palace?.palace_key));
  if (new Set(names).size !== 12 || !ROLE_ORDER.every((name) => names.includes(name))) {
    failures.push(`十二宫名称不完整或重复：${names.join('、')}`);
  }
  return failures;
}

function checkLifeBody(natal, palaces) {
  const failures = [];
  const names = palaces.map((palace) => canonical(palace.palace_key));
  const lifeIndex = names.indexOf('命宫');
  if (lifeIndex < 0) return ['缺少命宫'];
  if (!followsRoleOrder(names, lifeIndex)) failures.push('十二宫次序与命宫起排次序不一致');
  if (natal.soul_palace_branch !== palaces[lifeIndex].earthly_branch) {
    failures.push(`soul_palace_branch=${natal.soul_palace_branch} 与命宫地支 ${palaces[lifeIndex].earthly_branch} 不一致`);
  }
  const bodies = palaces.filter((palace) => palace.is_body_palace === true);
  if (bodies.length !== 1) {
    failures.push(`身宫数量为 ${bodies.length}`);
  } else if (natal.body_palace_branch !== bodies[0].earthly_branch) {
    failures.push(`body_palace_branch=${natal.body_palace_branch} 与身宫地支 ${bodies[0].earthly_branch} 不一致`);
  }
  return failures;
}

function checkRelations(palaces) {
  const failures = [];
  const names = palaces.map((palace) => canonical(palace.palace_key));
  palaces.forEach((palace, index) => {
    if (!palace.relations) return;
    const opposite = canonical(palace.relations.opposite);
    const trine = (palace.relations.trine || []).map(canonical).sort();
    const expectedTrine = [names[mod12(index + 4)], names[mod12(index + 8)]].sort();
    if (opposite !== names[mod12(index + 6)] || !sameList(trine, expectedTrine)) {
      failures.push(`${names[index]} 的对宫或三合与宫位索引不闭合`);
    }
  });
  return failures;
}

function checkStarsAndMutagens(natal, palaces) {
  const failures = [];
  const seen = new Map();
  const mutagenStars = {};
  palaces.forEach((palace) => {
    STAR_COLLECTIONS.forEach((collection) => {
      (palace[collection] || []).forEach((star) => {
        if (star.scope !== 'origin') failures.push(`本命星 ${star.name} 的 scope=${star.scope}，动态星混入本命`);
        if (seen.has(star.name)) failures.push(`星曜 ${star.name} 重复出现在 ${seen.get(star.name)} 与 ${palace.palace_key}`);
        seen.set(star.name, palace.palace_key);
        if (star.mutagen) {
          if (!MUTAGENS.includes(star.mutagen)) failures.push(`${star.name} 的四化无效：${star.mutagen}`);
          else if (mutagenStars[star.mutagen]) failures.push(`生年化${star.mutagen}出现多次`);
          else mutagenStars[star.mutagen] = star.name;
        }
      });
    });
  });
  MUTAGENS.forEach((mutagen) => {
    if (!mutagenStars[mutagen]) failures.push(`缺少生年化${mutagen}`);
    if (natal.natal_mutagens?.[mutagen] !== mutagenStars[mutagen]) {
      failures.push(`natal_mutagens.${mutagen} 与星曜上的四化不一致`);
    }
  });
  const yearStem = String(natal.chinese_date || '').charAt(0);
  if (STEMS.includes(yearStem)) {
    const expected = getMutagensByHeavenlyStem(yearStem);
    if (!sameList(MUTAGENS.map((mutagen) => mutagenStars[mutagen]), expected)) {
      failures.push(`生年四化与年干 ${yearStem} 的 iztro-default 四化表不一致`);
    }
  } else {
    failures.push(`无法从 chinese_date 读取年干：${natal.chinese_date}`);
  }
  return failures;
}

function checkDecadalSequence(natal, palaces) {
  const failures = [];
  const startAge = FIVE_ELEMENT_CLASS[natal.five_elements_class];
  if (!startAge) return [`未知五行局：${natal.five_elements_class}`];
  const lifeIndex = palaces.findIndex((palace) => canonical(palace.palace_key) === '命宫');
  palaces.forEach((palace) => {
    const decadal = palace.decadal;
    if (!decadal || decadal.end_age - decadal.start_age !== 9) {
      failures.push(`${palace.palace_key} 大限区间不是十年`);
    }
  });
  if (palaces[lifeIndex]?.decadal?.start_age !== startAge) {
    failures.push(`命宫大限起于 ${palaces[lifeIndex]?.decadal?.start_age} 岁，应为五行局数 ${startAge}`);
  }
  const forward = palaces[mod12(lifeIndex + 1)]?.decadal?.start_age === startAge + 10;
  for (let step = 0; step < 12; step += 1) {
    const index = mod12(lifeIndex + (forward ? step : -step));
    if (palaces[index]?.decadal?.start_age !== startAge + step * 10) {
      failures.push('大限起运岁未按单一方向每宫递增十年');
      break;
    }
  }
  return failures;
}

function checkPeriods(chart, palaces, requiredScopes) {
  const failures = [];
  const horoscope = chart.horoscope;
  requiredScopes.filter((scope) => scope !== 'natal').forEach((scope) => {
    if (!horoscope?.[scope]) failures.push(`缺少所需运限快照：${scope}`);
  });
  if (!horoscope) return failures;

  DYNAMIC_SCOPES.forEach((scope) => {
    const snapshot = horoscope[scope];
    if (!snapshot) return;
    const keys = Array.isArray(snapshot.palace_keys) ? snapshot.palace_keys.map(canonical) : [];
    if (!Number.isInteger(snapshot.index) || snapshot.index < 0 || snapshot.index > 11) {
      failures.push(`${scope}.index 无效`);
      return;
    }
    if (keys.length !== 12 || keys[snapshot.index] !== '命宫' || !followsRoleOrder(keys, snapshot.index)) {
      failures.push(`${scope} 的十二宫重排与运限命宫不一致`);
    }
    if (BRANCH_ALIGNED_SCOPES.includes(scope) && snapshot.earthly_branch !== palaces[snapshot.index].earthly_branch) {
      failures.push(`${scope} 命宫地支 ${snapshot.earthly_branch} 与所落本命宫地支 ${palaces[snapshot.index].earthly_branch} 不一致`);
    }
    if (!STEMS.includes(snapshot.heavenly_stem)) {
      failures.push(`${scope} 天干无效：${snapshot.heavenly_stem}`);
    } else if (!sameList(snapshot.mutagens, getMutagensByHeavenlyStem(snapshot.heavenly_stem))) {
      failures.push(`${scope} 四化与天干 ${snapshot.heavenly_stem} 的 iztro-default 四化表不一致`);
    }
  });
  return failures;
}

/**
 * 校验 ziwei-cli/v1 命盘。成功返回 ValidatedZiweiChart/v1 摘要；失败抛错且不返回半份结果。
 * @param {object} chart ziwei-cli/v1 输出
 * @param {{requiredScopes?: string[], traceId?: string}} options
 */
function validateZiweiChart(chart, { requiredScopes = ['natal'], traceId = null } = {}) {
  const unknownScopes = requiredScopes.filter((scope) => scope !== 'natal' && !DYNAMIC_SCOPES.includes(scope));
  if (unknownScopes.length) {
    throw makeValidatorError('ZIWEI_FACT_INVARIANT_FAILED', `未知的运限层级：${unknownScopes.join('、')}`);
  }
  const results = [];
  const run = (id, check) => {
    let failures;
    try {
      failures = check();
    } catch (error) {
      failures = [`校验异常：${error.message}`];
    }
    results.push({ id, failures });
    return failures.length === 0;
  };

  if (run('envelope_valid', () => checkEnvelope(chart))) {
    const { natal } = chart;
    const { palaces } = natal;
    if (run('twelve_palaces_unique', () => checkTwelvePalaces(palaces))) {
      run('life_body_present', () => checkLifeBody(natal, palaces));
      run('relations_closed', () => checkRelations(palaces));
      run('stars_unique_and_natal_mutagens_consistent', () => checkStarsAndMutagens(natal, palaces));
      run('decadal_sequence_consistent', () => checkDecadalSequence(natal, palaces));
      run('period_mapping_consistent', () => checkPeriods(chart, palaces, requiredScopes));
    }
  }

  const failed = results.filter((result) => result.failures.length);
  if (failed.length) {
    throw makeValidatorError(
      'ZIWEI_FACT_INVARIANT_FAILED',
      `命盘不变量校验失败：${failed.map((result) => result.id).join('、')}`,
      failed,
    );
  }

  return {
    schema_version: VALIDATED_SCHEMA_VERSION,
    trace_id: traceId,
    chart_ref: chartRef(chart),
    engine_version: `${chart.engine.library}@${chart.engine.library_version}`,
    validated: true,
    required_scopes: [...requiredScopes],
    invariants: results.map((result) => result.id),
  };
}

module.exports = {
  VALIDATED_SCHEMA_VERSION,
  validateZiweiChart,
};
