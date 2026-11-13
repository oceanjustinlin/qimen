const { Solar } = require('lunar-javascript');
const { calculateDailyScore, getShiShen } = require('./calculateDailyScore');

const ZHI_TO_PALACE = {
  子: '坎宫',
  丑: '艮宫',
  寅: '艮宫',
  卯: '震宫',
  辰: '巽宫',
  巳: '巽宫',
  午: '离宫',
  未: '坤宫',
  申: '坤宫',
  酉: '兑宫',
  戌: '乾宫',
  亥: '乾宫',
};

const ZHI_BY_ELEMENT = {
  木: ['寅', '卯'],
  火: ['巳', '午'],
  土: ['辰', '未', '戌', '丑'],
  金: ['申', '酉'],
  水: ['子', '亥'],
};

const GAN_BY_ELEMENT = {
  木: ['甲', '乙'],
  火: ['丙', '丁'],
  土: ['戊', '己'],
  金: ['庚', '辛'],
  水: ['壬', '癸'],
};

const DIRECTION_BY_ELEMENT = {
  木: '东南',
  火: '正南',
  土: '西南',
  金: '西北',
  水: '正北',
};

const SHEN_GROUPS = {
  wealth: ['正财', '偏财'],
  officer: ['正官', '七杀'],
  seal: ['正印', '偏印'],
};

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return String(val).split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean);
}

function getLuckyElements(profile = {}) {
  const favorableWuxing = profile.bazi_detail?.wuxing?.favorable;
  const elements = normalizeList(favorableWuxing).filter(item => ZHI_BY_ELEMENT[item]);
  if (elements.length > 0) return elements;

  const directElements = normalizeList(profile.favorable_elements).filter(item => ZHI_BY_ELEMENT[item]);
  if (directElements.length > 0) return directElements;

  const riGan = profile.ri_zhu ? profile.ri_zhu.charAt(0) : '';
  const favorableShens = normalizeList(profile.favorable_elements);
  if (!riGan || favorableShens.length === 0) return [];

  return Object.entries(GAN_BY_ELEMENT)
    .filter(([, gans]) => gans.some(gan => favorableShens.includes(getShiShen(gan, riGan))))
    .map(([element]) => element);
}

function buildLuckyElementText(profile = {}) {
  const elements = getLuckyElements(profile);
  return elements.length > 0 ? elements.join('、') : '无明显偏好';
}

function getLuckyHourZhis(luckyElement) {
  const elements = normalizeList(luckyElement).filter(item => ZHI_BY_ELEMENT[item]);
  const zhis = elements.flatMap(element => ZHI_BY_ELEMENT[element]);
  return [...new Set(zhis)].slice(0, 3);
}

function getLuckyDirection(luckyElement) {
  const elements = normalizeList(luckyElement);
  const firstElement = elements.find(element => DIRECTION_BY_ELEMENT[element]);
  return firstElement ? DIRECTION_BY_ELEMENT[firstElement] : '东南';
}

function getCoreShenToday(profile = {}, dayGan) {
  const riGan = profile.ri_zhu ? profile.ri_zhu.charAt(0) : '';
  if (!riGan || !dayGan) return '流日主导星曜';
  return getShiShen(dayGan, riGan);
}

function getWealthOfficerState(coreShenToday, scoreLevel, dayClash) {
  const tags = [];
  if (SHEN_GROUPS.wealth.includes(coreShenToday)) tags.push(`${coreShenToday}临日，财务议题显性`);
  if (SHEN_GROUPS.officer.includes(coreShenToday)) tags.push(`${coreShenToday}临日，职场规则显性`);
  if (SHEN_GROUPS.seal.includes(coreShenToday)) tags.push(`${coreShenToday}临日，资源与凭证显性`);
  if (tags.length === 0) tags.push(`${coreShenToday}临日，行动节奏为主`);
  tags.push(`运势等级${scoreLevel}`);
  tags.push(dayClash ? `冲煞见${dayClash}` : '无明显冲煞');
  return tags.join('；');
}

function getBeijingDayInfo(targetDate) {
  let bjTime;

  if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    bjTime = new Date(`${targetDate}T12:00:00+08:00`);
  } else {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    bjTime = new Date(utc + 3600000 * 8);
  }

  const todayKey = [
    bjTime.getFullYear(),
    String(bjTime.getMonth() + 1).padStart(2, '0'),
    String(bjTime.getDate()).padStart(2, '0'),
  ].join('-');

  const h = bjTime.getHours();
  const m = bjTime.getMinutes();
  const s = bjTime.getSeconds();
  const secondsUntilMidnight = Math.max(60, 86400 - (h * 3600 + m * 60 + s));

  const expiresAt = new Date(bjTime);
  expiresAt.setHours(23, 59, 59, 999);

  return { bjTime, todayKey, secondsUntilMidnight, expiresAt };
}

function buildFortunePeriodKey(dateStr, profileId) {
  return profileId ? `${dateStr}::${profileId}` : dateStr;
}

function getScoreLevel(finalScore) {
  if (finalScore >= 85) return '优';
  if (finalScore >= 70) return '良';
  if (finalScore >= 60) return '平';
  if (finalScore >= 50) return '注意';
  return '慎行';
}

function hasScoreFields(profile) {
  return profile.ri_zhu && profile.day_zhi && profile.year_zhi
    && Array.isArray(profile.favorable_elements)
    && Array.isArray(profile.unfavorable_elements);
}

function buildFortuneContext(profile, bjTime, todayKey) {
  const solar = Solar.fromDate(bjTime);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const solar_date = todayKey;
  const year_gz = eightChar.getYear();
  const month_gz = eightChar.getMonth();
  const day_gz = eightChar.getDay();
  const day_gan = day_gz.charAt(0);
  const day_zhi = day_gz.charAt(1);
  const day_officer = lunar.getZhiXing();
  const day_void = lunar.getDayXunKong();
  const day_clash = lunar.getDayChongDesc();
  const day_nayin = lunar.getDayNaYin();

  const scoreResult = hasScoreFields(profile)
    ? calculateDailyScore(profile, lunar)
    : null;

  const finalScore = scoreResult ? scoreResult.final_score : 70;
  const score_level = getScoreLevel(finalScore);
  const is_kongwang = scoreResult ? !!scoreResult.is_kongwang : false;
  const has_sanxing = scoreResult ? !!scoreResult.has_sanxing : false;
  const lucky_element = buildLuckyElementText(profile);
  const day_zhi_palace = scoreResult?.day_zhi_palace || ZHI_TO_PALACE[day_zhi] || `${day_zhi}地支关联宫位`;
  const core_shen_today = scoreResult?.core_shen_today || getCoreShenToday(profile, day_gan);
  const lucky_hour_zhis = getLuckyHourZhis(lucky_element);
  const lucky_direction = getLuckyDirection(lucky_element);
  const wealth_officer_state = getWealthOfficerState(core_shen_today, score_level, day_clash);

  return {
    profile,
    solar_date,
    year_gz,
    month_gz,
    day_gz,
    day_gan,
    day_zhi,
    day_officer,
    day_void,
    day_clash,
    day_nayin,
    scoreResult,
    finalScore,
    score_level,
    is_kongwang,
    has_sanxing,
    lucky_element,
    day_zhi_palace,
    core_shen_today,
    lucky_hour_zhis,
    lucky_direction,
    wealth_officer_state,
  };
}

function buildBaseFortunePayload(context) {
  const payload = {
    solar_date: context.solar_date,
    day_gz: context.day_gz,
    month_gz: context.month_gz,
    year_gz: context.year_gz,
    day_zhi_palace: context.day_zhi_palace,
    lucky_element: context.lucky_element,
    day_officer: context.day_officer,
    day_void: context.day_void,
    day_clash: context.day_clash,
    day_nayin: context.day_nayin,
    score_level: context.score_level,
    is_kongwang: context.is_kongwang,
    has_sanxing: context.has_sanxing,
    core_shen_today: context.core_shen_today,
    lucky_hour_zhis: context.lucky_hour_zhis,
    lucky_direction: context.lucky_direction,
    wealth_officer_state: context.wealth_officer_state,
    interpretation_status: 'pending',
  };

  if (context.scoreResult) {
    payload.day_score = context.scoreResult.final_score;
    payload.score_breakdown = {
      dim1_score: context.scoreResult.breakdown.dim1_score,
      dim2_score: context.scoreResult.breakdown.dim2_score,
      dim3_score: context.scoreResult.breakdown.dim3_score,
      kong_wang_triggered: context.scoreResult.is_kongwang,
      sanjing_triggered: context.scoreResult.has_sanxing,
    };
  } else {
    payload.day_score = context.finalScore;
    payload.score_breakdown = {
      dim1_score: 0,
      dim2_score: 0,
      dim3_score: 0,
      kong_wang_triggered: false,
      sanjing_triggered: false,
    };
  }

  return payload;
}

function pickInterpretationFields(data = {}) {
  data = data || {};
  return {
    solar_date: data.solar_date || '',
    day_gz: data.day_gz || '',
    month_gz: data.month_gz || '',
    year_gz: data.year_gz || '',
    day_zhi_palace: data.day_zhi_palace || '',
    score_level: data.score_level || '',
    day_insight: data.day_insight || '',
    day_warning: data.day_warning || '',
    career_insight: data.career_insight || '',
    wealth_insight: data.wealth_insight || '',
    love_insight: data.love_insight || '',
    health_insight: data.health_insight || '',
    day_guide: data.day_guide || '',
    lucky_hours: Array.isArray(data.lucky_hours) ? data.lucky_hours : [],
    lucky_direction: data.lucky_direction || '',
    lucky_number: Array.isArray(data.lucky_number) ? data.lucky_number : [],
    resolve_tip: data.resolve_tip || '',
    hook_teaser: data.hook_teaser || '',
    lucky_element: data.lucky_element || '',
    lucky_color: data.lucky_color || '',
    lucky_color_hex: data.lucky_color_hex || '',
    interpretation_status: 'ready',
  };
}

function mergeInterpretation(baseData = {}, interpretationData = {}) {
  return {
    ...baseData,
    ...pickInterpretationFields(interpretationData),
    day_score: baseData.day_score,
    score_breakdown: baseData.score_breakdown,
    lucky_element: baseData.lucky_element,
    solar_date: baseData.solar_date,
    day_gz: baseData.day_gz,
    month_gz: baseData.month_gz,
    year_gz: baseData.year_gz,
    day_zhi_palace: baseData.day_zhi_palace,
    score_level: baseData.score_level,
  };
}

function hasReadyInterpretation(data = {}) {
  data = data || {};
  return Boolean(
    data.day_insight
    && data.career_insight
    && data.wealth_insight
    && data.love_insight
    && data.health_insight
    && data.hook_teaser
  );
}

function buildInterpretationPrompt(context) {
  const {
    profile,
    solar_date,
    year_gz,
    month_gz,
    day_gz,
    day_gan,
    day_zhi,
    day_officer,
    day_void,
    day_clash,
    day_nayin,
    score_level,
    is_kongwang,
    has_sanxing,
    lucky_element,
    day_zhi_palace,
    core_shen_today,
    lucky_hour_zhis,
    lucky_direction,
    wealth_officer_state,
  } = context;

  return `
你是一位精通子平八字的命理文案师，断语风格短、准、有画面。
上游系统已完成全部算分与命理推导，你的唯一职责是：
将结构化的命理数据转化为有温度、有画面感、可执行的白话文案。

⚠️ 铁律（违反即视为输出无效）：
1. 禁止输出任何评分数字、维度分值、算分说明。
2. 禁止自行推算或修改任何干支、评分、宫位数据。
3. 仅输出纯净 JSON，严禁包含 \`\`\`json 等任何 Markdown 标记。
4. 所有文案字段均基于下方【命理解读上下文】生成，不得凭空发挥。

━━━━━━━━━━━━━━━━━━━━━━
【命主档案】
━━━━━━━━━━━━━━━━━━━━━━
${profile.bazi_summary}

━━━━━━━━━━━━━━━━━━━━━━
【命理解读上下文】（由系统预算完成，直接信任）
━━━━━━━━━━━━━━━━━━━━━━
公历日期：${solar_date}
流年干支：${year_gz}
流月干支：${month_gz}
流日干支：${day_gz}（天干：${day_gan}，地支：${day_zhi}）

建除十二神：${day_officer}
旬空亡地支：${day_void}
今日地支宫位：${day_zhi_palace}
今日冲煞状态：${day_clash}
纳音五行：${day_nayin}

今日运势等级：${score_level}
是否触发空亡：${is_kongwang}
是否触发三刑：${has_sanxing}
今日喜用五行：${lucky_element}
今日核心用神十神：${core_shen_today}
今日吉时地支列表：${JSON.stringify(lucky_hour_zhis)}
今日贵人方位：${lucky_direction}
今日财官星态：${wealth_officer_state}

━━━━━━━━━━━━━━━━━━━━━━
【文案生成任务】
━━━━━━━━━━━━━━━━━━━━━━

▌ day_warning（字符串）
  • 触发条件：is_kongwang 为 true 或 has_sanxing 为 true
  • 若两者均为 false → 输出空字符串 ""
  • 若触发 → 15字以内，点明风险性质（空亡/三刑），
    不得出现"小心""注意"等空泛词，需说明具体影响方向
  • 示例（空亡）："今日旬空，谋事不实，签约宜缓"
  • 示例（三刑）："三刑拱照，人事暗动，慎防口舌引发连锁"

▌ day_insight（≤30字）
  • 盲派断语风格：一针见血，带江湖气，有画面感
  • 必须呼应 core_shen_today 与 day_officer
  • 按 score_level 档位区分基调：
    ── 优（≥85分档）：正面星曜意象，点明今日核心机遇，可用进取语气
    ── 良（70–84分档）：稳中有进，点出一个值得把握的方向
    ── 平（60–69分档）：平稳为主，点出一个需要留意的变量
    ── 注意（50–59分档）：偏守势，明确今日最大风险点
    ── 慎行（<50分档）：凶星/化忌意象，语气克制但信息量足
  • 禁止出现分数数字、维度名称、"喜用神""忌神"等技术术语

▌ career_insight（≤20字）
  • 聚焦事业/工作维度，呼应 core_shen_today 中的官杀/印星状态
  • 说明今日工作场景的核心变量：机遇方向 或 需要规避的人事风险
  • 语气具体，避免"运势不错""有所突破"等无信息量表达
  • 示例："上司主动关注，汇报时机已到，勿错过"
  • 示例："同事暗中较劲，低调推进优于公开表态"

▌ wealth_insight（≤20字）
  • 聚焦财务维度，呼应 wealth_officer_state 与 lucky_element
  • 区分正财（劳动所得/固定收入）与偏财（投机/额外收益）方向
  • 说明今日财务操作的利与忌
  • 示例："正财稳进，收款推进顺畅，投机类操作暂缓"
  • 示例："偏财有动，副业/兼职有小获，勿重仓押注"

▌ love_insight（≤20字）
  • 聚焦感情/人际亲密关系维度，呼应 core_shen_today 中的财星（男命）/官星（女命）状态
  • 系统不知道命主是单身还是有伴，写一句两种情况都适用的相处/社交提示，不要假设感情状态
  • 不得出现"桃花旺""缘分到来"等陈腐套语
  • 示例："今天对方更看重态度，先听后说胜过讲道理"

▌ health_insight（≤20字）
  • 聚焦精力与作息，不写具体脏器、疾病或症状，不做任何医疗判断
  • 依据 day_clash（冲煞）与 day_nayin 判断今天精力是充沛还是易耗，给一个作息或活动安排上的提示
  • 禁止输出"注意休息""多喝水"等无效建议
  • 示例："精力偏散，重要的事放上午，午后留出空档"
  • 示例："精力充沛，体力消耗类活动可放在上午"

▌ lucky_hours（数组，1–3个元素）
  • 直接取 lucky_hour_zhis 中的时辰，转换为中文时辰+对应现代时段，并附一句不超过8字的适用场景
  • 输出格式：[{"hour": "卯时（5–7点）", "tip": "晨会/签约最佳窗口"}]
  • 示例：[{"hour": "午时（11–13点）", "tip": "推进谈判，对方更易点头"}, {"hour": "申时（15–17点）", "tip": "财务决策，思路清晰"}]

▌ lucky_direction（字符串）
  • 直接引用系统提供的 lucky_direction 字段（如"东南"）
  • 附加一句话说明实际应用场景（座位朝向/出行方向/面谈时背靠方向）
  • 格式："东南——面谈时背朝东南，气场更稳"

▌ lucky_number（数组，1–2个整数）
  • 基于 lucky_element 对应的河洛数理推导：
    木 → 3、8    火 → 2、7    土 → 5、10（输出5）
    金 → 4、9    水 → 1、6
  • 从对应数字中取1–2个，输出为整数数组，如 [3, 8]

▌ resolve_tip（字符串）
  • 触发条件：is_kongwang 或 has_sanxing 或 day_clash 非空时必须输出
  • 若三者均为否/空 → 输出空字符串 ""
  • 20字以内，给出一个具体的化解/趋吉动作
  • 必须是现代人可执行的行为，禁止输出"焚香祈福""佩戴平安符"等无操作性内容
  • 行为须与 lucky_element 呼应（如喜水→多饮水、近水；喜木→多接触绿植、户外）
  • 示例（空亡+喜木）："晨间于绿植旁静坐10分钟，稳固今日根基"
  • 示例（冲煞+喜水）："午间饮一杯温水，路过水景处稍作停留"

▌ hook_teaser（字符串）
  • 15–25字的悬念引导语，用于驱动用户点击查看"本月/本周详批"
  • 必须基于今日命理数据中最值得关注的一个信号，不得凭空制造焦虑
  • 你手上只有今天的数据：不要编造本月/本周会发生什么具体事件（如“本月有一笔财”“有一波红利窗口”），只能用今天的信号引出“想知道后面怎么走”的好奇
  • 语气：像老友提醒，非算命恐吓
  • 结尾固定格式：以"→"结束，引导用户点击
  • 示例："今日偏财临门只是开头，这股财气能走多远 →"
  • 示例："今天贵人星动，这位贵人会在哪一步出现 →"

▌ day_guide（格式严格：宜[动词+名词]、[动词+名词]；忌[动词+名词]、[动词+名词]）
  • 贴合现代打工人/创业者视角，每项必须可执行、有具体场景
  • 宜/忌各写2项，必须命中以下维度之一：
    ① 事业决策：签约 / 谈判 / 汇报 / 项目推进 / 公开表达
    ② 财务投资：收款 / 支出 / 理财操作 / 合同确认
    ③ 人际关系：社交拓展 / 合作推进 / 求人办事 / 化解矛盾
  • 宜与忌必须呼应 lucky_element 与 day_clash 信息
  • 禁止输出以下空洞词语：
    "宜静思"、"忌冲动"、"宜休息"、"忌争执"、"宜谨慎"

▌ lucky_color（字符串）
  • 根据 lucky_element 输出对应的中文色名
  • 禁止输出"红色""蓝色"等基础色名
  • 参考映射（可细化）：
    火 → "绛红"或"珊瑚橙"    水 → "靛青"或"霁蓝"
    木 → "松绿"或"竹青"      金 → "月白"或"香槟金"
    土 → "赭石"或"琥珀棕"

▌ lucky_color_hex（字符串）
  • 与 lucky_color 严格对应的十六进制颜色码
  • 须为视觉上可用于 UI 展示的非极端色（非纯黑/纯白）

━━━━━━━━━━━━━━━━━━━━━━
【输出格式】仅输出以下纯 JSON，无任何其他文字
━━━━━━━━━━━━━━━━━━━━━━
{
  "solar_date": "${solar_date}",
  "day_gz": "${day_gz}",
  "month_gz": "${month_gz}",
  "year_gz": "${year_gz}",
  "day_zhi_palace": "${day_zhi_palace}",
  "score_level": "${score_level}",
  "day_warning": "",
  "day_insight": "≤30字盲派断语",
  "career_insight": "≤20字事业运文案",
  "wealth_insight": "≤20字财运文案",
  "love_insight": "≤20字感情运文案",
  "health_insight": "≤20字健康运文案",
  "day_guide": "宜[xx]、[xx]；忌[xx]、[xx]",
  "lucky_hours": [{"hour": "卯时（5–7点）", "tip": "晨会签约最佳窗口"}],
  "lucky_direction": "东南——面谈时背朝东南，气场更稳",
  "lucky_number": [3, 8],
  "resolve_tip": "",
  "hook_teaser": "悬念引导语 →",
  "lucky_element": "${lucky_element}",
  "lucky_color": "幸运色名称",
  "lucky_color_hex": "#000000"
}
`;
}

function parseModelJson(content) {
  const raw = String(content || '').replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(raw);
}

module.exports = {
  getBeijingDayInfo,
  buildFortunePeriodKey,
  buildFortuneContext,
  buildBaseFortunePayload,
  buildInterpretationPrompt,
  parseModelJson,
  pickInterpretationFields,
  mergeInterpretation,
  hasReadyInterpretation,
};
