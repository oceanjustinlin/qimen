'use strict';

/**
 * 紫微特征条件与可执行修正项（docs/ziwei-interpretation-model-design.md §6.3–6.4）。
 *
 * 条件只能引用 L1 派生特征，结构为 all / any / not 嵌套，叶子节点为
 * {feature, palace?, star?, path?, operator, value?}。只允许登记过的操作符，
 * 不支持正则、自由表达式或外部函数。
 */

const { FEATURES } = require('./ziweiFeatureDeriver.cjs');

const OPERATORS = new Set([
  'equals',
  'contains',
  'contains_any',
  'contains_all',
  'gte',
  'lte',
  'count_gte',
  'exists',
  'not_exists',
]);
const BINDINGS = new Set(['$matched_palace', '$subject_star']);
const EFFECTS = new Set(['strengthen', 'weaken', 'redirect', 'negate']);

function makeConditionError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isGroup(condition) {
  return own(condition, 'all') || own(condition, 'any') || own(condition, 'not');
}

function assertBindingToken(value, label) {
  if (typeof value === 'string' && value.startsWith('$') && !BINDINGS.has(value)) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 使用了未登记的绑定：${value}`);
  }
}

/** 编译期校验：结构、特征名、操作符和取值类型。 */
function assertFeatureCondition(condition, label = '<condition>') {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的条件结构无效。`);
  }
  if (isGroup(condition)) {
    const keys = Object.keys(condition);
    if (keys.length !== 1) {
      throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的条件组只能有一个键。`);
    }
    if (own(condition, 'not')) {
      assertFeatureCondition(condition.not, label);
      return;
    }
    const items = condition[keys[0]];
    if (!Array.isArray(items) || items.length === 0) {
      throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的 ${keys[0]} 必须是非空数组。`);
    }
    items.forEach((item) => assertFeatureCondition(item, label));
    return;
  }

  if (!FEATURES.includes(condition.feature)) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 引用了未登记的特征：${condition.feature}`);
  }
  if (!OPERATORS.has(condition.operator)) {
    throw makeConditionError('FEATURE_OPERATOR_UNSUPPORTED', `${label} 使用了不受支持的操作符：${condition.operator}`);
  }
  assertBindingToken(condition.palace, label);
  assertBindingToken(condition.star, label);
  assertBindingToken(condition.value, label);

  const { operator, value } = condition;
  if (operator === 'exists' || operator === 'not_exists') {
    if (own(condition, 'value')) {
      throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的 ${operator} 不接受 value。`);
    }
    return;
  }
  if (!own(condition, 'value')) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的 ${operator} 缺少 value。`);
  }
  if (['gte', 'lte', 'count_gte'].includes(operator) && !Number.isFinite(value)) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的 ${operator} 要求数值 value。`);
  }
  if (['contains_any', 'contains_all'].includes(operator) && (!Array.isArray(value) || value.length === 0)) {
    throw makeConditionError('FEATURE_CONDITION_INVALID', `${label} 的 ${operator} 要求非空数组 value。`);
  }
}

function resolveBinding(value, bindings) {
  if (typeof value !== 'string' || !value.startsWith('$')) return value;
  const key = value.slice(1);
  if (!BINDINGS.has(value) || bindings[key] === undefined || bindings[key] === null) {
    throw makeConditionError('FEATURE_BINDING_MISSING', `条件绑定 ${value} 没有可用取值。`);
  }
  return bindings[key];
}

function readPath(value, pathExpression) {
  if (!pathExpression) return value;
  return String(pathExpression).split('.').reduce(
    (current, key) => (current !== null && current !== undefined && own(Object(current), key)
      ? current[key]
      : undefined),
    value,
  );
}

function itemMatches(item, expected) {
  if (item === expected) return true;
  return Boolean(item && typeof item === 'object' && item.star === expected);
}

function contains(actual, expected) {
  if (Array.isArray(actual)) return actual.some((item) => itemMatches(item, expected));
  if (typeof actual === 'string') return actual.includes(expected);
  return false;
}

function compare(operator, actual, expected) {
  switch (operator) {
    case 'equals':
      return JSON.stringify(actual) === JSON.stringify(expected);
    case 'contains':
      return contains(actual, expected);
    case 'contains_any':
      return expected.some((item) => contains(actual, item));
    case 'contains_all':
      return expected.every((item) => contains(actual, item));
    case 'gte':
      return Number.isFinite(actual) && actual >= expected;
    case 'lte':
      return Number.isFinite(actual) && actual <= expected;
    case 'count_gte':
      return Array.isArray(actual) && actual.length >= expected;
    case 'exists':
      return actual !== undefined && actual !== null;
    default:
      throw makeConditionError('FEATURE_OPERATOR_UNSUPPORTED', `不受支持的操作符：${operator}`);
  }
}

function evaluateLeaf(leaf, featureSet, bindings) {
  const palace = resolveBinding(leaf.palace, bindings);
  const star = resolveBinding(leaf.star, bindings);
  const expected = resolveBinding(leaf.value, bindings);
  const candidates = featureSet.features.filter((feature) => (
    feature.feature === leaf.feature
    && (palace === undefined || feature.palace === palace)
    && (star === undefined || feature.star === star)
  ));

  if (leaf.operator === 'not_exists') {
    const present = candidates.some((feature) => compare('exists', readPath(feature.value, leaf.path)));
    return present ? null : [];
  }
  const matched = candidates.filter((feature) => (
    compare(leaf.operator, readPath(feature.value, leaf.path), expected)
  ));
  return matched.length ? matched.map((feature) => feature.feature_id) : null;
}

/**
 * 求值条件，命中时返回支撑的 feature_id 列表（可能为空，例如 not_exists），未命中返回 null。
 */
function evaluateFeatureCondition(condition, featureSet, bindings = {}) {
  if (own(condition, 'all')) {
    const groups = condition.all.map((item) => evaluateFeatureCondition(item, featureSet, bindings));
    if (groups.some((group) => group === null)) return null;
    return [...new Set(groups.flat())].sort();
  }
  if (own(condition, 'any')) {
    const groups = condition.any
      .map((item) => evaluateFeatureCondition(item, featureSet, bindings))
      .filter((group) => group !== null);
    return groups.length ? [...new Set(groups.flat())].sort() : null;
  }
  if (own(condition, 'not')) {
    return evaluateFeatureCondition(condition.not, featureSet, bindings) === null ? [] : null;
  }
  return evaluateLeaf(condition, featureSet, bindings);
}

function collectFeatures(condition, output = new Set()) {
  if (own(condition, 'all')) condition.all.forEach((item) => collectFeatures(item, output));
  else if (own(condition, 'any')) condition.any.forEach((item) => collectFeatures(item, output));
  else if (own(condition, 'not')) collectFeatures(condition.not, output);
  else output.add(condition.feature);
  return output;
}

function assertModifiers(proposition) {
  const ids = new Set();
  (proposition.modifiers || []).forEach((modifier) => {
    const label = `${proposition.id}/${modifier?.id}`;
    if (ids.has(modifier.id)) {
      throw makeConditionError('FEATURE_MODIFIER_DUPLICATE', `修正项 ID 重复：${label}`);
    }
    ids.add(modifier.id);
    if (!EFFECTS.has(modifier.effect)) {
      throw makeConditionError('FEATURE_MODIFIER_INVALID', `${label} 的 effect 无效：${modifier.effect}`);
    }
    assertFeatureCondition(modifier.when, label);
  });
}

/**
 * 逐条求值命题的可执行修正项。
 * 门禁顺序：来源已视觉复核 → 所用特征方法为 reviewed（可用 allowPendingMethods 放开，仅限测试/trace）→ 条件命中。
 */
function evaluateModifiers(proposition, featureSet, { sources, bindings = {}, allowPendingMethods = false } = {}) {
  if (!(sources instanceof Map)) {
    throw makeConditionError('FEATURE_MODIFIER_INVALID', 'evaluateModifiers 需要来源 Map。');
  }
  assertModifiers(proposition);
  const applied = [];
  const skipped = [];

  (proposition.modifiers || []).forEach((modifier) => {
    const unverified = modifier.evidence.filter((id) => sources.get(id)?.ocr_status !== 'visually_verified');
    if (unverified.length) {
      skipped.push({ modifier_id: modifier.id, reason: 'evidence_unverified', details: unverified });
      return;
    }
    const pending = [...collectFeatures(modifier.when)]
      .filter((feature) => featureSet.methods?.[feature]?.status !== 'reviewed')
      .sort();
    if (pending.length && !allowPendingMethods) {
      skipped.push({ modifier_id: modifier.id, reason: 'feature_method_pending_source', details: pending });
      return;
    }
    const matched = evaluateFeatureCondition(modifier.when, featureSet, bindings);
    if (matched === null) {
      skipped.push({ modifier_id: modifier.id, reason: 'condition_not_met' });
      return;
    }
    applied.push({
      modifier_id: modifier.id,
      effect: modifier.effect,
      matched_feature_ids: matched,
      evidence_ids: [...modifier.evidence],
    });
  });

  return { applied, skipped };
}

module.exports = {
  BINDINGS,
  EFFECTS,
  OPERATORS,
  assertFeatureCondition,
  assertModifiers,
  evaluateFeatureCondition,
  evaluateModifiers,
};
