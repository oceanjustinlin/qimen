'use strict';

/**
 * 紫微 L5 动态派生特征（docs/ziwei-interpretation-model-design.md §4.2、§9）。
 *
 * 从已校验命盘的运限快照派生大限、流年两层的特征，结果与本命特征集物理隔离：
 * 每条特征的 scope 是 decadal 或 yearly，origin 只指向 horoscope 路径（本命星曜定位除外）。
 * 本层只产出事实性特征，不判断增强或削弱；首期拒绝流月、流日、流时（PRD §11）。
 */

const { DYNAMIC_FEATURES, loadFeatureKnowledge } = require('./ziweiFeatureDeriver.cjs');

const DYNAMIC_FEATURE_SET_SCHEMA_VERSION = 'ziwei-dynamic-feature-set/v1';
const SUPPORTED_SCOPES = ['decadal', 'yearly'];
const KNOWN_SCOPES = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];
const MUTAGEN_ORDER = ['禄', '权', '科', '忌'];
const STAR_COLLECTIONS = ['major_stars', 'minor_stars', 'adjective_stars'];
const LAYER_ORDER = ['natal', ...SUPPORTED_SCOPES];

function makeDynamicError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function locateNatalStars(palaces) {
  const index = new Map();
  palaces.forEach((palace, palaceIndex) => {
    STAR_COLLECTIONS.forEach((collection) => {
      (palace[collection] || []).forEach((star, starIndex) => {
        if (!index.has(star.name)) {
          index.set(star.name, {
            palaceIndex,
            mutagen: star.mutagen || '',
            path: `natal.palaces[${palaceIndex}].${collection}[${starIndex}]`,
          });
        }
      });
    });
  });
  return index;
}

/**
 * @param {object} chart 已通过 validateZiweiChart 的 ziwei-cli/v1 命盘（含 horoscope）
 * @param {{scopes?: string[], knowledgeRoot?: string, knowledge?: object}} options
 */
function deriveDynamicFeatureSet(chart, options = {}) {
  const scopes = options.scopes || SUPPORTED_SCOPES;
  const unknown = scopes.filter((scope) => !KNOWN_SCOPES.includes(scope));
  if (unknown.length) {
    throw makeDynamicError('ZIWEI_DYNAMIC_SCOPE_INVALID', `未知的运限层级：${unknown.join('、')}`);
  }
  if (!chart?.natal?.palaces || chart.natal.palaces.length !== 12) {
    throw makeDynamicError('ZIWEI_DYNAMIC_SNAPSHOT_MISSING', '动态特征需要完整命盘。');
  }
  const supported = SUPPORTED_SCOPES.filter((scope) => scopes.includes(scope));
  const unsupportedScopes = scopes.filter((scope) => !SUPPORTED_SCOPES.includes(scope));
  const missing = supported.filter((scope) => !chart.horoscope?.[scope]);
  if (missing.length) {
    throw makeDynamicError('ZIWEI_DYNAMIC_SNAPSHOT_MISSING', `缺少运限快照：${missing.join('、')}`);
  }

  const knowledge = options.knowledge || loadFeatureKnowledge(options);
  const { methods, palaceAliases } = knowledge;
  const palaces = chart.natal.palaces;
  const names = palaces.map((palace) => palaceAliases.get(palace.palace_key) || palace.palace_key);
  const natalStars = locateNatalStars(palaces);
  const features = [];
  const snapshots = [];

  function push(scope, feature, palace, value, paths, suffix) {
    const method = methods.get(feature);
    features.push({
      feature_id: `feat.${scope}.${feature}.${palace}${suffix ? `.${suffix}` : ''}`,
      feature,
      scope,
      palace,
      value,
      origin: { paths: [...new Set(paths)].sort() },
      method: { id: method.id, status: method.status },
    });
  }

  // 每层四化：star -> [{scope, mutagen}]，本命层取生年四化。
  const layersByStar = new Map();
  const addLayer = (star, scope, mutagen, path) => {
    if (!layersByStar.has(star)) layersByStar.set(star, []);
    layersByStar.get(star).push({ scope, mutagen, path });
  };
  natalStars.forEach((located, star) => {
    if (MUTAGEN_ORDER.includes(located.mutagen)) addLayer(star, 'natal', located.mutagen, `${located.path}.mutagen`);
  });

  supported.forEach((scope) => {
    const snapshot = chart.horoscope[scope];
    const snapshotPath = `horoscope.${scope}`;
    const roles = (snapshot.palace_keys || []).map((key) => palaceAliases.get(key) || key);
    if (roles.length !== 12 || roles[snapshot.index] !== '命宫') {
      throw makeDynamicError('ZIWEI_DYNAMIC_SNAPSHOT_INVALID', `${scope} 运限宫位重排无效。`);
    }
    snapshots.push({
      scope,
      heavenly_stem: snapshot.heavenly_stem,
      earthly_branch: snapshot.earthly_branch,
      life_palace_maps_to: names[snapshot.index],
      origin: { path: snapshotPath },
    });

    // overlay_map：该层每个宫位角色落在哪个本命宫
    roles.forEach((role, natalIndex) => {
      push(
        scope,
        'overlay_map',
        names[natalIndex],
        { period_role: role, natal_palace: names[natalIndex] },
        [`${snapshotPath}.palace_keys[${natalIndex}]`],
      );
    });

    // period_mutagen：该层四化星落在哪个本命宫，以及该宫在该层的角色
    if (!Array.isArray(snapshot.mutagens) || snapshot.mutagens.length !== 4) {
      throw makeDynamicError('ZIWEI_DYNAMIC_SNAPSHOT_INVALID', `${scope} 运限四化不是四颗星。`);
    }
    snapshot.mutagens.forEach((star, mutagenIndex) => {
      const mutagen = MUTAGEN_ORDER[mutagenIndex];
      const located = natalStars.get(star);
      if (!located) {
        throw makeDynamicError('ZIWEI_DYNAMIC_SNAPSHOT_INVALID', `${scope} 四化星 ${star} 不在命盘中。`);
      }
      const mutagenPath = `${snapshotPath}.mutagens[${mutagenIndex}]`;
      push(
        scope,
        'period_mutagen',
        names[located.palaceIndex],
        {
          mutagen,
          star,
          natal_palace: names[located.palaceIndex],
          period_role: roles[located.palaceIndex],
        },
        [mutagenPath, located.path],
        mutagen,
      );
      addLayer(star, scope, mutagen, mutagenPath);
    });
  });

  // mutagen_stack：同一星曜在两层及以上同时化曜
  [...layersByStar.entries()]
    .filter(([, layers]) => layers.length >= 2)
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .forEach(([star, layers]) => {
      const ordered = [...layers].sort((a, b) => LAYER_ORDER.indexOf(a.scope) - LAYER_ORDER.indexOf(b.scope));
      const counts = {};
      ordered.forEach((layer) => { counts[layer.mutagen] = (counts[layer.mutagen] || 0) + 1; });
      const located = natalStars.get(star);
      const scope = ordered[ordered.length - 1].scope;
      push(
        scope,
        'mutagen_stack',
        names[located.palaceIndex],
        {
          star,
          natal_palace: names[located.palaceIndex],
          layers: ordered.map(({ scope: layerScope, mutagen }) => ({ scope: layerScope, mutagen })),
          repeated_mutagens: MUTAGEN_ORDER.filter((mutagen) => counts[mutagen] >= 2),
        },
        ordered.map((layer) => layer.path),
        star,
      );
    });

  return {
    schema_version: DYNAMIC_FEATURE_SET_SCHEMA_VERSION,
    target_datetime: chart.horoscope?.target_datetime || null,
    scopes: supported,
    unsupported_scopes: unsupportedScopes,
    snapshots,
    methods: Object.fromEntries(DYNAMIC_FEATURES.map((feature) => {
      const method = methods.get(feature);
      return [feature, { id: method.id, status: method.status, school: method.school }];
    })),
    features,
  };
}

module.exports = {
  DYNAMIC_FEATURE_SET_SCHEMA_VERSION,
  SUPPORTED_SCOPES,
  deriveDynamicFeatureSet,
};
