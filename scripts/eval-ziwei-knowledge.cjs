#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const { run: runZiweiCli } = require('./ziwei_cli.cjs');
const { compileRules } = require('./ziwei_rule_compile.cjs');
const { evaluateCompiledRules } = require('./ziwei_rule_eval.cjs');
const {
  composeEvidenceReport,
  conditionMatchFacts,
  validateReportOutput,
} = require('./ziwei_report_evidence.cjs');

const DEFAULT_KNOWLEDGE_ROOT = path.join(__dirname, '..', 'knowledge', 'ziwei');
const DEFAULT_FIXTURE_PATH = path.join(
  DEFAULT_KNOWLEDGE_ROOT,
  'fixtures',
  'regression-cases',
  'baseline-v1.json',
);
const INTERPRETATION_FILES = [
  'interpretations/palaces/core-palaces.yaml',
  'interpretations/stars/major-stars.yaml',
  'interpretations/transformations/core-mutagens.yaml',
];

function makeEvalError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
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

function ratio(numerator, denominator) {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(6));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPropositions(knowledgeRoot) {
  return INTERPRETATION_FILES.flatMap((relativePath) => {
    const document = YAML.parse(fs.readFileSync(path.join(knowledgeRoot, relativePath), 'utf8'));
    if (
      document?.schema_version !== 'ziwei-interpretations/v1'
      || !Array.isArray(document.propositions)
    ) {
      throw makeEvalError(
        'ZIWEI_EVAL_PROPOSITIONS_INVALID',
        `解释命题文件无效：${relativePath}`,
      );
    }
    return document.propositions;
  });
}

function evaluateP0Rules(knowledgeRoot) {
  const compiled = compileRules({ knowledgeRoot });
  const fixture = loadJson(path.join(
    knowledgeRoot,
    'fixtures',
    'rule-cases',
    'p0-rules.json',
  ));
  let passedCaseCount = 0;
  let conflictCount = 0;
  const cases = fixture.cases.map((fixtureCase) => {
    try {
      const result = evaluateCompiledRules(compiled, { facts: fixtureCase.input });
      const match = result.matches.find((item) => item.rule_id === fixtureCase.rule_id);
      const passed = Boolean(match) && valuesEqual(match.value, fixtureCase.expected);
      if (passed) passedCaseCount += 1;
      return {
        id: fixtureCase.id,
        rule_id: fixtureCase.rule_id,
        passed,
        actual: match ? match.value : null,
      };
    } catch (error) {
      const conflict = error.code === 'RULE_FACT_CONFLICT';
      if (conflict) conflictCount += 1;
      return {
        id: fixtureCase.id,
        rule_id: fixtureCase.rule_id,
        passed: false,
        error: {
          code: error.code || 'RULE_EVAL_ERROR',
          message: error.message,
        },
      };
    }
  });

  return {
    metrics: {
      compiled_rule_count: compiled.rule_count,
      case_count: cases.length,
      passed_case_count: passedCaseCount,
      rule_hit_rate: ratio(passedCaseCount, cases.length),
      conflict_count: conflictCount,
      conflict_rate: ratio(conflictCount, cases.length),
    },
    source_digest: compiled.source_digest,
    cases,
  };
}

function evaluateP1Interpretations(knowledgeRoot) {
  const propositions = loadPropositions(knowledgeRoot);
  const fixture = loadJson(path.join(
    knowledgeRoot,
    'fixtures',
    'report-cases',
    'core-interpretations.json',
  ));
  let passedCaseCount = 0;
  const cases = fixture.cases.map((fixtureCase) => {
    const matchedIds = propositions
      .filter((proposition) => conditionMatchFacts(proposition.conditions, fixtureCase.facts) !== null)
      .map((proposition) => proposition.id);
    const expectedMatches = fixtureCase.expected_matches;
    const expectedNonMatchesAbsent = fixtureCase.expected_non_matches.every((id) => (
      !matchedIds.includes(id)
    ));
    const passed = valuesEqual(matchedIds, expectedMatches) && expectedNonMatchesAbsent;
    if (passed) passedCaseCount += 1;
    return {
      id: fixtureCase.id,
      passed,
      matched_ids: matchedIds,
    };
  });

  return {
    metrics: {
      reviewed_proposition_count: propositions.filter((item) => item.status === 'reviewed').length,
      case_count: cases.length,
      passed_case_count: passedCaseCount,
      interpretation_hit_rate: ratio(passedCaseCount, cases.length),
    },
    cases,
  };
}

function evaluateReports(knowledgeRoot, fixture) {
  let reportCount = 0;
  let conclusionCount = 0;
  let noEvidenceConclusionCount = 0;
  let invalidReportCount = 0;
  const cases = fixture.report_cases.map((fixtureCase) => {
    const chart = runZiweiCli({
      mode: 'natal',
      profile_snapshot: fixtureCase.profile,
      target_datetime: fixtureCase.target_datetime,
      options: { include_horoscope: true },
    });
    const topics = {};

    fixture.report_topics.forEach((topic) => {
      reportCount += 1;
      try {
        const report = composeEvidenceReport({ chart, topic, knowledgeRoot });
        validateReportOutput(report, { chart, knowledgeRoot });
        const count = report.conclusions.length;
        const expectedCount = fixtureCase.expected_conclusion_counts[topic];
        const countMatches = count === expectedCount;
        conclusionCount += count;
        noEvidenceConclusionCount += report.conclusions.filter((conclusion) => (
          !Array.isArray(conclusion.matched_facts)
          || conclusion.matched_facts.length === 0
          || !Array.isArray(conclusion.evidence_ids)
          || conclusion.evidence_ids.length === 0
        )).length;
        if (!countMatches) invalidReportCount += 1;
        topics[topic] = {
          passed: countMatches,
          conclusion_count: count,
          expected_conclusion_count: expectedCount,
        };
      } catch (error) {
        invalidReportCount += 1;
        topics[topic] = {
          passed: false,
          error: {
            code: error.code || 'REPORT_EVAL_ERROR',
            message: error.message,
          },
        };
      }
    });

    return {
      id: fixtureCase.id,
      passed: Object.values(topics).every((topic) => topic.passed),
      topics,
    };
  });

  return {
    metrics: {
      profile_count: fixture.report_cases.length,
      report_count: reportCount,
      conclusion_count: conclusionCount,
      no_evidence_conclusion_count: noEvidenceConclusionCount,
      invalid_report_count: invalidReportCount,
    },
    cases,
  };
}

function evaluateZiweiKnowledge({
  knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT,
  fixturePath = DEFAULT_FIXTURE_PATH,
} = {}) {
  const fixture = loadJson(fixturePath);
  if (
    fixture?.schema_version !== 'ziwei-knowledge-regression-cases/v1'
    || fixture?.privacy?.origin !== 'synthetic'
    || fixture?.privacy?.contains_real_identity !== false
  ) {
    throw makeEvalError(
      'ZIWEI_EVAL_FIXTURE_INVALID',
      '知识回归 fixture 必须声明为不含真实身份的 synthetic 数据。',
    );
  }

  const p0 = evaluateP0Rules(knowledgeRoot);
  const p1 = evaluateP1Interpretations(knowledgeRoot);
  const reports = evaluateReports(knowledgeRoot, fixture);
  const metrics = {
    p0: p0.metrics,
    p1: p1.metrics,
    reports: reports.metrics,
  };
  const thresholds = fixture.thresholds;
  const checks = {
    p0_rule_hit_rate: metrics.p0.rule_hit_rate >= thresholds.p0_rule_hit_rate_min,
    p0_conflict_rate: metrics.p0.conflict_rate <= thresholds.p0_conflict_rate_max,
    p1_interpretation_hit_rate: (
      metrics.p1.interpretation_hit_rate >= thresholds.p1_interpretation_hit_rate_min
    ),
    no_evidence_conclusion_count: (
      metrics.reports.no_evidence_conclusion_count
      <= thresholds.no_evidence_conclusion_count_max
    ),
    invalid_report_count: (
      metrics.reports.invalid_report_count <= thresholds.invalid_report_count_max
    ),
    baseline_exact_match: valuesEqual(metrics, fixture.expected_baseline),
  };

  return {
    schema_version: 'ziwei-knowledge-evaluation/v1',
    baseline_id: fixture.baseline_id,
    source_digest: p0.source_digest,
    metrics,
    thresholds,
    checks,
    passed: Object.values(checks).every(Boolean),
    details: {
      p0_cases: p0.cases,
      p1_cases: p1.cases,
      report_cases: reports.cases,
    },
  };
}

function serializeError(error) {
  return {
    code: error.code || 'ZIWEI_EVAL_ERROR',
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

if (require.main === module) {
  try {
    const assertBaseline = process.argv.includes('--assert-baseline');
    const fixtureFlagIndex = process.argv.indexOf('--fixture');
    const fixturePath = fixtureFlagIndex >= 0 ? process.argv[fixtureFlagIndex + 1] : undefined;
    if (fixtureFlagIndex >= 0 && (!fixturePath || fixturePath.startsWith('--'))) {
      throw makeEvalError('ZIWEI_EVAL_FIXTURE_MISSING', '--fixture 必须提供 JSON 文件路径。');
    }
    const result = evaluateZiweiKnowledge({
      ...(fixturePath ? { fixturePath: path.resolve(fixturePath) } : {}),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    if (assertBaseline && !result.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: serializeError(error) })}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  evaluateZiweiKnowledge,
};
