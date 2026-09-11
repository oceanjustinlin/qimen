const PALACE_NAMES_BY_INDEX = ['巽', '离', '坤', '震', '中', '兑', '艮', '坎', '乾'];
const PALACE_NUMBERS_BY_INDEX = [4, 9, 2, 3, 5, 7, 8, 1, 6];

function palaceNameByIndex(index) {
  if (index == null || index < 0 || index > 8) return '';
  return `${PALACE_NAMES_BY_INDEX[index]}${PALACE_NUMBERS_BY_INDEX[index]}宫`;
}

function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n > 0 ? `+${n}` : String(n);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDoor(value) {
  return normalizeText(value).replace(/門/g, '门');
}

function normalizeStar(value) {
  return normalizeText(value).replace(/星$/, '').replace(/輔/g, '辅').replace(/沖/g, '冲');
}

function normalizeGod(value) {
  return normalizeText(value).replace(/騰/g, '腾');
}

function formatList(items = [], fallback = '- 无') {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!list.length) return fallback;
  return list.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function findLayerHits(scoreAudit = {}, layer) {
  return (scoreAudit.adjustments || []).filter((item) => item.layer === layer);
}

function matchSymbolToPalace(palace = {}, symbol = '') {
  const raw = normalizeText(symbol);
  if (!raw) return false;
  if (raw === '日干') return Boolean(palace.isDayStem);
  if (raw === '时干') return Boolean(palace.isHourStem);
  if (raw === '值使门') return Boolean(palace.isZhiShi);
  if (raw === '值符') return normalizeGod(palace.god) === '值符';
  if (raw.endsWith('门')) return normalizeDoor(palace.door) === normalizeDoor(raw);
  if (raw.endsWith('星')) return normalizeStar(palace.star) === normalizeStar(raw);
  return [palace.sky, palace.earth, palace.door, palace.star, palace.god].map(normalizeText).includes(raw);
}

function collectYongshenItems(yongshenRule = {}) {
  const groups = [
    ...(yongshenRule.yongshen?.primary || []),
    ...(yongshenRule.yongshen?.secondary || []),
    ...(yongshenRule.yongshen?.contextual || [])
  ];
  const requirementItems = (yongshenRule.outputRequirements?.scoreAuditMustIncludeAtLeastOneOf || [])
    .map((symbol) => ({ symbol, role: '本域核心审计符号' }));
  const seen = new Set();
  return [...groups, ...requirementItems]
    .map((item) => typeof item === 'string' ? { symbol: item, role: '' } : item)
    .filter((item) => {
      const symbol = normalizeText(item.symbol);
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
}

function describeMatchedYongshen(palace = {}, yongshenItems = []) {
  const matches = yongshenItems.filter((item) => matchSymbolToPalace(palace, item.symbol));
  if (!matches.length) return '未能从规则中反查具体用神';
  return matches
    .map((item) => `${item.symbol}${item.role ? `（${item.role}）` : ''}`)
    .join('、');
}

function findPalaceByEvaluation(scoreInput = {}, evaluation = {}) {
  const palaces = scoreInput.palaces || [];
  return palaces.find((palace) => palace.index === evaluation.palace_index)
    || palaces.find((palace) => palace.name === evaluation.palace)
    || {};
}

function describePalaceReality(palace = {}, evaluation = {}) {
  const notes = [];
  if (evaluation.components?.ground < 0) notes.push('用神底气不足或受制');
  if (evaluation.components?.door > 0) notes.push(`${normalizeDoor(palace.door) || '八门'}仍有可用之处`);
  if (evaluation.components?.star < 0) notes.push(`${normalizeText(palace.star) || '九星'}带来拖延、病滞或阻力`);
  if (evaluation.components?.god > 0) notes.push(`${normalizeGod(palace.god) || '八神'}表示仍有协商或助力`);
  if (evaluation.isKong) notes.push('核心用神逢空，现实中多表示未落实、待填实');
  if (evaluation.hasHorse) notes.push('临马星，表示事情可被催动但不代表必成');
  return notes.length ? notes.join('；') : '本宫信号偏中性，需结合其他层判断';
}

function buildPalaceDetailNarrative(scoreAudit = {}, { scoreInput = {}, yongshenRule = {} } = {}) {
  const nodes = scoreAudit.yongshen_nodes || [];
  if (!nodes.length) return '未纳入明确核心用神宫评分；LLM 应审计取用神规则是否过窄或输入是否缺失。';

  const yongshenItems = collectYongshenItems(yongshenRule);
  return nodes.map((node, index) => {
    const palace = findPalaceByEvaluation(scoreInput, node);
    const core = describeMatchedYongshen(palace, yongshenItems);
    const components = node.components || {};
    const stateNotes = [
      node.isKong ? '核心用神逢空，后续由空亡修正处理，不可重复机械扣分，也不可断必然成事' : '',
      node.hasHorse ? '临马星，只代表动象或可催动，不得单独大幅加分' : '',
      palace.isDoorPressured ? '门迫已在八门分值中处理，不得重复扣分' : '',
      palace.isTomb ? '入墓已进入旺衰/地利底板，不得重复扣分' : '',
      palace.isPunishment ? '受刑已进入旺衰/地利底板，不得重复扣分' : ''
    ].filter(Boolean).join('；') || '未见空亡、马星、门迫、入墓等额外状态。';

    return `${index + 1}. 本领域核心用神：${core}
   命中宫位：${node.palace || palace.name || '未知宫位'}，后端单宫合计：${signed(node.delta)}。
   后端组件：
   - 旺衰/地利：${signed(components.ground ?? 0)}，依据：${palace.prosperity || '未标注旺衰'}${palace.isTomb ? '，入墓' : ''}${palace.isPunishment ? '，受刑' : ''}
   - 八门：${signed(components.door ?? 0)}，依据：${normalizeDoor(palace.door) || '未标注八门'}
   - 九星：${signed(components.star ?? 0)}，依据：${normalizeText(palace.star) || '未标注九星'}
   - 八神：${signed(components.god ?? 0)}，依据：${normalizeGod(palace.god) || '未标注八神'}
   - 状态：${stateNotes}
   现实含义：${describePalaceReality(palace, node)}。`;
  }).join('\n');
}

function buildNamedFormationNarrative(scoreAudit = {}) {
  const hits = findLayerHits(scoreAudit, 'named_formation');
  if (!hits.length) {
    return '未命中可计分有名格；或命中格局经领域/主客校准后没有形成额外净影响。';
  }
  return hits.map((hit, index) => {
    const palace = palaceNameByIndex(hit.palace_index);
    const palaceText = palace ? `落${palace}，` : '';
    return `${index + 1}. ${hit.signal}：${hit.effect}。${palaceText}依据：${hit.reason}`;
  }).join('\n');
}

function buildLayerOverview(scoreAudit = {}) {
  const deltas = scoreAudit.deltas || {};
  return [
    `- 主客动静：${signed(deltas.master_client ?? 0)}。${findLayerHits(scoreAudit, 'master_client')[0]?.reason || '按当前 role 与时干阴阳判断。'}`,
    `- 大局提纲：${signed(deltas.macro ?? 0)}。${findLayerHits(scoreAudit, 'macro').map((hit) => hit.reason).join('；') || '值符、值使门未形成明显额外净影响。'}`,
    `- 核心用神宫：${signed(deltas.palace ?? 0)}。详见下方“核心用神宫明细”。`,
    `- 有名格层：${signed(deltas.named_formation ?? 0)}。详见下方“有名格层明细”。`,
    `- 主客生克：${signed(deltas.relation ?? 0)}。${(scoreAudit.relations || [])[0]?.reason || findLayerHits(scoreAudit, 'relation')[0]?.reason || '未形成明显可计分生克影响。'}`,
    `- 语境修正：${signed(deltas.context ?? 0)}。${findLayerHits(scoreAudit, 'context').map((hit) => hit.reason).join('；') || '未命中问题域极性翻转，或翻转已被有名格层覆盖。'}`,
    `- 高风险校准：${signed(deltas.risk ?? 0)}。${findLayerHits(scoreAudit, 'risk')[0]?.reason || '非健康/法律等高风险问题，未额外保守扣分。'}`,
    `- 空亡修正：${deltas.void_modifier_applied ? '已触发。核心用神空亡时，后端将原始分向 60 中线回归。' : '未触发。核心用神未见需要回归中线的空亡修正。'}`
  ].join('\n');
}

function buildScoreEvidenceNarrative(scoreAudit = {}, options = {}) {
  const positiveSignals = scoreAudit.summary?.score_basis?.positive_signals
    || (scoreAudit.adjustments || []).filter((item) => String(item.effect).startsWith('+')).map((item) => `${item.signal}：${item.reason}`);
  const negativeSignals = scoreAudit.summary?.score_basis?.negative_signals
    || (scoreAudit.adjustments || []).filter((item) => String(item.effect).startsWith('-')).map((item) => `${item.signal}：${item.reason}`);

  return `
【后端工程指标证据摘要】
后端工程指标：${scoreAudit.final_score ?? '未知'} 点（项目排序值，不是古籍分数或概率）。
后端等级：${scoreAudit.level || '未标注'}。
基准分：${scoreAudit.base_score ?? 60} 分。
后端主客站位：${scoreAudit.role || '未标注'}。

一、分层总览：
${buildLayerOverview(scoreAudit)}

二、核心用神宫明细：
${buildPalaceDetailNarrative(scoreAudit, options)}

三、有名格层明细：
${buildNamedFormationNarrative(scoreAudit)}

四、关键有利因素：
${formatList(positiveSignals)}

五、关键风险因素：
${formatList(negativeSignals)}

六、审计提醒：
LLM 只能审计后端是否漏判、误判、过重或过轻；不得重复计算已经在宫位层、有名格层、语境层或空亡修正中处理过的因素。`;
}

function normalizeScoreAuditArgs(input = {}) {
  if (input && input.scoreAudit) return input;
  return { scoreAudit: input };
}

function buildScoreAuditPromptSection(input = {}) {
  const { scoreAudit = {}, scoreInput = {}, yongshenRule = {} } = normalizeScoreAuditArgs(input);
  const scoreEvidence = buildScoreEvidenceNarrative(scoreAudit, { scoreInput, yongshenRule });
  return `
**【确定性工程指标 + LLM复核要求】**
后端先按所选古籍规则识别盘面事实，再以项目权重生成工程排序指标。该指标不是古籍分数、概率或事实本身，模型不得改写它。
你必须基于当前问题域、subcategory 取用神规则与盘面，对后端识别结果作文字复核；score_review.audit_delta 固定返回 0。

硬性要求：
1. 你只输出 LLM 审计意见，不要输出 backend_pre_score、final_score_suggestion、backend_score_audit、timing_analysis 后端原文或 qimen_data。
2. score_review.audit_delta 必须返回整数 0；发现漏判或误判时写入 missed_or_overweighted_factors，不改分。
3. 最终分、summary.score、score_audit.backend_pre_score、score_audit.final_score_suggestion 由后端在后处理阶段拼接，模型不要承接这些字段。
4. 复核意见必须说明古籍规则或盘面依据：后端漏看、误判、过度加权、权重不足、分类/取用神低置信度导致的偏差。
5. 如果 route.confidence 为 low，必须优先审计分类和取用神是否正确；若分类可能错，confidence 不得为 high。
6. 动态应期只能说明何时可能启动，不得单独把空亡、杜门、死门等阻力改写成高确定性成功。
7. 马星只代表动象/速度，不得单独大幅加分；空亡要解释为虚、不实、待填实，不得机械判死。
8. 若后端证据已经包含空亡、杜门、庚格、凶格、主客动静等因素，LLM 只能解释其现实含义，不得因同一因素重复评价。
9. 用户态表达必须用人话，不要原样展示“乾6宫单宫能量、日干/时干主客生克、qimen-score-v4.2”等后端技术标签。
10. 若后端证据摘要中有“有名格层明细”命中且形成净影响，必须在 layer_reviews、qimen_report.m2_basis.yongshen_cards.evidence、qimen_report.m3_inference.support_factors/constraint_factors 或 m1_conclusion.conclusion 中至少一处承接其现实含义；若未承接，视为审计不完整。

${scoreEvidence}

score_review 输出要求：
- audit_delta：固定写 0；模型意见仅作文字复核。
- confidence：low/medium/high。
- role_review：审计 role 是否合理。
- layer_reviews：逐层说明 role、宏观、核心用神宫、有名格、主客生克、语境极性、高风险、空亡、应期是否需要修正。
- timing_review：只评价后端应期候选是否可用，不要重建 timing_analysis。
- audit_delta_breakdown：留空数组，具体问题写入 missed_or_overweighted_factors。
- missed_or_overweighted_factors：列出后端漏判/误判/过重/过轻的因素。
- audit_reason：用自然语言说明修正原因，不能只写技术术语。`;
}

function buildSummaryPromptSection() {
  return `
**【旧 Summary 兼容说明】**
新 UI 不要求模型输出顶层 summary。总判内容统一写入 qimen_report.m1_conclusion；summary、summary.score、summary.score_basis 均由后端从 qimen_report 与评分审计结果派生或覆盖。

若为了兼容旧链路误输出 summary，只允许包含 title、conclusion、keyword，且必须与 qimen_report.m1_conclusion 同义；不要输出 score、score_basis 或任何分数依据。

欠款还款类语气参考：
- title：还款应期判断
- conclusion：有催动还款的窗口，但不宜断为必然到账
- keyword：钱款落空，冲填为应`;
}

function buildQimenInferenceRulesSection() {
  return `
**【奇门推断规则总纲（v4）】**
你必须按当前后端分析框架推断，不得只看取用神宫，也不得跳过有名格层。推断顺序如下：

1. 主客动静层：
   - 先确认 role 是 client（主动方）还是 master（守待方）。
   - 五阳时利客，五阴时利主；role 会影响主客动静分，也会影响部分有名格的领域/主客取值。
   - 如果用户语义是在等待对方行动、被起诉、等还款、等回复，应优先审计是否应为 master。

2. 宏观提纲层：
   - 值符看大局资源、主导权和关键权力端。
   - 值使门看具体执行流程和事情顺滞。
   - 值符空亡、值使门凶，不能被单一吉象完全洗掉。

3. 核心用神宫层：
   - 必须说明本领域核心用神是谁，落哪一宫，后端单宫合计几分。
   - 必须拆开旺衰/地利、八门、九星、八神、空亡、马星、门迫、入墓/受刑。
   - 旺衰是能量底板；门代表人事入口；星代表天时；神代表助力或风险。
   - 空亡不机械判死，但表示虚、不实、待填实；马星只代表动象或速度，不单独大幅加分。

4. 有名格层：
   - 必须检查有名格层是否命中，不得跳过有名格层。
   - 常见吉格包括：飞鸟跌穴、青龙返首、日月并行、奇仪相佐、三奇得使、三奇贵人升殿、玉女守门、天显时格、三诈、五假、九遁。
   - 常见凶格包括：青龙逃走、白虎猖狂、朱雀投江、螣蛇夭矫、太白入荧、荧入太白、大格、小格、伏宫格、飞宫格、刑格、天网四张、地网遮蔽、六仪击刑、三奇入墓、五不遇时、奇格、岁格、月格、悖格、伏干格、飞干格、伏吟、反吟。
   - 有名格按领域和 role 校准：同一格局在求财、健康、诉讼、主动方/守待方下可能不同。
   - 三奇得使只能锦上添花，大凶时不可直接翻成大吉；六仪击刑、五不遇时等重凶不可轻描淡写。

5. 主客生克层：
   - 重点看日干宫与时干/事项宫关系。
   - 事项生我、比和、我能制事可加分；事项克我、我生事项耗力要扣分或降语气。
   - 若客体能量弱而主体能量强，可按“衰不克旺”减轻扣分。

6. 语境极性层：
   - 必须结合当前 category/subcategory 判断极性翻转。
   - 例如催收场景中压力信号可转为催动力；健康场景中同一信号可能仍是风险。
   - positive_with_risk 不是纯吉，必须同时说有利面和残余风险。
   - 已被有名格层覆盖的信号不得在语境层重复加扣。

7. 高风险校准层：
   - 健康、法律等高风险问题必须保守，不得用吉象替代医生、律师或现实证据。
   - 高风险校准不改变教材主线，但会降低断语确定性。

8. 空亡回归修正：
   - 核心用神空亡时，后端会把原始分向 60 中线回归。
   - LLM 不得重复扣空亡，也不得把空亡直接说成无望；应解释为虚、不实、待填实。

9. 应期层：
   - 应期只说明何时可能启动、催动、沟通、兑现或观察。
   - 定应期优先级：空亡冲填 > 马星动 > 墓库冲开 > 刑冲 > 逢合。
   - 只能使用后端应期扫描给出的窗口，不得自行新增日期、时辰或触发条件。

审计底线：
- 先按上述层级解释，再输出结论。
- 不得只凭单个吉门、吉神、马星或应期窗口给高分。
- 不得只凭单个凶象判死。
- 严禁引用盘面不存在的符号与关系：门、星、神、天地盘干、宫位、空亡、马星、有名格、生克刑冲合害等，只能引用后端实际给出的盘面字段，不得凭空捏造某宫临某门某星、某干某神，或编造盘面未出现的格局与生克关系。
- 分数修正必须说明落在哪一层：role、宏观、核心用神宫、有名格、主客生克、语境极性、高风险、空亡或应期。`;
}

function buildFrontendCopyProtocolSection() {
  return `
**【前端断语协议】**
你输出的内容会直接进入前端结果页。请把专业判断转译成用户能理解、能行动、不过度恐吓、不过度承诺的断语。

总原则：
1. 不要展示后端技术词：不得原样写 backend_pre_score、audit_delta、qimen-score-v4.2、乾6宫单宫能量、日干/时干主客生克。
1b. 严禁泄漏后端计算指标的数值：任何面向用户的文案中绝对不能出现"强度74.4""能量值80""得分60""置信度0.8""引动力85"等"指标+数字"形式。内部量化只能改用命理语言定性表达（如"气势旺盛""引动有力""根基偏弱"），不得带出任何具体数字或打分。
2. 可以使用必要术语，但必须转译：空亡=事情未实/承诺未落地/待填实；马星=有动象/可催动；杜门=流程卡住/信息不透明；死门=停滞/低活力。
3. 不得绝对化，避免“必成、必败、一定、百分百、马上发生”。
4. 必须同时给支撑与风险；风险后必须给出可执行建议。
5. 健康、法律、投资等高风险问题必须加现实边界。
6. 前端分数、后端评分审计、应期扫描结果由后端拼接；模型只负责把依据转译成用户可读文案。
7. 如果命中有名格，前端断语必须说清它在当前问题域里的现实含义，不要只写格局名称。

分数区间语气：
- 85-100：明显有利，但仍保留条件。
- 70-84：偏有利，可以推进，但要管控风险。
- 55-69：中等可观察，有机会但不稳。
- 40-54：偏谨慎，宜保守推进或等待条件改善。
- 0-39：明显不利，不建议强行推进。

前端字段写作要求：
- 不再要求输出旧展示字段 summary、analysis、advice、display_blocks、domain_view；这些字段只作为历史记录 fallback。
- qimen_report.m1_conclusion：title、keyword、conclusion、actions。actions 固定 3 条，每条 45-95 字，动词开头，必须能落地到沟通、等待、催动、取证、避险、择时或调整动作；至少 1 条融合后端时间检索/应期候选，若暂无明确窗口则说明观察触发条件。
- qimen_report.m2_basis.yongshen_cards：优先按后端给出的“ M2 领域用神卡片规则 ”逐项输出；若没有领域 axes，才使用“问测人 / 目标事态或物品 / 关键环境因素”的通用结构。证据必须来自实际落宫、门、星、神、空亡、马星或有名格。
- qimen_report.m3_inference：按 subject_state、target_state、environment_state、support_factors、constraint_factors、interaction_decision 六段输出。不要输出 label、key_components、user_implication、verdict、evidence、reason、decision。
- qimen_report.m4_guidance.environment_fengshui：输出 suitable_direction、do、avoid、reason。
- qimen_report.m4_guidance.timing_behavior：输出 window、wait_until、do、avoid、reason；日期或时辰只能来自后端候选，不能自行新增。`;
}

function buildReportSchemaPromptSection() {
  return `
**【新 UI 报告结构：qimen_report】**
你必须输出 qimen_report，供前端直接渲染 M1-M4 报告。

qimen_report 必须包含四个子模块：

1. m1_conclusion：结论先行。
   - title：8-14字，直接点明问题类型。
   - keyword：4-12字核心判断词。
   - conclusion：35-80字总判。
   - actions：固定输出3条，动词开头，45-95字，从盘面风险和后端 timing_review / timing_analysis 候选窗口反推，不写泛泛建议。至少1条必须融合时间检索信息；如果暂无明确窗口，要说明先观察哪些触发条件。
   - 不要输出 score、verdict_label、tone、score_basis——后端补全。

2. m2_basis：奇门定基。
   - yongshen_cards：优先按照后端“ M2 领域用神卡片规则 ”中的 axes 生成，每个 axis 一张卡，key/label/symbol 必须继承后端规则，不要强行压成通用三卡。
   - 若当前领域没有 axes，才输出通用三卡：subject（问测人 = 日干）、target（目标事态/物品/对方 = 时干或领域主用神）、environment（关键环境因素 = 值使门/值符/关键门星神）。
   - 每张卡：key、label、symbol（如"日干 戊"）、tone（positive/mixed/warning）、verdict（一句话状态）、evidence（必须引用盘面依据）。
   - 不要输出 chart_summary、palaces、formation_tags——后端补全。

3. m3_inference：局象推演，必须按顺序包含六段，分三层。

   【翻译层】用用户能懂的结论句描述盘面，依据必须融合进同一句或同段，不要拆成"结论 + 依据小字"：
   - subject_state：日干落宫状态。reading 80-140字，必须说明日干临何宫、何门、何星、何神，旺衰/空亡/马星/入墓/受刑如何影响求测人的行动状态。
   - target_state：领域核心用神落宫状态。reading 80-140字，必须说明用神（时干或领域主符号）落何宫、临何门，旺衰与空亡如何影响目标事态。
   - environment_state：值使门与宏观环境状态。reading 90-150字，必须说明值使门、值符宫位、宏观资源或流程管道的现实含义；不得只写一句短判断。

   【提炼层】综合翻译层，讲人话，不写门/星/神符号（必要时括号注释）：
   - support_factors：有利因素。只输出 tone、summary、items[]。summary 45-90字，必须把主要依据融合进结论；items 固定 1-3项，每项只包含 name、impact，impact 45-90字。不要输出 reason/evidence。
   - constraint_factors：不利因素。只输出 tone、summary、items[]。summary 45-90字，必须把主要依据融合进结论；items 固定 1-3项，每项只包含 name、impact，impact 45-90字。不恐吓，不写"必败"。不要输出 reason/evidence。

   【拍板层】综合前五段给出方向性结论：
   - interaction_decision：生克决断。必须引用 backend relations 的 subject_symbol ↔ target_symbol；只输出 subject_symbol、target_symbol、tone、reading。reading 80-140字，直接说明双方互动后的判断与现实动作边界，不要单独输出"推进/观望/暂缓"这类短 decision 字段，不要输出 reason/evidence。

   翻译层三段只输出：symbol、palace、tone、reading。reading 必须引用至少一种盘面依据：落宫、门、星、神、天地盘干、空亡、马星、有名格、日时生克或应期候选。
   M3 全段不要输出 label、key_components、user_implication、verdict、evidence、reason、decision；这些字段已下线或由前端固定标题/旧记录 fallback 处理。

4. m4_guidance：开运指南。
   - environment_fengshui：suitable_direction、do、avoid、reason。suitable_direction 写宜用方位/坐向；do 写环境布置或沟通场景；avoid 写应避开的方位/环境；reason 必须说明盘面依据。
   - timing_behavior：window、wait_until、do、avoid、reason。window 只能基于后端应期候选或写"暂无明确窗口"；do 写该窗口内的动作；avoid 写时机上的避坑；reason 说明为什么是观察/启动窗口，不保证结果必然落地。

tone 只能是 positive、mixed、warning。badge（顺/参/慎）由前端从 tone 派生，不需要输出。
score_basis 不需要输出——后端从 m3_inference 自动提炼，写了也会被覆盖。`;
}

function buildQimenOutputContractSection({ routeConfidence = 'medium', backendScore = 0 } = {}) {
  return `
**【输出字段契约】**
只返回一个 JSON 对象，不要 markdown，不要解释 JSON 外的内容。不要在 prompt 中复述大段 JSON 模板。
后端负责拼接的字段不要由模型承接输出：不要输出 backend_score_audit、preliminary_score_audit、qimen_data、最终 timing_analysis、summary.score、score_audit.backend_pre_score、score_audit.final_score_suggestion。

模型必须包含的顶层字段：
intent_audit、score_review、timing_review、qimen_report。
不要输出 summary、analysis、advice、display_blocks、domain_view；旧记录兼容由前端 fallback 处理。

qimen_report 必须包含：
m1_conclusion（含 title、keyword、conclusion、actions），m2_basis（含 yongshen_cards），m3_inference（含六段：subject_state、target_state、environment_state、support_factors、constraint_factors、interaction_decision），m4_guidance（含 environment_fengshui 和 timing_behavior）。
后端会补全：m1_conclusion.question/score/verdict_label/tone/score_basis，m2_basis.chart_summary/palaces/formation_tags，m3_inference.interaction_decision.relation。

intent_audit 必须包含：
route_confidence、is_route_acceptable、is_role_acceptable、suggested_category、suggested_subcategory、suggested_role、reason。
其中 intent_audit.route_confidence 必须填 ${routeConfidence}，除非你明确说明上游路由不可接受。

score_review 必须包含：
audit_delta、confidence、role_review、layer_reviews、audit_delta_breakdown、missed_or_overweighted_factors、audit_reason。
其中 audit_delta 必须是整数 0。后端工程指标为 ${backendScore}，仅供你判断语气；如发现问题，写入复核意见，不要改分或把该数值描述为概率。

timing_review 必须包含：
summary、usable_candidates、limitations。它只评价后端应期候选，不要输出完整 timing_analysis。

旧展示字段（summary、analysis、advice、display_blocks）不再要求输出；如模型仍输出，后端保留用于旧记录兼容，不作为核心依赖。`;
}

module.exports = {
  buildScoreEvidenceNarrative,
  buildScoreAuditPromptSection,
  buildSummaryPromptSection,
  buildReportSchemaPromptSection,
  buildFrontendCopyProtocolSection,
  buildQimenInferenceRulesSection,
  buildQimenOutputContractSection
};
