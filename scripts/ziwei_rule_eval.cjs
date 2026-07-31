#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { compileRules } = require('./ziwei_rule_compile.cjs');

const EVALUATION_SCHEMA_VERSION = 'ziwei-rule-evaluation/v1';
const PREDICATE_OPERATORS = new Set([
  'equals',
  'contains',
  'between',
  'same_palace',
  'opposite',
  'trine',
  'has_mutagen',
]);
const DERIVATION_OPERATORS = new Set([
  'opposite',
  'trine',
  'palace_offset',
  'assign',
]);

function makeRuleError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function positiveModulo(value, modulus) {
  if (!Number.isFinite(value) || !Number.isInteger(modulus) || modulus <= 0) {
    throw makeRuleError('RULE_ARGUMENT_INVALID', '取模运算要求有限数值和正整数模数。');
  }
  return ((value % modulus) + modulus) % modulus;
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertConditionOperators(condition, ruleId) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    throw makeRuleError('RULE_CONDITION_INVALID', `${ruleId} 的条件结构无效。`);
  }
  if (own(condition, 'all') || own(condition, 'any')) {
    const key = own(condition, 'all') ? 'all' : 'any';
    if (!Array.isArray(condition[key])) {
      throw makeRuleError('RULE_CONDITION_INVALID', `${ruleId} 的 ${key} 必须是数组。`);
    }
    condition[key].forEach((item) => assertConditionOperators(item, ruleId));
    return;
  }
  if (own(condition, 'not')) {
    assertConditionOperators(condition.not, ruleId);
    return;
  }
  if (!PREDICATE_OPERATORS.has(condition.operator)) {
    throw makeRuleError(
      'RULE_OPERATOR_UNSUPPORTED',
      `${ruleId} 使用了不受支持的条件操作符：${condition.operator}`,
    );
  }
}

function assertCompiledRules(compiled) {
  if (
    !compiled
    || compiled.schema_version !== 'ziwei-compiled-rules/v1'
    || !Array.isArray(compiled.rules)
  ) {
    throw makeRuleError('RULE_COMPILED_INVALID', '编译规则包结构无效。');
  }
  if (compiled.rule_count !== compiled.rules.length) {
    throw makeRuleError('RULE_COMPILED_INVALID', '编译规则数量与 rule_count 不一致。');
  }

  compiled.rules.forEach((rule, index) => {
    const ruleId = rule?.id || `<rule:${index}>`;
    assertConditionOperators(rule?.when, ruleId);
    if (!DERIVATION_OPERATORS.has(rule?.derive?.operator)) {
      throw makeRuleError(
        'RULE_OPERATOR_UNSUPPORTED',
        `${ruleId} 使用了不受支持的派生操作符：${rule?.derive?.operator}`,
      );
    }
  });
}

function resolveExpected(value, facts) {
  if (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.input === 'string'
  ) {
    if (!own(facts, value.input)) {
      throw makeRuleError('RULE_INPUT_MISSING', `缺少规则事实：${value.input}`);
    }
    return facts[value.input];
  }
  return value;
}

function evaluatePredicate(predicate, facts) {
  const actual = facts[predicate.fact];
  const expected = resolveExpected(predicate.value, facts);

  switch (predicate.operator) {
    case 'equals':
    case 'same_palace':
      return valuesEqual(actual, expected);
    case 'contains':
      if (Array.isArray(actual) || typeof actual === 'string') return actual.includes(expected);
      if (actual && typeof actual === 'object') return own(actual, expected);
      return false;
    case 'between':
      return (
        Number.isFinite(actual)
        && Array.isArray(expected)
        && expected.length === 2
        && Number.isFinite(expected[0])
        && Number.isFinite(expected[1])
        && actual >= expected[0]
        && actual <= expected[1]
      );
    case 'opposite':
      return (
        Number.isInteger(actual)
        && Number.isInteger(expected)
        && positiveModulo(actual - expected, 12) === 6
      );
    case 'trine': {
      if (!Number.isInteger(actual) || !Number.isInteger(expected)) return false;
      const distance = positiveModulo(actual - expected, 12);
      return distance === 4 || distance === 8;
    }
    case 'has_mutagen':
      if (Array.isArray(actual)) {
        return actual.some((item) => (
          item === expected
          || (item && typeof item === 'object' && (
            item.mutagen === expected
            || item.name === expected
          ))
        ));
      }
      if (actual && typeof actual === 'object') {
        return own(actual, expected)
          ? Boolean(actual[expected])
          : Object.values(actual).includes(expected);
      }
      return actual === expected;
    default:
      throw makeRuleError(
        'RULE_OPERATOR_UNSUPPORTED',
        `不受支持的条件操作符：${predicate.operator}`,
      );
  }
}

function evaluateCondition(condition, facts) {
  if (own(condition, 'all')) {
    return condition.all.every((item) => evaluateCondition(item, facts));
  }
  if (own(condition, 'any')) {
    return condition.any.some((item) => evaluateCondition(item, facts));
  }
  if (own(condition, 'not')) {
    return !evaluateCondition(condition.not, facts);
  }
  return evaluatePredicate(condition, facts);
}

function resolveNumericTerm(term, facts) {
  if (Number.isFinite(term)) return term;
  if (typeof term === 'string') {
    if (!own(facts, term) || !Number.isFinite(facts[term])) {
      throw makeRuleError('RULE_INPUT_INVALID', `${term} 必须是有限数值。`);
    }
    return facts[term];
  }
  if (!term || typeof term !== 'object' || typeof term.input !== 'string') {
    throw makeRuleError('RULE_ARGUMENT_INVALID', '位移参数必须是数值、事实名或 input 表达式。');
  }
  if (!own(facts, term.input) || !Number.isFinite(facts[term.input])) {
    throw makeRuleError('RULE_INPUT_INVALID', `${term.input} 必须是有限数值。`);
  }

  let value = facts[term.input];
  if (own(term, 'subtract')) {
    if (!Number.isFinite(term.subtract)) {
      throw makeRuleError('RULE_ARGUMENT_INVALID', 'subtract 必须是有限数值。');
    }
    value -= term.subtract;
  }
  if (own(term, 'modulo')) value = positiveModulo(value, term.modulo);
  return value;
}

function deriveValue(derivation, facts) {
  const args = derivation.arguments || {};
  switch (derivation.operator) {
    case 'assign':
      if (!own(args, 'value')) {
        throw makeRuleError('RULE_ARGUMENT_INVALID', 'assign 操作必须提供 value。');
      }
      return clone(args.value);
    case 'opposite': {
      const modulus = args.modulus ?? 12;
      const offset = args.offset ?? 6;
      return positiveModulo(resolveNumericTerm(args.start, facts) + offset, modulus);
    }
    case 'trine': {
      const start = resolveNumericTerm(args.start, facts);
      const modulus = args.modulus ?? 12;
      if (!Array.isArray(args.offsets) || args.offsets.some((item) => !Number.isFinite(item))) {
        throw makeRuleError('RULE_ARGUMENT_INVALID', 'trine 操作必须提供数值 offsets。');
      }
      return args.offsets.map((offset) => positiveModulo(start + offset, modulus));
    }
    case 'palace_offset': {
      const modulus = args.modulus ?? 12;
      let value = resolveNumericTerm(args.start, facts);
      const forward = args.forward || [];
      const reverse = args.reverse || [];
      if (!Array.isArray(forward) || !Array.isArray(reverse)) {
        throw makeRuleError('RULE_ARGUMENT_INVALID', 'forward 和 reverse 必须是数组。');
      }
      forward.forEach((term) => {
        value += resolveNumericTerm(term, facts);
      });
      reverse.forEach((term) => {
        value -= resolveNumericTerm(term, facts);
      });
      return positiveModulo(value, modulus);
    }
    default:
      throw makeRuleError(
        'RULE_OPERATOR_UNSUPPORTED',
        `不受支持的派生操作符：${derivation.operator}`,
      );
  }
}

function extractFocus(chart, context, facts) {
  const palaceKey = context?.focus_palace_key;
  if (!palaceKey) return null;
  const palaces = chart?.natal?.palaces;
  if (!Array.isArray(palaces)) {
    throw makeRuleError('RULE_CHART_INVALID', '命盘缺少 natal.palaces。');
  }
  const palace = palaces.find((item) => item?.palace_key === palaceKey);
  if (!palace || !Number.isInteger(palace.index)) {
    throw makeRuleError('RULE_FOCUS_NOT_FOUND', `命盘中找不到宫位：${palaceKey}`);
  }
  if (own(facts, 'palace_index') && facts.palace_index !== palace.index) {
    throw makeRuleError('RULE_FACT_CONFLICT', 'palace_index 与 focus_palace_key 不一致。');
  }
  facts.palace_index = palace.index;
  return {
    palace_key: palace.palace_key,
    index: palace.index,
  };
}

function evaluateCompiledRules(compiled, input = {}) {
  assertCompiledRules(compiled);
  const facts = clone(input.facts || {});
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    throw makeRuleError('RULE_FACTS_INVALID', 'facts 必须是对象。');
  }
  const focus = extractFocus(input.chart, input.context, facts);
  const derivedFacts = {};
  const matches = [];
  const processedRuleIds = new Set();

  while (true) {
    const availableAtRoundStart = new Set(Object.keys(facts));
    let processedThisRound = 0;

    compiled.rules.forEach((rule) => {
      if (processedRuleIds.has(rule.id)) return;
      if (!rule.inputs.every((inputName) => availableAtRoundStart.has(inputName))) return;

      processedRuleIds.add(rule.id);
      processedThisRound += 1;
      if (!evaluateCondition(rule.when, facts)) return;

      const value = deriveValue(rule.derive, facts);
      const factName = rule.derive.fact;
      if (own(facts, factName) && !valuesEqual(facts[factName], value)) {
        throw makeRuleError(
          'RULE_FACT_CONFLICT',
          `${rule.id} 派生的 ${factName} 与已有事实冲突。`,
        );
      }
      facts[factName] = clone(value);
      derivedFacts[factName] = clone(value);
      matches.push({
        rule_id: rule.id,
        fact: factName,
        value: clone(value),
        school: rule.school,
        scope: rule.scope,
        confidence: rule.confidence,
        evidence: clone(rule.evidence),
      });
    });

    if (processedThisRound === 0) break;
  }

  return {
    schema_version: EVALUATION_SCHEMA_VERSION,
    source_digest: compiled.source_digest,
    focus,
    derived_facts: derivedFacts,
    matches,
  };
}

function serializeError(error) {
  return {
    code: error.code || 'RULE_EVALUATION_FAILED',
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

if (require.main === module) {
  try {
    const rawInput = fs.readFileSync(0, 'utf8').trim();
    if (!rawInput) throw makeRuleError('RULE_INPUT_MISSING', '请通过 stdin 提供 JSON 输入。');
    const input = JSON.parse(rawInput);
    const result = evaluateCompiledRules(compileRules(), input);
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } catch (error) {
    const normalized = error instanceof SyntaxError
      ? makeRuleError('BAD_JSON', `stdin 不是合法 JSON：${error.message}`)
      : error;
    process.stderr.write(`${JSON.stringify({ ok: false, error: serializeError(normalized) })}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  EVALUATION_SCHEMA_VERSION,
  evaluateCompiledRules,
};
