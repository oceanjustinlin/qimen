// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-gray; icon-glyph: magic;
// 文件名: QimenUtils
/**
 * 奇門遁甲通用工具函數模組
 */

// ============================================================================
// 1. 引入依賴 (從 constants 模組)
// ============================================================================
const {
    PALACE,
    ZHONG_SUBSTITUTE,
    SIX_XUNS,
    XUN_HEADS,
    XUN_TO_HEAD,
    XUN_TO_KONGWANG_DIRECTION
} = importModule('QimenConstants');

// ============================================================================
// 陣列旋轉工具
// ============================================================================

/**
 * 從指定起點旋轉陣列
 */
function rotateArrayFromIndex(array, startIndex) {
    if (!Array.isArray(array) || array.length === 0) {
        return [];
    }
    
    const normalizedIndex = startIndex % array.length;
    return [
        ...array.slice(normalizedIndex),
        ...array.slice(0, normalizedIndex)
    ];
}

/**
 * 根據飛布軌跡生成放置順序
 */
function generatePutSequence(flyPath, startPalaceIndex) {
    const pathIndex = flyPath.indexOf(startPalaceIndex);
    if (pathIndex === -1) {
        // 若起始宮位不在軌跡中（如中宮），使用替代宮位
        const substituteIndex = flyPath.indexOf(ZHONG_SUBSTITUTE);
        return rotateArrayFromIndex(flyPath, substituteIndex);
    }
    return rotateArrayFromIndex(flyPath, pathIndex);
}

/**
 * 根據飛布軌跡進行旋轉映射 (核心算法)
 */
function rotateMapping(sourceArray, flyPath, sourceStartIndex, targetStartIndex) {
    // 處理中宮替代
    const normalizedSourceStart = sourceStartIndex === PALACE.ZHONG 
        ? ZHONG_SUBSTITUTE 
        : sourceStartIndex;
    const normalizedTargetStart = targetStartIndex === PALACE.ZHONG 
        ? ZHONG_SUBSTITUTE 
        : targetStartIndex;
    
    // 生成取值與放置順序
    const getSequence = generatePutSequence(flyPath, normalizedSourceStart);
    const putSequence = generatePutSequence(flyPath, normalizedTargetStart);
    
    // 執行映射
    const result = new Array(9).fill('');
    for (let i = 0; i < getSequence.length; i++) {
        const sourceIndex = getSequence[i];
        const targetIndex = putSequence[i];
        result[targetIndex] = sourceArray[sourceIndex];
    }
    
    // 中宮保持原值
    result[PALACE.ZHONG] = sourceArray[PALACE.ZHONG];
    
    return result;
}

// ============================================================================
// 索引轉換工具
// ============================================================================

function normalizeZhongPalace(index) {
    return index === PALACE.ZHONG ? ZHONG_SUBSTITUTE : index;
}

function findIndexWithZhongNormalization(array, element) {
    const index = array.indexOf(element);
    return normalizeZhongPalace(index);
}

// ============================================================================
// 旬首與符首查詢
// ============================================================================

/**
 * 根據干支時辰查詢所屬旬首
 */
function getXunHead(ganzhi) {
    for (const xunHead of XUN_HEADS) {
        if (SIX_XUNS[xunHead].includes(ganzhi)) {
            return xunHead;
        }
    }
    return null;
}

/**
 * 根據旬首查詢符首
 */
function getFuShou(xunHead) {
    return XUN_TO_HEAD[xunHead];
}

/**
 * 計算飛布步數
 */
function calculateFlyStep(xunHead, currentTime) {
    const xunArray = SIX_XUNS[xunHead];
    if (!xunArray) {
        return 0;
    }
    return xunArray.indexOf(currentTime);
}

/**
 * 查詢孤虛方位
 */
function getKongWangDirection(ganzhi) {
    const xunHead = getXunHead(ganzhi);
    return xunHead ? XUN_TO_KONGWANG_DIRECTION[xunHead] : undefined;
}

// ============================================================================
// 天干處理工具
// ============================================================================

function resolveJiaHiding(tianGan, fuShou) {
    return tianGan === '甲' ? fuShou : tianGan;
}

function extractTianGan(ganzhi) {
    return ganzhi.substring(0, 1);
}

function extractDiZhi(ganzhi) {
    return ganzhi.substring(1, 2);
}

// ============================================================================
// 模組導出
// ============================================================================
module.exports = {
    rotateArrayFromIndex,
    generatePutSequence,
    rotateMapping,
    normalizeZhongPalace,
    findIndexWithZhongNormalization,
    getXunHead,
    getFuShou,
    calculateFlyStep,
    getKongWangDirection,
    resolveJiaHiding,
    extractTianGan,
    extractDiZhi
};
