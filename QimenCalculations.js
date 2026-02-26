// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;
// 文件名: QimenCalculations
/**
 * 奇門遁甲盤局運算模組
 * 修复记录：补全 24 节气简繁转换表 (小满、芒种)
 */

// ============================================================================
// 1. 引入依賴 (QimenConstants 和 QimenUtils)
// ============================================================================
const {
    PALACE,
    ZHONG_SUBSTITUTE,
    FLY_PATH,
    DIRECTION_ARROWS,
    HETU_BAGUA,
    LUOSHU_BAGUA,
    FLYING_STARS,
    FLYING_STAR_CHARTS,
    QIMEN_STARS,
    EIGHT_DOORS_ORIGINAL,
    EIGHT_DOORS_SEQUENCE,
    EIGHT_GODS_YANG,
    EIGHT_GODS_YIN,
    DIPAN_YANG,
    DIPAN_YIN
} = importModule('QimenConstants');

const {
    rotateMapping,
    generatePutSequence,
    normalizeZhongPalace,
    resolveJiaHiding
} = importModule('QimenUtils');

// ============================================================================
// 基礎盤面：河圖與洛書
// ============================================================================

function getHeTu() {
    return [...HETU_BAGUA];
}

function getLuoShu() {
    return [...LUOSHU_BAGUA];
}

// ============================================================================
// 飛星系統
// ============================================================================

function calculateFlyingStars(centerStar) {
    const starNumbers = FLYING_STAR_CHARTS[centerStar];
    if (!starNumbers) {
        throw new Error(`無效的中宮星數：${centerStar}，必須為 1-9`);
    }
    return starNumbers.map(num => FLYING_STARS[num]);
}

// ============================================================================
// 第一層：地盤（三奇六儀）
// ============================================================================

function getDiPan(isYang, gameNumber) {
    const diPanConfig = isYang ? DIPAN_YANG : DIPAN_YIN;
    const result = diPanConfig[gameNumber];
    if (!result) {
        throw new Error(`無效的局數：${gameNumber}，必須為 1-9`);
    }
    return [...result];
}

// ============================================================================
// 第二層：天盤（天干飛布）
// ============================================================================

function calculateTianPan(isYang, tianGan, fuShou, diPan) {
    const targetIndex = diPan.indexOf(tianGan);
    const sourceIndex = diPan.indexOf(fuShou);
    
    // 陽局與陰局使用相同的順時針軌跡
    return rotateMapping(diPan, FLY_PATH.CLOCKWISE, sourceIndex, targetIndex);
}

// ============================================================================
// 第三層：八門
// ============================================================================

function getOriginalDoors() {
    return [...EIGHT_DOORS_ORIGINAL];
}

function getZhiShiDoor(fuShou, diPan) {
    let doorIndex = diPan.indexOf(fuShou);
    doorIndex = normalizeZhongPalace(doorIndex);
    return EIGHT_DOORS_ORIGINAL[doorIndex];
}

function calculateEightDoors(isYang, zhiShiDoor, flyStep, fuShou, diPan) {
    // 確定符首在地盤上的位置作為飛布起點
    const startIndex = diPan.indexOf(fuShou);
    
    // 選擇飛布軌跡（陽局順飛、陰局逆飛）
    const flyIndex = isYang ? FLY_PATH.DOOR_YANG : FLY_PATH.DOOR_YIN;
    
    // 處理飛布步數超過九宮數量的情況
    const normalizedFlyStep = flyStep % flyIndex.length;
    
    // 生成放置順序
    const putSequence = generatePutSequence(flyIndex, startIndex);
    
    // 計算值使門應落入的宮位
    let zhiShiTargetIndex = putSequence[normalizedFlyStep];
    zhiShiTargetIndex = normalizeZhongPalace(zhiShiTargetIndex);
    
    // 從值使門目標宮位開始，沿順時針軌跡安排八門
    const doorPutSequence = generatePutSequence(FLY_PATH.CLOCKWISE, zhiShiTargetIndex);
    
    // 從值使門開始，按固定順序排列八門
    const zhiShiIndexInSequence = EIGHT_DOORS_SEQUENCE.indexOf(zhiShiDoor);
    const doorOrder = [
        ...EIGHT_DOORS_SEQUENCE.slice(zhiShiIndexInSequence),
        ...EIGHT_DOORS_SEQUENCE.slice(0, zhiShiIndexInSequence)
    ];
    
    // 將八門填入對應宮位
    const result = new Array(9).fill('');
    for (let i = 0; i < doorPutSequence.length; i++) {
        result[doorPutSequence[i]] = doorOrder[i];
    }
    
    return result;
}

// ============================================================================
// 第四層：九星
// ============================================================================

function getOriginalStars() {
    return [...QIMEN_STARS];
}

function getZhiFuStar(fuShou, diPan) {
    const starIndex = diPan.indexOf(fuShou);
    return QIMEN_STARS[starIndex];
}

function getZhiFuPosition(tianGan, diPan) {
    const positionIndex = diPan.indexOf(tianGan);
    return LUOSHU_BAGUA[positionIndex];
}

function calculateNineStars(zhiFuStar, tianGan, diPan) {
    const targetIndex = diPan.indexOf(tianGan);
    const sourceIndex = QIMEN_STARS.indexOf(zhiFuStar);
    
    return rotateMapping(QIMEN_STARS, FLY_PATH.CLOCKWISE, sourceIndex, targetIndex);
}

function getTianQinDirection(nineStars) {
    const tianRuiIndex = nineStars.indexOf('天芮');
    return DIRECTION_ARROWS[tianRuiIndex];
}

// ============================================================================
// 第五層：八神
// ============================================================================

function calculateEightGods(isYang, tianGan, diPan) {
    // 確定時干在地盤上的位置作為值符神起點
    let headIndex = diPan.indexOf(tianGan);
    headIndex = normalizeZhongPalace(headIndex);
    
    // 選擇八神組合與飛布軌跡
    const gods = isYang ? EIGHT_GODS_YANG : EIGHT_GODS_YIN;
    const flyPath = isYang ? FLY_PATH.CLOCKWISE : FLY_PATH.COUNTER_CLOCKWISE;
    
    // 生成放置順序
    const putSequence = generatePutSequence(flyPath, headIndex);
    
    // 將八神填入對應宮位
    const result = new Array(9).fill('');
    for (let i = 0; i < putSequence.length; i++) {
        result[putSequence[i]] = gods[i];
    }
    
    return result;
}

// ============================================================================
// 輔助查詢函數
// ============================================================================

function getDirectionArrow(palaceIndex) {
    return DIRECTION_ARROWS[palaceIndex] || '';
}

function getZhiShiPosition(zhiShiDoor, eightDoors) {
    const doorIndex = eightDoors.indexOf(zhiShiDoor);
    return LUOSHU_BAGUA[doorIndex];
}

// ============================================================================
// 拆補法定局
// ============================================================================

/**
 * 简繁转换表（修复版）
 * 补全了 小满->小滿, 芒种->芒種
 */
const SIMPLIFIED_TO_TRADITIONAL = {
    '谷雨': '穀雨',
    '惊蛰': '驚蟄',
    '处暑': '處暑',
    '小满': '小滿', // 新增
    '芒种': '芒種'  // 新增
};

function s2t(str) {
    if (!str) return str;
    let result = str;
    for (const [simplified, traditional] of Object.entries(SIMPLIFIED_TO_TRADITIONAL)) {
        result = result.replace(new RegExp(simplified, 'g'), traditional);
    }
    return result;
}

/**
 * 拆補法定局
 */
function calculateJuByChaiBu(solar, jieQiJuShu, yuanNames) {
    const lunar = solar.getLunar();
    
    // 獲取當前所在節氣
    const currentJieQi = lunar.getPrevJieQi();
    const jieQiNameRaw = currentJieQi.getName();
    
    // 强制转换为繁体以匹配 constants
    const jieQiName = s2t(jieQiNameRaw);
    
    // 獲取節氣交接的精確時間（Solar 對象）
    const jieQiSolar = currentJieQi.getSolar();
    
    // 使用儒略日計算精確天數差
    const currentJD = solar.getJulianDay();
    const jieQiJD = jieQiSolar.getJulianDay();
    const daysDiff = currentJD - jieQiJD;
    
    // 判斷三元
    let yuan;
    if (daysDiff < 5) {
        yuan = 0; // 上元
    } else if (daysDiff < 10) {
        yuan = 1; // 中元
    } else {
        yuan = 2; // 下元
    }
    
    // 查表獲取局數配置
    const config = jieQiJuShu[jieQiName];
    if (!config) {
        // 如果转换后依然找不到，抛出更详细的错误以便调试
        throw new Error(`未知的節氣：${jieQiNameRaw} (轉換後: ${jieQiName})。請檢查 QimenConstants 是否包含此節氣的繁體名稱。`);
    }
    
    return {
        jieQiName,
        yuan,
        yuanName: yuanNames[yuan],
        isYang: config.yang,
        yinYang: config.yang ? '陽' : '陰',
        gameNumber: config.ju[yuan],
        daysSinceJieQi: Math.floor(daysDiff)
    };
}

// ============================================================================
// 模組導出
// ============================================================================
module.exports = {
    getHeTu,
    getLuoShu,
    calculateFlyingStars,
    getDiPan,
    calculateTianPan,
    getOriginalDoors,
    getZhiShiDoor,
    calculateEightDoors,
    getOriginalStars,
    getZhiFuStar,
    getZhiFuPosition,
    calculateNineStars,
    getTianQinDirection,
    calculateEightGods,
    getDirectionArrow,
    getZhiShiPosition,
    calculateJuByChaiBu
};
