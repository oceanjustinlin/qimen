const POLARITY_RULES = [
  {
    signal: '伤门+白虎',
    match: { door: '伤门', god: '白虎' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['health_action'],
        subcategories: ['sports_competition'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+6 to +10, plus a smaller risk deduction',
        reason: '伤门主攻击、冲击、破坏，白虎主杀伐、威压、疼痛与对抗。疾病预测中为伤灾警示，但散打、搏击、竞技抢攻语境中可转为主动进攻、爆发力和压迫力；仍需保留受伤、犯规、用力过猛的风险。'
      },
      {
        categories: ['health_action', 'pregnancy_birth'],
        domain_polarity: 'warning',
        score_effect_hint: '-8 to -14',
        reason: '健康、疾病、孕产或手术语境中，伤门与白虎同临多主疼痛、外伤、血光、急症或处置风险，应作为警示信号处理。'
      },
      {
        categories: ['lawsuit_legal'],
        subcategories: ['criminal_case'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8, plus a smaller escalation-risk deduction',
        reason: '刑事、执法、强制执行语境中，伤门白虎可代表威慑、压制和强执行力；但也提示冲突升级、伤害或程序风险。'
      }
    ]
  },
  {
    signal: '乙+辛',
    match: { sky: '乙', earth: '辛' },
    default_polarity: 'strong_warning',
    contexts: [
      {
        categories: ['health_action'],
        subcategories: ['medical_diagnosis', 'treatment_effect'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8 for recent illness, keep warning for chronic or severe disease',
        reason: '乙加辛为青龙逃走，常规主逃散、破败、离散；但近病预测中可取“病神逃走”之象，表示病邪退散、病情有转机。久病或重症不可直接转吉，仍需保留风险。'
      },
      {
        categories: ['relationship', 'finance_wealth', 'career_business', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-8 to -14',
        reason: '婚恋、财务、事业等需要维系与积累的事项中，乙加辛多主逃散、破财、合作失信或关系离散，应按强风险处理。'
      }
    ]
  },
  {
    signal: '庚+丙',
    match: { sky: '庚', earth: '丙' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['finance_wealth'],
        subcategories: ['trade_buy_sell', 'service_brokerage', 'general_wealth'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8 when the user is buyer/active guest, otherwise warning',
        reason: '庚加丙为太白入荧、贼必来，常规防外来冲击；但买货求财、等客来、主动为客时，可取“财物/对方主动到来”之象，利主动出击或买入。若自己是守方或防盗防损，则仍为风险。'
      },
      {
        categories: ['relationship'],
        subcategories: ['single_romance', 'pursuit_dating'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+3 to +6 when asking whether someone approaches, keep ambiguity risk',
        reason: '女性或被追求方问关系时，庚加丙可取男性主动靠近、对方来追之象；但该格仍带突发和压迫感，不能直接断稳定。'
      },
      {
        categories: ['career_business', 'health_action', 'lawsuit_legal', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-6 to -12',
        reason: '普通求稳、疾病、官非或防守语境中，庚加丙主外来压力、盗损、病来或官非来，不宜机械转吉。'
      }
    ]
  },
  {
    signal: '丙+庚',
    match: { sky: '丙', earth: '庚' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['health_action'],
        subcategories: ['medical_diagnosis', 'treatment_effect'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8 for illness leaving, keep chronic-disease caveat',
        reason: '丙加庚为荧入太白、贼必去，主事物离去、消散。测疾病时可取病去、病势缓解之象，但久病重病仍需结合日干、年命和天芮状态。'
      },
      {
        categories: ['finance_wealth'],
        subcategories: ['trade_buy_sell'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 when selling or clearing inventory, warning when seeking accumulation',
        reason: '丙加庚主离去，卖货清仓、撤出库存时可为用；若问投资增值、聚财或买入，则主财物离散。'
      },
      {
        categories: ['career_business', 'relationship', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-6 to -12',
        reason: '主动谋求好事、求职、求录取、求关系稳定时，丙加庚多主机会离去、半途撤退或难以积累。'
      }
    ]
  },
  {
    signal: '死门+天芮星',
    match: { door: '死门', star: '天芮' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['health_action'],
        domain_polarity: 'warning',
        score_effect_hint: '-10 to -16',
        reason: '疾病预后中，死门主沉滞、闭塞、消极，天芮为病星，同临时应重点提示病势拖延、恢复慢或病灶较重。'
      },
      {
        categories: ['fengshui_house'],
        subcategories: ['yin_house'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +8 when well placed, otherwise neutral or warning',
        reason: '阴宅、祖坟语境中死门可作为阴宅本体，不宜机械判凶；若得位、旺相并生助年命，反主归藏稳定。天芮仍提示潮湿、病符或破损隐患，需要并列说明。'
      }
    ]
  },
  {
    signal: '伤门',
    match: { door: '伤门' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['finance_wealth'],
        subcategories: ['debt_repayment'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8, plus risk deduction for excessive pressure',
        reason: '伤门主索取、冲击、破坏和施压。讨债催收需要催逼和制约欠债方时，伤门可作为催收动作有力的信号；但仍要防方式过激、冲突升级或程序风险。'
      },
      {
        categories: ['health_action'],
        subcategories: ['sports_competition'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8, plus injury-risk deduction',
        reason: '竞技体育、搏击格斗等场景需要攻击性和冲击力，伤门可转为主动进攻与破局能力；但仍主伤痛和碰撞。'
      },
      {
        categories: ['item_transaction'],
        subcategories: ['vehicle_lost'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 when judging vehicle or machinery clues',
        reason: '车辆、机械类事项以伤门为重要类象，可作为定位车辆、机械损坏或行动工具的用神，不应只按凶门扣分。'
      },
      {
        categories: ['relationship', 'career_business', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -10',
        reason: '求和、求稳、求录取、普通出行或日常谋事中，伤门多主伤害、争执、突发阻隔或交通损伤。'
      }
    ]
  },
  {
    signal: '死门',
    match: { door: '死门' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['fengshui_house'],
        subcategories: ['yin_house'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +8 when well placed, otherwise warning',
        reason: '阴宅、祖坟、丧葬、归藏事项以死门为本体或相应类象，得位旺相可主稳定，不应机械判凶。'
      },
      {
        categories: ['finance_wealth'],
        subcategories: ['real_estate_trade'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 when tied to land/title stability',
        reason: '房产、地皮、固定资产交易中，死门可代表土地、产权根基和固定资产底层，不等同于失败；需结合生克、空亡和合同用神判断。'
      },
      {
        categories: ['health_action', 'career_business', 'relationship', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-6 to -12',
        reason: '疾病、关系、职场、考试等进取类事项中，死门多主沉滞、无生机、结束或难推进，应作为阻力。'
      }
    ]
  },
  {
    signal: '杜门',
    match: { door: '杜门' },
    default_polarity: 'mixed',
    contexts: [
      {
        categories: ['career_business'],
        subcategories: ['project_business'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 for confidential or technical work, warning for public expansion',
        reason: '杜门主闭塞、隐藏、保密。保密项目、技术研发、闭关学习、内部攻关时可转为保护与专注；若问公开推进、沟通流通，则仍主卡顿。'
      },
      {
        categories: ['lawsuit_legal', 'item_transaction'],
        subcategories: ['criminal_case', 'stolen_item', 'lost_found'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 when used for hiding, blocking or containment',
        reason: '捕盗、隐蔽调查、阻断风险、躲灾避难等需要隐藏与屏障的场景中，杜门的闭塞性可为用。'
      },
      {
        categories: ['relationship', 'finance_wealth', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-4 to -9',
        reason: '沟通、交易、考试发挥、出行和普通谋事需要开放流通，杜门多主消息不通、不同意、流程受阻。'
      }
    ]
  },
  {
    signal: '惊门',
    match: { door: '惊门' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['lawsuit_legal'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+3 to +7 when debate or legal argument is central, keep conflict-risk deduction',
        reason: '惊门主口舌、声音、惊动和争议。诉讼、辩论、律师代理、公开陈述等以语言争辩为核心时可为用；但仍提示口舌激化和心理压力。'
      },
      {
        categories: ['exam_study', 'career_business'],
        subcategories: ['interview_review', 'promotion_title', 'project_business'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 for speaking, presentation or persuasion; warning for panic',
        reason: '面试答辩、演讲汇报、宣传说服需要声音与表达，惊门可转为表达张力；若日干受克或门星失衡，则转为紧张失误。'
      },
      {
        categories: ['health_action', 'relationship', 'finance_wealth', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -10',
        reason: '普通谋事、关系和健康语境中，惊门多主惊恐、口舌、争吵、精神紧张或突发惊扰。'
      }
    ]
  },
  {
    signal: '景门',
    match: { door: '景门' },
    default_polarity: 'mixed',
    contexts: [
      {
        categories: ['exam_study', 'career_business', 'finance_wealth'],
        subcategories: ['exam_performance', 'interview_review', 'promotion_title', 'project_business', 'trade_buy_sell'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +7 when documents, exposure or exams are central',
        reason: '景门主光明、文书、信息、宣传和表现。考试答卷、汇报展示、合同信息、宣传推广时可为用；但仍需防虚假繁荣、文书错漏和火性急躁。'
      },
      {
        categories: ['relationship'],
        subcategories: ['online_romance', 'love_conflict'],
        domain_polarity: 'warning',
        score_effect_hint: '-4 to -9',
        reason: '线上关系、隐私或感情纠葛中，景门的曝光与表象性容易对应信息包装、虚假繁荣或隐情暴露。'
      }
    ]
  },
  {
    signal: '白虎',
    match: { god: '白虎' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['career_business', 'lawsuit_legal', 'health_action'],
        subcategories: ['project_business', 'criminal_case', 'sports_competition'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+3 to +7 for enforcement, authority or hard skill; keep injury/conflict risk',
        reason: '白虎主刚猛、威严、杀伐和压力。军警执法、强执行、技术硬实力、竞技对抗中可转为权威与压制力；疾病、事故和冲突风险仍需保留。'
      },
      {
        categories: ['health_action', 'pregnancy_birth', 'relationship', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -12',
        reason: '健康、孕产、关系和日常出行语境中，白虎多主疼痛、血光、刑伤、事故、压力和冲突。'
      }
    ]
  },
  {
    signal: '玄武',
    match: { god: '玄武' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['item_transaction', 'lawsuit_legal'],
        subcategories: ['stolen_item', 'lost_found', 'criminal_case', 'settlement_evidence'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 for hidden clues or covert investigation, warning for fraud',
        reason: '玄武主隐匿、暗线、欺瞒。查盗、找暗线、证据调查时可作为隐藏线索或暗处信息的指示；但也同步提示盗窃、虚假和欺骗。'
      },
      {
        categories: ['relationship', 'finance_wealth', 'career_business', 'health_action', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -10',
        reason: '感情、交易、职场和健康语境中，玄武多主隐瞒、虚假、暧昧、诈骗、信息不明或诊断不清。'
      }
    ]
  },
  {
    signal: '天芮星',
    match: { star: '天芮' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['health_action'],
        subcategories: ['treatment_effect'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +5 when representing doctors, clinics or medicine; warning when representing disease',
        reason: '天芮为病星，但也可代表医生、医疗机构、药店、医疗问题本身。治疗效果问题中若天芮被天心、乙奇制化，可作为医疗处置对象明确，不应只按病凶扣分。'
      },
      {
        categories: ['exam_study'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +5 when tied to learning or students, warning for mistakes',
        reason: '材料中天芮亦有学生、好学、传教授道之象。求学语境中可代表学习承载，但仍需防错漏、病弱或状态拖累。'
      },
      {
        categories: ['health_action', 'fengshui_house', 'pregnancy_birth', 'finance_wealth', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -12',
        reason: '多数语境中天芮仍主疾病、问题、缺陷、病符、质量毛病，应优先作为风险信号。'
      }
    ]
  },
  {
    signal: '庚格',
    match: { sky: '庚' },
    default_polarity: 'warning',
    contexts: [
      {
        categories: ['item_transaction'],
        subcategories: ['lost_found', 'stolen_item', 'vehicle_lost'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +10 when tied to the lost item or process palace',
        reason: '庚常为阻隔之神，普通成事语境多主受阻；但找失物、追赃、破案、截获语境需要拦截与阻止，庚格反可作为找回、截获、锁定应期的有利信号。'
      },
      {
        categories: ['lawsuit_legal'],
        subcategories: ['criminal_case', 'settlement_evidence'],
        domain_polarity: 'positive_with_risk',
        score_effect_hint: '+4 to +8 when used for interception or evidence lock',
        reason: '刑侦破案、证据锁定、追逃追赃等事项中，庚的阻隔性可转为拦截、卡住对方、锁定线索。若问普通和解或顺利推进，则仍需谨慎。'
      },
      {
        categories: ['career_business', 'relationship', 'finance_wealth', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-4 to -10',
        reason: '普通求成、求顺、求合作、求录取等语境中，庚多主阻隔、压力、竞争或推进卡点，通常应作为扣分或风险信号。'
      }
    ]
  },
  {
    signal: '空亡',
    match: { isKong: true },
    default_polarity: 'mixed',
    contexts: [
      {
        categories: ['lawsuit_legal', 'health_action', 'item_transaction'],
        subcategories: ['criminal_case', 'medical_diagnosis', 'lost_found', 'stolen_item'],
        domain_polarity: 'mixed_or_positive',
        score_effect_hint: '+2 to +6 when the harmful object falls empty, warning when the desired object falls empty',
        reason: '空亡本质是气场断档、能量虚无。吉事落空为凶，但凶事、刑罚、病邪、盗贼或压力落空时，可转为灾不实、罚不成、病邪无根或对方难以落实。必须说明落空的是哪一方。'
      },
      {
        categories: ['career_business', 'finance_wealth', 'relationship', 'exam_study', 'general'],
        domain_polarity: 'warning',
        score_effect_hint: '-5 to -12 when the desired core yongshen falls empty',
        reason: '求职位、求财、求关系、求录取等吉事中，核心用神空亡多主未成形、口头化、落空或等待填实。'
      }
    ]
  }
];

function normalizeText(value) {
  return String(value || '').trim();
}

function matchesPalace(match, palace) {
  return Object.entries(match).every(([key, expected]) => {
    if (Array.isArray(expected)) {
      return expected.map(normalizeText).includes(normalizeText(palace[key]));
    }
    return normalizeText(palace[key]) === normalizeText(expected);
  });
}

function matchesContext(context, intent = {}) {
  const category = normalizeText(intent.category);
  const subcategory = normalizeText(intent.subcategory);
  const categoryMatches = !context.categories || context.categories.includes(category);
  const subcategoryMatches = !context.subcategories || context.subcategories.includes(subcategory);
  return categoryMatches && subcategoryMatches;
}

function detectPolarityOverrides({ intent = {}, palaces = [] } = {}) {
  const overrides = [];

  for (const palace of palaces) {
    const palaceMatches = [];

    for (const rule of POLARITY_RULES) {
      if (!matchesPalace(rule.match, palace)) continue;

      const context = rule.contexts.find((item) => matchesContext(item, intent));
      if (!context) continue;

      palaceMatches.push({
        signal: rule.signal,
        palace: palace.name || '',
        door: palace.door || '',
        star: palace.star || '',
        god: palace.god || '',
        sky: palace.sky || '',
        earth: palace.earth || '',
        default_polarity: rule.default_polarity || 'warning',
        domain_polarity: context.domain_polarity,
        score_effect_hint: context.score_effect_hint,
        reason: context.reason,
        match_keys: Object.keys(rule.match)
      });
    }

    const filteredMatches = palaceMatches.filter((candidate) => {
      return !palaceMatches.some((other) => {
        if (other === candidate) return false;
        if (other.match_keys.length <= candidate.match_keys.length) return false;
        return candidate.match_keys.every((key) => other.match_keys.includes(key));
      });
    });

    overrides.push(...filteredMatches.map(({ match_keys, ...override }) => override));
  }

  return overrides;
}

const POLARITY_LABELS = {
  positive: '有利',
  positive_with_risk: '有利但有残余风险',
  mixed: '吉凶参半',
  warning: '不利',
  strong_warning: '明显不利'
};

function polarityLabel(value) {
  return POLARITY_LABELS[value] || value || '未标注';
}

function buildPolarityPromptSection(overrides = []) {
  if (!overrides.length) return '';

  // 同一信号在多个宫命中时合并成一条；默认极性与覆盖后极性相同的信号单独列为“问题域确认”，不算翻转。
  const grouped = [];
  for (const override of overrides) {
    const key = `${override.signal}|${override.default_polarity}|${override.domain_polarity}|${override.reason}`;
    const existing = grouped.find((item) => item.key === key);
    if (existing) {
      if (override.palace && !existing.palaces.includes(override.palace)) existing.palaces.push(override.palace);
    } else {
      grouped.push({ key, ...override, palaces: override.palace ? [override.palace] : [] });
    }
  }
  const flipped = grouped.filter((item) => item.default_polarity !== item.domain_polarity);
  const confirmed = grouped.filter((item) => item.default_polarity === item.domain_polarity);
  const formatItem = (item, index, withFlip) => {
    const palace = item.palaces.length ? `（${item.palaces.join('、')}）` : '';
    const polarity = withFlip
      ? `通常${polarityLabel(item.default_polarity)}，本问题域下按${polarityLabel(item.domain_polarity)}理解`
      : `本问题域下仍按${polarityLabel(item.domain_polarity)}理解`;
    return `${index + 1}. ${item.signal}${palace}：${polarity}。原因：${item.reason}`;
  };

  const blocks = [];
  if (flipped.length) {
    blocks.push(`极性发生变化的信号：\n${flipped.map((item, index) => formatItem(item, index, true)).join('\n')}`);
  }
  if (confirmed.length) {
    blocks.push(`问题域确认、极性未变的信号：\n${confirmed.map((item, index) => formatItem(item, index, false)).join('\n')}`);
  }

  return `
**【格局极性翻转表命中】**
以下信号已按当前问题域确定吉凶方向（已计入【盘面评估】，你不用打分）。不要把命中信号机械判为纯凶，也不要把风险完全洗白。

${blocks.join('\n\n').replace(/扣分/g, '阻力').replace(/加分/g, '助力')}

写法：
- 用神卡片里相关卡的 evidence 和 tone 按上面确定的方向写。
- 有利、不利因素里，${flipped.length ? '“极性发生变化的信号”要说明它在本问题里为什么和通常理解不同；' : ''}“有利但有残余风险”的信号要同时写有利面与风险面。`;
}

module.exports = {
  POLARITY_RULES,
  buildPolarityPromptSection,
  detectPolarityOverrides
};
