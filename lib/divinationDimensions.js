/**
 * 跨体系共享的维度层（奇门 / 八字 / 紫微）。
 *
 * 三层结构（docs/ziwei-interpretation-model-design.md §6.2）：
 *   A. 问事主题树：lib/divinationCategories.js（category → subcategory），本文件不重复定义。
 *   B. 答案槽位 ANSWER_SLOTS：一份解读由哪些部分组成（主体、目标、环境、助力、制约……），
 *      各体系把自己的输出字段映射到同一组槽位，报告与 UI 才能对齐。
 *   C. 内容维度 CONTENT_FACETS：挂在主题树子类下，描述「这一类问题具体看哪些方面」，
 *      每个维度归属一个槽位。先天结构类子类由八字、紫微共用。
 *
 * 只共享坐标，不共享证据：宫星四化、十神五行、门星神各自产出证据，
 * 也不在此合并不同体系的结论。
 */

const { DIVINATION_CATEGORIES } = require('./divinationCategories');

const ANSWER_SLOTS = {
  subject_state: { label: '主体状态', description: '问事人自身的条件、底盘与行动状态' },
  target_state: { label: '目标状态', description: '所问之事、目标对象或目标领域的状态与适配度' },
  environment: { label: '环境条件', description: '外部大环境、流程管道与阶段性气候' },
  support: { label: '助力', description: '有利于目标实现的结构或因素' },
  constraint: { label: '制约', description: '阻碍、代价或需要处理的课题' },
  interaction: { label: '主客互动', description: '问事人与目标之间的作用关系' },
  timing: { label: '时机', description: '触发时点、应期窗口与阶段节奏' },
  portrait: { label: '画像', description: '他人（伴侣、上司、子女等）的特征倾向' },
  guidance: { label: '行动指引', description: '可执行的方向与节奏建议' },
};

/**
 * 内容维度，按「category.subcategory」索引。只为八字、紫微可回答的先天结构类子类定义；
 * 奇门的事件类子类沿用 M3 槽位，不需要额外内容维度。
 */
const CONTENT_FACETS = {
  'career_business.career_direction': [
    { id: 'work_style', label: '做事方式', slot: 'subject_state' },
    { id: 'role_fit', label: '角色适配', slot: 'target_state' },
    { id: 'career_stability', label: '事业稳定性', slot: 'target_state' },
  ],
  'career_business.industry_fit': [
    { id: 'industry_affinity', label: '行业亲和', slot: 'target_state' },
    { id: 'work_style', label: '做事方式', slot: 'subject_state' },
  ],
  'career_business.entrepreneurship_vs_job': [
    { id: 'risk_appetite', label: '风险偏好', slot: 'subject_state' },
    { id: 'autonomy_fit', label: '自主经营适配', slot: 'target_state' },
  ],
  'finance_wealth.general_wealth': [
    { id: 'income_mode', label: '进财方式', slot: 'target_state' },
    { id: 'retention', label: '守财能力', slot: 'subject_state' },
  ],
  'finance_wealth.wealth_capacity': [
    { id: 'wealth_capacity', label: '财富容量', slot: 'target_state' },
    { id: 'retention', label: '守财能力', slot: 'subject_state' },
  ],
  'finance_wealth.income_model': [
    { id: 'income_mode', label: '进财方式', slot: 'target_state' },
  ],
  'relationship.marriage_pattern': [
    { id: 'interaction_style', label: '相处方式', slot: 'subject_state' },
    { id: 'relationship_stability', label: '关系稳定性', slot: 'target_state' },
    { id: 'expectation_gap', label: '期待落差', slot: 'constraint' },
  ],
  'relationship.partner_profile': [
    { id: 'partner_traits', label: '伴侣特征', slot: 'portrait' },
  ],
};

/** 奇门报告（docs/qimen-report-schema-prd.md）字段 → 共享槽位。 */
const QIMEN_SLOT_MAP = {
  'm3_inference.subject_state': 'subject_state',
  'm3_inference.target_state': 'target_state',
  'm3_inference.environment_state': 'environment',
  'm3_inference.support_factors': 'support',
  'm3_inference.constraint_factors': 'constraint',
  'm3_inference.interaction_decision': 'interaction',
  'm4_guidance.timing_behavior': 'timing',
  'm4_guidance.environment_fengshui': 'guidance',
};

/**
 * 八字问事输出（lib/baziQuestionCore.js 统一 envelope v2）→ 共享槽位。
 * 按 framework 轴索引；legacy analysis_mode 经 MODE_TO_FRAMEWORK 对应。
 */
const BAZI_SLOT_MAP = {
  envelope: {
    rhythm: 'timing',
    action_guide: 'guidance',
  },
  frameworks: {
    dynamic_current: {
      'readings.base_foundation': 'subject_state',
      'readings.target_state': 'target_state',
      'readings.dayun_field': 'environment',
      'readings.liunian_trigger': 'timing',
    },
    dynamic_scan: {
      'readings.base_foundation': 'subject_state',
      'readings.target_state': 'target_state',
      'readings.trigger_windows': 'timing',
      'readings.best_window': 'timing',
      'readings.worst_window': 'timing',
    },
    static_structure: {
      'readings.base_foundation': 'subject_state',
      'readings.target_state': 'target_state',
      'readings.structural_supports': 'support',
      'readings.structural_risks': 'constraint',
      'readings.structural_verdict': 'target_state',
      'readings.current_status_note': 'timing',
    },
    portrait: {
      'readings.appearance_tendency': 'portrait',
      'readings.personality_tendency': 'portrait',
      'readings.career_style': 'portrait',
      'readings.relationship_dynamic': 'portrait',
    },
    open_strategy: {
      'readings.base_foundation': 'subject_state',
      'readings.target_state': 'target_state',
      'readings.dayun_field': 'environment',
      'readings.liunian_trigger': 'timing',
      'readings.path_readings': 'target_state',
    },
  },
};

function isValidSlot(slot) {
  return Object.prototype.hasOwnProperty.call(ANSWER_SLOTS, slot);
}

function facetKey(category, subcategory) {
  return `${category}.${subcategory}`;
}

function getContentFacets(category, subcategory) {
  return CONTENT_FACETS[facetKey(category, subcategory)] || [];
}

function findContentFacet(category, subcategory, facetId) {
  return getContentFacets(category, subcategory).find((facet) => facet.id === facetId) || null;
}

/** 结构自检：槽位存在、子类存在于主题树、子类声明了可回答它的命理分支。 */
function validateDimensionRegistry() {
  const problems = [];
  Object.entries(CONTENT_FACETS).forEach(([key, facets]) => {
    const [category, subcategory] = key.split('.');
    const node = DIVINATION_CATEGORIES[category]?.subcategories?.[subcategory];
    if (!node) {
      problems.push(`${key} 不在 divinationCategories 主题树中`);
      return;
    }
    if (!node.branches.some((branch) => branch === 'bazi' || branch === 'ziwei')) {
      problems.push(`${key} 未标注八字或紫微可回答`);
    }
    const ids = new Set();
    facets.forEach((facet) => {
      if (!isValidSlot(facet.slot)) problems.push(`${key}.${facet.id} 的槽位无效：${facet.slot}`);
      if (ids.has(facet.id)) problems.push(`${key} 内维度重复：${facet.id}`);
      ids.add(facet.id);
    });
  });
  const mappedSlots = [
    ...Object.values(QIMEN_SLOT_MAP),
    ...Object.values(BAZI_SLOT_MAP.envelope),
    ...Object.values(BAZI_SLOT_MAP.frameworks).flatMap((map) => Object.values(map)),
  ];
  mappedSlots.filter((slot) => !isValidSlot(slot)).forEach((slot) => problems.push(`映射到未知槽位：${slot}`));
  return problems;
}

module.exports = {
  ANSWER_SLOTS,
  BAZI_SLOT_MAP,
  CONTENT_FACETS,
  QIMEN_SLOT_MAP,
  facetKey,
  findContentFacet,
  getContentFacets,
  isValidSlot,
  validateDimensionRegistry,
};
