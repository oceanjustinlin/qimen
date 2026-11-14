const careerBusinessYongshenRule = {
  category: 'career_business',
  label: '事业职场/求职跳槽/项目推进/创业经营',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch22-v1',
  systems: ['干支系统', '专用用神', '年命系统', '日时一对一系统', '宫位系统'],
  yongshen: {
    primary: [
      {
        symbol: '日干',
        role: '求测人本人',
        layer: 'subject',
        method: '干支系统',
        judge: '看日干落宫的门、星、神、天地盘干、旺衰、空亡、马星，判断本人状态、资源、主动权与承压能力。'
      },
      {
        symbol: '开门',
        role: '职位、岗位、事业机会、工作平台',
        layer: 'object',
        method: '专用用神',
        judge: '开门旺相、生助日干，主职位机会对本人有利；开门克日干、空亡、入墓或临凶神，主岗位阻力、竞争压力或机会不实。'
      },
      {
        symbol: '值符',
        role: '领导、高层、核心决策人、权力资源',
        layer: 'authority',
        method: '专用用神',
        judge: '值符生日干或与日干同宫/比和，主领导支持或有贵人资源；值符克日干、空亡或受制，主上级态度不明、审批难过或权力端不给力。'
      }
    ],
    secondary: [
      {
        symbol: '值使门',
        role: '事情执行过程、流程推进状态',
        layer: 'process',
        method: '专用用神',
        judge: '值使门旺相、生日干，主流程顺；休囚、空亡、临杜门/死门，主流程卡顿、消息闭塞或执行迟滞。'
      },
      {
        symbol: '时干',
        role: '所问之事的当前状态与短期趋势',
        layer: 'event',
        method: '日时一对一系统',
        judge: '日干与时干相生、同宫、比和，主人与事相连；相克、冲动、空亡，主短期阻力或事态不稳。'
      },
      {
        symbol: '年命',
        role: '求测人长期职业根基与关键成败承载点',
        layer: 'life_anchor',
        method: '年命系统',
        requiresBazi: true,
        judge: '年命落宫吉、生日干或得开门/值符扶助，主此事契合长期发展；年命受克、空亡、临凶格，主短期可动但长期代价较高。'
      }
    ],
    contextual: [
      {
        symbol: '天辅星',
        role: '文书、策划、学习能力、专业支持',
        layer: 'support',
        method: '专用用神',
        appliesTo: ['考试', '面试', '方案', '咨询', '知识型工作']
      },
      {
        symbol: '景门',
        role: '简历、汇报、文书、品牌曝光、合同材料',
        layer: 'document',
        method: '专用用神',
        appliesTo: ['面试', '汇报', '投标', '合同', '作品展示']
      },
      {
        symbol: '六合',
        role: '合作关系、团队配合、中间人撮合',
        layer: 'collaboration',
        method: '专用用神',
        appliesTo: ['合作', '团队', '合伙', '客户谈判']
      },
      {
        symbol: '驿马',
        role: '调动、跳槽、外派、跨城机会、变化速度',
        layer: 'movement',
        method: '方位/动态系统',
        appliesTo: ['跳槽', '调岗', '出差', '外派', '异地工作']
      }
    ]
  },
  judgmentOrder: [
    '先看日干：判断求测人本人状态、资源、主动权和承压能力。',
    '再看开门：判断岗位、职位、事业机会本身是否真实有力。',
    '再看值符：判断领导、高层、关键决策人是否支持。',
    '然后看值使门和时干：判断流程是否推进、短期是否能成。',
    '若提供八字或出生年，再看年命：判断此事对长期职业根基是否有利。',
    '最后按具体问题补看天辅、景门、六合、驿马等辅助用神。'
  ],
  scoringRules: {
    mustReward: [
      '开门旺相且生日干',
      '值符生日干或与日干同宫比和',
      '日干与时干相生或同宫，且不逢空亡',
      '值使门旺相并生助日干',
      '年命落宫得开门、值符、吉门吉星扶助'
    ],
    mustPenalize: [
      '开门空亡、受克、入墓或临死门/杜门',
      '值符克日干或值符所在宫空亡',
      '日干受开门、时干、值符多重克制',
      '值使门空亡或临杜门导致流程闭塞',
      '景门临玄武/腾蛇/空亡，涉及简历、合同、汇报时需防文书不实',
      '年命受克或空亡，尤其用于重大跳槽、升迁、创业判断'
    ]
  },
  outputRequirements: {
    analysisYongshenMustMention: [
      '日干落宫状态',
      '开门落宫状态',
      '值符与日干关系',
      '值使门/时干代表的流程趋势',
      '若有年命，必须说明年命落宫对长期职业判断的影响'
    ],
    scoreAuditMustIncludeAtLeastOneOf: ['开门', '值符', '值使门', '时干', '年命']
  },
  domainView: {
    type: 'career_business',
    title: '职业判断',
    axes: [
      { key: 'self', label: '本人状态', symbol: '日干' },
      { key: 'position', label: '岗位机会', symbol: '开门' },
      { key: 'authority', label: '领导态度', symbol: '值符' }
    ],
    process: { label: '流程推进', symbols: ['值使门', '时干'] },
    timing: { label: '职业应期' },
    decision: { label: '行动取舍' }
  }
};

const relationshipYongshenRule = {
  category: 'relationship',
  label: '婚姻感情/恋爱复合/关系走向',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch22-v1',
  systems: ['专用用神', '日时一对一系统', '年命系统', '干支系统'],
  yongshen: {
    primary: [
      {
        symbol: '乙',
        role: '女方、妻子或女性关系主体',
        layer: 'female',
        method: '专用用神',
        judge: '看乙奇落宫的旺衰、门星神、空亡和与庚/六合的生克，判断女方状态与关系承接力。'
      },
      {
        symbol: '庚',
        role: '男方、丈夫或男性关系主体',
        layer: 'male',
        method: '专用用神',
        judge: '看庚落宫的旺衰、门星神、空亡和与乙/六合的生克，判断男方状态、行动力与压力来源。'
      },
      {
        symbol: '六合',
        role: '婚姻整体、关系黏合度、媒介撮合',
        layer: 'bond',
        method: '专用用神',
        judge: '六合旺相、生合乙庚为关系可维系；六合空亡、受克、临死门/玄武，则关系整体稳定性下降。'
      }
    ],
    secondary: [
      {
        symbol: '日干/时干',
        role: '当下互动状态与追求过程',
        layer: 'interaction',
        method: '日时一对一系统',
        judge: '日时相生、比和主互动顺；相克、空亡、临凶门主短期沟通阻力。'
      },
      {
        symbol: '丙/丁',
        role: '男性/女性第三者或外部情感干扰',
        layer: 'interference',
        method: '专用用神',
        judge: '丙丁与乙庚生合、同宫或乘玄武桃花时，需要判断第三者、旧情或隐秘关系。'
      },
      {
        symbol: '双方年命',
        role: '长期缘分与根本吉凶',
        layer: 'life_anchor',
        method: '年命系统',
        requiresBazi: true,
        judge: '双方年命相生、比和且得吉门吉星，主长期缘分仍可承载；年命相克或空亡，长期稳定性不足。'
      }
    ],
    contextual: []
  },
  judgmentOrder: [
    '先看乙庚：判断男女双方状态和彼此生克。',
    '再看六合：判断婚姻或关系整体能否承载。',
    '再看日干/时干：判断当下互动、追求或沟通状态。',
    '若出现丙丁、玄武、桃花等信号，再判断第三者或旧情干扰。',
    '若提供双方年命，再判断长期缘分与根本稳定性。'
  ],
  scoringRules: {
    mustReward: ['乙庚相生或比和', '六合旺相并生助乙庚', '日时相生且不逢空亡', '双方年命相生或比和'],
    mustPenalize: ['乙庚相克且临凶门凶神', '六合空亡、受克或临死门/玄武', '丙丁构成明显第三者干扰', '年命相克或空亡']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['乙落宫状态', '庚落宫状态', '六合代表的关系整体', '日时互动趋势', '第三者或外部干扰是否成立'],
    scoreAuditMustIncludeAtLeastOneOf: ['乙', '庚', '六合', '日干/时干', '丙/丁']
  },
  domainView: {
    type: 'relationship',
    title: '关系判断',
    axes: [
      { key: 'female', label: '女方状态', symbol: '乙' },
      { key: 'male', label: '男方状态', symbol: '庚' },
      { key: 'bond', label: '婚姻整体', symbol: '六合' }
    ],
    process: { label: '关系阻力', symbols: ['丙', '丁', '值使门', '日时'] },
    timing: { label: '关系应期' },
    decision: { label: '沟通取舍' }
  }
};

const financeWealthYongshenRule = {
  category: 'finance_wealth',
  label: '财运投资/生意利润/交易收款',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch22-v1',
  systems: ['专用用神', '日时一对一系统', '年命系统', '干支系统'],
  yongshen: {
    primary: [
      {
        symbol: '戊',
        role: '本金资金、资本盘、主财根基',
        layer: 'capital',
        method: '专用用神',
        judge: '戊旺相、不空、不受克为本金有根；戊空亡、击刑、入墓或受克，主资金虚浮、被困或破财。'
      },
      {
        symbol: '生门',
        role: '利润收益、财路入口、收益空间',
        layer: 'profit',
        method: '专用用神',
        judge: '生门旺相并生助日干或戊，主收益可期；生门休囚、受克、空亡，主利润薄或财路不稳。'
      },
      {
        symbol: '日干',
        role: '我方、求财者、投资人或交易主导方',
        layer: 'self',
        method: '干支系统',
        judge: '日干得生扶、有吉门吉星，主我方判断和掌控力较强；受克或空亡，则主被动。'
      },
      {
        symbol: '时干',
        role: '对方、货物、交易事项或短期走势',
        layer: 'counterparty',
        method: '日时一对一系统',
        judge: '时干生日干或与日干比和，交易较顺；时干克日干、临玄武/白虎/空亡，需防欺诈、质量或对手方风险。'
      }
    ],
    secondary: [
      {
        symbol: '景门',
        role: '合同、票据、信息披露、宣传包装',
        layer: 'document',
        method: '专用用神',
        judge: '景门临玄武/腾蛇/空亡，合同文书、信息披露或宣传口径容易有隐患。'
      },
      {
        symbol: '年命',
        role: '长期财运承载力与重大投资根基',
        layer: 'life_anchor',
        method: '年命系统',
        requiresBazi: true,
        judge: '重大投资需看年命是否承得住财；年命受克或空亡，即使短线有利也不宜重仓。'
      }
    ],
    contextual: []
  },
  judgmentOrder: [
    '先看戊：判断本金、资金根基和破财风险。',
    '再看生门：判断利润空间和财路是否成形。',
    '再看日干与时干：判断我方和对方/货物/交易事项的生克关系。',
    '涉及合同、票据、真假信息时，重点补看景门、玄武、腾蛇。',
    '重大投资或长期合作，再看年命承载力。'
  ],
  scoringRules: {
    mustReward: ['戊旺相且不逢空亡', '生门旺相并生助日干或戊', '时干生日干或日时比和', '景门清明且不临玄武/腾蛇'],
    mustPenalize: ['戊空亡、入墓、击刑或受克', '生门休囚、受克或空亡', '时干克日干且临玄武/白虎', '景门临玄武/腾蛇/空亡', '年命受克或空亡时不宜重仓']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['戊代表的本金资金状态', '生门代表的利润收益状态', '日干与时干的交易关系', '景门/玄武/腾蛇对应的合同信息风险'],
    scoreAuditMustIncludeAtLeastOneOf: ['戊', '生门', '日干', '时干', '景门']
  },
  domainView: {
    type: 'finance_wealth',
    title: '财运交易判断',
    axes: [
      { key: 'capital', label: '本金资金', symbol: '戊' },
      { key: 'profit', label: '利润收益', symbol: '生门' },
      { key: 'self', label: '我方掌控', symbol: '日干' },
      { key: 'counterparty', label: '对方/货物', symbol: '时干' }
    ],
    process: { label: '交易风险', symbols: ['景门', '玄武', '白虎'] },
    timing: { label: '得财应期' },
    decision: { label: '进退取舍' }
  }
};

const healthActionYongshenRule = {
  category: 'health_action',
  label: '健康疾病/病情诊断/治疗效果',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch36-v1',
  systems: ['专用用神', '年命系统', '干支系统', '日时一对一系统'],
  yongshen: {
    primary: [
      {
        symbol: '天芮星',
        role: '疾病、病灶、病情性质',
        layer: 'disease',
        method: '专用用神',
        judge: '看天芮星落宫、旺衰、门神干和是否临庚、死门、白虎，判断病灶部位、病势轻重和危险性。'
      },
      {
        symbol: '日干',
        role: '病人当前生命力与身体承受力',
        layer: 'patient',
        method: '干支系统',
        judge: '日干旺相、临吉门吉星且不受天芮冲克，主身体承受力尚可；落死墓绝、空亡或受天芮冲克，主风险升高。'
      },
      {
        symbol: '年命',
        role: '生死关键与长期体质根基',
        layer: 'life_anchor',
        method: '年命系统',
        requiresBazi: true,
        judge: '重病、久病、生死判断必须看年命；年命落宫旺相得生为吉，落死墓绝、空亡、被天芮冲克为凶。'
      }
    ],
    secondary: [
      {
        symbol: '天心星',
        role: '西医、医生、治疗方案',
        layer: 'doctor',
        method: '专用用神',
        judge: '天心星能克制天芮星，主治疗有效；天心受克、空亡或被天芮反制，主医生方案受阻。'
      },
      {
        symbol: '乙',
        role: '中医、药物、调理方案',
        layer: 'medicine',
        method: '专用用神',
        judge: '乙奇能制病或生日干，主药物调理有效；乙受克空亡，主药效不足或调理慢。'
      },
      {
        symbol: '时干',
        role: '病情当前表现与短期趋势',
        layer: 'event',
        method: '日时一对一系统',
        judge: '时干与天芮、日干的关系用于判断病情短期变化、检查结果和突发趋势。'
      }
    ],
    contextual: [
      {
        symbol: '开门',
        role: '手术、医疗处置、检查开刀',
        layer: 'treatment_action',
        method: '专用用神',
        appliesTo: ['手术', '检查', '治疗处置']
      },
      {
        symbol: '白虎',
        role: '疼痛、伤灾、手术血光、急症',
        layer: 'acute_risk',
        method: '八神系统',
        appliesTo: ['急症', '手术', '外伤', '疼痛']
      }
    ]
  },
  judgmentOrder: [
    '先看天芮星：判断疾病、病灶、病势轻重。',
    '再看日干/年命：判断病人生命力和能否承受病势。',
    '再看天心星与乙奇：判断医生、药物和治疗效果。',
    '再看时干与八门八神：判断短期病情变化、心理精神状态与急症风险。',
    '新病与久病要区分：新病逢空亡或反吟可有转机，久病逢空亡或反吟需更谨慎。'
  ],
  scoringRules: {
    mustReward: ['天心星或乙奇克制天芮星', '日干/年命旺相并得吉门吉星', '天芮星受制且不临死门/白虎', '新病逢空亡或反吟可视为病势有变'],
    mustPenalize: ['日干/年命落死墓绝或空亡', '天芮星旺相且冲克日干/年命', '天芮星临庚、死门、白虎', '久病逢空亡或反吟', '治疗用神天心星/乙奇受克或空亡']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['天芮星代表的病情状况', '日干/年命代表的病人生命力', '天心星/乙奇代表的治疗效果', '时干代表的病情短期趋势'],
    scoreAuditMustIncludeAtLeastOneOf: ['天芮星', '日干', '年命', '天心星', '乙', '时干']
  },
  domainView: {
    type: 'health_action',
    title: '健康病情判断',
    axes: [
      { key: 'disease', label: '病情状况', symbol: '天芮星' },
      { key: 'vitality', label: '病人生命力', symbol: '日干/年命' },
      { key: 'treatment', label: '治疗有效率', symbol: '天心星/乙' }
    ],
    process: { label: '短期趋势', symbols: ['时干', '八门', '八神'] },
    timing: { label: '病情应期' },
    decision: { label: '就医取舍' }
  }
};

const itemTransactionYongshenRule = {
  category: 'item_transaction',
  label: '失物寻物/被盗查找/交易物品',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch33-v1',
  systems: ['干支系统', '日时一对一系统', '专用用神', '宫位系统'],
  yongshen: {
    primary: [
      {
        symbol: '日干',
        role: '失主、求测人',
        layer: 'owner',
        method: '干支系统',
        judge: '日干代表失主状态；日干旺相、得时干生扶，主有找回主动权；日干受克空亡，主寻找被动。'
      },
      {
        symbol: '时干',
        role: '失物、所找之物、当前物品状态',
        layer: 'lost_item',
        method: '日时一对一系统',
        judge: '时干为失物核心，用其落宫内外盘定远近，门星神干定位置、状态和能否找回。'
      },
      {
        symbol: '值使门',
        role: '寻找方向、事态推进、线索入口',
        layer: 'search_process',
        method: '专用用神',
        judge: '值使门用于判断从哪里找、线索如何推进；旺相生日干为有线索，空亡受克为线索断。'
      }
    ],
    secondary: [
      {
        symbol: '玄武',
        role: '盗贼、隐匿、暗处、欺瞒',
        layer: 'theft_risk',
        method: '八神系统',
        judge: '时干临玄武或受玄武冲克，多主被盗、被藏、有人隐瞒。'
      },
      {
        symbol: '天蓬星',
        role: '盗贼、风险人物、暗昧处',
        layer: 'thief',
        method: '九星系统',
        judge: '天蓬星关联时干或失物宫时，需判断被盗或被人拿走。'
      },
      {
        symbol: '伤门',
        role: '车辆、机械、损坏、行动工具',
        layer: 'vehicle',
        method: '专用用神',
        judge: '机动车、车辆被盗或机械物品，需重点看伤门。'
      }
    ],
    contextual: []
  },
  judgmentOrder: [
    '先看日干与时干生克：判断能否找回。',
    '再看时干内外盘和落宫：判断远近、方向、位置环境。',
    '再看玄武/天蓬：判断自遗、被盗或有人隐瞒。',
    '车辆机械类补看伤门。',
    '最后看庚格、冲合、空亡填冲，判断找回时间。'
  ],
  scoringRules: {
    mustReward: ['时干生日干或日时比和', '日时同落内盘', '反吟局或庚格利于破案找回', '时干旺相且不空亡'],
    mustPenalize: ['时干克日干', '时干空亡、入墓或落绝地', '时干临玄武/天蓬或被其冲克', '伏吟局线索闭塞', '伤门受克且车辆类问题']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['日干代表的失主状态', '时干代表的失物状态', '内外盘代表的远近方向', '玄武/天蓬代表的被盗可能', '值使门代表的寻找线索'],
    scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '值使门', '玄武', '天蓬星', '伤门']
  },
  domainView: {
    type: 'item_transaction',
    title: '失物寻回判断',
    axes: [
      { key: 'owner', label: '失主状态', symbol: '日干' },
      { key: 'item', label: '失物状态', symbol: '时干' },
      { key: 'theft', label: '被盗可能', symbol: '玄武/天蓬' }
    ],
    process: { label: '寻找线索', symbols: ['值使门', '内外盘', '伤门'] },
    timing: { label: '寻回应期' },
    decision: { label: '查找策略' }
  }
};

const examStudyYongshenRule = {
  category: 'exam_study',
  label: '求学考试/升学录取/成绩发挥',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch29-v1',
  systems: ['干支系统', '年命系统', '专用用神'],
  yongshen: {
    primary: [
      {
        symbol: '日干',
        role: '考生、本人临场状态',
        layer: 'student',
        method: '干支系统',
        judge: '日干旺相、得吉门吉星和考试用神生扶，主状态好；空亡、入墓、死绝，主发挥受限。'
      },
      {
        symbol: '天辅星',
        role: '考试院、考场、学业能力、评审环境',
        layer: 'exam_authority',
        method: '专用用神',
        judge: '天辅星生日干或与日干比和，主考试环境、评审和学业能力有利；克日干主录取压力。'
      },
      {
        symbol: '年干',
        role: '录取学校、官方名额、招生方',
        layer: 'school',
        method: '干支系统',
        judge: '年干落宫生日干或考生克年干，主有录取机会；年干克考生，主学校门槛高或竞争强。'
      }
    ],
    secondary: [
      {
        symbol: '景门',
        role: '试卷、理科题目、答题表现',
        layer: 'paper',
        method: '专用用神',
        judge: '景门旺相清明主答题表现好；休囚、空亡、入墓或临天芮，主错漏。'
      },
      {
        symbol: '丁',
        role: '文章、文科、文字表达',
        layer: 'writing',
        method: '三奇系统',
        judge: '丁奇旺相得吉格，主文书表达、作文、文科发挥佳；受克空亡则文字失分。'
      },
      {
        symbol: '年命',
        role: '考生长期学业根基',
        layer: 'life_anchor',
        method: '年命系统',
        requiresBazi: true,
        judge: '年命得天辅、景门、丁奇扶助，主学业根基能承；受克空亡则长期准备不足。'
      }
    ],
    contextual: [
      {
        symbol: '值符',
        role: '主考官、关键评审人、权威评价',
        layer: 'judge',
        method: '专用用神',
        appliesTo: ['面试', '复试', '评审', '公务员考试']
      }
    ]
  },
  judgmentOrder: [
    '先看日干/年命，判断考生状态和根基。',
    '再看天辅星与年干，判断考试院、学校和录取方是否有利。',
    '再看景门/丁奇，判断试卷、文章、答题发挥。',
    '复试、面试、评审类补看值符。'
  ],
  scoringRules: {
    mustReward: ['天辅星或年干生日干/年命', '日干旺相并得吉门吉星', '景门或丁奇旺相得吉格', '考生克天辅/年干可视为能攻克考试'],
    mustPenalize: ['日干/年命空亡、入墓、死绝', '天辅星或年干克日干', '景门/丁奇休囚、空亡、入墓或临天芮', '值符克考生且用于面试评审']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['日干/年命代表的考生状态', '天辅星代表的考试环境', '年干代表的学校/录取方', '景门/丁奇代表的试卷文章表现'],
    scoreAuditMustIncludeAtLeastOneOf: ['日干', '年命', '天辅星', '年干', '景门', '丁']
  },
  domainView: {
    type: 'exam_study',
    title: '考试录取判断',
    axes: [
      { key: 'student', label: '考生状态', symbol: '日干/年命' },
      { key: 'exam', label: '考试环境', symbol: '天辅星' },
      { key: 'school', label: '录取方', symbol: '年干' }
    ],
    process: { label: '发挥表现', symbols: ['景门', '丁奇', '值符'] },
    timing: { label: '考试应期' },
    decision: { label: '备考取舍' }
  }
};

const lawsuitLegalYongshenRule = {
  category: 'lawsuit_legal',
  label: '官司诉讼/民事刑事/胜败刑罚',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch35-v1',
  systems: ['主客系统', '专用用神', '干支系统'],
  yongshen: {
    primary: [
      {
        symbol: '值符',
        role: '原告、起诉方、主张方',
        layer: 'plaintiff',
        method: '主客系统',
        judge: '值符旺相并克制天乙，主原告或主张方占优；值符受克空亡，则主诉求弱。'
      },
      {
        symbol: '天乙',
        role: '被告、应诉方、对方',
        layer: 'defendant',
        method: '主客系统',
        judge: '天乙旺相并克值符，主被告或对方更强；天乙受制，主对方承压。'
      },
      {
        symbol: '开门',
        role: '法官、法院、裁判机关',
        layer: 'court',
        method: '专用用神',
        judge: '开门生助我方用神，主法院倾向有利；开门克我方，主裁判压力。'
      }
    ],
    secondary: [
      {
        symbol: '景门',
        role: '诉状、法律文书、公开陈述',
        layer: 'document',
        method: '专用用神',
        judge: '景门清明主文书有效；空亡、玄武主诉状不实、证据表达不足或不被受理。'
      },
      {
        symbol: '惊门',
        role: '律师、辩论、争执口舌',
        layer: 'lawyer',
        method: '专用用神',
        judge: '惊门得力主律师辩论有效；受克空亡主代理或辩护不给力。'
      },
      {
        symbol: '六合',
        role: '证据、证人、调解与和解',
        layer: 'evidence',
        method: '专用用神',
        judge: '六合旺相主证据链、证人或调解有用；六合空亡受克主证据不足或和解难。'
      },
      {
        symbol: '辛',
        role: '嫌疑人、罪人、刑事责任点',
        layer: 'criminal_subject',
        method: '干支系统',
        judge: '刑事案件看辛及其是否入墓、临天罗地网、受庚刑克，以断刑罚轻重。'
      }
    ],
    contextual: []
  },
  judgmentOrder: [
    '民事先看值符与天乙生克，判断原被告胜负。',
    '再看开门，判断法官/法院对哪一方有利。',
    '再看景门、惊门、六合，判断诉状、律师和证据。',
    '刑事案件补看辛、壬癸天牢地网、庚辛刑克，判断刑罚风险。'
  ],
  scoringRules: {
    mustReward: ['我方用神旺相并克制对方', '开门生助我方用神', '景门清明且六合有力', '辛金逢丁奇或有救应'],
    mustPenalize: ['开门克我方用神', '景门空亡或临玄武导致文书证据不稳', '六合空亡受克导致证据不足', '辛或用神临壬癸、入墓、天罗地网', '庚加辛等刑罚重象']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['值符与天乙代表的原被告强弱', '开门代表的法院/法官倾向', '景门代表的诉状文书', '惊门/六合代表的律师证据', '刑事案件需说明辛及天罗地网风险'],
    scoreAuditMustIncludeAtLeastOneOf: ['值符', '天乙', '开门', '景门', '惊门', '六合', '辛']
  },
  domainView: {
    type: 'lawsuit_legal',
    title: '诉讼胜败判断',
    axes: [
      { key: 'plaintiff', label: '原告/主张方', symbol: '值符' },
      { key: 'defendant', label: '被告/对方', symbol: '天乙' },
      { key: 'court', label: '法院倾向', symbol: '开门' }
    ],
    process: { label: '证据与辩护', symbols: ['景门', '惊门', '六合'] },
    timing: { label: '诉讼应期' },
    decision: { label: '诉讼策略' }
  }
};

const fengshuiHouseYongshenRule = {
  category: 'fengshui_house',
  label: '风水阳宅/阴宅/家宅气场',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch39-ch40-v1',
  systems: ['宫位系统', '专用用神', '年命系统', '干支系统'],
  yongshen: {
    primary: [
      {
        symbol: '生门',
        role: '阳宅、房屋、本宅生气',
        layer: 'yang_house',
        method: '专用用神',
        judge: '阳宅以生门为本体；生门旺相生日干/年命，主宅气养人；生门空亡、受克、入墓，主宅气散或不利居者。'
      },
      {
        symbol: '死门',
        role: '阴宅、祖坟、土地墓穴',
        layer: 'yin_house',
        method: '专用用神',
        judge: '阴宅以死门为本体；死门得位且生助年命为吉，受克、空亡、临凶神煞则主阴宅不安。'
      },
      {
        symbol: '日干',
        role: '居住者、求测人',
        layer: 'resident',
        method: '干支系统',
        judge: '日干与宅体用神相生比和，主人与宅相合；宅体克日干，主宅伤人。'
      },
      {
        symbol: '时干',
        role: '宅现状、当前环境气机',
        layer: 'house_status',
        method: '日时一对一系统',
        judge: '时干用于判断当前房屋现状、气场变化和即时问题。'
      }
    ],
    secondary: [
      {
        symbol: '值符',
        role: '大环境、坐山、外部格局',
        layer: 'macro_environment',
        method: '专用用神',
        judge: '值符定大环境和坐山气势；旺相得吉主环境有力，受克空亡主外局不佳。'
      },
      {
        symbol: '值使门',
        role: '大门、明堂、纳气口',
        layer: 'gate',
        method: '专用用神',
        judge: '值使门判断大门、明堂与纳气入口，旺相生宅生人为吉，空亡受克主门路不通。'
      },
      {
        symbol: '天芮星',
        role: '隐患、病符、潮湿破损',
        layer: 'hidden_risk',
        method: '专用用神',
        judge: '天芮星关联宅体时，主病符、隐患、潮湿、破损或不洁。'
      },
      {
        symbol: '庚/辛',
        role: '煞气、金属尖角、路冲刑伤',
        layer: 'sha',
        method: '干支系统',
        judge: '庚辛临凶门凶神并冲克宅体或日干，多主煞气、刀兵、尖角、路冲等不利。'
      }
    ],
    contextual: []
  },
  judgmentOrder: [
    '先看值符，判断大环境与坐山外局。',
    '阳宅看生门，阴宅看死门，判断宅体本身吉凶。',
    '再看日干/年命与宅体用神生克，判断宅人相合度。',
    '再看时干和值使门，判断宅现状、大门和明堂纳气。',
    '最后查天芮、庚辛、白虎、玄武等隐患和煞气。'
  ],
  scoringRules: {
    mustReward: ['生门/死门旺相并生日干或年命', '值符大环境得吉门吉星', '值使门旺相纳气顺', '宅体得三奇吉格'],
    mustPenalize: ['生门/死门克日干或年命', '宅体空亡、入墓、击刑、门迫', '宅体临白虎、玄武、庚/辛等煞气', '天芮星关联宅体主隐患病符']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['值符代表的大环境', '生门/死门代表的阳宅/阴宅本体', '日干/年命代表的宅人相合度', '值使门代表的大门明堂', '天芮/庚辛代表的隐患煞气'],
    scoreAuditMustIncludeAtLeastOneOf: ['值符', '生门', '死门', '日干', '年命', '值使门', '天芮星', '庚/辛']
  },
  domainView: {
    type: 'fengshui_house',
    title: '家宅风水判断',
    axes: [
      { key: 'macro', label: '大环境', symbol: '值符' },
      { key: 'house', label: '宅体气场', symbol: '生门/死门' },
      { key: 'resident', label: '宅人相合', symbol: '日干/年命' }
    ],
    process: { label: '门路与隐患', symbols: ['值使门', '天芮星', '庚/辛'] },
    timing: { label: '风水应期' },
    decision: { label: '调整建议' }
  }
};

const pregnancyBirthYongshenRule = {
  category: 'pregnancy_birth',
  label: '孕产受孕/胎儿母体/分娩安危',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch31-v1',
  systems: ['专用用神', '宫位系统', '干支系统'],
  yongshen: {
    primary: [
      {
        symbol: '天芮星',
        role: '母体、子宫、孕产病理状态',
        layer: 'mother_body',
        method: '专用用神',
        judge: '天芮星和坤宫用于判断母体、子宫、孕产相关病理；临开休生门较利受孕，临死杜庚等阻隔则不利。'
      },
      {
        symbol: '坤宫',
        role: '母体、腹部、子宫承载环境',
        layer: 'womb',
        method: '宫位系统',
        judge: '坤宫状态用于判断母体承载、胎位和孕产环境；旺相得吉为安，受克临凶为忧。'
      },
      {
        symbol: '六合',
        role: '胎儿、胎孕关系、母子连接',
        layer: 'fetus',
        method: '专用用神',
        judge: '六合旺相并生母体用神，主胎儿状态稳；六合受克空亡，主胎孕不稳或连接不足。'
      }
    ],
    secondary: [
      {
        symbol: '值使门',
        role: '胎儿、生产过程、分娩推进',
        layer: 'delivery_process',
        method: '专用用神',
        judge: '值使门用于判断生产过程顺逆，旺相生母为顺，克母或临凶门白虎则需防手术伤灾。'
      },
      {
        symbol: '辛',
        role: '精子质量、受孕关键点',
        layer: 'conception_seed',
        method: '干支系统',
        judge: '求受孕时辛金代表精子质量；辛旺相乘吉为佳，击刑、入墓、临壬癸天网为不利。'
      },
      {
        symbol: '日干/时干',
        role: '母与子、当前孕产事件',
        layer: 'mother_child_event',
        method: '日时一对一系统',
        judge: '日时生克用于判断母子关系、孕产当前状态和短期变化。'
      }
    ],
    contextual: [
      {
        symbol: '白虎',
        role: '手术、伤灾、剖腹产风险',
        layer: 'surgery_risk',
        method: '八神系统',
        appliesTo: ['分娩', '剖腹产', '手术']
      }
    ]
  },
  judgmentOrder: [
    '先看天芮星/坤宫，判断母体、子宫和受孕环境。',
    '求受孕补看辛金，判断受孕关键条件。',
    '再看六合、值使门，判断胎儿和生产过程。',
    '比较母子用神生克，判断母子安危与分娩顺逆。',
    '临白虎、死杜、庚辛刑伤时，需提示医疗检查和手术风险。'
  ],
  scoringRules: {
    mustReward: ['天芮星临开门/休门/生门', '辛金旺相乘吉', '六合旺相并生母体用神', '值使门生母且不临凶门凶神'],
    mustPenalize: ['天芮带庚或临死门/杜门', '辛金击刑、入墓或临壬癸天网', '子克母', '六合空亡受克', '白虎或凶门提示手术伤灾风险']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['天芮星/坤宫代表的母体子宫状态', '辛金代表的受孕关键条件', '六合/值使门代表的胎儿与分娩过程', '日时代表的母子当前关系', '白虎/凶门代表的手术风险'],
    scoreAuditMustIncludeAtLeastOneOf: ['天芮星', '坤宫', '辛', '六合', '值使门', '日干/时干', '白虎']
  },
  domainView: {
    type: 'pregnancy_birth',
    title: '孕产安危判断',
    axes: [
      { key: 'conception', label: '受孕条件', symbol: '天芮星/辛' },
      { key: 'mother', label: '母体状态', symbol: '坤宫/日干' },
      { key: 'fetus', label: '胎儿状态', symbol: '六合/值使门' }
    ],
    process: { label: '分娩风险', symbols: ['白虎', '凶门', '日时'] },
    timing: { label: '孕产应期' },
    decision: { label: '就医取舍' }
  }
};

const generalYongshenRule = {
  category: 'general',
  label: '日常杂事/时机选择/泛问题',
  ruleset: 'mainline-cn-v1/book-buchuiniu-ch22-v1',
  systems: ['干支系统', '日时一对一系统', '专用用神'],
  yongshen: {
    primary: [
      {
        symbol: '日干',
        role: '求测人本人',
        layer: 'subject',
        method: '干支系统',
        judge: '看本人状态、主动权、所临门星神与空亡。'
      },
      {
        symbol: '时干',
        role: '所问之事与短期趋势',
        layer: 'event',
        method: '日时一对一系统',
        judge: '看事情与本人之间的生克、同宫、冲动、空亡。'
      },
      {
        symbol: '值使门',
        role: '事情执行过程',
        layer: 'process',
        method: '专用用神',
        judge: '看流程顺逆、推进阻力和执行窗口。'
      }
    ],
    secondary: [],
    contextual: []
  },
  judgmentOrder: [
    '先看日干，判断求测人状态。',
    '再看时干，判断所问之事当前趋势。',
    '再看值使门，判断执行过程顺逆。'
  ],
  scoringRules: {
    mustReward: ['日时相生或同宫', '值使门旺相并生助日干'],
    mustPenalize: ['日干或时干空亡', '值使门空亡、休囚或临凶门']
  },
  outputRequirements: {
    analysisYongshenMustMention: ['日干落宫状态', '时干落宫状态', '值使门代表的流程趋势'],
    scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '值使门']
  }
};

const QIMEN_YONGSHEN_RULES = {
  career_business: careerBusinessYongshenRule,
  finance_wealth: financeWealthYongshenRule,
  relationship: relationshipYongshenRule,
  health_action: healthActionYongshenRule,
  item_transaction: itemTransactionYongshenRule,
  exam_study: examStudyYongshenRule,
  lawsuit_legal: lawsuitLegalYongshenRule,
  fengshui_house: fengshuiHouseYongshenRule,
  pregnancy_birth: pregnancyBirthYongshenRule,
  general: generalYongshenRule
};

function createSubcategoryRule(baseRule, subcategory, overrides = {}) {
  return {
    ...baseRule,
    ...overrides,
    category: baseRule.category,
    subcategory,
    label: overrides.label || baseRule.label,
    ruleset: overrides.ruleset || `${baseRule.ruleset}/subcategory-${subcategory}`,
    systems: overrides.systems || baseRule.systems,
    domainView: overrides.domainView || baseRule.domainView
  };
}

const QIMEN_SUBCATEGORY_YONGSHEN_RULES = {
  finance_wealth: {
    general_wealth: createSubcategoryRule(financeWealthYongshenRule, 'general_wealth', {
      label: '笼统财运/整体求财',
      yongshen: {
        primary: [
          {
            symbol: '生门',
            role: '财路、产业、收益入口',
            layer: 'wealth_gate',
            method: '专用用神',
            judge: '生门旺相、生日干或年命，主财路有根；生门空亡、休囚或受克，主财气不实或收益难落地。'
          },
          {
            symbol: '日干',
            role: '求测人本人',
            layer: 'self',
            method: '干支系统',
            judge: '日干得财门生扶，主本人能承财；日干受克或空亡，主求财被动。'
          },
          {
            symbol: '年命',
            role: '长期财运承载力',
            layer: 'life_anchor',
            method: '年命系统',
            requiresBazi: true,
            judge: '年命得生门、吉门吉星扶助，主长期财运可承；年命受克或空亡，主财来难守。'
          }
        ],
        secondary: financeWealthYongshenRule.yongshen.secondary,
        contextual: []
      },
      judgmentOrder: [
        '先看生门：判断财路是否成形、收益入口是否真实。',
        '再看日干：判断求测人能否承接财气。',
        '若提供八字或出生年，再看年命：判断长期财运承载力。',
        '最后补看景门、玄武、腾蛇，判断信息、合同或包装风险。'
      ],
      outputRequirements: {
        analysisYongshenMustMention: ['生门代表的财路收益状态', '日干代表的求财承接力', '若有年命，必须说明长期财运承载力'],
        scoreAuditMustIncludeAtLeastOneOf: ['生门', '日干', '年命']
      }
    }),
    service_brokerage: createSubcategoryRule(financeWealthYongshenRule, 'service_brokerage', {
      label: '空手求财/中介撮合/服务佣金',
      systems: ['日时一对一系统', '专用用神', '干支系统'],
      yongshen: {
        primary: [
          {
            symbol: '日干',
            role: '我方、服务提供者、求财者',
            layer: 'self',
            method: '干支系统',
            judge: '日干旺相并得六合、时干生扶，主自己能促成撮合或服务变现；受克空亡则主主动权弱。'
          },
          {
            symbol: '时干',
            role: '客户、事项、佣金机会',
            layer: 'event',
            method: '日时一对一系统',
            judge: '时干生日干或与日干比和，主客户/事项向我方靠拢；时干克日干，主对方压价或机会难成。'
          },
          {
            symbol: '六合',
            role: '中介、撮合、合作链路',
            layer: 'broker',
            method: '专用用神',
            judge: '六合旺相并生合日时，主撮合关系顺；六合空亡、受克或临玄武，主中间环节虚、承诺不稳。'
          }
        ],
        secondary: [
          {
            symbol: '景门',
            role: '信息发布、宣传话术、合同凭证',
            layer: 'document',
            method: '专用用神',
            judge: '景门清明则信息有效；临玄武/腾蛇/空亡，需防口头承诺、虚假信息或合同不明。'
          }
        ],
        contextual: []
      },
      judgmentOrder: ['先看日干能否承接机会。', '再看时干代表的客户/事项是否向我方生合。', '重点看六合，判断中介撮合链路是否真实顺畅。', '涉及合同和信息发布时补看景门。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干代表的我方承接力', '时干代表的客户/事项状态', '六合代表的撮合链路', '景门代表的信息凭证风险'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '六合', '景门']
      }
    }),
    trade_buy_sell: createSubcategoryRule(financeWealthYongshenRule, 'trade_buy_sell', {
      label: '买卖交易/商品流通',
      systems: ['日时一对一系统', '干支系统', '专用用神'],
      yongshen: {
        primary: [
          {
            symbol: '日干',
            role: '我方、买卖主导方',
            layer: 'self',
            method: '干支系统',
            judge: '日干旺相或得时干/生门生扶，主我方掌控力强；受克空亡则主被动、议价弱。'
          },
          {
            symbol: '时干',
            role: '货物、对方、交易事项',
            layer: 'goods_counterparty',
            method: '日时一对一系统',
            judge: '时干状态决定货物质量或对方状态；时干生日干多利我，时干克日干多主对方强势或交易压力。'
          },
          {
            symbol: '生门',
            role: '交易利润与成交收益',
            layer: 'profit',
            method: '专用用神',
            judge: '生门旺相且与日时关系和顺，主有利润；生门空亡受克，主成交有名无利或利润薄。'
          }
        ],
        secondary: financeWealthYongshenRule.yongshen.secondary,
        contextual: []
      },
      judgmentOrder: ['先看日干，定我方状态。', '再看时干，定货物/对方/交易事项。', '重点比较日时生克，判断交易主动权和成交难易。', '最后看生门和景门，判断利润与合同信息风险。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干代表的我方掌控力', '时干代表的货物/对方状态', '日时生克代表的成交关系', '生门代表的利润空间'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '生门', '景门']
      }
    }),
    investment_business: createSubcategoryRule(financeWealthYongshenRule, 'investment_business', {
      label: '投资开店/办厂项目/实体经营',
      yongshen: financeWealthYongshenRule.yongshen,
      judgmentOrder: [
        '先看戊：判断本金、资本盘和资金是否被困。',
        '再看生门：判断利润空间和收益能否形成。',
        '再看开门：判断店铺、企业、项目平台的现状。',
        '再看日干/时干：判断我方与项目/合伙人/客户之间的关系。',
        '重大投入必须补看年命承载力。'
      ],
      outputRequirements: {
        analysisYongshenMustMention: ['戊代表的本金资本状态', '生门代表的利润收益状态', '开门代表的店铺/企业/项目平台', '日干与时干的项目关系'],
        scoreAuditMustIncludeAtLeastOneOf: ['戊', '生门', '开门', '日干', '时干']
      }
    }),
    debt_repayment: createSubcategoryRule(financeWealthYongshenRule, 'debt_repayment', {
      label: '借贷讨债/催收回款',
      systems: ['专用用神', '主客系统', '日时一对一系统'],
      yongshen: {
        primary: [
          {
            symbol: '值符',
            role: '债主、银行、放贷人、求测方的债权力量',
            layer: 'creditor',
            method: '专用用神',
            judge: '值符旺相、克制天乙或生助伤门，主债权方有压制和收回能力；值符空亡或受克，主债权力量弱。'
          },
          {
            symbol: '天乙',
            role: '借款人、欠债人、拖欠方',
            layer: 'debtor',
            method: '专用用神',
            judge: '天乙旺而克值符，主欠债人强势或拖延；天乙受制、空亡或被值符克，主对方承压，有还款机会。'
          },
          {
            symbol: '伤门',
            role: '讨债人、催收动作、施压手段',
            layer: 'collection_action',
            method: '专用用神',
            judge: '伤门旺相并克制欠债方，主催促有效；伤门空亡、受克或临凶象过重，主催收受阻或方式需谨慎。'
          }
        ],
        secondary: [
          {
            symbol: '生门',
            role: '利息、回款通道、对方可动用的钱路',
            layer: 'repayment_channel',
            method: '专用用神',
            judge: '生门旺相并与值符/伤门相通，主有回款通道；生门空亡受克，主钱路未开、只见承诺不见到账。'
          },
          {
            symbol: '景门',
            role: '借条、转账凭证、聊天记录、还款承诺',
            layer: 'evidence',
            method: '专用用神',
            judge: '景门清明主凭证清楚；临玄武/腾蛇/空亡，需防承诺反复、证据不足或信息不实。'
          },
          {
            symbol: '时干',
            role: '此笔欠款的当前状态与短期动向',
            layer: 'event',
            method: '日时一对一系统',
            judge: '时干被触发、冲空填实或与值符/伤门相生，主短期有消息或动作。'
          }
        ],
        contextual: []
      },
      judgmentOrder: ['先看值符：判断债主/债权方是否有力量。', '再看天乙：判断欠债人状态和是否承压。', '重点比较值符与天乙：值符克天乙，则收回概率提高；天乙克值符，则拖欠方更强。', '再看伤门：判断催收动作是否有效、是否适合施压。', '最后看生门、景门、时干，判断回款通道、凭证承诺和短期动向。'],
      scoringRules: {
        mustReward: ['值符旺相且克制天乙', '伤门旺相并能制欠债方', '生门被填实或与值符/伤门相通', '景门清明且凭证链路明确'],
        mustPenalize: ['值符空亡或受天乙克制', '天乙旺相且克值符', '伤门空亡或催收动作受制', '生门空亡受克导致回款通道未开', '景门临玄武/腾蛇/空亡导致承诺或证据不稳']
      },
      outputRequirements: {
        analysisYongshenMustMention: ['值符代表的债主力量', '天乙代表的欠债人状态', '伤门代表的催收动作', '生门代表的回款通道', '景门代表的凭证/承诺风险'],
        scoreAuditMustIncludeAtLeastOneOf: ['值符', '天乙', '伤门', '生门', '景门']
      },
      domainView: {
        type: 'finance_wealth',
        title: '欠款回收判断',
        axes: [
          { key: 'creditor', label: '债主力量', symbol: '值符' },
          { key: 'debtor', label: '欠债人状态', symbol: '天乙' },
          { key: 'collection', label: '催收动作', symbol: '伤门' },
          { key: 'repayment', label: '回款通道', symbol: '生门' }
        ],
        process: { label: '凭证与承诺', symbols: ['景门', '玄武', '时干'] },
        timing: { label: '还款应期' },
        decision: { label: '催收取舍' }
      }
    }),
    real_estate_trade: createSubcategoryRule(financeWealthYongshenRule, 'real_estate_trade', {
      label: '房产买卖/地皮交易',
      systems: ['专用用神', '干支系统', '日时一对一系统'],
      yongshen: {
        primary: [
          {
            symbol: '生门',
            role: '房屋、房产价值、可售性',
            layer: 'house',
            method: '专用用神',
            judge: '生门旺相主房屋价值和交易机会较好；生门空亡受克，主房屋状态、价格或成交难度有问题。'
          },
          {
            symbol: '死门',
            role: '地皮、土地、固定资产底层条件',
            layer: 'land',
            method: '专用用神',
            judge: '死门状态用于判断地皮、产权根基和固定资产底层风险。'
          },
          {
            symbol: '日干',
            role: '买卖主、求测方',
            layer: 'self',
            method: '干支系统',
            judge: '日干与生门/死门相生比和，主我方易承接交易；受克空亡则主被动或风险高。'
          }
        ],
        secondary: financeWealthYongshenRule.yongshen.secondary,
        contextual: []
      },
      judgmentOrder: ['先看生门，判断房屋价值和交易机会。', '再看死门，判断土地、产权和固定资产根基。', '再看日干与房屋/地皮用神的关系，定买卖主是否得利。', '最后看景门，判断合同产权信息风险。'],
      outputRequirements: {
        analysisYongshenMustMention: ['生门代表的房屋状态', '死门代表的地皮/产权根基', '日干代表的买卖主承接力', '景门代表的合同产权风险'],
        scoreAuditMustIncludeAtLeastOneOf: ['生门', '死门', '日干', '景门']
      }
    })
  },
  career_business: {
    job_search: createSubcategoryRule(careerBusinessYongshenRule, 'job_search', {
      label: '求职应聘/面试机会',
      judgmentOrder: ['先看日干/年命，判断求职者状态。', '再看开门，判断单位、岗位和职位机会。', '再看时干，判断本次求职事项。', '再看值使门，判断流程推进。', '补看景门/天辅星，判断简历、面试表达和专业能力。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干/年命代表的求职者状态', '开门代表的单位/岗位机会', '时干代表的本次求职事项', '值使门代表的流程推进', '景门/天辅星代表的简历面试与专业能力'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '开门', '时干', '值使门', '景门', '天辅星', '年命']
      }
    }),
    current_job_change: createSubcategoryRule(careerBusinessYongshenRule, 'current_job_change', {
      label: '现有工作/辞职跳槽/调动革职',
      judgmentOrder: ['先看日干，判断本人状态和主动权。', '再看开门，判断现有工作状态。', '重点看反吟、冲格、马星，判断调动、跳槽或职位变化。', '若开门受克、空亡或六仪击刑，需提示辞职、革职或工作伤害风险。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干代表的本人状态', '开门代表的现有工作状态', '马星/反吟/冲格代表的变动信号', '值使门/时干代表的短期流程'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '开门', '马星', '值使门', '时干']
      }
    }),
    promotion_title: createSubcategoryRule(careerBusinessYongshenRule, 'promotion_title', {
      label: '升迁晋升/职称评定',
      yongshen: {
        primary: [
          ...careerBusinessYongshenRule.yongshen.primary,
          {
            symbol: '天辅星',
            role: '职称、评委、专业资质、文书评审',
            layer: 'evaluation',
            method: '专用用神',
            judge: '天辅星旺相且生助日干/开门，主评审、职称、资质认可有利；受克空亡，主材料或评委端阻力。'
          }
        ],
        secondary: careerBusinessYongshenRule.yongshen.secondary,
        contextual: careerBusinessYongshenRule.yongshen.contextual
      },
      judgmentOrder: ['先看日干，判断本人资质与承压。', '再看开门，判断官职/职位。', '再看年干或值符，判断领导和一把手态度。', '职称评定必须看天辅星和景门，判断评委、材料、文书。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干代表的本人状态', '开门代表的职位/官职', '值符代表的领导态度', '天辅星代表的职称/评委/专业资质', '景门代表的材料文书'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '开门', '值符', '天辅星', '景门']
      }
    }),
    project_business: createSubcategoryRule(careerBusinessYongshenRule, 'project_business', {
      label: '项目推进/客户谈判/合作落地',
      judgmentOrder: ['先看日干，判断我方状态。', '再看时干，判断项目、客户或对方。', '再看开门，判断机会入口和商业场景。', '再看值符，判断关键负责人或决策层。', '合作撮合类补看六合，合同汇报类补看景门。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干代表的我方状态', '时干代表的项目/客户/对方状态', '开门代表的机会入口', '值符代表的关键负责人', '六合/景门代表的合作与合同信息'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干', '时干', '开门', '值符', '六合', '景门']
      }
    })
  },
  relationship: {
    single_romance: createSubcategoryRule(relationshipYongshenRule, 'single_romance', {
      label: '单身寻缘/何时遇对象',
      judgmentOrder: ['先看乙庚，判断男女缘分主体。', '再看六合，判断媒介、缘分入口和关系整体。', '补看太岁、年命和桃花位，判断何时容易出现对象。', '若日时相生或被应期触发，可作为近期相识窗口。'],
      outputRequirements: {
        analysisYongshenMustMention: ['乙代表的女性缘分状态', '庚代表的男性缘分状态', '六合代表的缘分入口/媒介', '年命/桃花位代表的长期缘分触发'],
        scoreAuditMustIncludeAtLeastOneOf: ['乙', '庚', '六合', '年命', '桃花']
      }
    }),
    pursuit_dating: createSubcategoryRule(relationshipYongshenRule, 'pursuit_dating', {
      label: '追求相亲/能否发展',
      judgmentOrder: ['先看日干与时干，判断我方和对方/此事的互动关系。', '再看乙庚，判断男女主体状态。', '再看六合，判断关系能否黏合。', '若景门/玄武异常，提示信息不实或表达误差。'],
      outputRequirements: {
        analysisYongshenMustMention: ['日干与时干代表的追求互动', '乙庚代表的男女主体状态', '六合代表的关系黏合度', '景门/玄武代表的信息真实性'],
        scoreAuditMustIncludeAtLeastOneOf: ['日干/时干', '乙', '庚', '六合', '景门']
      }
    }),
    love_conflict: createSubcategoryRule(relationshipYongshenRule, 'love_conflict', {
      label: '恋爱纠葛/第三者/多角关系',
      judgmentOrder: ['先看乙庚，判断双方本体。', '再看六合，判断关系整体。', '重点看丙丁、玄武、桃花，判断第三者、旧情或隐秘关系是否成立。', '最后看日时互动，判断沟通能否化解。'],
      outputRequirements: {
        analysisYongshenMustMention: ['乙庚双方状态', '六合代表的关系整体', '丙/丁代表的第三者或新旧情干扰', '玄武/桃花代表的隐秘关系信号'],
        scoreAuditMustIncludeAtLeastOneOf: ['乙', '庚', '六合', '丙/丁', '玄武']
      }
    }),
    marriage_existing: createSubcategoryRule(relationshipYongshenRule, 'marriage_existing', {
      label: '已婚关系/婚姻危机/同居',
      judgmentOrder: ['先看乙庚生克，定夫妻双方关系。', '再看六合，定婚姻整体承载力。', '若六合空亡或受克，需提示关系稳定性下降。', '补看癸/壬/己、天芮星、玄武等，判断私欲、同居、隐情或身体压力。'],
      outputRequirements: {
        analysisYongshenMustMention: ['乙庚生克代表的夫妻关系', '六合代表的婚姻整体', '癸/壬/己与天芮星代表的私欲/同居/隐情信号', '日时互动代表的当前沟通状态'],
        scoreAuditMustIncludeAtLeastOneOf: ['乙', '庚', '六合', '癸/壬/己', '天芮星']
      }
    }),
    online_romance: createSubcategoryRule(relationshipYongshenRule, 'online_romance', {
      label: '网恋真假/线上关系',
      yongshen: {
        primary: [
          ...relationshipYongshenRule.yongshen.primary,
          {
            symbol: '景门',
            role: '网络信息、聊天表达、线上形象',
            layer: 'online_info',
            method: '专用用神',
            judge: '景门清明主信息相对透明；景门临玄武/腾蛇/空亡，主包装、隐瞒、虚假身份或表达失真。'
          },
          {
            symbol: '玄武',
            role: '隐瞒、虚假、暧昧不明',
            layer: 'deception_risk',
            method: '专用用神',
            judge: '玄武强而关联乙庚/景门，必须提示线上身份、承诺或情感状态不透明。'
          }
        ],
        secondary: relationshipYongshenRule.yongshen.secondary,
        contextual: []
      },
      judgmentOrder: ['先看景门与玄武，判断线上信息真假。', '再看乙庚，判断男女主体。', '再看六合，判断关系是否能落地。', '最后看日时互动，判断线下见面或推进可能。'],
      outputRequirements: {
        analysisYongshenMustMention: ['景门代表的线上信息状态', '玄武代表的虚假隐瞒风险', '乙庚代表的男女主体状态', '六合代表的关系落地可能'],
        scoreAuditMustIncludeAtLeastOneOf: ['景门', '玄武', '乙', '庚', '六合']
      }
    })
  }
};

function getYongshenRule(category, subcategory = '') {
  const mainRule = QIMEN_YONGSHEN_RULES[category] || QIMEN_YONGSHEN_RULES.general;
  if (!subcategory) return mainRule;

  return QIMEN_SUBCATEGORY_YONGSHEN_RULES[category]?.[subcategory] || mainRule;
}

function formatYongshenItems(items, hasBaziInfo) {
  const visibleItems = items.filter((item) => hasBaziInfo || !item.requiresBazi);
  if (visibleItems.length === 0) return '无';

  return visibleItems
    .map((item, index) => {
      const appliesTo = item.appliesTo?.length ? `适用场景：${item.appliesTo.join('、')}。` : '';
      const judge = item.judge || '按该符号落宫的门、星、神、天地盘干、旺衰、空亡、马星综合判断。';
      return `${index + 1}. ${item.symbol}：${item.role}。${appliesTo}判断要点：${judge}`;
    })
    .join('\n');
}

function formatList(items) {
  if (!items || items.length === 0) return '- 无';
  return items.map((item) => `- ${item}`).join('\n');
}

function buildYongshenPromptSection({ intent = {}, rule, hasBaziInfo = false }) {
  const selectedRule = rule || getYongshenRule(intent.category);
  const outputMustMention = selectedRule.outputRequirements.analysisYongshenMustMention
    .filter((item) => hasBaziInfo || !item.includes('年命'));
  const scoreAuditCoreSymbols = selectedRule.outputRequirements.scoreAuditMustIncludeAtLeastOneOf
    .filter((item) => hasBaziInfo || item !== '年命');

  return `
**【精准定用神：${selectedRule.label}】**
取法系统：${selectedRule.systems.join('、')}

一、主用神，必须逐项判断，缺一不可：
${formatYongshenItems(selectedRule.yongshen.primary, hasBaziInfo)}

二、辅用神，用于判断流程、趋势和长期影响：
${formatYongshenItems(selectedRule.yongshen.secondary, hasBaziInfo)}

三、情境用神，若问题语义命中则补充判断：
${formatYongshenItems(selectedRule.yongshen.contextual || [], hasBaziInfo)}

四、判断顺序：
${selectedRule.judgmentOrder.map((item, index) => `${index + 1}. ${item}`).join('\n')}

五、信号方向（已计入【盘面评估】，你不用打分，在解读中体现其现实含义即可）：
有利信号：
${formatList(selectedRule.scoringRules.mustReward)}

不利信号：
${formatList(selectedRule.scoringRules.mustPenalize)}

六、解读要求：
用神卡片和各段解读中须逐项说明：
${formatList(outputMustMention)}

核心用神至少覆盖以下之一：
${formatList(scoreAuditCoreSymbols)}`;
}

function buildDomainViewPromptSection(rule) {
  if (!rule?.domainView) {
    return `
**【M2 领域用神卡片规则】**
本问题域没有专属卡片，按通用三卡输出：
- subject：求测人 = 日干
- target：目标事态、物品或对方 = 时干或本题主用神
- environment：关键环境 = 值使门、值符或关键门星神`;
  }

  const axes = rule.domainView.axes
    .map((axis) => `- ${axis.key}：${axis.label}（${axis.symbol}）`)
    .join('\n');
  const { process, timing, decision } = rule.domainView;

  return `
**【M2 领域用神卡片规则】**
本问题域的用神卡片已经定好。按下面的 axis 逐项出卡，每个 axis 一张，不要自己增减，也不要压成通用三卡：
${axes}

卡片字段：key、label 沿用 axis；symbol 沿用 axis 的符号，可补实际盘面符号，如“日干 戊”；tone 三选一；verdict 一句话说明现实状态；evidence 写具体宫位、门星神干、空亡马星、有名格或生克关系，不要只写抽象判断。

另外三项不单独出卡：
- ${process.label}（参考 ${process.symbols.join('、')}）写进 environment_reading 或 decision_reading。
- ${timing.label}写进 m4_guidance.timing_behavior。
- ${decision.label}写进 actions 或 decision_reading。`;
}

module.exports = {
  QIMEN_YONGSHEN_RULES,
  buildDomainViewPromptSection,
  buildYongshenPromptSection,
  getYongshenRule
};
