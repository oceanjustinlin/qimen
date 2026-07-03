const { BaziRuleEngine, getDiShi, getShen } = require('./BaziRuleEngine');
const { assessBaziImage, resolvePatternOverride } = require('./baziImageAssessor');
const { buildSiziSummaryKey, getSiziSummary } = require('./siziSummary');
const { getPatternStatement } = require('./baziPatternStatements');
const { getSourceBackedPatternStatement } = require('./baziSourceBackedStatements');
const { resolveSanMingPattern } = require('./sanMingPatternResolver');

const BAZI_ENGINE_VERSION = '1.8.19';

// 纠偏缓存版本：prompt 模板变更时递增，使已有纠偏结果失效
const CALIBRATION_VERSION = '1.0.0';

// 生成断事笔记的稳定指纹（与 CALIBRATION_VERSION 组合构成 calibrated_version）
function computeEventsHash(events) {
    if (!Array.isArray(events) || events.length === 0) return 'empty';
    const stable = events
        .map(e => [e.year, e.month ?? '', e.category, e.impact, (e.description || '').trim()].join('|'))
        .sort()
        .join('\n');
    let h = 0;
    for (let i = 0; i < stable.length; i++) {
        h = (Math.imul(h, 31) + stable.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
}

// 类比 hasLatestEngineCache：检查纠偏结果是否仍然有效
function hasValidCalibration(profile, events) {
    if (!profile?.calibrated_yuanju_core) return false;
    return profile.calibrated_version === `${CALIBRATION_VERSION}:${computeEventsHash(events)}`;
}

function hasCompleteLlmCache(profile = {}) {
    const hasLLM = Boolean(
        profile.llm_yuanju_core &&
        profile.llm_current_dayun &&
        profile.llm_current_liunian
    );
    const isLatestEngine = profile.bazi_detail?.engine_version === BAZI_ENGINE_VERSION;
    return hasLLM && isLatestEngine;
}

// 仅判断引擎版本是否是最新，不考虑 LLM 是否存在
function hasLatestEngineCache(profile = {}) {
    return profile.bazi_detail?.engine_version === BAZI_ENGINE_VERSION;
}

// 判断是否有 LLM 断语（不管版本）
function hasExistingLlm(profile = {}) {
    return Boolean(
        profile.llm_yuanju_core &&
        profile.llm_current_dayun &&
        profile.llm_current_liunian
    );
}

function buildQualitativeSections({ llmSucceeded, llmQualitativeData, engineQualitativeData }) {
    const normalizedEngine = {
        yuanju_core: engineQualitativeData?.yuanju_core || '',
        current_dayun: engineQualitativeData?.current_dayun || '',
        current_liunian: engineQualitativeData?.current_liunian || ''
    };

    const normalizedLlm = llmSucceeded ? {
        yuanju_core: llmQualitativeData?.yuanju_core || '',
        current_dayun: llmQualitativeData?.current_dayun || '',
        current_liunian: llmQualitativeData?.current_liunian || ''
    } : {
        yuanju_core: null,
        current_dayun: null,
        current_liunian: null
    };

    return {
        display: llmSucceeded ? normalizedLlm : normalizedEngine,
        llm: normalizedLlm,
        engine: normalizedEngine
    };
}
const GE_JU_INFO = {
    '正官格': {
        name: '正官格',
        element: '官',
        judgeBase: '月令以官星司令，取官为格。',
        yongShenTypical: '官星',
        xianShenTypical: '印绶、财星',
        strength: '宜身强',
        shunNi: '顺用',
        personality: ['端凝守礼', '重名分秩序', '行事持中', '喜清不喜杂'],
        goodFor: ['仕途法务', '组织管理', '公职文教'],
        watchOut: ['最忌官杀混杂', '防伤官犯官', '忌财印两伤'],
        chengGeTypes: ['正官佩印格', '用官喜财格', '弃官就食格', '弃官存财格'],
        defeatConditions: ['官杀混杂', '伤官见官', '官星无根受制'],
        classicQuote: '《子平真诠》意旨：官以纯粹为贵，喜财印相随，最忌混杀伤官。'
    },
    '七杀格': {
        name: '七杀格',
        element: '杀',
        judgeBase: '月令以七杀司令，取杀为格。',
        yongShenTypical: '七杀',
        xianShenTypical: '食神、印绶、劫财',
        strength: '宜身强',
        shunNi: '逆用',
        personality: ['气决胆壮', '任事果断', '好胜尚权', '遇制则贵'],
        goodFor: ['武职权柄', '竞争行业', '高压决断岗位'],
        watchOut: ['忌杀无制化', '忌财党助杀', '忌身弱受攻'],
        chengGeTypes: ['杀印相生格', '杀邀食制格', '七杀用财格', '以劫合杀格', '财滋弱杀格'],
        defeatConditions: ['七杀无气无根', '杀旺无制', '身弱受杀'],
        classicQuote: '《子平真诠》意旨：杀为偏官，须有制伏，制化得宜，反成权贵。'
    },
    '正财格': {
        name: '正财格',
        element: '财',
        judgeBase: '月令以正财司令，取财为格。',
        yongShenTypical: '正财',
        xianShenTypical: '官星、食神',
        strength: '宜身强',
        shunNi: '顺用',
        personality: ['务实持家', '重信用分寸', '善经营筹画', '不喜虚浮'],
        goodFor: ['经营理财', '实业贸易', '稳定管理岗'],
        watchOut: ['防比劫争财', '忌财多身弱', '忌印财交战'],
        chengGeTypes: ['财旺生官格', '化伤为财生官格', '财旺身弱用印格', '财格佩印格', '财格食印不碍格', '财格去食护官格', '制杀生财格', '财带暗官格', '合杀存财格', '弃杀就财格', '财喜食生格', '用财喜印格', '用财喜比格'],
        defeatConditions: ['比劫争财', '财多压身', '财星失根'],
        classicQuote: '《子平真诠》意旨：财宜根深有气，得食生官护，则富而能贵。'
    },
    '偏财格': {
        name: '偏财格',
        element: '才',
        judgeBase: '月令以偏财司令，取才为格。',
        yongShenTypical: '偏财',
        xianShenTypical: '官星、食神',
        strength: '宜身强',
        shunNi: '顺用',
        personality: ['机敏通达', '善应变取机', '重效率资源', '外缘较广'],
        goodFor: ['市场拓展', '项目经营', '资源整合型工作'],
        watchOut: ['防比劫夺财', '忌贪多冒进', '忌财轻浮荡'],
        chengGeTypes: ['财旺生官格', '化伤为财生官格', '财旺身弱用印格', '财格佩印格', '财格食印不碍格', '财格去食护官格', '制杀生财格', '财带暗官格', '合杀存财格', '弃杀就财格', '财喜食生格', '用财喜印格', '用财喜比格'],
        defeatConditions: ['比劫争财', '财旺身弱', '财星无根'],
        classicQuote: '《子平真诠》意旨：偏财喜身强而能任，得食官辅佐，则发福尤速。'
    },
    '食神格': {
        name: '食神格',
        element: '食',
        judgeBase: '月令以食神司令，取食为格。',
        yongShenTypical: '食神',
        xianShenTypical: '财星、七杀',
        strength: '强弱皆可',
        shunNi: '顺用',
        personality: ['温厚宽和', '辞气雍容', '才艺外发', '重生活情趣'],
        goodFor: ['文艺策划', '教育传播', '品牌内容'],
        watchOut: ['忌枭神夺食', '忌财引杀重', '忌食轻无根'],
        chengGeTypes: ['食神制杀格', '食神生财格', '用食喜比格', '弃食就印格', '灵枭得用格'],
        defeatConditions: ['枭神夺食', '食神失根', '杀重无制'],
        classicQuote: '《子平真诠》意旨：食神最喜生财制杀，怕偏印夺其清气。'
    },
    '伤官格': {
        name: '伤官格',
        element: '伤',
        judgeBase: '月令以伤官司令，取伤为格。',
        yongShenTypical: '伤官',
        xianShenTypical: '印绶、财星',
        strength: '宜身强',
        shunNi: '逆用',
        personality: ['聪警敏锐', '辞锋见长', '不拘常格', '好胜自任'],
        goodFor: ['创意表达', '技术突破', '营销策动'],
        watchOut: ['防伤官见官', '忌锋芒太露', '忌无印节制'],
        chengGeTypes: ['伤官佩印格', '伤官用杀印格', '伤官兼用财印格', '伤官生财格', '伤官喜官格', '伤官弃官格'],
        defeatConditions: ['伤官见官', '伤重无印', '官星受伤成祸'],
        classicQuote: '《子平真诠》意旨：伤官虽秀，须财印相辅；若直犯官星，多主反覆。'
    },
    '正印格': {
        name: '正印格',
        element: '印',
        judgeBase: '月令以正印司令，取印为格。',
        yongShenTypical: '正印',
        xianShenTypical: '官星、比劫',
        strength: '强弱皆可',
        shunNi: '顺用',
        personality: ['慈厚稳重', '喜学好古', '重名节涵养', '有护持心'],
        goodFor: ['教育研究', '顾问策士', '文职学术'],
        watchOut: ['防财破印', '忌枭食并争', '忌印重闭塞'],
        chengGeTypes: ['印旺泄秀格', '用印喜官格', '用印喜食格', '用印喜比格', '弃印就财格'],
        defeatConditions: ['财破印', '印轻无根', '食印相碍'],
        classicQuote: '《子平真诠》意旨：印绶喜官来生扶，最怕财星坏印。'
    },
    '偏印格': {
        name: '偏印格',
        element: '枭',
        judgeBase: '月令以偏印司令，取枭为格。',
        yongShenTypical: '偏印',
        xianShenTypical: '官星、比劫',
        strength: '强弱皆可',
        shunNi: '逆用',
        personality: ['思深好静', '悟性偏高', '孤介不群', '多偏门专长'],
        goodFor: ['术数设计', '研究开发', '宗教身心领域'],
        watchOut: ['防枭神夺食', '忌财来破印', '忌孤高失群'],
        chengGeTypes: ['印旺泄秀格', '用印喜官格', '用印喜食格', '用印喜比格', '弃印就财格'],
        defeatConditions: ['财破印', '枭神夺食', '印枭失根'],
        classicQuote: '《子平真诠》意旨：偏印偏于孤清，得官比扶持则奇，见财多损。'
    },
    '建禄格': {
        name: '建禄格',
        element: '比',
        judgeBase: '月支为日主禄位，以身自旺立格。',
        yongShenTypical: '比肩',
        xianShenTypical: '官星、财星、食神',
        strength: '宜身强',
        shunNi: '逆用',
        personality: ['自主自立', '自尊极强', '行事果毅', '不喜受制'],
        goodFor: ['自主创业', '统筹管理', '开创型岗位'],
        watchOut: ['防比劫太重', '忌无财官引', '防刚强失和'],
        chengGeTypes: ['建禄用官格', '建禄用财格', '建禄用食格'],
        defeatConditions: ['比劫壅滞', '无吉神引化', '财官俱薄'],
        classicQuote: '《子平真诠》意旨：建禄月劫，最喜财官透出，方见福力。'
    },
    '羊刃格': {
        name: '羊刃格',
        element: '劫',
        judgeBase: '阳干月支临刃，以刃气过刚立格。',
        yongShenTypical: '劫财',
        xianShenTypical: '七杀、正官、食伤',
        strength: '宜身强',
        shunNi: '逆用',
        personality: ['刚决猛烈', '好胜不屈', '担当敢为', '喜直不喜曲'],
        goodFor: ['军警竞技', '攻坚执行', '高压管理场域'],
        watchOut: ['忌羊刃无制', '防争斗伤灾', '忌财星裸露'],
        chengGeTypes: ['刃杀相停格', '阳刃露杀财印助杀格', '羊刃驾官格', '刃旺泄秀格', '刃泄生财格'],
        defeatConditions: ['羊刃无制', '刃旺伤身', '财官受冲'],
        classicQuote: '《子平真诠》意旨：羊刃极刚，须官杀制伏，制得其宜，反主威权。'
    }
};

const _FULL_TEN_GOD_MAP = {
    '比': '比肩',
    '劫': '劫财',
    '食': '食神',
    '伤': '伤官',
    '财': '正财',
    '才': '偏财',
    '官': '正官',
    '杀': '七杀',
    '印': '正印',
    '枭': '偏印'
};
const _SHORT_TEN_GOD_MAP = Object.fromEntries(Object.entries(_FULL_TEN_GOD_MAP).map(([key, value]) => [value, key]));
const _GAN_TO_ELEMENT = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const _ELEMENT_TO_REP_GAN = { '木': '甲', '火': '丙', '土': '戊', '金': '庚', '水': '壬' };
const _ELEMENT_TO_STEMS = {
    '木': ['甲', '乙'],
    '火': ['丙', '丁'],
    '土': ['戊', '己'],
    '金': ['庚', '辛'],
    '水': ['壬', '癸']
};
const _HE_GAN_MAP = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
const _ZHI_CHONG = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
const _YANG_REN_MAP = { '甲': '卯', '丙': '午', '戊': '午', '庚': '酉', '壬': '子' };
const _TEN_GOD_TO_GEJU = { '官': '正官格', '杀': '七杀格', '财': '正财格', '才': '偏财格', '食': '食神格', '伤': '伤官格', '印': '正印格', '枭': '偏印格', '比': '建禄格', '劫': '羊刃格' };
let _monthMergeStemContext = [];

function _normalizeTenGodName(name) {
    return _SHORT_TEN_GOD_MAP[name] || name || '';
}

function _buildStemsFromBazi(bazi) {
    return [bazi.year[0], bazi.month[0], bazi.day[0], bazi.time[0]];
}

function _buildBranchesFromBazi(bazi) {
    return [bazi.year[1], bazi.month[1], bazi.day[1], bazi.time[1]];
}

function _getVisibleStems(allStems, dayGan) {
    const visible = [];
    allStems.forEach((stem, index) => {
        if (index === 2) return;
        visible.push(stem);
    });
    return visible.filter(stem => stem !== undefined && stem !== null && stem !== '');
}

function _isStemTouGan(stem, allStems) {
    return _getVisibleStems(allStems).includes(stem);
}

function _countStemTouGan(stem, allStems) {
    return _getVisibleStems(allStems).filter(item => item === stem).length;
}

function _getStemRootStats(stem, allBranches) {
    const stats = { strong: 0, weak: 0, trace: 0, none: 0, phases: [] };
    allBranches.forEach(branch => {
        const phase = getDiShi(stem, branch);
        stats.phases.push({ branch, phase });
        if (phase === '帝旺' || phase === '临官') stats.strong += 1;
        else if (phase === '长生' || phase === '冠带') stats.weak += 1;
        else if (phase === '墓') stats.trace += 1;
        else stats.none += 1;
    });
    return stats;
}

function _getStemState(stem, allStems, allBranches) {
    const rootStats = _getStemRootStats(stem, allBranches);
    const touGanCount = _countStemTouGan(stem, allStems);
    return {
        stem,
        touGan: touGanCount > 0,
        touGanCount,
        rootStats,
        hasStrongRoot: rootStats.strong > 0,
        hasWeakRoot: rootStats.weak > 0,
        hasTraceRoot: rootStats.trace > 0,
        hasRoot: rootStats.strong > 0 || rootStats.weak > 0 || rootStats.trace > 0,
        hasLi: touGanCount > 0 && rootStats.strong > 0,
        hasQi: touGanCount > 0 && (rootStats.strong > 0 || rootStats.weak > 0),
        noRoot: rootStats.strong === 0 && rootStats.weak === 0 && rootStats.trace === 0
    };
}

function _getTenGodStem(dayGan, tenGod, tenGodMap) {
    const normalized = _normalizeTenGodName(tenGod);
    const mapEntries = tenGodMap ? Object.entries(tenGodMap) : Object.entries(BaziEngine.ShiShen[dayGan] || {});
    const found = mapEntries.find(([, value]) => _normalizeTenGodName(value) === normalized);
    return found ? found[0] : '';
}

function _getTenGodState(dayGan, tenGod, allStems, allBranches, tenGodMap) {
    const stem = _getTenGodStem(dayGan, tenGod, tenGodMap);
    return stem ? _getStemState(stem, allStems, allBranches) : {
        stem: '',
        touGan: false,
        touGanCount: 0,
        rootStats: { strong: 0, weak: 0, trace: 0, none: allBranches.length, phases: [] },
        hasStrongRoot: false,
        hasWeakRoot: false,
        hasTraceRoot: false,
        hasRoot: false,
        hasLi: false,
        hasQi: false,
        noRoot: true
    };
}

function _getCombinedTenGodState(dayGan, tenGods, allStems, allBranches, tenGodMap) {
    const states = tenGods.map(tenGod => _getTenGodState(dayGan, tenGod, allStems, allBranches, tenGodMap));
    const active = states.filter(state => state.stem);
    return {
        stems: active.map(state => state.stem),
        states: active,
        touGan: active.some(state => state.touGan),
        hasLi: active.some(state => state.hasLi),
        hasQi: active.some(state => state.hasQi),
        hasRoot: active.some(state => state.hasRoot),
        overWang: false
    };
}

function _hasStemCombinationBetween(groupA, groupB) {
    const statesA = groupA?.states || [];
    const statesB = groupB?.states || [];
    return statesA.some(a => a.touGan && statesB.some(b => b.touGan && _HE_GAN_MAP[a.stem] === b.stem));
}

function _isElementOverWang(element, allStems, allBranches) {
    const stems = _ELEMENT_TO_STEMS[element] || [];
    const touGanCount = stems.reduce((sum, stem) => sum + _countStemTouGan(stem, allStems), 0);
    const strongRootCount = stems.reduce((sum, stem) => sum + _getStemRootStats(stem, allBranches).strong, 0);
    return touGanCount >= 2 && strongRootCount >= 2;
}

function _isOfficialMixed(states) {
    if (!states.guan.touGan || !states.sha.touGan) return false;
    if (states.shi.hasLi) return false;
    if (states.jie.touGan && (_HE_GAN_MAP[states.jie.stem] === states.sha.stem || _HE_GAN_MAP[states.jie.stem] === states.guan.stem)) return false;
    return true;
}

function _isDangerousShangGuan(dayGan, states) {
    if (['庚', '辛', '壬', '癸'].includes(dayGan)) return false;
    return states.shang.hasQi && states.guan.touGan && !states.yin.touGan;
}

function _isAnyShangGuanJianGuan(dayGan, states) {
    if (['庚', '辛', '壬', '癸'].includes(dayGan)) return false;
    return states.shang.hasQi && states.guan.touGan && !states.yin.touGan;
}

function _isStemKe(targetStem, attackerStem) {
    const targetElement = _GAN_TO_ELEMENT[targetStem];
    const attackerElement = _GAN_TO_ELEMENT[attackerStem];
    const keMap = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
    return keMap[attackerElement] === targetElement;
}

function _getMonthHiddenGans(monthZhi) {
    const hides = BaziEngine.ZHI_HIDE[monthZhi] || [];
    return [hides[0] || null, hides[1] || null, hides[2] || null];
}

function _formatGeJuByTenGod(tenGod) {
    return _TEN_GOD_TO_GEJU[tenGod] || `${tenGod}格`;
}

function _isStemHiddenInBranches(stem, allBranches) {
    return allBranches.some(branch => (BaziEngine.ZHI_HIDE[branch] || []).includes(stem));
}

function _getHiddenStemEvidence(stem, allBranches, maxHiddenIndex = 1) {
    if (!stem) return [];
    return allBranches.flatMap((branch, pillarIndex) => {
        const hiddenIndex = (BaziEngine.ZHI_HIDE[branch] || []).indexOf(stem);
        if (hiddenIndex < 0 || hiddenIndex > maxHiddenIndex) return [];
        return [{ branch, pillarIndex, hiddenIndex }];
    });
}

function _pickRootedExposedOutput(states, allBranches) {
    return [
        { tenGod: '食', state: states.shi },
        { tenGod: '伤', state: states.shang }
    ].find(item => item.state.touGan && _isStemHiddenInBranches(item.state.stem, allBranches)) || null;
}

function _officialHasActualRoot(states, allBranches) {
    return _isStemHiddenInBranches(states.guan.stem, allBranches)
        || _isStemHiddenInBranches(states.sha.stem, allBranches);
}

function _hasElementBranchMeetingSupport(element, monthZhi, allBranches) {
    const groups = [
        { branches: ['亥', '卯', '未'], element: '木' },
        { branches: ['寅', '午', '戌'], element: '火' },
        { branches: ['巳', '酉', '丑'], element: '金' },
        { branches: ['申', '子', '辰'], element: '水' }
    ];
    return groups.some(group => (
        group.element === element
        && group.branches.includes(monthZhi)
        && group.branches.some(branch => branch !== monthZhi && allBranches.includes(branch))
    ));
}

function _buildPatternCandidate({ type, stem, tenGod, priority, evidence = [] }) {
    return {
        type,
        name: _formatGeJuByTenGod(tenGod),
        stem,
        tenGod,
        priority,
        evidence
    };
}

function _resolvePatternCandidates({ dayGan, monthZhi, allStems, allBranches, monthHiddenGans, monthMainGan, rawMonthMainGan, basis }) {
    const tenGodMap = BaziEngine.ShiShen[dayGan] || {};
    const candidates = [];
    const pushCandidate = (candidate) => {
        if (!candidate || !candidate.stem || !candidate.tenGod) return;
        const duplicated = candidates.some(item => item.type === candidate.type && item.stem === candidate.stem && item.tenGod === candidate.tenGod);
        if (!duplicated) candidates.push(candidate);
    };
    const baseTenGod = tenGodMap[monthMainGan];
    pushCandidate(_buildPatternCandidate({
        type: basis === '月支本气' && monthMainGan === rawMonthMainGan ? 'base_month' : 'revealed_hidden',
        stem: monthMainGan,
        tenGod: baseTenGod,
        priority: 50,
        evidence: [`${monthZhi}中${monthMainGan}取格`]
    }));

    const states = {
        shi: _getTenGodState(dayGan, '食', allStems, allBranches, tenGodMap),
        guan: _getTenGodState(dayGan, '官', allStems, allBranches, tenGodMap),
        sha: _getTenGodState(dayGan, '杀', allStems, allBranches, tenGodMap),
    };
    const hasFoodControl = states.shi.touGan && (states.shi.hasRoot || _isStemHiddenInBranches(states.shi.stem, allBranches));
    const hasKillingWeight = states.sha.touGanCount >= 2;
    if (states.sha.touGan && hasKillingWeight && hasFoodControl) {
        pushCandidate(_buildPatternCandidate({
            type: 'exposed_killing_controlled',
            stem: states.sha.stem,
            tenGod: '杀',
            priority: 92,
            evidence: ['七杀透出有势', '食神透出可制杀']
        }));
    }

    const shaCombinedAway = states.sha.touGan && allStems.some(stem => stem !== dayGan && _HE_GAN_MAP[stem] === states.sha.stem);
    if (states.guan.touGan && shaCombinedAway) {
        pushCandidate(_buildPatternCandidate({
            type: 'mixed_official_cleanup',
            stem: states.guan.stem,
            tenGod: '官',
            priority: 95,
            evidence: ['官杀并见', '七杀被合而留官取清']
        }));
    }

    const isGraveyardMonth = ['辰', '戌', '丑', '未'].includes(monthZhi);
    const monthPeerCannotFormPattern = isGraveyardMonth && (baseTenGod === '比' || baseTenGod === '劫');
    const hasVisibleNonPeerMonthHidden = monthHiddenGans.some(stem => {
        const tenGod = tenGodMap[stem];
        return stem && _isStemTouGan(stem, allStems) && tenGod !== '比' && tenGod !== '劫';
    });
    const singleExposedOfficialAxis = states.guan.touGan !== states.sha.touGan
        ? (states.guan.touGan ? { state: states.guan, tenGod: '官' } : { state: states.sha, tenGod: '杀' })
        : null;
    if (monthPeerCannotFormPattern && !hasVisibleNonPeerMonthHidden && singleExposedOfficialAxis) {
        pushCandidate(_buildPatternCandidate({
            type: 'graveyard_peer_official_axis',
            stem: singleExposedOfficialAxis.state.stem,
            tenGod: singleExposedOfficialAxis.tenGod,
            priority: 88,
            evidence: [`${monthZhi}墓库本气为比劫不另立格`, `${singleExposedOfficialAxis.state.stem}${singleExposedOfficialAxis.tenGod}独透立轴`]
        }));
    }

    if (isGraveyardMonth) {
        monthHiddenGans.forEach(stem => {
            if (!stem || !_isStemTouGan(stem, allStems)) return;
            const tenGod = tenGodMap[stem];
            if (!tenGod || tenGod === '比' || tenGod === '劫') return;
            pushCandidate(_buildPatternCandidate({
                type: 'revealed_hidden',
                stem,
                tenGod,
                priority: 55,
                evidence: [`墓库月${stem}透干`]
            }));
            const element = _GAN_TO_ELEMENT[stem];
            if (['官', '杀', '财', '才'].includes(tenGod) && _hasElementBranchMeetingSupport(element, monthZhi, allBranches)) {
                pushCandidate(_buildPatternCandidate({
                    type: 'graveyard_revealed_supported',
                    stem,
                    tenGod,
                    priority: tenGod === '官' || tenGod === '杀' ? 90 : 72,
                    evidence: [`墓库月${stem}透干`, `${monthZhi}有${element}局会支支持`]
                }));
            }
        });
    }

    return candidates.sort((a, b) => b.priority - a.priority);
}

function _detectMonthMerge(allBranches, monthZhi) {
    const sanHeGroups = [
        { branches: ['申', '子', '辰'], element: '水' },
        { branches: ['寅', '午', '戌'], element: '火' },
        { branches: ['巳', '酉', '丑'], element: '金' },
        { branches: ['亥', '卯', '未'], element: '木' }
    ];
    for (const group of sanHeGroups) {
        if (!group.branches.includes(monthZhi)) continue;
        if (group.branches.every(branch => allBranches.includes(branch))) {
            return {
                mergeType: '三合',
                originalZhi: monthZhi,
                resultElement: group.element,
                resultGan: _ELEMENT_TO_REP_GAN[group.element]
            };
        }
    }
    const liuHeGroups = [
        { branches: ['子', '丑'], element: '土' },
        { branches: ['寅', '亥'], element: '木' },
        { branches: ['卯', '戌'], element: '火' },
        { branches: ['辰', '酉'], element: '金' },
        { branches: ['巳', '申'], element: '水' },
        { branches: ['午', '未'], element: '土' }
    ];
    for (const group of liuHeGroups) {
        if (!group.branches.includes(monthZhi)) continue;
        if (!group.branches.every(branch => allBranches.includes(branch))) continue;
        const resultStems = _ELEMENT_TO_STEMS[group.element] || [];
        const hasVisibleStem = _monthMergeStemContext.some(stem => resultStems.includes(stem));
        if (!hasVisibleStem) continue;
        return {
            mergeType: '六合',
            originalZhi: monthZhi,
            resultElement: group.element,
            resultGan: _ELEMENT_TO_REP_GAN[group.element]
        };
    }
    return null;
}

function getChengGe(baziInfo) {
    const { geju, dayGan, allStems, allBranches, tenGodMap, dayStrength } = baziInfo;
    const baseBasis = baziInfo.basis || (geju === '建禄格' || geju === '羊刃格' ? '特判' : '月令本气');
    const states = {
        bi: _getTenGodState(dayGan, '比', allStems, allBranches, tenGodMap),
        jie: _getTenGodState(dayGan, '劫', allStems, allBranches, tenGodMap),
        shi: _getTenGodState(dayGan, '食', allStems, allBranches, tenGodMap),
        shang: _getTenGodState(dayGan, '伤', allStems, allBranches, tenGodMap),
        cai: _getTenGodState(dayGan, '财', allStems, allBranches, tenGodMap),
        caiPian: _getTenGodState(dayGan, '才', allStems, allBranches, tenGodMap),
        guan: _getTenGodState(dayGan, '官', allStems, allBranches, tenGodMap),
        sha: _getTenGodState(dayGan, '杀', allStems, allBranches, tenGodMap),
        yin: _getTenGodState(dayGan, '印', allStems, allBranches, tenGodMap),
        xiao: _getTenGodState(dayGan, '枭', allStems, allBranches, tenGodMap)
    };
    const finance = _getCombinedTenGodState(dayGan, ['财', '才'], allStems, allBranches, tenGodMap);
    const seal = _getCombinedTenGodState(dayGan, ['印', '枭'], allStems, allBranches, tenGodMap);
    const official = _getCombinedTenGodState(dayGan, ['官', '杀'], allStems, allBranches, tenGodMap);
    const biJieTooStrong = _isElementOverWang(_GAN_TO_ELEMENT[states.bi.stem || dayGan], allStems, allBranches);
    const result = {
        yongShen: '',
        yongShenTenGod: '',
        chengGe: geju,
        chengGeResult: '待定',
        chengGeReason: '月令已定格，仍待四柱配合分高下。',
        xianShen: '',
        basis: baseBasis,
        patternEffects: {
            protectedShens: [],
            invalidatedShens: [],
            demotedShens: [],
            promotedShens: [],
            assistantShens: [],
            methodTags: [],
            qiongTongPriority: false
        }
    };
    const setResult = (yongTenGod, chengGe, chengGeResult, chengGeReason, xianShen = '', yongStem = '', patternEffects = {}) => {
        result.yongShenTenGod = yongTenGod;
        result.yongShen = yongStem || _getTenGodStem(dayGan, yongTenGod, tenGodMap) || (yongTenGod === '比' ? dayGan : '');
        result.chengGe = chengGe;
        result.chengGeResult = chengGeResult;
        result.chengGeReason = chengGeReason;
        result.xianShen = xianShen;
        result.patternEffects = {
            protectedShens: patternEffects.protectedShens || [],
            invalidatedShens: patternEffects.invalidatedShens || [],
            demotedShens: patternEffects.demotedShens || [],
            promotedShens: patternEffects.promotedShens || [],
            assistantShens: patternEffects.assistantShens || [],
            methodTags: patternEffects.methodTags || [],
            qiongTongPriority: patternEffects.qiongTongPriority === true
        };
        return result;
    };

    const resolveQiongTongPattern = () => {
        const monthZhi = baziInfo.monthZhi;
        const hasStem = stem => allStems.includes(stem);
        const hasBranch = branch => allBranches.includes(branch);
        const qiongEffects = (extra = {}) => ({
            qiongTongPriority: true,
            ...extra
        });

        if (dayGan === '甲' && monthZhi === '申' && hasStem('丙') && !hasStem('壬') && !hasStem('癸')) {
            return setResult('食', '穷通甲申用丙格', '成格', '申月甲木，秋金肃杀，穷通专用丙火制金暖木。', '杀', '丙', qiongEffects({
                protectedShens: ['食'],
                promotedShens: ['食'],
                demotedShens: ['印', '枭'],
                methodTags: ['专用丙火', '秋木以火制金']
            }));
        }

        if (dayGan === '甲' && monthZhi === '丑' && hasStem('丁')) {
            return setResult('伤', hasBranch('午') ? '寒木丁火得根格' : '寒木吐秀生财格', '成格', hasBranch('午')
                ? '丑月寒木，丁火透出且午中得根，寒木向阳而富贵皆成。'
                : '丑月寒木，丁火透出吐秀暖局，伤官生财为用。', '财', '丁', qiongEffects({
                protectedShens: ['伤', '财', '才'],
                promotedShens: ['伤'],
                demotedShens: ['印', '枭'],
                methodTags: ['寒木向阳', hasBranch('午') ? '丁火得根' : '伤官生财']
            }));
        }

        if (dayGan === '甲' && monthZhi === '戌' && hasStem('壬') && hasStem('庚')) {
            return setResult('枭', '假伤官得地格', '成格', '戌月甲木火土燥烈，庚杀透而壬水泄庚制火扶身，假伤官得地。', '杀', '壬', qiongEffects({
                protectedShens: ['枭'],
                promotedShens: ['枭'],
                methodTags: ['假伤官得地', '壬水泄庚', '制火扶身']
            }));
        }

        if (dayGan === '丁' && monthZhi === '辰') {
            if (hasStem('戊')) {
                return setResult('伤', '穷通丁辰戊土制杀格', '成格', '三月丁火，支成水局或杀气出干时，以戊土制杀为用。', '杀', '戊', qiongEffects({
                    protectedShens: ['伤'],
                    promotedShens: ['伤'],
                    demotedShens: ['官', '杀'],
                    methodTags: ['戊土制杀', '喜用同宫']
                }));
            }
            if (hasStem('庚')) {
                return setResult('财', '穷通丁辰庚金泄土格', '成格', '三月丁火土重晦光，取庚金泄土之气为用。', '', '庚', qiongEffects({
                    protectedShens: ['财'],
                    promotedShens: ['财'],
                    demotedShens: ['印', '枭'],
                    methodTags: ['土重晦光', '庚金泄土']
                }));
            }
            if (hasStem('癸') && (finance.hasQi || hasBranch('酉'))) {
                return setResult('杀', '财滋弱杀格', '成格', '三月丁火财星有气，癸杀透出，财滋杀为用。', '财', '癸', qiongEffects({
                    protectedShens: ['杀', '财', '才'],
                    promotedShens: ['杀'],
                    assistantShens: ['财', '才'],
                    methodTags: ['财滋杀', '可用财杀']
                }));
            }
        }

        if (dayGan === '丁' && monthZhi === '巳') {
            if (hasStem('壬')) {
                return setResult('官', '穷通丁巳专用官星格', '成格', '四月丁火火旺，壬水官星透出，专用官星调济成贵。', '', '壬', qiongEffects({
                    protectedShens: ['官'],
                    promotedShens: ['官'],
                    assistantShens: finance.touGan ? ['财', '才'] : [],
                    methodTags: ['专用官星']
                }));
            }
            if (hasStem('癸')) {
                return setResult('杀', '穷通丁巳无壬用癸格', '成格', '四月丁火无壬而癸水透出，取癸杀调候，官杀得财生。', '财', '癸', qiongEffects({
                    protectedShens: ['杀'],
                    promotedShens: ['杀'],
                    assistantShens: ['财', '才'],
                    demotedShens: ['食', '伤'],
                    methodTags: ['无壬用癸', '官得财生']
                }));
            }
            if (hasBranch('亥')) {
                return setResult('官', '穷通丁巳亥宫官贵格', '成格', '四月丁火，亥中壬官为贵气，取亥宫官贵为用，甲木引丁为助。', '印', '壬', qiongEffects({
                    protectedShens: ['官', '印'],
                    promotedShens: ['官'],
                    assistantShens: ['印'],
                    demotedShens: ['财', '才'],
                    methodTags: ['亥宫官贵', '甲木引丁']
                }));
            }
            if (hasStem('庚')) {
                return setResult('财', '穷通丁巳专用庚金格', '成格', '四月丁火身强火旺，庚金透出，专用庚金泄火成财。', '', '庚', qiongEffects({
                    protectedShens: ['财'],
                    promotedShens: ['财'],
                    methodTags: ['专用庚金', '身强财旺']
                }));
            }
        }

        if (dayGan === '丙' && monthZhi === '亥' && hasStem('己') && (hasStem('壬') || hasBranch('子'))) {
            return setResult('枭', '己土混壬格', '成格', '亥月丙火壬水旺，己土混壬只是培木机制，真正用神仍在甲木。', '伤', '甲', qiongEffects({
                protectedShens: ['枭'],
                promotedShens: ['枭'],
                assistantShens: ['伤'],
                methodTags: ['己土混壬', '绝地逢生', '辅药不等于用神']
            }));
        }

        if (dayGan === '辛' && monthZhi === '丑' && hasStem('丁')) {
            return setResult('杀', '财旺生杀格', '成格', '辛金丑月，丁火得用，甲木引丁，财旺生杀兼调候。', finance.touGan ? '财' : '', '丁', qiongEffects({
                protectedShens: ['杀', '财', '才'],
                promotedShens: ['杀'],
                assistantShens: finance.touGan ? ['财', '才'] : [],
                methodTags: ['财旺生杀', '甲木引丁', '冬金用火']
            }));
        }

        return null;
    };

    const qiongTongPattern = resolveQiongTongPattern();
    if (qiongTongPattern) return qiongTongPattern;

    if (geju === '正官格') {
        // 化官为印：月令官星被日主合（丁壬合等），且官支三合/会成印局 → 官化为印、印重成势，转用财损印（无财则用印）。
        const _huaSealEl = _GAN_TO_ELEMENT[states.yin.stem || states.xiao.stem];
        if (baziInfo.monthMergeInfo && baziInfo.monthMergeInfo.mergeType === '三合' && _huaSealEl && baziInfo.monthMergeInfo.resultElement === _huaSealEl && _HE_GAN_MAP[dayGan] === states.guan.stem) {
            if (finance.touGan) {
                const huaCaiUse = states.caiPian.touGan ? '才' : '财';
                const huaCaiStem = states.caiPian.touGan ? states.caiPian.stem : states.cai.stem;
                return setResult(huaCaiUse, '化官为印格', '成格', '官星合化为印，印重成势，透财损印为用。', '印', huaCaiStem);
            }
            return setResult(states.yin.touGan ? '印' : '枭', '化官为印格', '成格', '官星合化为印，印绶成势为用。', '', states.yin.touGan ? states.yin.stem : states.xiao.stem);
        }
        // 合杀留官：官杀混杂时，七杀被它干合去（非日主自合），留官取清，官为用、印为护。
        if (states.sha.touGan && allStems.some(s => s !== dayGan && _HE_GAN_MAP[s] === states.sha.stem)) return setResult('官', '合杀留官格', '成格', '七杀被合去，留官取清。', '印', states.guan.stem);
        if (baseBasis === '主格候选' && ['辰', '戌', '丑', '未'].includes(baziInfo.monthZhi) && _hasStemCombinationBetween(finance, seal)) {
            return setResult('官', '孤官无辅格', '待定', '杂气正官透干会支，但财印相合失用，官星孤露无辅。', '', states.guan.stem, {
                protectedShens: ['官'],
                promotedShens: ['官'],
                invalidatedShens: ['财', '才', '印']
            });
        }
        if (_isOfficialMixed(states)) return setResult('官', '正官格', '败格', '官杀混杂', '', states.guan.stem);
        if (_isDangerousShangGuan(dayGan, states)) return setResult('官', '正官格', '败格', '伤官见官', '', states.guan.stem);
        const monthStemIsSeal = [states.yin.stem, states.xiao.stem].includes(allStems[1]);
        const timeStemIsFinance = [states.cai.stem, states.caiPian.stem].includes(allStems[3]);
        if (states.guan.hasRoot && monthStemIsSeal && timeStemIsFinance && !_hasStemCombinationBetween(finance, seal)) {
            return setResult('官', '财印并用格', '成格', '官星秉令，财印并透且两不相碍。', '财星、印绶', states.guan.stem, {
                protectedShens: ['官', '财', '才', '印', '枭']
            });
        }
        if (states.guan.hasLi && seal.hasLi) return setResult('官', '正官佩印格', '成格', '官印相扶，官星清而有护。', '印', states.guan.stem);
        if (states.guan.hasLi && finance.hasQi && !states.shang.touGan) return setResult('官', '用官喜财格', '成格', '官星有力，财星通气以生官。', '财', states.guan.stem);
        if (states.guan.noRoot && (states.shang.hasLi || states.shi.hasLi)) return setResult('官', '弃官就食格', '成格', '官星无根受制，转取食神成局。', '食', states.guan.stem);
        if ((states.shang.hasLi || states.sha.hasLi) && finance.hasLi) return setResult('官', '弃官存财格', '成格', '官星受制，财星反得成用。', '财', states.guan.stem);
        return setResult('官', '正官格', '待定', '官星已立，须再观印财与清纯。', '', states.guan.stem);
    }

    if (geju === '七杀格') {
        if (baseBasis === '主格候选' && states.sha.touGanCount >= 2 && states.shi.touGan && (states.shi.hasRoot || _isStemHiddenInBranches(states.shi.stem, allBranches))) {
            return setResult('食', '食神制杀格', '成格', '七杀并透成势，食神有根，制杀扶身。', '杀', states.shi.stem, {
                protectedShens: ['食'],
                demotedShens: ['财', '才']
            });
        }
        if (states.sha.noRoot && !finance.hasQi) return setResult('杀', '七杀格', '败格', '七杀无气无根', '', states.sha.stem);
        // 官杀去留取清
        // 去官留杀：官透而伤官透出制去官星，留当令七杀取清，用杀。
        if (states.guan.touGan && states.shang.touGan && states.sha.hasRoot && !states.shi.touGan) return setResult('杀', '去官留杀格', '成格', '伤官制去官星，官杀两清而留杀为用。', '', states.sha.stem);
        // 去杀留官：月令七杀被地支冲去，官透留用取清。
        if (states.guan.touGan && allBranches.includes(_ZHI_CHONG[baziInfo.monthZhi])) return setResult('官', '去杀留官格', '成格', '月令七杀被冲去，留官取清，印护官为喜。', '印', states.guan.stem);
        const rootedExposedOutput = _pickRootedExposedOutput(states, allBranches);
        const exposedSeal = states.yin.touGan
            ? { tenGod: '印', state: states.yin }
            : (states.xiao.touGan ? { tenGod: '枭', state: states.xiao } : null);
        const exposedFinance = states.cai.touGan
            ? { tenGod: '财', state: states.cai }
            : (states.caiPian.touGan ? { tenGod: '才', state: states.caiPian } : null);
        const financeRemovesSeal = exposedSeal && exposedFinance
            && _isStemKe(exposedSeal.state.stem, exposedFinance.state.stem);
        if (states.sha.hasRoot && rootedExposedOutput && financeRemovesSeal) {
            return setResult(exposedFinance.tenGod, '七杀用财格', '成格', '七杀有根，食伤本可制杀而受印所碍；财去印存食，生杀即以制杀，两得其用。', rootedExposedOutput.tenGod, exposedFinance.state.stem, {
                protectedShens: [rootedExposedOutput.tenGod],
                invalidatedShens: [exposedSeal.tenGod],
                promotedShens: [exposedFinance.tenGod],
                assistantShens: [rootedExposedOutput.tenGod]
            });
        }
        if (states.shi.touGan && states.shi.hasRoot && states.sha.hasRoot) return setResult('食', '杀邀食制格', '成格', '食神有根，制伏七杀。', '', states.shi.stem, {
            promotedShens: ['食'],
            demotedShens: dayStrength === '身弱' ? ['财', '才'] : ['财', '才', '印', '枭'],
            assistantShens: dayStrength === '身弱' ? ['印', '枭'] : []
        });
        if (states.sha.hasRoot && seal.hasLi) return setResult('印', '杀印相生格', '成格', '七杀有根，印绶有力化杀生身。', '杀', states.yin.touGan ? states.yin.stem : states.xiao.stem);
        if (states.shi.touGan && states.sha.hasRoot && !seal.hasQi) return setResult('食', '杀邀食制格', '成格', '食神透出而无印，制伏七杀。', '', states.shi.stem, {
            promotedShens: ['食'],
            demotedShens: dayStrength === '身弱' ? ['财', '才'] : ['财', '才', '印', '枭'],
            assistantShens: dayStrength === '身弱' ? ['印', '枭'] : []
        });
        const hiddenSealUse = !seal.touGan && [
            { tenGod: '印', state: states.yin },
            { tenGod: '枭', state: states.xiao }
        ].find(item => _getHiddenStemEvidence(item.state.stem, allBranches, 1).length > 0);
        const hasEffectiveOutputControl = states.shi.hasQi || states.shang.hasQi;
        const daySeatedYangRen = _YANG_REN_MAP[dayGan] === allBranches[2];
        if (states.sha.hasRoot && !hasEffectiveOutputControl && hiddenSealUse && !daySeatedYangRen) {
            return setResult(hiddenSealUse.tenGod, '杀印相生格', '成格', '七杀有根而无食制，印不透但藏支有根，取藏印化杀生身。', '杀', hiddenSealUse.state.stem, {
                promotedShens: [hiddenSealUse.tenGod],
                assistantShens: dayStrength === '身强' ? ['比', '劫'] : []
            });
        }
        if (states.sha.hasRoot && dayStrength === '身弱' && seal.hasQi) return setResult('印', '杀印相生格', '成格', '身弱杀重，印绶化杀生身。', '杀', states.yin.touGan ? states.yin.stem : states.xiao.stem);
        if (states.jie.touGan && _HE_GAN_MAP[states.jie.stem] === states.sha.stem) return setResult('杀', '以劫合杀格', '成格', '劫财透干，与杀相合成权。', '劫', states.sha.stem);
        if (finance.hasLi && states.sha.hasRoot && dayStrength === '身强') return setResult('杀', '财滋弱杀格', '成格', '财星有力而身能任杀。', '财', states.sha.stem);
        return setResult('杀', '七杀格', '待定', '杀星已立，仍须制化得所。', '', states.sha.stem);
    }

    if (geju === '正财格' || geju === '偏财格') {
        const yongTenGod = geju === '正财格' ? '财' : '才';
        const yongState = geju === '正财格' ? states.cai : states.caiPian;
        const pickSealUse = ({ allowRootOnly = false } = {}) => {
            if (states.xiao.hasLi || (states.xiao.touGan && states.xiao.hasRoot)) return { tenGod: '枭', stem: states.xiao.stem };
            if (states.yin.hasLi || (states.yin.touGan && states.yin.hasRoot)) return { tenGod: '印', stem: states.yin.stem };
            if (!allowRootOnly) return null;
            if (states.yin.hasRoot) return { tenGod: '印', stem: states.yin.stem };
            if (states.xiao.hasRoot) return { tenGod: '枭', stem: states.xiao.stem };
            return null;
        };
        if (biJieTooStrong && !official.hasQi) return setResult(yongTenGod, geju, '败格', '比劫争财', '', yongState.stem);
        const monthHiddenGans = baziInfo.monthHiddenGans || [];
        const rootedExposedFood = states.shi.touGan && _isStemHiddenInBranches(states.shi.stem, allBranches)
            ? { tenGod: '食', state: states.shi }
            : null;
        const exposedRootedSeal = [
            { tenGod: '印', state: states.yin },
            { tenGod: '枭', state: states.xiao }
        ].find(item => item.state.touGan && _isStemHiddenInBranches(item.state.stem, allBranches));
        const hiddenOfficerInMonth = !states.guan.touGan && monthHiddenGans.slice(0, 2).includes(states.guan.stem);
        const sealControlsFood = rootedExposedFood && exposedRootedSeal
            && _isStemKe(rootedExposedFood.state.stem, exposedRootedSeal.state.stem);
        if (hiddenOfficerInMonth && sealControlsFood) {
            return setResult('官', '财格去食护官格', '成格', '财格食印相克，月令暗官可用；印制食神而护官，去食存官。', exposedRootedSeal.tenGod, states.guan.stem, {
                protectedShens: ['官', exposedRootedSeal.tenGod],
                invalidatedShens: [rootedExposedFood.tenGod],
                promotedShens: ['官'],
                assistantShens: [exposedRootedSeal.tenGod]
            });
        }
        const visibleStemIndex = stem => allStems.findIndex((item, index) => index !== 2 && item === stem);
        const foodStemIndex = visibleStemIndex(states.shi.stem);
        const separatedSeal = [
            { tenGod: '印', state: states.yin },
            { tenGod: '枭', state: states.xiao }
        ].find(item => item.state.touGan && foodStemIndex >= 0 && Math.abs(foodStemIndex - visibleStemIndex(item.state.stem)) >= 3);
        if (geju === '正财格' && !hiddenOfficerInMonth && !official.touGan && yongState.hasRoot && states.shi.touGan && separatedSeal) {
            return setResult('食', '财格食印不碍格', '成格', '财格用食兼印，食印分居而不相碍。', separatedSeal.tenGod, states.shi.stem, {
                protectedShens: ['食', separatedSeal.tenGod, '财', '才'],
                assistantShens: [separatedSeal.tenGod]
            });
        }
        if (yongState.hasLi && states.sha.touGan && states.jie.touGan && _HE_GAN_MAP[states.jie.stem] === states.sha.stem) {
            return setResult(yongTenGod, '合杀存财格', '成格', '财带七杀，合杀存财。', '', yongState.stem);
        }
        if (geju === '正财格' && yongState.hasRoot && states.shi.touGan && states.sha.touGan && states.sha.hasRoot && _isStemKe(states.sha.stem, states.shi.stem)) {
            return setResult('食', '制杀生财格', '成格', '财带七杀，食神制杀而生财。', yongTenGod, states.shi.stem, {
                protectedShens: ['食', '财', '才']
            });
        }
        const canUseRootOnlySeal = states.guan.hasQi && !states.shi.touGan && !states.shang.touGan;
        const sealUse = dayStrength === '身弱' && yongState.hasLi ? pickSealUse({ allowRootOnly: canUseRootOnlySeal }) : null;
        if (sealUse && canUseRootOnlySeal) return setResult(sealUse.tenGod, '财旺身弱用印格', '成格', '财旺身弱，用印不用官。', '', sealUse.stem);
        if (sealUse) return setResult(sealUse.tenGod, '财格佩印格', '成格', '财格佩印，佩印帮身。', sealUse.tenGod === '枭' && states.yin.hasRoot ? '印' : '', sealUse.stem);
        if (yongState.hasLi && monthHiddenGans.includes(states.shang.stem) && states.guan.hasQi) {
            return setResult(yongTenGod, '化伤为财生官格', '成格', '化伤为财，财旺生官。', '官', yongState.stem, { assistantShens: ['印', '枭'] });
        }
        if (yongState.hasLi && states.guan.hasRoot && !states.guan.touGan && monthHiddenGans.includes(states.guan.stem)) {
            return setResult(yongTenGod, '财带暗官格', '成格', '单透财，月令暗官。', '官', yongState.stem);
        }
        if (yongState.hasLi && states.sha.hasRoot && !states.sha.touGan && monthHiddenGans.includes(states.sha.stem)) {
            return setResult(yongTenGod, '弃杀就财格', '成格', '财透杀藏，弃杀就财。', '', yongState.stem, {
                demotedShens: ['杀']
            });
        }
        if ((yongState.hasLi || finance.hasLi) && states.guan.touGan && states.guan.hasQi) return setResult('官', '财旺生官格', '成格', '财星有力，官星得气，财生官为用。', yongTenGod, states.guan.stem, { assistantShens: ['印', '枭'] });
        if (states.shi.hasLi && yongState.hasQi) return setResult(yongTenGod, '财喜食生格', '成格', '食神有力，能生财星。', '食', yongState.stem);
        if (seal.hasLi && yongState.hasLi && !allBranches.every(branch => branch === baziInfo.monthZhi)) return setResult(yongTenGod, '用财喜印格', '成格', '财印各有所凭，互成高下。', '印', yongState.stem);
        if ((states.bi.touGan || states.jie.touGan) && yongState.hasRoot && !biJieTooStrong) return setResult(yongTenGod, '用财喜比格', '成格', '比劫透而不劫尽，反能任财。', '比', yongState.stem);
        return setResult(yongTenGod, geju, '待定', '财星已立，仍需官食护持。', '', yongState.stem);
    }

    if (geju === '正印格' || geju === '偏印格') {
        const yongTenGod = geju === '正印格' ? '印' : '枭';
        const yongState = geju === '正印格' ? states.yin : states.xiao;
        const sealElement = _GAN_TO_ELEMENT[yongState.stem || dayGan];
        const sealOverWang = !!sealElement && _isElementOverWang(sealElement, allStems, allBranches);
        if (finance.hasLi && yongState.hasLi && !states.bi.touGan && !states.jie.touGan) return setResult(yongTenGod, geju, '败格', '财破印', '', yongState.stem);
        if ((sealOverWang || seal.hasLi) && states.sha.touGan && states.sha.hasRoot && dayStrength !== '身弱') return setResult('杀', '印格用杀格', '成格', '印重身旺，透杀以化印立格。', '印', states.sha.stem);
        if (sealOverWang && finance.touGan) {
            const caiUse = states.caiPian.touGan ? '才' : '财';
            const caiStem = states.caiPian.touGan ? states.caiPian.stem : states.cai.stem;
            return setResult(caiUse, '印多用财格', '成格', '印多身强，透财损印太过为用。', states.shi.touGan ? '食' : '', caiStem);
        }
        const outputRelease = _pickRootedExposedOutput(states, allBranches);
        if (dayStrength === '身强' && outputRelease && !_officialHasActualRoot(states, allBranches)) {
            return setResult(outputRelease.tenGod, '印旺泄秀格', '成格', '身强印旺，食伤透而有根，泄秀为用；官杀无根不取。', yongTenGod, outputRelease.state.stem, {
                promotedShens: [outputRelease.tenGod],
                demotedShens: ['官', '杀'],
                assistantShens: ['印', '枭']
            });
        }
        if (dayStrength === '身强' && states.guan.touGan && !states.sha.touGan) return setResult('官', '印旺用官格', '成格', '身旺印强，官星清纯泄秀为用。', '印', states.guan.stem);
        if (yongState.hasLi && states.guan.hasQi) return setResult(yongTenGod, '用印喜官格', '成格', '印绶有力，官星来生。', '官', yongState.stem);
        if (yongState.hasLi && states.shi.hasQi && !(states.xiao.hasLi && states.shi.noRoot)) return setResult(yongTenGod, '用印喜食格', '成格', '印绶稳而食神通气。', '食', yongState.stem);
        if (yongState.hasLi && (states.bi.hasQi || states.jie.hasQi)) return setResult(yongTenGod, '用印喜比格', '成格', '印比相扶，身有依归。', '比', yongState.stem);
        if (yongState.noRoot && finance.hasLi) return setResult(yongTenGod, '弃印就财格', '成格', '印星失势，转取财星为用。', '财', yongState.stem);
        return setResult(yongTenGod, geju, '待定', '印星已立，仍须看官比食之配。', '', yongState.stem);
    }

    if (geju === '食神格') {
        if (states.xiao.hasLi && states.shi.noRoot) return setResult('食', '食神格', '败格', '枭神夺食', '', states.shi.stem);
        const foodMainRootCount = allBranches.filter(branch => (BaziEngine.ZHI_HIDE[branch] || [])[0] === states.shi.stem).length;
        if (dayStrength === '身弱' && states.shi.touGan && foodMainRootCount >= 2 && states.xiao.touGanCount >= 2) {
            return setResult('枭', '灵枭得用格', '成格', '食神当令叠根而身弱，枭神两透，制食止泄并扶身为用。', '', states.xiao.stem, {
                protectedShens: ['枭'],
                demotedShens: ['食', '伤']
            });
        }
        // 金水食神用杀：金水日主食神当令，气寒湿，专取七杀（丙丁火）暖局为用。
        if (['庚', '辛'].includes(dayGan) && states.sha.touGan && ['亥', '子', '丑'].includes(baziInfo.monthZhi)) return setResult('杀', '金水食神用杀格', '成格', '金水食神，气寒喜七杀暖局为用。', '食', states.sha.stem);
        if (states.shi.hasLi && states.sha.hasRoot && !finance.touGan) return setResult('食', '食神制杀格', '成格', '食神有力而专制七杀。', '杀', states.shi.stem);
        if (states.shi.hasLi && finance.hasQi) return setResult('食', '食神生财格', '成格', '食神通关，财星随之而起。', '财', states.shi.stem, { protectedShens: ['食', '财', '才'], demotedShens: ['枭', '印'] });
        if (states.shi.hasLi && (states.bi.hasQi || states.jie.hasQi) && !official.touGan) return setResult('食', '用食喜比格', '成格', '比劫相扶，食神得展。', '比', states.shi.stem);
        if (states.shi.noRoot && seal.hasLi) return setResult('食', '弃食就印格', '成格', '食神失根，转取印绶。', '印', states.shi.stem);
        return setResult('食', '食神格', '待定', '食神已立，仍须分清财杀印之路。', '', states.shi.stem);
    }

    if (geju === '伤官格') {
        // 月令伤官当令，成法判断不以伤官透干为必要（子/亥/酉/丑等本气伤官多不透）。
        const isMetalWater = ['庚', '辛', '壬', '癸'].includes(dayGan);
        const sealStem = states.yin.touGan ? states.yin.stem : (states.xiao.touGan ? states.xiao.stem : (states.yin.stem || states.xiao.stem));
        const caiUse = states.caiPian.touGan ? '才' : '财';
        const caiStem = states.caiPian.touGan ? states.caiPian.stem : states.cai.stem;
        const rootedFinanceUse = [
            { tenGod: '才', state: states.caiPian },
            { tenGod: '财', state: states.cai }
        ].find(item => item.state.hasStrongRoot);
        if (_isAnyShangGuanJianGuan(dayGan, states)) return setResult('伤', '伤官格', '败格', '伤官见官', '', states.shang.stem);
        const repeatedPrimaryOutput = _getHiddenStemEvidence(states.shang.stem, allBranches, 0).length >= 2;
        const hiddenSealUse = !seal.touGan && [
            { tenGod: '印', state: states.yin },
            { tenGod: '枭', state: states.xiao }
        ].find(item => _getHiddenStemEvidence(item.state.stem, allBranches, 1).length > 0);
        if (dayStrength === '身弱' && repeatedPrimaryOutput && states.yin.touGan && states.yin.hasQi && states.sha.touGanCount >= 2 && !states.guan.touGan) {
            return setResult('印', '伤官用杀印格', '成格', '伤官叠根而身弱，七杀两透生印，取印制伤并以杀扶印。', '', states.yin.stem, {
                protectedShens: ['印', '杀'],
                demotedShens: ['食', '伤'],
                assistantShens: ['杀']
            });
        }
        if (dayStrength === '身弱' && repeatedPrimaryOutput && hiddenSealUse) {
            return setResult(hiddenSealUse.tenGod, '伤官佩印格', '成格', '伤官叠根过泄而身弱，印不透但藏支有根，取藏印制伤生身。', '伤', hiddenSealUse.state.stem, {
                promotedShens: [hiddenSealUse.tenGod],
                demotedShens: ['食', '伤'],
                assistantShens: ['官', '杀']
            });
        }
        if (!finance.touGan && rootedFinanceUse && states.shang.touGan && states.shang.hasRoot) {
            return setResult(rootedFinanceUse.tenGod, '伤官生财格', '成格', '伤官透而有根，财星虽不透但坐支主气，可承伤官生财。', '伤', rootedFinanceUse.state.stem, {
                protectedShens: ['伤', '财', '才'],
                promotedShens: [rootedFinanceUse.tenGod],
                demotedShens: ['印', '枭'],
                assistantShens: ['伤'],
                methodTags: ['伤官用财', '伤官生财', '制劫化财']
            });
        }
        // 金水伤官喜官：调候清贵，官透即喜
        if (isMetalWater && states.guan.touGan && !states.sha.touGan) return setResult('官', '伤官喜官格', '成格', '金水日主，伤官见官反成清贵，官为用。', '伤', states.guan.stem, { assistantShens: ['印', '枭'] });
        // 伤官带杀，用伤制杀
        if (states.sha.touGan && states.sha.hasRoot && !seal.hasLi) return setResult('伤', '伤官带杀格', '成格', '伤官当令而制伏七杀。', '杀', states.shang.stem);
        // 身弱伤官佩印：印为用，化伤生身护格
        if (dayStrength === '身弱' && seal.hasLi) return setResult(states.yin.touGan ? '印' : '枭', '伤官佩印格', '成格', '身弱伤官泄重，佩印生身护格。', '伤', sealStem, { assistantShens: ['官', '杀'] });
        // 化伤为财生官（财官皆显）
        if (finance.touGan && states.guan.hasQi && !states.sha.touGan) return setResult(caiUse, '化伤为财生官格', '成格', '伤官化财，财旺生官，财为通关。', '官', caiStem, { assistantShens: ['印', '枭'] });
        const sealOnOppositeEdge = (
            [states.yin.stem, states.xiao.stem].includes(allStems[0])
            && [states.cai.stem, states.caiPian.stem].includes(allStems[3])
        ) || (
            [states.cai.stem, states.caiPian.stem].includes(allStems[0])
            && [states.yin.stem, states.xiao.stem].includes(allStems[3])
        );
        const financeRootPillars = new Set(
            [states.cai.stem, states.caiPian.stem]
                .flatMap(stem => _getHiddenStemEvidence(stem, allBranches, 2))
                .map(item => item.pillarIndex)
        );
        if (['戊', '己'].includes(dayGan) && baziInfo.monthZhi === '酉' && finance.touGan && seal.touGan && sealOnOppositeEdge && financeRootPillars.size >= 2) {
            return setResult(caiUse, '伤官兼用财印格', '成格', '酉月伤官金水偏寒，财印分居年时而两不相碍，以财泄秀、以印暖局。', '印', caiStem, {
                protectedShens: ['伤', '财', '才'],
                assistantShens: ['印', '枭']
            });
        }
        // 伤官生财：财透得生，财为用
        if (finance.touGan) return setResult(caiUse, '伤官生财格', '成格', '伤官吐秀而财星得生。', '伤', caiStem, { protectedShens: ['伤', '财', '才'], demotedShens: ['枭', '印'] });
        // 印强能化（非身弱亦可佩印）
        if (seal.hasLi) return setResult(states.yin.touGan ? '印' : '枭', '伤官佩印格', '成格', '伤官外露而印绶能化。', '伤', sealStem, { assistantShens: ['官', '杀'] });
        if (states.guan.noRoot && states.shang.hasLi) return setResult('伤', '伤官弃官格', '成格', '官星无根，伤官得以专用。', '', states.shang.stem);
        return setResult('伤', '伤官格', '待定', '伤官已立，仍须看印财调停。', '', states.shang.stem);
    }

    if (geju === '建禄格') {
        // 建禄身旺，官透有根（含墓库通根）即以官为用、印护官为喜（官为用神，非比劫）。
        // 伤官透出本破官，但若伤官被它干合去（去伤存官，如庚合乙），则官仍清可用。
        const jianluShangHeAway = states.shang.stem && allStems.some(s => s !== dayGan && _HE_GAN_MAP[s] === states.shang.stem);
        if (states.guan.touGan && states.guan.hasRoot && (!states.shang.touGan || jianluShangHeAway) && !states.sha.touGan) return setResult('官', '建禄用官格', '成格', '建禄身旺，官透有根（伤官合去存官），以官为用、印护官为喜。', '印', states.guan.stem);
        if (finance.hasLi && !biJieTooStrong) return setResult('比', '建禄用财格', '成格', '建禄得财，身能任之。', '财', dayGan);
        if ((states.shi.hasLi || states.shang.hasLi) && finance.touGan) return setResult('比', '建禄用食格', '成格', '食伤吐秀而财来引化。', '食', dayGan);
        return setResult('比', '建禄格', '待定', '建禄身旺，仍需财官食引发。', '', dayGan);
    }

    if (geju === '羊刃格') {
        if (!states.sha.touGan && !states.guan.touGan && !(states.shi.hasLi || states.shang.hasLi)) return setResult('劫', '羊刃格', '败格', '羊刃无制', '', states.jie.stem);
        if (states.sha.touGan && states.sha.hasRoot && finance.touGan && seal.touGan) {
            return setResult('杀', '阳刃露杀财印助杀格', '成格', '阳刃露杀，财印并透助杀成格。', '印、财', states.sha.stem, {
                protectedShens: ['杀', '印', '枭', '财', '才'],
                assistantShens: ['印', '枭', '财', '才'],
                methodTags: ['阳刃露煞', '透煞根浅', '财印助之']
            });
        }
        if (states.sha.touGan && states.sha.hasRoot) return setResult('劫', '刃杀相停格', '成格', '七杀透而有根，可以驾刃。', '杀', states.jie.stem);
        if (states.guan.touGan && states.guan.hasRoot) return setResult('劫', '羊刃驾官格', '成格', '官星透而有根，可以制刃。', '官', states.jie.stem);
        const bladeOutputRelease = _pickRootedExposedOutput(states, allBranches);
        if (dayStrength === '身强' && bladeOutputRelease && !_officialHasActualRoot(states, allBranches)) {
            return setResult(bladeOutputRelease.tenGod, '刃旺泄秀格', '成格', '禄刃身旺，食伤透而有根，泄秀为用；官杀无根不取。', '劫', bladeOutputRelease.state.stem, {
                promotedShens: [bladeOutputRelease.tenGod],
                demotedShens: ['官', '杀'],
                assistantShens: ['比', '劫']
            });
        }
        if ((states.shi.hasLi || states.shang.hasLi) && finance.touGan) return setResult('劫', '刃泄生财格', '成格', '食伤泄刃而财星引化。', '食', states.jie.stem);
        return setResult('劫', '羊刃格', '待定', '羊刃已立，仍须官杀食伤调之。', '', states.jie.stem);
    }

    return result;
}

const _GOOD_TEN_GODS = new Set(['财', '才', '官', '印', '食']);
const _EVIL_TEN_GODS = new Set(['杀', '伤', '枭', '劫']);
const _NORMAL_PATTERN_NAMES = new Set(['正官格', '七杀格', '正财格', '偏财格', '食神格', '伤官格', '正印格', '偏印格']);
const _SPECIAL_FORCE_PATTERN_NAMES = {
    '从财': '从财格',
    '从官杀': '从官杀格',
    '从食伤': '从儿格',
    '从势': '从势格',
    '专旺': '专旺格'
};

function _getPatternCategory(patternName) {
    if (_NORMAL_PATTERN_NAMES.has(patternName)) return 'NORMAL';
    if (patternName === '建禄格' || patternName === '羊刃格') return 'JIANLU_REN';
    if (Object.values(_SPECIAL_FORCE_PATTERN_NAMES).includes(patternName)) return 'SPECIAL_FORCE';
    return 'MINOR_SIGNAL';
}

function _mapChengGeStatus(status) {
    if (status === '成格') return 'FORMED';
    if (status === '败格') return 'BROKEN';
    if (status === '偏枯') return 'DRY_COLD_IMBALANCED';
    return 'PENDING';
}

function _buildExtractionBasis(geJuInfo = {}) {
    if (geJuInfo.basis === '羊刃特判') return 'YANGREN_SPECIAL';
    if (geJuInfo.basis === '建禄特判') return 'JIANLU_SPECIAL';
    if (geJuInfo.basis === '月支合化') return 'MONTH_COMBINATION_TRANSFORMED';
    if (geJuInfo.basis === '月令透干') return 'MONTH_HIDDEN_STEM_REVEALED';
    return 'MONTH_MAIN_QI';
}

function _buildSpecialPatternName(specialPattern) {
    if (!specialPattern?.type) return '';
    return _SPECIAL_FORCE_PATTERN_NAMES[specialPattern.type] || `${specialPattern.type}格`;
}

function _buildTiaohouEvaluation(tiaohouDetail = {}, favorableResult = {}) {
    const urgency = tiaohouDetail.urgency || '普通';
    const needsAdjustment = urgency === '偏急' || urgency === '极急';
    let status = 'NOT_NEEDED';
    if (needsAdjustment) status = 'NEEDED_RESOLVED';
    return {
        status,
        needs_adjustment: needsAdjustment,
        urgency,
        climate_state: tiaohouDetail.climate_state || '',
        axis: tiaohouDetail.axis || '',
        purpose: tiaohouDetail.purpose || '',
        primary_gods: tiaohouDetail.primary_gods || [],
        secondary_gods: tiaohouDetail.secondary_gods || [],
        avoid_gods: tiaohouDetail.avoid_gods || [],
        explanation: tiaohouDetail.explanation || '',
        special_pattern_warning: tiaohouDetail.special_pattern_warning || ''
    };
}

function buildPatternAnalysis({
    geJuInfo = {},
    geJu = '',
    geJuInfoRecord = null,
    chengGeDetail = {},
    strengthResult = {},
    favorableResult = {},
    imageAnalysis = null,
    patternOverride = null,
    classicalPattern = null,
    monthHiddenGans = [],
    monthZhi = '',
    dayGan = ''
} = {}) {
    const specialPattern = favorableResult.special_pattern || null;
    const basePatternName = geJu || geJuInfo.geju || chengGeDetail.chengGe || '未定格';
    const specialPatternName = _buildSpecialPatternName(specialPattern);
    const hasImageOverride = patternOverride?.overridden === true;
    const hasSpecialForce = hasImageOverride || Boolean(specialPattern);
    const finalPatternName = hasImageOverride
        ? patternOverride.final_pattern
        : (specialPatternName || basePatternName);
    const finalPatternCategory = hasSpecialForce ? 'SPECIAL_FORCE' : _getPatternCategory(finalPatternName);
    const extractionBasis = hasImageOverride
        ? patternOverride.basis
        : (specialPattern ? 'SPECIAL_FORCE' : _buildExtractionBasis(geJuInfo));
    const chengGeStatus = chengGeDetail.chengGeResult || '待定';
    const climateAdjustment = _buildTiaohouEvaluation(favorableResult.tiaohou_detail, favorableResult);
    const overallStatus = hasSpecialForce ? 'FORMED' : _mapChengGeStatus(chengGeStatus);
    const tenGod = geJuInfo.tenGod || geJuInfoRecord?.element || chengGeDetail.yongShenTenGod || '';
    const candidate = imageAnalysis?.override_candidate
        || imageAnalysis?.primary_candidate;
    const sourceBackedStatement = getSourceBackedPatternStatement(candidate?.subtype)
        || getSourceBackedPatternStatement(finalPatternName)
        || getSourceBackedPatternStatement(specialPatternName);
    const patternStatement = sourceBackedStatement
        || getPatternStatement(finalPatternName, overallStatus)
        || getPatternStatement(basePatternName, overallStatus);
    const goodEvilType = _GOOD_TEN_GODS.has(tenGod)
        ? 'GOOD_GOD'
        : (_EVIL_TEN_GODS.has(tenGod) ? 'EVIL_GOD' : 'NEUTRAL');
    const strategy = geJuInfoRecord?.shunNi === '逆用'
        ? 'NI_YONG'
        : (geJuInfoRecord?.shunNi === '顺用' ? 'SHUN_YONG' : '');

    const monthMergeInfo = geJuInfo.monthMergeInfo || null;
    const steps = [
        {
            key: 'dominant_force',
            label: '月令主气',
            value: monthZhi && geJuInfo.monthMainGan
                ? `${monthZhi}藏干以${geJuInfo.monthMainGan}定主轴`
                : (geJuInfo.note || '以月令提纲定格局主轴')
        },
        {
            key: 'stem_reveal',
            label: '透干取用',
            value: monthHiddenGans.length
                ? `月令藏干：${monthHiddenGans.filter(Boolean).join('、')}；当前依据为${geJuInfo.basis || '月支本气'}。`
                : `当前依据为${geJuInfo.basis || '月支本气'}。`
        },
        {
            key: 'combinations',
            label: '合会校验',
            value: monthMergeInfo
                ? `${monthMergeInfo.originalZhi}参与${monthMergeInfo.mergeType}，化${monthMergeInfo.resultElement}，以${monthMergeInfo.resultGan}参与取格。`
                : '未见足以覆盖月令主气的合会成局。'
        }
    ];

    if (hasSpecialForce) {
        steps.unshift({
            key: 'special_force',
            label: '特殊气势',
            value: candidate
                ? `形象评分识别为${candidate.subtype}（${candidate.match_score}分），${candidate.override_scope === 'full' ? '特殊气势覆盖常规格局' : '特殊气势主导喜忌取用'}。`
                : (strengthResult.strengthDetail?.structure_exception?.text || `识别为${specialPattern?.type || finalPatternName}，喜忌先顺其成势。`)
        });
    }

    return {
        final_pattern: classicalPattern
            ? {
                name: classicalPattern.name,
                category: 'CLASSICAL_DISPLAY',
                base_pattern: basePatternName,
                aliases: classicalPattern.aliases || [],
                source: classicalPattern.source || '三命通会',
                score_scope: classicalPattern.scoreScope || 'display_only'
            }
            : undefined,
        classical_pattern: classicalPattern || undefined,
        extraction: {
            basis: extractionBasis,
            base_pattern: basePatternName,
            steps,
            final_pattern: {
                name: finalPatternName,
                category: finalPatternCategory,
                base_pattern: basePatternName,
                ten_god: tenGod,
                description: hasSpecialForce
                    ? `原局触发${specialPattern?.type || finalPatternName}，格局主轴以特殊气势优先。`
                    : (geJuInfoRecord?.judgeBase || geJuInfo.note || '以月令提纲为重，结合透干与合会定格。')
            }
        },
        evaluation: {
            good_evil_flow: {
                god_type: goodEvilType,
                ten_god: tenGod,
                strategy,
                is_fulfilled: overallStatus === 'FORMED',
                text: strategy
                    ? `${geJuInfoRecord?.name || basePatternName}按${geJuInfoRecord?.shunNi}处理。`
                    : '此格需结合全局力量与岁运再细分顺逆。'
            },
            affection_and_power: {
                status: overallStatus === 'FORMED' ? 'SUPPORTIVE' : (overallStatus === 'BROKEN' ? 'CONFLICTED' : 'UNRESOLVED'),
                power_status: chengGeStatus === '成格' ? 'ROOTED_POWERFUL' : 'PENDING',
                text: chengGeDetail.chengGeReason || '已定主格，仍待四柱配合分高下。'
            },
            disease_medicine: {
                disease: Array.isArray(favorableResult.core_shens?.unfavorable) ? favorableResult.core_shens.unfavorable.join('、') : '',
                medicine: Array.isArray(favorableResult.core_shens?.favorable) ? favorableResult.core_shens.favorable.join('、') : '',
                has_medicine: Array.isArray(favorableResult.core_shens?.favorable) && favorableResult.core_shens.favorable.length > 0,
                text: favorableResult.verdict || ''
            },
            climate_adjustment: climateAdjustment,
            special_force: specialPattern,
            overall_status: overallStatus,
            overall_status_label: chengGeStatus
        },
        traits: {
            personality: patternStatement?.personality || (geJuInfoRecord?.personality || []),
            career_wealth: patternStatement?.career_wealth || (geJuInfoRecord?.goodFor || []),
            relationship_health: patternStatement?.relationship_health || '',
            warning: patternStatement?.warning || '',
            failure_warning: patternStatement?.warning || (geJuInfoRecord?.watchOut || []),
            source_basis: patternStatement?.source_basis || '',
            statement_source: patternStatement?.statement_source || '',
            statement_state: patternStatement?.statement_state || '',
            source_backed: patternStatement?.source_backed === true,
            source_limited: patternStatement?.source_limited === true,
            source_title: patternStatement?.source_title || '',
            source_excerpt: patternStatement?.source_excerpt || '',
            source_ref: patternStatement?.source_ref || '',
            covered_fields: patternStatement?.covered_fields || [],
            unsupported_fields: patternStatement?.unsupported_fields || []
        },
        dynamic: {
            current_luck_effect: 'NEUTRAL',
            note: '大运流年成破变化可在下一阶段接入干支刑冲合害与调候药神命中。'
        }
    };
}

// ============================================================================
// 🌟 东方玄学 OS - 全能后端排盘引擎 (接管所有前端计算逻辑)
// ============================================================================
const BaziEngine = {
    Rules: {
        tianYi: { 甲: '丑未', 乙: '子申', 丙: '亥酉', 丁: '亥酉', 戊: '丑未', 己: '子申', 庚: '丑未', 辛: '寅午', 壬: '卯巳', 癸: '卯巳' },
        wenChang: { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' },
        yangRen: { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' },
        feiRen: { 甲: '酉', 丙: '子', 戊: '子', 庚: '卯', 壬: '午' },
        luShen: { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' },
        hongYan: { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '子', 己: '辰', 庚: '戌', 辛: '酉', 壬: '巳', 癸: '申' },
        tianChu: { 甲: '巳', 乙: '午', 丙: '巳', 丁: '午', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' },
        taiji: { 甲: '子午', 乙: '子午', 丙: '卯酉', 丁: '卯酉', 戊: '申辰戌丑未', 己: '申辰戌丑未', 庚: '寅亥', 辛: '寅亥', 壬: '申巳', 癸: '申巳' },
        xueTang: { 甲: '巳', 乙: '巳', 丙: '申', 丁: '申', 戊: '亥', 己: '亥', 庚: '寅', 辛: '寅', 壬: '申', 癸: '申' },
        tianGuan: { 甲: '未', 乙: '辰', 丙: '巳', 丁: '寅', 戊: '卯', 己: '酉', 庚: '亥', 辛: '酉', 壬: '戌', 癸: '午' },
        zaiSha: { 子: '午', 丑: '卯', 寅: '子', 卯: '酉', 辰: '午', 巳: '卯', 午: '子', 未: '酉', 申: '午', 酉: '卯', 戌: '子', 亥: '酉' },
        yiMa: { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 亥: '巳', 卯: '巳', 未: '巳', 巳: '亥', 酉: '亥', 丑: '亥' },
        taoHua: { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 亥: '子', 卯: '子', 未: '子', 巳: '午', 酉: '午', 丑: '午' },
        huaGai: { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 亥: '未', 卯: '未', 未: '未', 巳: '丑', 酉: '丑', 丑: '丑' },
        jiangXing: { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 亥: '卯', 卯: '卯', 未: '卯', 巳: '酉', 酉: '酉', 丑: '酉' },
        guChen: { 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥', 亥: '寅', 子: '寅', 丑: '寅' },
        guaSu: { 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未', 亥: '戌', 子: '戌', 丑: '戌' },
        yueDe: { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' },
        yueDeHe: { 子: '丁', 丑: '乙', 寅: '辛', 卯: '己', 辰: '丁', 巳: '乙', 午: '辛', 未: '己', 申: '丁', 酉: '乙', 戌: '辛', 亥: '己' },
        tianDe: { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' },
        tianDeHe: { 子: '申', 丑: '乙', 寅: '壬', 卯: '巳', 辰: '丁', 巳: '丙', 午: '寅', 未: '己', 申: '戊', 酉: '亥', 戌: '辛', 亥: '庚' },
        specialDays: { 魁罡: ['庚辰','壬辰','戊戌','庚戌'], 日德: ['甲寅','丙辰','戊辰','庚辰','壬戌'], 日贵: ['丁酉','丁亥','癸巳','癸卯'] },
        // ── 新增神煞 ─────────────────────────────────────────────
        guoYin:  {甲:'戌',乙:'未',丙:'丑',丁:'戌',戊:'丑',己:'戌',庚:'辰',辛:'丑',壬:'未',癸:'辰'},
        fuXing:  {甲:'寅',乙:'丑',丙:'子',丁:'亥',戊:'戌',己:'酉',庚:'申',辛:'未',壬:'午',癸:'巳'},
        liuXia:  {甲:'酉',乙:'戌',丙:'未',丁:'申',戊:'巳',己:'辰',庚:'寅',辛:'亥',壬:'卯',癸:'巳'},
        tianXi:  {子:'酉',丑:'申',寅:'未',卯:'午',辰:'巳',巳:'辰',午:'卯',未:'寅',申:'丑',酉:'子',戌:'亥',亥:'戌'},
        xueRen:  {子:'卯',丑:'子',寅:'酉',卯:'午',辰:'卯',巳:'子',午:'酉',未:'午',申:'卯',酉:'子',戌:'酉',亥:'午'},
        tianMed: {子:'亥',丑:'子',寅:'丑',卯:'寅',辰:'卯',巳:'辰',午:'巳',未:'午',申:'未',酉:'申',戌:'酉',亥:'戌'},
        jinYu:   {甲:'丑',乙:'辰',丙:'辰',丁:'未',戊:'辰',己:'未',庚:'未',辛:'戌',壬:'戌',癸:'丑'},
        deshuMap:{寅:['丙','丁','戊','癸'],午:['丙','丁','戊','癸'],戌:['丙','丁','戊','癸'],申:['甲','丙','戊','己','辛','壬','癸'],子:['甲','丙','戊','己','辛','壬','癸'],辰:['甲','丙','戊','己','辛','壬','癸'],巳:['乙','庚','辛'],酉:['乙','庚','辛'],丑:['乙','庚','辛'],亥:['甲','乙','丁','壬'],卯:['甲','乙','丁','壬'],未:['甲','乙','丁','壬']},
        yuanChen:{yang:{子:'未',丑:'申',寅:'酉',卯:'戌',辰:'亥',巳:'子',午:'丑',未:'寅',申:'卯',酉:'辰',戌:'巳',亥:'午'},yin:{子:'巳',丑:'午',寅:'未',卯:'申',辰:'酉',巳:'戌',午:'亥',未:'子',申:'丑',酉:'寅',戌:'卯',亥:'辰'}}
    },
    // 前端迁移过来的数据常量
    NAYIN: { "甲子": "海中金", "乙丑": "海中金", "丙寅": "炉中火", "丁卯": "炉中火", "戊辰": "大林木", "己巳": "大林木", "庚午": "路旁土", "辛未": "路旁土", "壬申": "剑锋金", "癸酉": "剑锋金", "甲戌": "山头火", "乙亥": "山头火", "丙子": "涧下水", "丁丑": "涧下水", "戊寅": "城头土", "己卯": "城头土", "庚辰": "白蜡金", "辛巳": "白蜡金", "壬午": "杨柳木", "癸未": "杨柳木", "甲申": "泉中水", "乙酉": "泉中水", "丙戌": "屋上土", "丁亥": "屋上土", "戊子": "霹雳火", "己丑": "霹雳火", "庚寅": "松柏木", "辛卯": "松柏木", "壬辰": "长流水", "癸巳": "长流水", "甲午": "沙中金", "乙未": "沙中金", "丙申": "山下火", "丁酉": "山下火", "戊戌": "平地木", "己亥": "平地木", "庚子": "壁上土", "辛丑": "壁上土", "壬寅": "金箔金", "癸卯": "金箔金", "甲辰": "覆灯火", "乙巳": "覆灯火", "丙午": "天河水", "丁未": "天河水", "戊申": "大驿土", "己酉": "大驿土", "庚戌": "钗钏金", "辛亥": "钗钏金", "壬子": "桑柘木", "癸丑": "桑柘木", "甲寅": "大溪水", "乙卯": "大溪水", "丙辰": "沙中土", "丁巳": "沙中土", "戊午": "天上火", "己未": "天上火", "庚申": "石榴木", "辛酉": "石榴木", "壬戌": "大海水", "癸亥": "大海水" },
    ZHI_HIDE: { "子": ["癸"], "丑": ["己", "癸", "辛"], "寅": ["甲", "丙", "戊"], "卯": ["乙"], "辰": ["戊", "乙", "癸"], "巳": ["丙", "戊", "庚"], "午": ["丁", "己"], "未": ["己", "丁", "乙"], "申": ["庚", "壬", "戊"], "酉": ["辛"], "戌": ["戊", "辛", "丁"], "亥": ["壬", "甲"] },
    SHI_ER: ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"],
    CHANG_SHENG_START: { "甲": 11, "丙": 2, "戊": 2, "庚": 5, "壬": 8, "乙": 6, "丁": 9, "己": 9, "辛": 0, "癸": 3 },
    ZHI_INDEX: { "子": 0, "丑": 1, "寅": 2, "卯": 3, "辰": 4, "巳": 5, "午": 6, "未": 7, "申": 8, "酉": 9, "戌": 10, "亥": 11 },

    // 独立神煞数组获取（供前端直接遍历渲染）
    // opts: { monthZhi, pillarGan, yearGan, isMale, allGans }
    getShenShaArray: function (targetZhi, dayGan, yearZhi, dayZhi, opts) {
        if (!targetZhi) return [];
        const o = opts || {};
        const monthZhi = o.monthZhi, pillarGan = o.pillarGan, yearGan = o.yearGan;
        const isMale = o.isMale, allGans = o.allGans || [dayGan];
        let res = [];
        // ── 日干起（基础） ────────────────────────────────────────
        if (this.Rules.tianYi[dayGan]?.includes(targetZhi)) res.push("天乙");
        if (this.Rules.wenChang[dayGan] === targetZhi) res.push("文昌");
        if (this.Rules.yangRen[dayGan] === targetZhi) res.push("羊刃");
        if (this.Rules.feiRen[dayGan] === targetZhi) res.push("飞刃");
        if (this.Rules.luShen[dayGan] === targetZhi) res.push("禄神");
        if (this.Rules.hongYan[dayGan] === targetZhi) res.push("红艳");
        if (this.Rules.tianChu[dayGan] === targetZhi) res.push("天厨");
        // 太极贵人：四柱任一天干命中即得（扩展多干校验）
        if (allGans.some(g => (this.Rules.taiji[g]||'').includes(targetZhi))) res.push("太极贵人");
        if (this.Rules.xueTang[dayGan] === targetZhi) res.push("学堂");
        if (this.Rules.guoYin[dayGan] === targetZhi) res.push("国印贵人");
        if (this.Rules.fuXing[dayGan] === targetZhi) res.push("福星贵人");
        if (this.Rules.liuXia[dayGan] === targetZhi) res.push("流霞");
        // ── 年支起 ───────────────────────────────────────────────
        if (this.Rules.yiMa[yearZhi] === targetZhi || this.Rules.yiMa[dayZhi] === targetZhi) res.push("驿马");
        if (this.Rules.taoHua[yearZhi] === targetZhi || this.Rules.taoHua[dayZhi] === targetZhi) res.push("桃花");
        if (this.Rules.huaGai[yearZhi] === targetZhi || this.Rules.huaGai[dayZhi] === targetZhi) res.push("华盖");
        if (this.Rules.jiangXing[yearZhi] === targetZhi || this.Rules.jiangXing[dayZhi] === targetZhi) res.push("将星");
        if (this.Rules.zaiSha[yearZhi] === targetZhi || this.Rules.zaiSha[dayZhi] === targetZhi) res.push("灾煞");
        if (this.Rules.tianXi[yearZhi] === targetZhi) res.push("天喜");
        if (this.Rules.xueRen[yearZhi] === targetZhi) res.push("血刃");
        // ── 月支起 ───────────────────────────────────────────────
        if (monthZhi && this.Rules.tianMed[monthZhi] === targetZhi) res.push("天医");
        // ── 各柱自干起 ───────────────────────────────────────────
        if (pillarGan && this.Rules.jinYu[pillarGan] === targetZhi) res.push("金舆");
        if (pillarGan && monthZhi && (this.Rules.deshuMap[monthZhi]||[]).includes(pillarGan)) res.push("德秀贵人");
        // ── 元辰（年支+阴阳男女） ─────────────────────────────────
        if (yearZhi && yearGan !== undefined && isMale !== undefined) {
            const yangStem = ['甲','丙','戊','庚','壬'].includes(yearGan);
            const useYang = (isMale && yangStem) || (!isMale && !yangStem);
            const ymap = useYang ? this.Rules.yuanChen.yang : this.Rules.yuanChen.yin;
            if (ymap[yearZhi] === targetZhi) res.push("元辰");
        }
        // ── 月支起（天德/月德/天官贵人，需柱干）──────────────────
        if (monthZhi && pillarGan) {
            if (this.Rules.yueDe[monthZhi] === pillarGan) res.push("月德");
            if (this.Rules.yueDeHe[monthZhi] === pillarGan) res.push("月德合");
            if (this.Rules.tianDe[monthZhi] === pillarGan || this.Rules.tianDe[monthZhi] === targetZhi) res.push("天德");
            if (this.Rules.tianDeHe[monthZhi] === pillarGan || this.Rules.tianDeHe[monthZhi] === targetZhi) res.push("天德合");
        }
        if (yearGan && this.Rules.tianGuan[yearGan] === targetZhi) res.push("天官贵人");
        return res;
    },
    // 十二长生计算
    getDiShi: function (gan, zhi) {
        if (!gan || !zhi || this.CHANG_SHENG_START[gan] === undefined || this.ZHI_INDEX[zhi] === undefined) return '-';
        let start = this.CHANG_SHENG_START[gan], zIndex = this.ZHI_INDEX[zhi], isYang = ["甲", "丙", "戊", "庚", "壬"].includes(gan);
        return this.SHI_ER[isYang ? (zIndex - start + 12) % 12 : (start - zIndex + 12) % 12];
    },
    calculateShenSha: function (bazi) {
        // 保留给 LLM 的字符串格式
        const { year, month, day, time } = bazi;
        const result = { year: [], month: [], day: [], time: [] };
        const dayGan = day[0], monthZhi = month[1], yearZhi = year[1], dayZhi = day[1];
        const yearGan = year[0];
        const allGans = [yearGan, month[0], dayGan, time[0]];
        const isMaleFlag = undefined; // calculateShenSha无性别上下文，元辰不在此处计算

        // getShenShaArray 已包含天德/月德/天德合/月德合/天官贵人，pushShen 直接调用即可
        const pushShen = (key, zhi, gan) => {
            result[key] = this.getShenShaArray(zhi, dayGan, yearZhi, dayZhi, {
                monthZhi, pillarGan: gan, yearGan, isMale: isMaleFlag, allGans
            });
        };
        pushShen('year', yearZhi, year[0]); pushShen('month', monthZhi, month[0]);
        pushShen('day', dayZhi, dayGan); pushShen('time', time[1], time[0]);

        // 特殊日柱组合（魁罡、日德、日贵）
        const dayPillar = dayGan + dayZhi;
        for (const [shen, days] of Object.entries(this.Rules.specialDays)) {
            if (days.includes(dayPillar)) result.day.push(shen);
        }

        return {
            year: result.year.length > 0 ? result.year.join(" ") : "-",
            month: result.month.length > 0 ? result.month.join(" ") : "-",
            day: result.day.length > 0 ? result.day.join(" ") : "-",
            time: result.time.length > 0 ? result.time.join(" ") : "-"
        };
    },
    extractSpecialPatterns: function (bazi) {
        return [];
    },
    ShiShen: {
        '甲': { '甲': '比', '乙': '劫', '丙': '食', '丁': '伤', '戊': '才', '己': '财', '庚': '杀', '辛': '官', '壬': '枭', '癸': '印' },
        '乙': { '甲': '劫', '乙': '比', '丙': '伤', '丁': '食', '戊': '财', '己': '才', '庚': '官', '辛': '杀', '壬': '印', '癸': '枭' },
        '丙': { '甲': '枭', '乙': '印', '丙': '比', '丁': '劫', '戊': '食', '己': '伤', '庚': '才', '辛': '财', '壬': '杀', '癸': '官' },
        '丁': { '甲': '印', '乙': '枭', '丙': '劫', '丁': '比', '戊': '伤', '己': '食', '庚': '财', '辛': '才', '壬': '官', '癸': '杀' },
        '戊': { '甲': '杀', '乙': '官', '丙': '枭', '丁': '印', '戊': '比', '己': '劫', '庚': '食', '辛': '伤', '壬': '才', '癸': '财' },
        '己': { '甲': '官', '乙': '杀', '丙': '印', '丁': '枭', '戊': '劫', '己': '比', '庚': '伤', '辛': '食', '壬': '财', '癸': '才' },
        '庚': { '甲': '才', '乙': '财', '丙': '杀', '丁': '官', '戊': '枭', '己': '印', '庚': '比', '辛': '劫', '壬': '食', '癸': '伤' },
        '辛': { '甲': '财', '乙': '才', '丙': '官', '丁': '杀', '戊': '印', '己': '枭', '庚': '劫', '辛': '比', '壬': '伤', '癸': '食' },
        '壬': { '甲': '食', '乙': '伤', '丙': '才', '丁': '财', '戊': '杀', '己': '官', '庚': '枭', '辛': '印', '壬': '比', '癸': '劫' },
        '癸': { '甲': '伤', '乙': '食', '丙': '财', '丁': '才', '戊': '官', '己': '杀', '庚': '印', '辛': '枭', '壬': '劫', '癸': '比' }
    },
    ZhiMainGan: { '子': '癸', '丑': '己', '寅': '甲', '卯': '乙', '辰': '戊', '巳': '丙', '午': '丁', '未': '己', '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬' },
    getGeJu: function (bazi) {
        const dayGan = bazi.day[0];
        const monthZhi = bazi.month[1];
        const allStems = _buildStemsFromBazi(bazi);
        const allBranches = _buildBranchesFromBazi(bazi);
        const jianLuMap = { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' };
        const yangRenMap = { '甲': '卯', '丙': '午', '戊': '午', '庚': '酉', '壬': '子' };
        _monthMergeStemContext = _getVisibleStems(allStems);
        const monthMergeInfo = _detectMonthMerge(allBranches, monthZhi);
        const rawMonthMainGan = this.ZhiMainGan[monthZhi];
        const yangRenKey = `${dayGan}${monthZhi}`;
        if (yangRenMap[dayGan] === monthZhi) {
            return {
                geju: '羊刃格',
                basis: '羊刃特判',
                monthMainGan: rawMonthMainGan,
                tenGod: '劫',
                monthMergeInfo,
                note: `${yangRenKey}命中羊刃特判，取原月支不论合化。`
            };
        }
        if (jianLuMap[dayGan] === monthZhi) {
            return {
                geju: '建禄格',
                basis: '建禄特判',
                monthMainGan: rawMonthMainGan,
                tenGod: '比',
                monthMergeInfo,
                note: `${dayGan}${monthZhi}命中建禄特判，取原月支禄位立格。`
            };
        }
        const monthHiddenGans = this.ZHI_HIDE[monthZhi] || [];
        let monthMainGan = rawMonthMainGan;
        let basis = '月支本气';
        const isGraveyardMonth = ['辰', '戌', '丑', '未'].includes(monthZhi);
        if (!monthMergeInfo && isGraveyardMonth) {
            // 杂气墓库月才取透干余气立格；四正/四生月以本气当令为主，不因余气透干改格。
            // 比劫透干不得另立建禄/羊刃格（禄刃已在上方按禄位/刃位特判）。
            const visibleHidden = monthHiddenGans.filter(stem =>
                stem && _isStemTouGan(stem, allStems) && this.ShiShen[dayGan][stem] !== '比' && this.ShiShen[dayGan][stem] !== '劫');
            if (visibleHidden.length > 0) {
                monthMainGan = visibleHidden.includes(rawMonthMainGan) ? rawMonthMainGan : visibleHidden[0];
            }
        }
        const tenGod = this.ShiShen[dayGan][monthMainGan];
        const patternCandidates = _resolvePatternCandidates({
            dayGan,
            monthZhi,
            allStems,
            allBranches,
            monthHiddenGans,
            monthMainGan,
            rawMonthMainGan,
            basis
        });
        const selectedCandidate = patternCandidates.find(candidate => candidate.priority > 80 && candidate.stem !== monthMainGan) || null;
        const selectedMonthMainGan = selectedCandidate?.stem || monthMainGan;
        const selectedTenGod = selectedCandidate?.tenGod || tenGod;
        const selectedByCandidate = !!selectedCandidate;
        return {
            geju: _formatGeJuByTenGod(selectedTenGod),
            basis: selectedByCandidate ? '主格候选' : basis,
            monthMainGan: selectedMonthMainGan,
            tenGod: selectedTenGod,
            monthMergeInfo,
            patternCandidates,
            note: monthMergeInfo
                ? `${monthZhi}参与${monthMergeInfo.mergeType}化${monthMergeInfo.resultElement}，合化保留为候选；主格仍以${monthZhi}本气${selectedMonthMainGan}立格。`
                : (selectedByCandidate
                    ? `主格候选提升：${selectedCandidate.evidence.join('；')}。`
                    : `${monthZhi}以${selectedMonthMainGan}为月令主气取格。`)
        };
    }
};

const _WX_DIRECTION = { '木': '东方木运', '火': '南方火运', '土': '中央土运', '金': '西方金运', '水': '北方水运' };
const _WX_SEASON =    { '木': '春', '火': '夏', '土': '四季末', '金': '秋', '水': '冬' };
const _GAN_TO_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const _SHEN_TO_WX_NAME = {
    '正印': '印星', '偏印': '枭印', '比肩': '比肩', '劫财': '劫财',
    '食神': '食神', '伤官': '伤官', '正财': '财星', '偏财': '偏财',
    '正官': '官星', '七杀': '七杀'
};

function _buildUserBlocks(favorableResult, strengthResult, geJu, geJuInfoRecord) {
    const fiveShens = favorableResult.five_shens;
    if (!fiveShens) return null;

    const yong = fiveShens.yong;
    const xi = fiveShens.xi || [];
    const ji = fiveShens.ji || [];
    const chou = fiveShens.chou || [];
    const confidence = fiveShens.yong_confidence || 'MEDIUM';
    const tiaohouDetail = favorableResult.tiaohou_detail || {};

    // 用神五行
    const yongWxLabel = (_SHEN_TO_WX_NAME[yong] || yong);
    const xiNames = xi.map(s => _SHEN_TO_WX_NAME[s] || s);
    const jiNames = ji.map(s => _SHEN_TO_WX_NAME[s] || s);
    const chouNames = chou.map(s => _SHEN_TO_WX_NAME[s] || s);

    // 命局定性一行
    const strongWeak = strengthResult.strongWeak || '';
    const confLabel = confidence === 'LOW' ? '（中和命，参考）' : '';
    const summary = `${strongWeak} · ${geJu} · 用${yongWxLabel}${confLabel}`;

    // 用神说明
    const tiaohouPrimary = (tiaohouDetail.primary_gods || []).map(g => g.gan).join('、');
    const tiaohouText = tiaohouPrimary ? `调候首取${tiaohouPrimary}，` : '';
    const swText = strongWeak === '身弱' ? '日主身弱需生扶，' : strongWeak === '身强' ? '日主身强需泄克，' : '日主中和，';
    const gejuText = geJuInfoRecord ? `${geJu}（${geJuInfoRecord.shunNi}）以${geJuInfoRecord.xianShenTypical}为用，` : '';
    const yongVerdict = confidence === 'LOW'
        ? `此命五行趋于中和，用神不专一，${yongWxLabel}综合评分最高，可作参考，大运吉凶变化较缓。`
        : `${tiaohouText}${swText}${gejuText}综合取${yongWxLabel}为命局用神。`;

    // 喜忌方向
    const xiWx = [...new Set(xi.map(s => {
        const shenWxMap = { '正印': '木火', '偏印': '木火', '比肩': '火', '劫财': '火',
            '食神': '土', '伤官': '土', '正财': '金', '偏财': '金', '正官': '水', '七杀': '水' };
        return shenWxMap[s] || s;
    }))].join('、');
    const jiWx = [...new Set([...ji, ...chou].map(s => {
        const shenWxMap = { '正官': '水', '七杀': '水', '正财': '金', '偏财': '金',
            '食神': '土', '伤官': '土', '正印': '木', '偏印': '木', '比肩': '火', '劫财': '火' };
        return shenWxMap[s] || s;
    }))].join('、');
    const xiJiText = [
        xiNames.length ? `喜${xiNames.join('、')}相辅` : '',
        jiNames.length ? `忌${jiNames.join('、')}` : '',
        chouNames.length ? `，${chouNames.join('、')}助忌为仇，尤须防范` : ''
    ].filter(Boolean).join('；') || '喜忌需结合岁运细看。';

    // 大运方向
    const yongGejuInfo = geJuInfoRecord;
    const goodDayunWx = xi.length ? xi.slice(0, 2) : [];
    const badDayunWx  = [...ji, ...chou].slice(0, 2);
    const goodDirText = goodDayunWx.length
        ? `大运喜走${goodDayunWx.map(s => _SHEN_TO_WX_NAME[s] || s).join('、')}方向`
        : '大运方向需结合用神五行细看';
    const badDirText = badDayunWx.length
        ? `，最忌${badDayunWx.map(s => _SHEN_TO_WX_NAME[s] || s).join('、')}运`
        : '';
    const dayunGuide = `${goodDirText}${badDirText}，岁运与用神同气则顺，克冲用神则需防波折。`;

    // 警示
    const avoidText = [...jiNames, ...chouNames].length
        ? `原局最忌${[...jiNames, ...chouNames].join('、')}透干或流年大运走${jiWx ? jiWx + '地' : '忌神方向'}，易生压制、阻滞或健康财运波动。`
        : '暂无显著忌神需特别警示，保持当前格局顺势运行为宜。';

    return { summary, yong_shen_text: yongVerdict, xi_ji_text: xiJiText, dayun_guide: dayunGuide, avoid_text: avoidText };
}

function buildCompleteBaziDetail({ baZi, yun, isMale = true, currentYear = new Date().getFullYear() }) {
    const baziObj = {
        year: baZi.getYear().split(''),
        month: baZi.getMonth().split(''),
        day: baZi.getDay().split(''),
        time: baZi.getTime().split('')
    };
    const dayGan = baZi.getDayGan();
    const yearZhi = baZi.getYearZhi();
    const yearGan = baZi.getYearGan();
    const dayZhi = baZi.getDayZhi();
    const monthZhi = baZi.getMonthZhi();
    const xunKong = baZi.getDayXunKong() || '';
    // 四柱天干（用于太极贵人多干校验）
    const allGans = [yearGan, baZi.getMonthGan(), dayGan, baZi.getTimeGan()];

    const shenshaResult = BaziEngine.calculateShenSha(baziObj);
    const geJuInfo = BaziEngine.getGeJu(baziObj);
    const geJu = geJuInfo.geju;
    const specialPatterns = BaziEngine.extractSpecialPatterns(baziObj);
    const siziSummaryKey = buildSiziSummaryKey(dayGan, baZi.getTime());
    const siziSummaryText = getSiziSummary(siziSummaryKey);

    const _computeXunKong = (g, z) => {
        const ganArr = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
        const zhiArr = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
        const gIdx = ganArr.indexOf(g), zIdx = zhiArr.indexOf(z);
        if (gIdx === -1 || zIdx === -1) return '-';
        const head = (zIdx - gIdx + 12) % 12;
        return zhiArr[(head + 10) % 12] + zhiArr[(head + 11) % 12];
    };
    const buildPillar = (name, gan, zhi, star) => ({
        name,
        gan,
        zhi,
        star,
        hidden_stems: (BaziEngine.ZHI_HIDE[zhi] || []).map(stemGan => ({
            gan: stemGan,
            shi_shen: _FULL_TEN_GOD_MAP[BaziEngine.ShiShen[dayGan]?.[stemGan] || ''] || BaziEngine.ShiShen[dayGan]?.[stemGan] || ''
        })),
        shi: BaziEngine.getDiShi(dayGan, zhi),
        zizuo: BaziEngine.getDiShi(gan, zhi),
        nayin: BaziEngine.NAYIN[gan + zhi] || '-',
        kong: _computeXunKong(gan, zhi),
        shensha: BaziEngine.getShenShaArray(zhi, dayGan, yearZhi, dayZhi, {
            monthZhi, pillarGan: gan, yearGan, isMale, allGans
        })
    });

    const pillarsData = [
        buildPillar('年', baZi.getYearGan(), baZi.getYearZhi(), baZi.getYearShiShenGan()),
        buildPillar('月', baZi.getMonthGan(), baZi.getMonthZhi(), baZi.getMonthShiShenGan()),
        buildPillar('日', baZi.getDayGan(), baZi.getDayZhi(), isMale ? '元男' : '元女'),
        buildPillar('时', baZi.getTimeGan(), baZi.getTimeZhi(), baZi.getTimeShiShenGan())
    ];

    // 跨柱神煞：魁罡、金神、天罗、地网
    const allPillarZhis = pillarsData.map(p => p.zhi);
    const dayPillarStr = dayGan + dayZhi;
    if (['庚辰', '壬辰', '庚戌', '戊戌'].includes(dayPillarStr)) {
        pillarsData[2].shensha.push('魁罡');
    }
    if (dayGan === '甲' && ['丑', '巳', '酉'].includes(baZi.getTimeZhi())) {
        pillarsData[3].shensha.push('金神');
    }
    if (allPillarZhis.includes('戌') && allPillarZhis.includes('亥')) {
        pillarsData.forEach(p => { if (p.zhi === '戌' || p.zhi === '亥') p.shensha.push('天罗'); });
    }
    if (allPillarZhis.includes('辰') && allPillarZhis.includes('巳')) {
        pillarsData.forEach(p => { if (p.zhi === '辰' || p.zhi === '巳') p.shensha.push('地网'); });
    }

    const buildTransitItem = (ganZhi, extra = {}) => {
        const gan = ganZhi ? ganZhi.charAt(0) : '';
        const zhi = ganZhi ? ganZhi.charAt(1) : '';
        return {
            gan,
            zhi,
            shi_shen: gan ? (BaziEngine.ShiShen[dayGan][gan] || '-') : '-',
            zhi_shi_shen: zhi ? (BaziEngine.ShiShen[dayGan][(BaziEngine.ZHI_HIDE[zhi] || [])[0]] || '-') : '-',
            ...extra
        };
    };

    const daYunRaw = yun.getDaYun();
    const mapTransitCycle = (dy, index) => {
        const ganZhi = dy.getGanZhi() || '';
        const startYear = dy.getStartYear();
        const endYear = typeof dy.getEndYear === 'function'
            ? dy.getEndYear()
            : (Number.isFinite(startYear) ? startYear + 9 : null);
        // 流月不在排盘时预建：92 流年 × 12 流月 = 1104 个 lunar 对象，每个都触发
        // 节气/儒略日重算，占排盘 ~94% CPU，曾导致 Worker CPU 超限(503)。
        // 前端只在选中某流年时按需算那一年的 12 个流月(BaziBackingPanel 本地回退)，
        // 故此处只保留流年骨架，不嵌 liuyue_list。
        const liunianList = dy.getLiuNian().map(ln => {
            const lnGanZhi = ln.getGanZhi() || '';
            return buildTransitItem(lnGanZhi, {
                year: ln.getYear(),
                age: ln.getAge(),
                dayun_ganzhi: ganZhi,
                dayun_index: index
            });
        });
        return {
            id: index,
            start_year: dy.getStartYear(),
            end_year: endYear,
            start_age: dy.getStartAge(),
            end_age: dy.getStartAge() + 9,
            ...buildTransitItem(ganZhi, {
                isXiaoyun: !ganZhi,
                liunian_list: liunianList
            })
        };
    };
    const transitCycles = daYunRaw.map(mapTransitCycle);
    const xiaoYunList = transitCycles.filter(item => item.isXiaoyun);
    const daYunList = transitCycles.filter(item => !item.isXiaoyun);

    const currentDaYunObj = daYunRaw.find(dy => currentYear >= dy.getStartYear() && currentYear <= dy.getEndYear())
        || daYunRaw.find(dy => currentYear <= dy.getStartYear())
        || daYunRaw[0];
    const currentLiuNianObj = currentDaYunObj?.getLiuNian().find(ln => ln.getYear() === currentYear)
        || currentDaYunObj?.getLiuNian()[0]
        || null;
    const liuNianList = daYunList
        .flatMap(dayun => (dayun.liunian_list || []).map(item => ({ ...item })))
        .filter(item => Number.isFinite(item.year))
        .sort((a, b) => a.year - b.year);
    const liuYueList = currentLiuNianObj?.getLiuYue().map(ly => {
        const ganZhi = ly.getGanZhi() || '';
        const gan = ganZhi.charAt(0);
        const zhi = ganZhi.charAt(1);
        return {
            month_name: `${ly.getMonthInChinese()}月`,
            gan,
            zhi,
            shi_shen: gan ? getShen(dayGan, gan) : '-'
        };
    }) || [];

    const currentDayunGanZhi = currentDaYunObj?.getGanZhi() || '';
    const currentLiuNianGanZhi = currentLiuNianObj?.getGanZhi() || '';
    const currentDayunGan = currentDayunGanZhi.charAt(0);
    const currentDayunZhi = currentDayunGanZhi.charAt(1);
    const currentLiuNianGan = currentLiuNianGanZhi.charAt(0);
    const currentLiuNianZhi = currentLiuNianGanZhi.charAt(1);

    const gansArr = [baZi.getYearGan(), baZi.getMonthGan(), baZi.getDayGan(), baZi.getTimeGan()];
    const zhisArr = [baZi.getYearZhi(), baZi.getMonthZhi(), baZi.getDayZhi(), baZi.getTimeZhi()];
    const strengthResult = BaziRuleEngine.calculateStrength(dayGan, gansArr, zhisArr);
    const imageAnalysis = assessBaziImage({
        dayGan,
        gans: gansArr,
        zhis: zhisArr,
        monthZhi
    });
    const patternOverride = resolvePatternOverride({
        basePattern: geJu,
        imageAnalysis
    });
    const classicalPattern = resolveSanMingPattern({
        gans: gansArr,
        zhis: zhisArr
    });
    const monthHiddenGans = _getMonthHiddenGans(monthZhi);
    const chengGeDetail = getChengGe({
        geju: geJuInfo.geju,
        basis: geJuInfo.basis === '月支合化'
            ? '月支合化'
            : (geJuInfo.basis.includes('特判')
                ? '特判'
                : (geJuInfo.basis === '主格候选'
                    ? '主格候选'
                    : (geJuInfo.basis === '月支本气'
                    ? '月令本气'
                    : (monthHiddenGans.some(stem => stem && _isStemTouGan(stem, gansArr)) ? '月令透干' : '月令本气')))),
        dayGan,
        monthZhi,
        allStems: gansArr,
        allBranches: zhisArr,
        monthHiddenGans,
        monthMergeInfo: geJuInfo.monthMergeInfo || null,
        patternCandidates: geJuInfo.patternCandidates || [],
        tenGodMap: BaziEngine.ShiShen[dayGan],
        dayStrength: strengthResult.strongWeak === '身强' ? '身强' : (strengthResult.strongWeak === '身弱' ? '身弱' : '身中')
    });
    const favorableResult = BaziRuleEngine.getFavorableUnfavorable(
        dayGan,
        monthZhi,
        geJu,
        strengthResult,
        zhisArr,
        gansArr,
        GE_JU_INFO[geJuInfo.geju] || null,
        imageAnalysis,
        chengGeDetail
    );
    const patternAnalysis = buildPatternAnalysis({
        geJuInfo,
        geJu,
        geJuInfoRecord: GE_JU_INFO[geJuInfo.geju] || null,
        chengGeDetail,
        strengthResult,
        favorableResult,
        imageAnalysis,
        patternOverride,
        classicalPattern,
        monthHiddenGans,
        monthZhi,
        dayGan
    });
    const rulePatterns = BaziRuleEngine.extractAdvancedPatterns(
        dayGan,
        gansArr,
        zhisArr,
        strengthResult.allShens,
        geJu,
        strengthResult
    );
    const shenshaFull = BaziRuleEngine.calculateShenShaFull(baziObj);
    const interactions = BaziRuleEngine.calculateInteractions(
        [...zhisArr, currentDayunZhi, currentLiuNianZhi],
        [...gansArr, currentDayunGan, currentLiuNianGan]
    );
    const engineYuanjuCore = BaziRuleEngine.buildYuanjuCore(
        dayGan,
        monthZhi,
        gansArr,
        zhisArr,
        geJu,
        strengthResult,
        favorableResult,
        rulePatterns
    );
    const engineCurrentDayun = BaziRuleEngine.buildCurrentDayun(
        currentDayunGan,
        currentDayunZhi,
        dayGan,
        zhisArr,
        gansArr
    );
    const engineCurrentLiunian = BaziRuleEngine.buildCurrentLiunian(
        currentLiuNianGan,
        currentLiuNianZhi,
        currentDayunGan,
        currentDayunZhi,
        dayGan,
        zhisArr
    );

    const userBlocks = _buildUserBlocks(favorableResult, strengthResult, geJu, GE_JU_INFO[geJuInfo.geju] || null);
    const decisionChain = classicalPattern
        ? [
            ...(favorableResult.decision_chain || []),
            {
                layer: 'L2 古法变格',
                reason: `识别为${classicalPattern.name}${classicalPattern.aliases?.length ? `（${classicalPattern.aliases.join('、')}）` : ''}；${classicalPattern.evidence || ''}；methodTags：${(classicalPattern.methodTags || []).join('、')}。`,
                override: 'display_only'
            }
        ]
        : favorableResult.decision_chain;

    return {
        base_info: {
            qi_yun: `出生后${yun.getStartYear()}年${yun.getStartMonth()}月${yun.getStartDay()}天起运`,
            ge_ju: geJu,
            ge_ju_detail: geJuInfo,
            special_patterns: specialPatterns
        },
        matrix: {
            pillars: pillarsData,
            xiaoyun_list: xiaoYunList,
            dayun_list: daYunList,
            liunian_list: liuNianList,
            liuyue_list: liuYueList,
            current_dayun: currentDayunGanZhi ? buildPillar('大运', currentDayunGan, currentDayunZhi, _FULL_TEN_GOD_MAP[BaziEngine.ShiShen[dayGan]?.[currentDayunGan] || ''] || BaziEngine.ShiShen[dayGan]?.[currentDayunGan] || '') : null,
            current_liunian: currentLiuNianGanZhi ? buildPillar('流年', currentLiuNianGan, currentLiuNianZhi, _FULL_TEN_GOD_MAP[BaziEngine.ShiShen[dayGan]?.[currentLiuNianGan] || ''] || BaziEngine.ShiShen[dayGan]?.[currentLiuNianGan] || '') : null
        },
        pillars: {
            ganzhi: { year: baZi.getYear(), month: baZi.getMonth(), day: baZi.getDay(), time: baZi.getTime() },
            main_stars: { year: baZi.getYearShiShenGan(), month: baZi.getMonthShiShenGan(), day: '日主', time: baZi.getTimeShiShenGan() },
            shensha: shenshaFull
        },
        shensha: shenshaFull,
        sizi_summary: { key: siziSummaryKey, text: siziSummaryText },
        geju: geJu,
        strong_weak: strengthResult.strongWeak,
        strength_basis: strengthResult.strengthBasis,
        strength_detail: strengthResult.strengthDetail,
        geju_detail: geJuInfo,
        geju_info: GE_JU_INFO[geJuInfo.geju] || null,
        chengge_detail: chengGeDetail,
        pattern_analysis: patternAnalysis,
        image_analysis: imageAnalysis,
        favorable_gods: favorableResult.core_shens.favorable,
        unfavorable_gods: favorableResult.core_shens.unfavorable,
        five_shens: favorableResult.five_shens,
        decision_chain: decisionChain,
        user_blocks: userBlocks,
        favorable_verdict: favorableResult.verdict,
        scoring_details: favorableResult.scoring_details,
        dimension_breakdown: favorableResult.dimension_breakdown,
        wuxing_ratio: favorableResult.wuxing_ratio,
        tiaohou_detail: favorableResult.tiaohou_detail,
        interactions,
        special_patterns: specialPatterns,
        classic_verdict: {
            source: '三命通会',
            key: siziSummaryKey,
            text: siziSummaryText
        },
        engine_yuanju_core: engineYuanjuCore,
        engine_current_dayun: engineCurrentDayun,
        engine_current_liunian: engineCurrentLiunian,
        day_zhi: dayZhi,
        year_zhi: yearZhi,
        month_zhi: monthZhi,
        ri_zhu: `${dayGan}${dayZhi}`,
        engine_version: BAZI_ENGINE_VERSION
    };
}

module.exports = {
    hasCompleteLlmCache,
    hasLatestEngineCache,
    hasExistingLlm,
    CALIBRATION_VERSION,
    computeEventsHash,
    hasValidCalibration,
    buildQualitativeSections,
    GE_JU_INFO,
    getChengGe,
    buildPatternAnalysis,
    getGeJu: BaziEngine.getGeJu.bind(BaziEngine),
    buildCompleteBaziDetail,
    BaziEngine
};
