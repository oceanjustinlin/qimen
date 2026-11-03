'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { run: runZiweiCli } = require('./ziwei_cli.cjs');
const {
  FEATURES,
  NATAL_FEATURES,
  deriveFeatureSet,
  loadFeatureKnowledge,
} = require('../lib/ziweiFeatureDeriver.cjs');
const {
  assertFeatureCondition,
  evaluateFeatureCondition,
  evaluateModifiers,
} = require('../lib/ziweiFeatureConditions.cjs');
const { deriveDynamicFeatureSet } = require('../lib/ziweiDynamicFeatures.cjs');

const KNOWLEDGE_ROOT = path.join(__dirname, '..', 'knowledge', 'ziwei');
const VERIFIED_SOURCE = 'source.mingli-tianji.p273.pojun';

// 虚构测试盘：命宫破军（子），三方为七杀、贪狼，官禄见地劫、迁移见空火。
function buildChart({ withHoroscope = false } = {}) {
  return runZiweiCli({
    mode: 'natal',
    profile_snapshot: {
      profile_id: 'fictional-feature-case',
      gender: '男',
      birth_date: '1990-05-15 10:30:00',
      adjusted_birth_date: '1990-05-15 10:30:00',
      solar_time_mode: 'clock',
      solar_time_adjustment_minutes: 0,
    },
    ...(withHoroscope
      ? { target_datetime: '2026-11-03 12:00:00', options: { include_horoscope: true } }
      : {}),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function find(featureSet, feature, palace, extra = () => true) {
  return featureSet.features.filter((item) => (
    item.feature === feature && item.palace === palace && extra(item)
  ));
}

function sources() {
  return new Map([
    [VERIFIED_SOURCE, { id: VERIFIED_SOURCE, ocr_status: 'visually_verified' }],
    ['source.example.unverified', { id: 'source.example.unverified', ocr_status: 'extracted' }],
  ]);
}

test('特征方法全部登记，未补来源的方法保持 pending_source', () => {
  const { methods } = loadFeatureKnowledge({ knowledgeRoot: KNOWLEDGE_ROOT });
  assert.deepEqual([...methods.keys()].sort(), [...FEATURES].sort());
  const reviewed = [...methods.values()].filter((method) => method.status === 'reviewed');
  assert.deepEqual(
    reviewed.map((method) => method.feature).sort(),
    ['overlay_map', 'palace_star_system', 'period_mutagen', 'relation_set'].sort(),
  );
  reviewed.filter((method) => method.basis === 'chart_fact').forEach((method) => {
    assert.equal(method.school, 'iztro-default', method.id);
  });
});

test('reviewed 方法缺少来源或依赖未审核本体时拒绝加载', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziwei-features-'));
  fs.cpSync(KNOWLEDGE_ROOT, root, { recursive: true });
  const methodsPath = path.join(root, 'rules', 'derivation', 'feature-methods.yaml');
  const original = JSON.parse(fs.readFileSync(methodsPath, 'utf8'));

  const promoteSanfang = clone(original);
  promoteSanfang.methods.find((m) => m.feature === 'sanfang_aggregate').status = 'reviewed';
  fs.writeFileSync(methodsPath, JSON.stringify(promoteSanfang));
  assert.throws(
    () => loadFeatureKnowledge({ knowledgeRoot: root }),
    (error) => error.code === 'FEATURE_METHOD_STATUS_INVALID',
  );

  const sanfangWithSource = clone(promoteSanfang);
  sanfangWithSource.methods.find((m) => m.feature === 'sanfang_aggregate').evidence = [VERIFIED_SOURCE];
  fs.writeFileSync(methodsPath, JSON.stringify(sanfangWithSource));
  assert.throws(
    () => loadFeatureKnowledge({ knowledgeRoot: root }),
    (error) => error.code === 'FEATURE_METHOD_STATUS_INVALID' && /依赖未审核/.test(error.message),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('派生结果确定、不修改命盘，且只含本命特征', () => {
  const chart = buildChart({ withHoroscope: true });
  const before = clone(chart);
  const first = deriveFeatureSet(chart);
  const second = deriveFeatureSet(chart);

  assert.deepEqual(second, first);
  assert.deepEqual(chart, before);
  assert.equal(first.schema_version, 'ziwei-feature-set/v1');
  assert.equal(new Set(first.features.map((item) => item.feature_id)).size, first.features.length);
  first.features.forEach((item) => {
    assert.equal(item.scope, 'natal');
    assert.ok(item.origin.paths.length > 0, item.feature_id);
    assert.ok(item.origin.paths.every((p) => p.startsWith('natal.')), item.feature_id);
    assert.equal(item.method.status, first.methods[item.feature].status);
  });
  assert.equal(first.features.some((item) => item.palace === '仆役宫'), false);
  assert.deepEqual(Object.keys(first.methods).sort(), [...NATAL_FEATURES].sort());
});

test('星系、关系与亮度特征', () => {
  const featureSet = deriveFeatureSet(buildChart());

  assert.equal(featureSet.features.filter((f) => f.feature === 'palace_star_system').length, 12);
  assert.deepEqual(find(featureSet, 'palace_star_system', '命宫')[0].value, { stars: ['破军'], empty: false });
  assert.deepEqual(find(featureSet, 'palace_star_system', '迁移宫')[0].value.stars, ['廉贞', '天相']);

  const relation = find(featureSet, 'relation_set', '命宫')[0].value;
  assert.equal(relation.opposite, '迁移宫');
  assert.deepEqual([...relation.trine].sort(), ['官禄宫', '财帛宫'].sort());
  assert.deepEqual([...relation.adjacent].sort(), ['兄弟宫', '父母宫'].sort());

  assert.deepEqual(find(featureSet, 'brightness_state', '命宫', (f) => f.star === '破军')[0].value, { label: '庙', rank: 7 });
  assert.deepEqual(find(featureSet, 'brightness_state', '兄弟宫', (f) => f.star === '太阳')[0].value, { label: '陷', rank: 1 });
});

test('三方四正汇总保留所在宫和关系类型', () => {
  const featureSet = deriveFeatureSet(buildChart());
  const aggregate = find(featureSet, 'sanfang_aggregate', '命宫')[0].value;

  assert.deepEqual(
    aggregate.malefic.map((item) => `${item.star}@${item.palace}/${item.relation}`).sort(),
    ['地空@迁移宫/opposite', '火星@迁移宫/opposite', '地劫@官禄宫/trine', '铃星@财帛宫/trine'].sort(),
  );
  assert.deepEqual(aggregate.auspicious, []);
  assert.deepEqual(aggregate.lucun, [{ star: '禄存', palace: '财帛宫', relation: 'trine' }]);
  assert.deepEqual(aggregate.mutagens, []);

  const fuqi = find(featureSet, 'sanfang_aggregate', '夫妻宫')[0].value;
  assert.ok(fuqi.mutagens.some((item) => item.star === '武曲' && item.mutagen === '权' && item.relation === 'self'));
});

test('夹宫识别成对星分居前后邻宫', () => {
  const featureSet = deriveFeatureSet(buildChart());
  const pairsOf = (palace) => find(featureSet, 'jia_palace', palace)[0].value.pairs.map((p) => p.pair_id);

  assert.deepEqual(pairsOf('财帛宫'), ['qingyang-tuoluo']);
  assert.deepEqual(pairsOf('疾厄宫'), ['huoxing-lingxing']);
  assert.deepEqual(pairsOf('交友宫'), ['dikong-dijie']);
  assert.deepEqual(pairsOf('命宫'), []);
});

test('宫干飞化与 iztro 四化表一致，并标出自化与化忌所冲之宫', () => {
  const chart = buildChart();
  const featureSet = deriveFeatureSet(chart);
  const ming = find(featureSet, 'flying_mutagen', '命宫').map((item) => item.value);

  assert.deepEqual(ming, [
    { stem: '戊', mutagen: '禄', star: '贪狼', to_palace: '官禄宫', self: false, clash_palace: null },
    { stem: '戊', mutagen: '权', star: '太阴', to_palace: '田宅宫', self: false, clash_palace: null },
    { stem: '戊', mutagen: '科', star: '右弼', to_palace: '疾厄宫', self: false, clash_palace: null },
    { stem: '戊', mutagen: '忌', star: '天机', to_palace: '父母宫', self: false, clash_palace: '疾厄宫' },
  ]);
  const selfMutagens = featureSet.features
    .filter((item) => item.feature === 'flying_mutagen' && item.value.self)
    .map((item) => `${item.palace}${item.value.mutagen}${item.value.star}`);
  assert.deepEqual(selfMutagens.sort(), ['交友宫忌文昌', '交友宫禄巨门'].sort());

  // 生年干（庚）飞化应与 CLI 的本命四化一致。
  const birthStemPalace = chart.natal.palaces.find((p) => p.heavenly_stem === '庚');
  const fromBirthStem = find(featureSet, 'flying_mutagen', birthStemPalace.palace_key === '仆役宫' ? '交友宫' : birthStemPalace.palace_key);
  assert.deepEqual(
    Object.fromEntries(fromBirthStem.map((item) => [item.value.mutagen, item.value.star])),
    chart.natal.natal_mutagens,
  );
});

test('空宫借对宫主星', () => {
  const chart = buildChart();
  assert.equal(deriveFeatureSet(chart).features.some((f) => f.feature === 'empty_palace_borrow'), false);

  const emptied = clone(chart);
  const mingIndex = emptied.natal.palaces.findIndex((p) => p.palace_key === '命宫');
  const xiongdiIndex = emptied.natal.palaces.findIndex((p) => p.palace_key === '兄弟宫');
  // 把命宫主星挪到兄弟宫，保持宫干飞化可定位。
  emptied.natal.palaces[xiongdiIndex].major_stars.push(...emptied.natal.palaces[mingIndex].major_stars);
  emptied.natal.palaces[mingIndex].major_stars = [];
  const featureSet = deriveFeatureSet(emptied);
  assert.deepEqual(find(featureSet, 'palace_star_system', '命宫')[0].value, { stars: [], empty: true });
  assert.deepEqual(find(featureSet, 'empty_palace_borrow', '命宫')[0].value, {
    borrowed_from: '迁移宫',
    stars: ['廉贞', '天相'],
  });
});

test('CLI 关系与索引推算不一致时拒绝派生', () => {
  const chart = buildChart();
  chart.natal.palaces[0].relations.opposite = '命宫';
  assert.throws(() => deriveFeatureSet(chart), (error) => error.code === 'FEATURE_RELATION_MISMATCH');
});

test('条件求值支持登记的操作符、绑定和取反', () => {
  const featureSet = deriveFeatureSet(buildChart());
  const hit = (condition, bindings) => evaluateFeatureCondition(condition, featureSet, bindings);

  assert.ok(hit({ all: [{ feature: 'palace_star_system', palace: '命宫', path: 'stars', operator: 'contains', value: '破军' }] }));
  assert.equal(hit({ all: [{ feature: 'palace_star_system', palace: '命宫', path: 'stars', operator: 'contains', value: '紫微' }] }), null);
  assert.ok(hit({ all: [{ feature: 'sanfang_aggregate', palace: '命宫', path: 'malefic', operator: 'contains_all', value: ['地空', '地劫'] }] }));
  assert.ok(hit({ all: [{ feature: 'sanfang_aggregate', palace: '命宫', path: 'malefic', operator: 'count_gte', value: 4 }] }));
  assert.equal(hit({ all: [{ feature: 'sanfang_aggregate', palace: '命宫', path: 'malefic', operator: 'count_gte', value: 5 }] }), null);
  assert.ok(hit({ all: [{ feature: 'brightness_state', star: '破军', path: 'rank', operator: 'gte', value: 6 }] }));
  assert.ok(hit({ all: [{ feature: 'brightness_state', star: '太阳', path: 'rank', operator: 'lte', value: 1 }] }));
  assert.ok(hit({ all: [{ feature: 'flying_mutagen', palace: '命宫', path: 'clash_palace', operator: 'equals', value: '疾厄宫' }] }));
  assert.deepEqual(hit({ all: [{ feature: 'empty_palace_borrow', palace: '命宫', operator: 'not_exists' }] }), []);
  assert.equal(hit({ not: { feature: 'palace_star_system', palace: '命宫', operator: 'exists' } }), null);
  assert.deepEqual(
    hit(
      { all: [{ feature: 'palace_star_system', palace: '$matched_palace', path: 'stars', operator: 'contains', value: '$subject_star' }] },
      { matched_palace: '命宫', subject_star: '破军' },
    ),
    ['feat.natal.palace_star_system.命宫'],
  );
  assert.throws(
    () => hit({ all: [{ feature: 'palace_star_system', palace: '$matched_palace', operator: 'exists' }] }, {}),
    (error) => error.code === 'FEATURE_BINDING_MISSING',
  );
});

test('条件编译期拒绝未登记的特征、操作符、绑定和错误取值', () => {
  const bad = [
    { all: [{ feature: 'unknown_feature', operator: 'exists' }] },
    { all: [{ feature: 'relation_set', operator: 'matches', value: '.*' }] },
    { all: [{ feature: 'relation_set', palace: '$other', operator: 'exists' }] },
    { all: [{ feature: 'brightness_state', path: 'rank', operator: 'gte', value: '旺' }] },
    { all: [{ feature: 'sanfang_aggregate', path: 'malefic', operator: 'contains_any', value: [] }] },
    { all: [{ feature: 'relation_set', operator: 'exists', value: true }] },
    { all: [] },
  ];
  bad.forEach((condition) => assert.throws(() => assertFeatureCondition(condition), JSON.stringify(condition)));
  assert.doesNotThrow(() => assertFeatureCondition({ any: [{ not: { feature: 'relation_set', operator: 'exists' } }] }));
});

test('修正项按来源、方法状态和条件三道门禁求值', () => {
  const featureSet = deriveFeatureSet(buildChart());
  const proposition = {
    id: 'interp.test.pojun.v1',
    modifiers: [
      {
        id: 'mod.test.reviewed-feature',
        when: { all: [{ feature: 'palace_star_system', palace: '$matched_palace', path: 'stars', operator: 'contains', value: '$subject_star' }] },
        effect: 'strengthen',
        evidence: [VERIFIED_SOURCE],
      },
      {
        id: 'mod.test.pending-feature',
        when: { all: [{ feature: 'sanfang_aggregate', palace: '$matched_palace', path: 'malefic', operator: 'contains_any', value: ['地空', '地劫'] }] },
        effect: 'weaken',
        evidence: [VERIFIED_SOURCE],
      },
      {
        id: 'mod.test.unverified-source',
        when: { all: [{ feature: 'relation_set', palace: '$matched_palace', operator: 'exists' }] },
        effect: 'redirect',
        evidence: ['source.example.unverified'],
      },
      {
        id: 'mod.test.not-met',
        when: { all: [{ feature: 'palace_star_system', palace: '$matched_palace', path: 'empty', operator: 'equals', value: true }] },
        effect: 'negate',
        evidence: [VERIFIED_SOURCE],
      },
    ],
  };
  const bindings = { matched_palace: '命宫', subject_star: '破军' };

  const online = evaluateModifiers(proposition, featureSet, { sources: sources(), bindings });
  assert.deepEqual(online.applied, [{
    modifier_id: 'mod.test.reviewed-feature',
    effect: 'strengthen',
    matched_feature_ids: ['feat.natal.palace_star_system.命宫'],
    evidence_ids: [VERIFIED_SOURCE],
  }]);
  assert.deepEqual(online.skipped, [
    { modifier_id: 'mod.test.pending-feature', reason: 'feature_method_pending_source', details: ['sanfang_aggregate'] },
    { modifier_id: 'mod.test.unverified-source', reason: 'evidence_unverified', details: ['source.example.unverified'] },
    { modifier_id: 'mod.test.not-met', reason: 'condition_not_met' },
  ]);

  const trace = evaluateModifiers(proposition, featureSet, { sources: sources(), bindings, allowPendingMethods: true });
  assert.deepEqual(
    trace.applied.map((item) => item.modifier_id),
    ['mod.test.reviewed-feature', 'mod.test.pending-feature'],
  );

  assert.throws(
    () => evaluateModifiers({ id: 'x', modifiers: [{ ...proposition.modifiers[0], effect: 'boost' }] }, featureSet, { sources: sources() }),
    (error) => error.code === 'FEATURE_MODIFIER_INVALID',
  );
});

test('动态特征与本命隔离：只含大限、流年，拒绝流月及以下', () => {
  const chart = buildChart({ withHoroscope: true });
  const before = clone(chart);
  const dynamic = deriveDynamicFeatureSet(chart, { scopes: ['decadal', 'yearly', 'monthly'] });

  assert.deepEqual(chart, before);
  assert.deepEqual(deriveDynamicFeatureSet(chart, { scopes: ['decadal', 'yearly', 'monthly'] }), dynamic);
  assert.equal(dynamic.schema_version, 'ziwei-dynamic-feature-set/v1');
  assert.deepEqual(dynamic.scopes, ['decadal', 'yearly']);
  assert.deepEqual(dynamic.unsupported_scopes, ['monthly']);
  assert.equal(new Set(dynamic.features.map((item) => item.feature_id)).size, dynamic.features.length);
  dynamic.features.forEach((item) => {
    assert.ok(['decadal', 'yearly'].includes(item.scope), item.feature_id);
    assert.ok(item.origin.paths.some((p) => p.startsWith(`horoscope.${item.scope}`)) || item.feature === 'mutagen_stack', item.feature_id);
  });
  // 本命特征集不受运限快照影响。
  assert.deepEqual(deriveFeatureSet(chart), deriveFeatureSet({ ...chart, horoscope: null }));

  assert.throws(
    () => deriveDynamicFeatureSet(buildChart(), { scopes: ['yearly'] }),
    (error) => error.code === 'ZIWEI_DYNAMIC_SNAPSHOT_MISSING',
  );
  assert.throws(
    () => deriveDynamicFeatureSet(chart, { scopes: ['weekly'] }),
    (error) => error.code === 'ZIWEI_DYNAMIC_SCOPE_INVALID',
  );
});

test('运限宫位映射与运限四化落点', () => {
  const chart = buildChart({ withHoroscope: true });
  const dynamic = deriveDynamicFeatureSet(chart);
  const pick = (feature, scope, predicate) => dynamic.features.filter((item) => (
    item.feature === feature && item.scope === scope && predicate(item)
  ));

  // 2026 流年：大限命宫在本命田宅宫，流年命宫在本命迁移宫。
  assert.deepEqual(
    dynamic.snapshots.map((item) => [item.scope, item.life_palace_maps_to]),
    [['decadal', '田宅宫'], ['yearly', '迁移宫']],
  );
  assert.deepEqual(
    pick('overlay_map', 'decadal', (item) => item.value.period_role === '官禄宫').map((item) => item.palace),
    ['疾厄宫'],
  );
  ['decadal', 'yearly'].forEach((scope) => {
    const roles = pick('overlay_map', scope, () => true).map((item) => item.value.period_role);
    assert.equal(new Set(roles).size, 12, scope);
    const mutagens = pick('period_mutagen', scope, () => true);
    assert.deepEqual(mutagens.map((item) => item.value.star), chart.horoscope[scope].mutagens, scope);
  });
  assert.deepEqual(
    pick('period_mutagen', 'yearly', (item) => item.value.mutagen === '忌')[0].value,
    { mutagen: '忌', star: '廉贞', natal_palace: '迁移宫', period_role: '命宫' },
  );
});

test('多层四化叠加记录每层化曜与重复的化曜', () => {
  const chart = buildChart({ withHoroscope: true });
  const stacks = deriveDynamicFeatureSet(chart).features.filter((item) => item.feature === 'mutagen_stack');

  assert.deepEqual(
    stacks.map((item) => item.value),
    [
      { star: '天同', natal_palace: '子女宫', layers: [{ scope: 'natal', mutagen: '忌' }, { scope: 'yearly', mutagen: '禄' }], repeated_mutagens: [] },
      { star: '武曲', natal_palace: '夫妻宫', layers: [{ scope: 'natal', mutagen: '权' }, { scope: 'decadal', mutagen: '禄' }], repeated_mutagens: [] },
    ],
  );
  stacks.forEach((item) => assert.equal(item.method.status, 'pending_source'));

  const repeated = clone(chart);
  repeated.horoscope.yearly.mutagens = [...repeated.horoscope.yearly.mutagens];
  repeated.horoscope.yearly.mutagens[3] = '天同';
  const tiantong = deriveDynamicFeatureSet(repeated).features
    .find((item) => item.feature === 'mutagen_stack' && item.value.star === '天同');
  assert.deepEqual(tiantong.value.repeated_mutagens, ['忌']);
});

test('动态特征可被条件引用，pending 方法的修正项在线上被跳过', () => {
  const chart = buildChart({ withHoroscope: true });
  const dynamic = deriveDynamicFeatureSet(chart);
  assert.ok(evaluateFeatureCondition(
    { all: [{ feature: 'overlay_map', palace: '疾厄宫', path: 'period_role', operator: 'equals', value: '官禄宫' }] },
    dynamic,
  ));
  const result = evaluateModifiers({
    id: 'interp.test.dynamic.v1',
    modifiers: [{
      id: 'mod.test.stack',
      when: { all: [{ feature: 'mutagen_stack', operator: 'exists' }] },
      effect: 'strengthen',
      evidence: [VERIFIED_SOURCE],
    }],
  }, dynamic, { sources: sources() });
  assert.deepEqual(result.skipped, [{ modifier_id: 'mod.test.stack', reason: 'feature_method_pending_source', details: ['mutagen_stack'] }]);
});
