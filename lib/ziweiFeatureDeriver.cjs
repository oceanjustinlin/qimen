'use strict';

/**
 * 紫微 L1 派生特征层（docs/ziwei-interpretation-model-design.md §4）。
 *
 * 输入已通过 CLI 生成的 ziwei-cli/v1 命盘，只读取 natal，确定性地计算命题条件可直接
 * 引用的结构特征。本层只产出事实性特征，不产出吉凶、倾向或用户语言。
 * 每类特征都登记在 rules/derivation/feature-methods.yaml，并携带方法状态；
 * 状态为 pending_source 的特征只可用于测试与 trace，不得进入线上命题条件。
 */

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const YAML = require('yaml');
const { getMutagensByHeavenlyStem } = require('iztro/lib/utils');

const DEFAULT_KNOWLEDGE_ROOT = path.join(__dirname, '..', 'knowledge', 'ziwei');
const FEATURE_SET_SCHEMA_VERSION = 'ziwei-feature-set/v1';
const METHODS_FILE = 'rules/derivation/feature-methods.yaml';
const STARS_FILE = 'ontology/stars.yaml';
const PALACES_FILE = 'ontology/palaces.yaml';
const METHOD_SCHEMA_FILE = 'schemas/feature-method.schema.json';
const EXCERPT_FILES = [
  'sources/mingli-tianji/excerpts.jsonl',
  'sources/feixing-ziwei/excerpts.jsonl',
];
const STAR_COLLECTIONS = ['major_stars', 'minor_stars', 'adjective_stars'];
const MUTAGEN_ORDER = ['禄', '权', '科', '忌'];
const FEATURES = [
  'palace_star_system',
  'relation_set',
  'brightness_state',
  'sanfang_aggregate',
  'jia_palace',
  'flying_mutagen',
  'empty_palace_borrow',
];
const AGGREGATE_GROUPS = ['auspicious', 'malefic', 'lucun', 'horse'];

function makeFeatureError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function mod12(value) {
  return ((value % 12) + 12) % 12;
}

function dependencyStatus(dependency, starsOntology) {
  if (dependency === 'ontology/stars.yaml#brightness_scale') {
    return starsOntology.brightness_scale?.status;
  }
  if (dependency.startsWith('ontology/stars.yaml#')) return starsOntology.status;
  throw makeFeatureError('FEATURE_METHOD_INVALID', `未知的方法依赖：${dependency}`);
}

function loadFeatureKnowledge({ knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT } = {}) {
  const schema = JSON.parse(fs.readFileSync(path.join(knowledgeRoot, METHOD_SCHEMA_FILE), 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const document = readYaml(path.join(knowledgeRoot, METHODS_FILE));
  if (document?.schema_version !== 'ziwei-feature-methods/v1' || !Array.isArray(document.methods)) {
    throw makeFeatureError('FEATURE_METHOD_INVALID', `${METHODS_FILE} 结构或版本无效。`);
  }

  const starsOntology = readYaml(path.join(knowledgeRoot, STARS_FILE));
  if (starsOntology?.schema_version !== 'ziwei-ontology/stars/v1') {
    throw makeFeatureError('FEATURE_ONTOLOGY_INVALID', `${STARS_FILE} 结构或版本无效。`);
  }

  const sources = new Map(
    EXCERPT_FILES.flatMap((file) => readJsonLines(path.join(knowledgeRoot, file)))
      .map((source) => [source.id, source]),
  );

  const methods = new Map();
  document.methods.forEach((method) => {
    if (!validate(method)) {
      throw makeFeatureError(
        'FEATURE_METHOD_INVALID',
        `${method?.id || METHODS_FILE} 不符合特征方法 Schema。`,
        validate.errors,
      );
    }
    if (methods.has(method.feature)) {
      throw makeFeatureError('FEATURE_METHOD_DUPLICATE', `特征方法重复：${method.feature}`);
    }
    if (method.status === 'reviewed') {
      if (method.basis === 'sourced_method') {
        if (method.evidence.length === 0) {
          throw makeFeatureError('FEATURE_METHOD_STATUS_INVALID', `${method.id} 缺少来源却标记为 reviewed。`);
        }
        method.evidence.forEach((sourceId) => {
          if (sources.get(sourceId)?.ocr_status !== 'visually_verified') {
            throw makeFeatureError(
              'FEATURE_METHOD_STATUS_INVALID',
              `${method.id} 引用的 ${sourceId} 不存在或未视觉复核。`,
            );
          }
        });
      }
      method.depends_on.forEach((dependency) => {
        if (dependencyStatus(dependency, starsOntology) !== 'reviewed') {
          throw makeFeatureError(
            'FEATURE_METHOD_STATUS_INVALID',
            `${method.id} 依赖未审核的 ${dependency}，不能标记为 reviewed。`,
          );
        }
      });
    }
    methods.set(method.feature, method);
  });

  const missing = FEATURES.filter((feature) => !methods.has(feature));
  if (missing.length) {
    throw makeFeatureError('FEATURE_METHOD_MISSING', `缺少特征方法登记：${missing.join('、')}`);
  }

  const palaceOntology = readYaml(path.join(knowledgeRoot, PALACES_FILE));
  const palaceAliases = new Map();
  (palaceOntology?.palaces || []).forEach((palace) => {
    palaceAliases.set(palace.id, palace.id);
    palace.aliases.forEach((alias) => palaceAliases.set(alias, palace.id));
  });

  return { methods, starsOntology, palaceAliases };
}

function assertNatalChart(chart) {
  if (
    !chart
    || chart.schema_version !== 'ziwei-cli/v1'
    || !Array.isArray(chart.natal?.palaces)
    || chart.natal.palaces.length !== 12
  ) {
    throw makeFeatureError('FEATURE_CHART_INVALID', '特征派生输入必须是完整的 ziwei-cli/v1 命盘。');
  }
  chart.natal.palaces.forEach((palace, position) => {
    if (palace?.index !== position) {
      throw makeFeatureError('FEATURE_CHART_INVALID', `natal.palaces[${position}] 的 index 与位置不一致。`);
    }
  });
}

function buildStarIndex(palaces) {
  const index = new Map();
  palaces.forEach((palace, palaceIndex) => {
    STAR_COLLECTIONS.forEach((collection) => {
      (palace[collection] || []).forEach((star, starIndex) => {
        if (!index.has(star.name)) {
          index.set(star.name, {
            palaceIndex,
            path: `natal.palaces[${palaceIndex}].${collection}[${starIndex}]`,
          });
        }
      });
    });
  });
  return index;
}

function deriveFeatureSet(chart, options = {}) {
  assertNatalChart(chart);
  const knowledge = options.knowledge || loadFeatureKnowledge(options);
  const { methods, starsOntology, palaceAliases } = knowledge;
  const palaces = chart.natal.palaces;
  const names = palaces.map((palace) => palaceAliases.get(palace.palace_key) || palace.palace_key);
  if (new Set(names).size !== 12) {
    throw makeFeatureError('FEATURE_CHART_INVALID', '命盘十二宫名称不唯一。');
  }
  const starIndex = buildStarIndex(palaces);
  const groupOf = new Map();
  AGGREGATE_GROUPS.forEach((group) => {
    (starsOntology.groups[group] || []).forEach((star) => groupOf.set(star, group));
  });
  const brightnessOrder = starsOntology.brightness_scale.order_high_to_low;
  const features = [];

  function push(feature, palaceIndex, value, paths, extra = {}) {
    const method = methods.get(feature);
    const palace = names[palaceIndex];
    const suffix = extra.id_suffix ? `.${extra.id_suffix}` : '';
    const entry = {
      feature_id: `feat.natal.${feature}.${palace}${suffix}`,
      feature,
      scope: 'natal',
      palace,
      ...(extra.star ? { star: extra.star } : {}),
      value,
      origin: { paths: [...new Set(paths)].sort() },
      method: { id: method.id, status: method.status },
    };
    features.push(entry);
  }

  const relationOf = (palaceIndex) => ({
    opposite: mod12(palaceIndex + 6),
    trine: [mod12(palaceIndex + 4), mod12(palaceIndex + 8)],
    adjacent: [mod12(palaceIndex - 1), mod12(palaceIndex + 1)],
  });

  palaces.forEach((palace, palaceIndex) => {
    const palacePath = `natal.palaces[${palaceIndex}]`;
    const majors = palace.major_stars || [];

    // palace_star_system
    push(
      'palace_star_system',
      palaceIndex,
      { stars: majors.map((star) => star.name), empty: majors.length === 0 },
      majors.length
        ? majors.map((_, starIndex) => `${palacePath}.major_stars[${starIndex}]`)
        : [`${palacePath}.major_stars`],
    );

    // relation_set（与 CLI relations 交叉校验）
    const relation = relationOf(palaceIndex);
    if (palace.relations) {
      const cliOpposite = palaceAliases.get(palace.relations.opposite) || palace.relations.opposite;
      const cliTrine = (palace.relations.trine || []).map((name) => palaceAliases.get(name) || name);
      const expectedTrine = relation.trine.map((index) => names[index]);
      if (
        cliOpposite !== names[relation.opposite]
        || cliTrine.length !== 2
        || !expectedTrine.every((name) => cliTrine.includes(name))
      ) {
        throw makeFeatureError('FEATURE_RELATION_MISMATCH', `${names[palaceIndex]} 的 CLI 关系与索引推算不一致。`);
      }
    }
    push(
      'relation_set',
      palaceIndex,
      {
        self: names[palaceIndex],
        opposite: names[relation.opposite],
        trine: relation.trine.map((index) => names[index]),
        adjacent: relation.adjacent.map((index) => names[index]),
      },
      [`${palacePath}.index`, ...(palace.relations ? [`${palacePath}.relations`] : [])],
    );

    // brightness_state
    STAR_COLLECTIONS.forEach((collection) => {
      (palace[collection] || []).forEach((star, starIndex) => {
        if (!star.brightness) return;
        const position = brightnessOrder.indexOf(star.brightness);
        if (position < 0) {
          throw makeFeatureError('FEATURE_BRIGHTNESS_UNKNOWN', `未知亮度：${star.name}${star.brightness}`);
        }
        push(
          'brightness_state',
          palaceIndex,
          { label: star.brightness, rank: brightnessOrder.length - position },
          [`${palacePath}.${collection}[${starIndex}]`],
          { star: star.name, id_suffix: star.name },
        );
      });
    });

    // sanfang_aggregate
    const members = [
      ['self', palaceIndex],
      ['opposite', relation.opposite],
      ['trine', relation.trine[0]],
      ['trine', relation.trine[1]],
    ];
    const aggregate = Object.fromEntries([...AGGREGATE_GROUPS, 'mutagens'].map((key) => [key, []]));
    const aggregatePaths = [];
    members.forEach(([relationType, memberIndex]) => {
      const member = palaces[memberIndex];
      STAR_COLLECTIONS.forEach((collection) => {
        (member[collection] || []).forEach((star, starIndex) => {
          const starPath = `natal.palaces[${memberIndex}].${collection}[${starIndex}]`;
          const group = groupOf.get(star.name);
          const base = { star: star.name, palace: names[memberIndex], relation: relationType };
          if (group) {
            aggregate[group].push(base);
            aggregatePaths.push(starPath);
          }
          if (MUTAGEN_ORDER.includes(star.mutagen)) {
            aggregate.mutagens.push({ ...base, mutagen: star.mutagen });
            aggregatePaths.push(starPath);
          }
        });
      });
    });
    push(
      'sanfang_aggregate',
      palaceIndex,
      aggregate,
      aggregatePaths.length ? aggregatePaths : [palacePath],
    );

    // jia_palace
    const [beforeIndex, afterIndex] = relation.adjacent;
    const beforeStars = buildPalaceStarSet(palaces[beforeIndex]);
    const afterStars = buildPalaceStarSet(palaces[afterIndex]);
    const pairs = [];
    const jiaPaths = [];
    starsOntology.pairs.forEach((pair) => {
      const [first, second] = pair.stars;
      const split = (beforeStars.has(first) && afterStars.has(second))
        || (beforeStars.has(second) && afterStars.has(first));
      if (!split) return;
      pairs.push({ pair_id: pair.id, stars: [...pair.stars], group: pair.group });
      pair.stars.forEach((name) => jiaPaths.push(starIndex.get(name).path));
    });
    push(
      'jia_palace',
      palaceIndex,
      { before: names[beforeIndex], after: names[afterIndex], pairs },
      jiaPaths.length ? jiaPaths : [`natal.palaces[${beforeIndex}]`, `natal.palaces[${afterIndex}]`],
    );

    // flying_mutagen（宫干四化，使用 iztro-default 四化表）
    const targets = getMutagensByHeavenlyStem(palace.heavenly_stem);
    if (!Array.isArray(targets) || targets.length !== 4) {
      throw makeFeatureError('FEATURE_STEM_INVALID', `${names[palaceIndex]} 宫干无效：${palace.heavenly_stem}`);
    }
    targets.forEach((starName, mutagenIndex) => {
      const mutagen = MUTAGEN_ORDER[mutagenIndex];
      const located = starIndex.get(starName);
      if (!located) {
        throw makeFeatureError('FEATURE_STAR_NOT_FOUND', `宫干四化星 ${starName} 不在命盘中。`);
      }
      const toIndex = located.palaceIndex;
      push(
        'flying_mutagen',
        palaceIndex,
        {
          stem: palace.heavenly_stem,
          mutagen,
          star: starName,
          to_palace: names[toIndex],
          self: toIndex === palaceIndex,
          clash_palace: mutagen === '忌' ? names[mod12(toIndex + 6)] : null,
        },
        [`${palacePath}.heavenly_stem`, located.path],
        { star: starName, id_suffix: mutagen },
      );
    });
  });

  // empty_palace_borrow（需要全部 palace_star_system 后计算）
  palaces.forEach((palace, palaceIndex) => {
    if ((palace.major_stars || []).length) return;
    const oppositeIndex = mod12(palaceIndex + 6);
    const borrowed = palaces[oppositeIndex].major_stars || [];
    push(
      'empty_palace_borrow',
      palaceIndex,
      { borrowed_from: names[oppositeIndex], stars: borrowed.map((star) => star.name) },
      borrowed.length
        ? borrowed.map((_, starIndex) => `natal.palaces[${oppositeIndex}].major_stars[${starIndex}]`)
        : [`natal.palaces[${oppositeIndex}].major_stars`],
    );
  });

  return {
    schema_version: FEATURE_SET_SCHEMA_VERSION,
    scope: 'natal',
    engine: chart.engine ? JSON.parse(JSON.stringify(chart.engine)) : null,
    methods: Object.fromEntries(FEATURES.map((feature) => {
      const method = methods.get(feature);
      return [feature, { id: method.id, status: method.status, school: method.school }];
    })),
    features,
  };
}

function buildPalaceStarSet(palace) {
  const set = new Set();
  STAR_COLLECTIONS.forEach((collection) => {
    (palace[collection] || []).forEach((star) => set.add(star.name));
  });
  return set;
}

module.exports = {
  FEATURES,
  FEATURE_SET_SCHEMA_VERSION,
  deriveFeatureSet,
  loadFeatureKnowledge,
};
