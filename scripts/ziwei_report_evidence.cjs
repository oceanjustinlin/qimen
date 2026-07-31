#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const YAML = require('yaml');

const DEFAULT_KNOWLEDGE_ROOT = path.join(__dirname, '..', 'knowledge', 'ziwei');
const REPORT_SCHEMA_VERSION = 'ziwei-report-output/v1';
const REPORT_FILES = [
  'overall.yaml',
  'career.yaml',
  'wealth.yaml',
  'relationship.yaml',
  'annual.yaml',
];
const INTERPRETATION_FILES = [
  'interpretations/palaces/core-palaces.yaml',
  'interpretations/stars/major-stars.yaml',
  'interpretations/transformations/core-mutagens.yaml',
];
const EXCERPT_FILES = [
  'sources/mingli-tianji/excerpts.jsonl',
  'sources/feixing-ziwei/excerpts.jsonl',
];
const STAR_COLLECTIONS = [
  ['major_stars', 'major'],
  ['minor_stars', 'minor'],
  ['adjective_stars', 'adjective'],
];
const PERIODS = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];

function makeReportError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function loadReportTemplates({ knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT } = {}) {
  const schema = readJson(path.join(knowledgeRoot, 'schemas', 'report.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const templates = new Map();

  REPORT_FILES.forEach((fileName) => {
    const filePath = path.join(knowledgeRoot, 'reports', fileName);
    const template = readYaml(filePath);
    if (!validate(template)) {
      throw makeReportError(
        'REPORT_TEMPLATE_INVALID',
        `${fileName} 不符合报告模板 Schema。`,
        clone(validate.errors),
      );
    }
    if (templates.has(template.topic)) {
      throw makeReportError('REPORT_TEMPLATE_DUPLICATE', `报告主题重复：${template.topic}`);
    }
    templates.set(template.topic, template);
  });

  return templates;
}

function loadPropositions(knowledgeRoot) {
  const schema = readJson(path.join(knowledgeRoot, 'schemas', 'interpretation.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const propositions = [];
  const ids = new Set();

  INTERPRETATION_FILES.forEach((relativePath) => {
    const document = readYaml(path.join(knowledgeRoot, relativePath));
    if (document?.schema_version !== 'ziwei-interpretations/v1') {
      throw makeReportError(
        'REPORT_PROPOSITION_SET_INVALID',
        `${relativePath} 的 schema_version 无效。`,
      );
    }
    (document.propositions || []).forEach((proposition) => {
      if (!validate(proposition)) {
        throw makeReportError(
          'REPORT_PROPOSITION_INVALID',
          `${proposition?.id || relativePath} 不符合解释命题 Schema。`,
          clone(validate.errors),
        );
      }
      if (ids.has(proposition.id)) {
        throw makeReportError('REPORT_PROPOSITION_DUPLICATE', `解释命题 ID 重复：${proposition.id}`);
      }
      ids.add(proposition.id);
      propositions.push(proposition);
    });
  });

  return propositions;
}

function loadSources(knowledgeRoot) {
  const sources = EXCERPT_FILES.flatMap((relativePath) => (
    readJsonLines(path.join(knowledgeRoot, relativePath))
  ));
  return new Map(sources.map((source) => [source.id, source]));
}

function loadSafetyPolicy(knowledgeRoot) {
  const safety = readYaml(path.join(knowledgeRoot, 'policies', 'safety.yaml'));
  if (safety?.schema_version !== 'ziwei-safety/v1') {
    throw makeReportError('REPORT_SAFETY_POLICY_INVALID', '紫微安全策略版本无效。');
  }
  return safety;
}

function loadPalaceAliases(knowledgeRoot) {
  const ontology = readYaml(path.join(knowledgeRoot, 'ontology', 'palaces.yaml'));
  const aliases = new Map();
  (ontology?.palaces || []).forEach((palace) => {
    aliases.set(palace.id, palace.id);
    palace.aliases.forEach((alias) => aliases.set(alias, palace.id));
  });
  return aliases;
}

function canonicalPalaceName(name, aliases) {
  return aliases.get(name) || name;
}

function projectChartFacts(
  chart,
  { knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT } = {},
) {
  if (
    !chart
    || chart.schema_version !== 'ziwei-cli/v1'
    || !Array.isArray(chart.natal?.palaces)
    || chart.natal.palaces.length !== 12
  ) {
    throw makeReportError('REPORT_CHART_INVALID', '报告输入必须是完整的 ziwei-cli/v1 命盘。');
  }

  const palaceAliases = loadPalaceAliases(knowledgeRoot);
  const facts = [];
  chart.natal.palaces.forEach((palace) => {
    const palaceName = canonicalPalaceName(palace.palace_key, palaceAliases);
    facts.push({
      feature: 'chart_has_palace',
      palace: palaceName,
    });

    STAR_COLLECTIONS.forEach(([collection, starClass]) => {
      (palace[collection] || []).forEach((star) => {
        facts.push({
          feature: 'palace_has_star',
          palace: palaceName,
          star: star.name,
          star_class: starClass,
        });
        if (star.brightness) {
          facts.push({
            feature: 'palace_has_brightness',
            palace: palaceName,
            star: star.name,
            value: star.brightness,
          });
        }
        if (star.mutagen) {
          facts.push({
            feature: 'star_has_mutagen',
            palace: palaceName,
            star: star.name,
            mutagen: star.mutagen,
          });
          facts.push({
            feature: 'palace_has_mutagen',
            palace: palaceName,
            star: star.name,
            mutagen: star.mutagen,
          });
        }
      });
    });

    if (palace.relations) {
      facts.push({
        feature: 'palace_has_relation',
        palace: palaceName,
        value: {
          opposite: canonicalPalaceName(palace.relations.opposite, palaceAliases),
          trine: palace.relations.trine.map((item) => (
            canonicalPalaceName(item, palaceAliases)
          )),
        },
      });
    }
  });

  PERIODS.forEach((period) => {
    const snapshot = chart.horoscope?.[period];
    if (!snapshot || !Number.isInteger(snapshot.index)) return;
    const natalPalace = chart.natal.palaces[snapshot.index];
    const periodPalace = canonicalPalaceName(
      snapshot.palace_keys?.[snapshot.index],
      palaceAliases,
    );
    if (!natalPalace || periodPalace !== '命宫') {
      throw makeReportError('REPORT_CHART_INVALID', `${period} 运限命宫索引无效。`);
    }
    facts.push({
      feature: 'period_activates',
      palace: canonicalPalaceName(natalPalace.palace_key, palaceAliases),
      period,
      value: '命宫',
    });
  });

  return facts;
}

function predicateMatchesFact(predicate, fact) {
  return Object.entries(predicate).every(([key, value]) => valuesEqual(fact[key], value));
}

function uniqueFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = JSON.stringify(canonicalize(fact));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function conditionMatchFacts(condition, facts) {
  if (own(condition, 'all')) {
    const matchedGroups = condition.all.map((item) => conditionMatchFacts(item, facts));
    if (matchedGroups.some((matched) => matched === null)) return null;
    return uniqueFacts(matchedGroups.flat());
  }
  if (own(condition, 'any')) {
    const matchedGroups = condition.any
      .map((item) => conditionMatchFacts(item, facts))
      .filter((matched) => matched !== null);
    return matchedGroups.length ? uniqueFacts(matchedGroups.flat()) : null;
  }
  if (own(condition, 'not')) {
    return conditionMatchFacts(condition.not, facts) === null ? [] : null;
  }

  const matched = facts.filter((fact) => predicateMatchesFact(condition, fact));
  return matched.length ? matched : null;
}

function propositionType(proposition) {
  if (proposition.subject.palace) return 'palace';
  if (proposition.subject.stars) return 'star';
  if (proposition.subject.mutagens) return 'mutagen';
  return 'period';
}

function propositionRelevant(proposition, template) {
  const topicMatches = proposition.topics.includes(template.topic)
    || (template.include_overall_context && proposition.topics.includes('overall'));
  return (
    topicMatches
    && template.school_order.includes(proposition.school)
    && template.scope_order.includes(proposition.scope)
  );
}

function propositionContextRole(proposition, template) {
  return proposition.topics.includes(template.topic) ? 'exact_topic' : 'overall_context';
}

function highestPriorityPalace(matchedFacts, template) {
  const matchedPalaces = new Set(matchedFacts.map((fact) => fact.palace).filter(Boolean));
  return template.palace_priority.find((palace) => matchedPalaces.has(palace)) || null;
}

function conclusionSortKey(conclusion, template) {
  const palaceOrder = template.palace_priority.indexOf(conclusion.palace);
  const readingOrder = template.reading_order.indexOf(conclusion.kind);
  const schoolOrder = template.school_order.indexOf(conclusion.school);
  return [
    palaceOrder < 0 ? Number.MAX_SAFE_INTEGER : palaceOrder,
    readingOrder < 0 ? Number.MAX_SAFE_INTEGER : readingOrder,
    schoolOrder < 0 ? Number.MAX_SAFE_INTEGER : schoolOrder,
    conclusion.proposition_id,
  ];
}

function compareKeys(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === right[index]) continue;
    if (typeof left[index] === 'number') return left[index] - right[index];
    return String(left[index]).localeCompare(String(right[index]), 'zh-CN');
  }
  return 0;
}

function validateReportOutput(
  report,
  { chart, knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT } = {},
) {
  if (
    !report
    || report.schema_version !== REPORT_SCHEMA_VERSION
    || typeof report.topic !== 'string'
    || !Array.isArray(report.conclusions)
  ) {
    throw makeReportError('REPORT_OUTPUT_INVALID', '报告输出结构或版本无效。');
  }

  const templates = loadReportTemplates({ knowledgeRoot });
  const template = templates.get(report.topic);
  if (!template || report.template_id !== template.id) {
    throw makeReportError('REPORT_TEMPLATE_UNKNOWN', `报告主题或模板不存在：${report.topic}`);
  }
  if (template.requires_horoscope && !chart?.horoscope) {
    throw makeReportError('REPORT_HOROSCOPE_REQUIRED', `${report.topic} 报告需要运限快照。`);
  }

  const propositions = loadPropositions(knowledgeRoot);
  const propositionById = new Map(propositions.map((item) => [item.id, item]));
  const sources = loadSources(knowledgeRoot);
  const safety = loadSafetyPolicy(knowledgeRoot);
  const chartFacts = projectChartFacts(chart, { knowledgeRoot });

  report.conclusions.forEach((conclusion, index) => {
    const label = conclusion?.proposition_id || `<conclusion:${index}>`;
    const proposition = propositionById.get(conclusion?.proposition_id);
    if (!proposition) {
      throw makeReportError('REPORT_PROPOSITION_UNKNOWN', `结论引用未知命题：${label}`);
    }
    if (proposition.status !== 'reviewed') {
      throw makeReportError('REPORT_PROPOSITION_UNREVIEWED', `${label} 尚未达到 reviewed。`);
    }
    if (!propositionRelevant(proposition, template)) {
      throw makeReportError('REPORT_PROPOSITION_OUT_OF_SCOPE', `${label} 不属于 ${report.topic} 报告。`);
    }
    if (conclusion.context_role !== propositionContextRole(proposition, template)) {
      throw makeReportError('REPORT_CONTEXT_ROLE_INVALID', `${label} 的主题角色标注不正确。`);
    }
    if (proposition.risk === 'high' || proposition.risk === 'prohibited') {
      throw makeReportError('REPORT_SAFETY_BLOCKED', `${label} 的风险等级禁止自动发布。`);
    }

    if (!Array.isArray(conclusion.matched_facts) || conclusion.matched_facts.length === 0) {
      throw makeReportError('REPORT_FACTS_MISSING', `${label} 缺少盘面命中事实。`);
    }
    const actualMatches = conditionMatchFacts(proposition.conditions, chartFacts);
    if (actualMatches === null) {
      throw makeReportError('REPORT_PROPOSITION_NOT_MATCHED', `${label} 未在当前命盘命中。`);
    }
    conclusion.matched_facts.forEach((fact) => {
      if (!chartFacts.some((chartFact) => valuesEqual(chartFact, fact))) {
        throw makeReportError('REPORT_FACT_NOT_IN_CHART', `${label} 包含不属于当前命盘的事实。`, fact);
      }
      if (!actualMatches.some((matchedFact) => valuesEqual(matchedFact, fact))) {
        throw makeReportError('REPORT_FACT_NOT_MATCHED', `${label} 的事实不能支撑该命题。`, fact);
      }
    });
    const palace = highestPriorityPalace(conclusion.matched_facts, template);
    if (!palace || conclusion.palace !== palace) {
      throw makeReportError('REPORT_FACT_OUT_OF_SCOPE', `${label} 未命中报告优先宫位。`);
    }

    if (!Array.isArray(conclusion.evidence_ids) || conclusion.evidence_ids.length === 0) {
      throw makeReportError('REPORT_EVIDENCE_MISSING', `${label} 缺少来源 ID。`);
    }
    conclusion.evidence_ids.forEach((sourceId) => {
      const source = sources.get(sourceId);
      if (!source) {
        throw makeReportError('REPORT_SOURCE_UNKNOWN', `${label} 引用未知来源：${sourceId}`);
      }
      if (!proposition.evidence.includes(sourceId)) {
        throw makeReportError(
          'REPORT_SOURCE_NOT_LINKED',
          `${sourceId} 未登记为 ${label} 的命题证据。`,
        );
      }
      if (source.ocr_status !== 'visually_verified') {
        throw makeReportError(
          'REPORT_SOURCE_UNREVIEWED',
          `${sourceId} 尚未完成视觉复核。`,
        );
      }
    });

    if (typeof conclusion.text !== 'string' || !conclusion.text.trim()) {
      throw makeReportError('REPORT_TEXT_MISSING', `${label} 缺少结论文本。`);
    }
    const forbidden = [
      ...safety.blocked_phrases,
      ...proposition.language_policy.forbidden_phrases,
    ];
    const blockedPhrase = forbidden.find((phrase) => conclusion.text.includes(phrase));
    if (blockedPhrase) {
      throw makeReportError(
        'REPORT_SAFETY_BLOCKED',
        `${label} 命中禁止发布短语：${blockedPhrase}`,
      );
    }
    if (conclusion.text !== proposition.claim.tendency) {
      throw makeReportError(
        'REPORT_TEXT_NOT_REVIEWED',
        `${label} 的结论文本不是已审核命题原文。`,
      );
    }
  });

  return {
    valid: true,
    conclusion_count: report.conclusions.length,
  };
}

function composeEvidenceReport({
  chart,
  topic,
  knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT,
}) {
  const templates = loadReportTemplates({ knowledgeRoot });
  const template = templates.get(topic);
  if (!template) {
    throw makeReportError('REPORT_TOPIC_UNKNOWN', `不支持的报告主题：${topic}`);
  }
  if (template.requires_horoscope && !chart?.horoscope) {
    throw makeReportError('REPORT_HOROSCOPE_REQUIRED', `${topic} 报告需要运限快照。`);
  }

  const facts = projectChartFacts(chart, { knowledgeRoot });
  const propositions = loadPropositions(knowledgeRoot);
  const conclusions = propositions
    .filter((proposition) => proposition.status === 'reviewed')
    .filter((proposition) => propositionRelevant(proposition, template))
    .map((proposition) => {
      const matchedFacts = conditionMatchFacts(proposition.conditions, facts);
      if (matchedFacts === null) return null;
      const palace = highestPriorityPalace(matchedFacts, template);
      if (!palace) return null;
      return {
        proposition_id: proposition.id,
        context_role: propositionContextRole(proposition, template),
        kind: propositionType(proposition),
        palace,
        text: proposition.claim.tendency,
        matched_facts: matchedFacts,
        evidence_ids: clone(proposition.evidence),
        school: proposition.school,
        scope: proposition.scope,
        confidence: proposition.confidence,
        risk: proposition.risk || 'low',
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareKeys(
      conclusionSortKey(left, template),
      conclusionSortKey(right, template),
    ));

  const report = {
    schema_version: REPORT_SCHEMA_VERSION,
    template_id: template.id,
    topic: template.topic,
    title: template.title,
    methodology: {
      school_order: clone(template.school_order),
      scope_order: clone(template.scope_order),
      palace_priority: clone(template.palace_priority),
      reading_order: clone(template.reading_order),
      safety_policy: template.evidence_policy.safety_policy,
    },
    conclusions,
    warnings: conclusions.length
      ? clone(chart.warnings || [])
      : [...clone(chart.warnings || []), 'ZIWEI_NO_REVIEWED_PROPOSITION_MATCHED'],
  };

  validateReportOutput(report, { chart, knowledgeRoot });
  return report;
}

function serializeError(error) {
  return {
    code: error.code || 'REPORT_ERROR',
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

if (require.main === module) {
  try {
    const rawInput = fs.readFileSync(0, 'utf8').trim();
    if (!rawInput) throw makeReportError('REPORT_INPUT_MISSING', '请通过 stdin 提供 JSON 输入。');
    const input = JSON.parse(rawInput);
    const result = composeEvidenceReport(input);
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } catch (error) {
    const normalized = error instanceof SyntaxError
      ? makeReportError('BAD_JSON', `stdin 不是合法 JSON：${error.message}`)
      : error;
    process.stderr.write(`${JSON.stringify({ ok: false, error: serializeError(normalized) })}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  REPORT_SCHEMA_VERSION,
  composeEvidenceReport,
  conditionMatchFacts,
  loadReportTemplates,
  projectChartFacts,
  validateReportOutput,
};
