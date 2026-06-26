'use strict';

/**
 * baziYunxian.js — 四柱运限并轨（缺失项 G1）
 * ──────────────────────────────────────────────────────────────────────────────
 * 理论依据：陆致极《八字命理动态分析教程》第三章
 *   八字自带时间轴：把四柱按年龄段并轨为「运限」，让大运按时序走入原局。
 *     年柱 1–16、月柱 17–32、日柱 33–48、时柱 49–64，65+ 为时柱延伸（权重衰减）。
 *   事业意义（见 docs/bazi-career-framework-final.md §1、§4）：
 *     月柱既是事业宫又对应 17–32 岁立业窗口；约第六步大运（50–60 岁）大运干支
 *     必与月柱「天克地冲」（冲提运），解释中年事业滑坡 / 退居二线 / 落马关口。
 *
 * 本模块为纯函数，无副作用：
 *   - getYunxian(age)                  年龄 → 运限柱
 *   - isTianKeDiChong(gz1, gz2)        天克地冲（干差6 且 支差6）= 反吟，R1 结构坍塌的基础件
 *   - isChongTiYun(monthGz, dayunGz)   大运是否冲提纲（= 大运 天克地冲 月柱）
 *   - annotateYunxian({ age, monthGz, dayunGz })  组合输出，供动态链路引用
 *
 * 约定：age 为 1 起算的生命年序（虚岁口径）；干支字符串如 '甲子'。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 运限阶段表。每柱 16 年。
 * topic_career 专写事业语义，供事业线领域落点引用。
 */
const YUNXIAN_STAGES = [
  { pillar: '年', start_age: 1, end_age: 16, stage_index: 0, topic: '童年 / 家庭根基', topic_career: '少年环境、家世起点' },
  { pillar: '月', start_age: 17, end_age: 32, stage_index: 1, topic: '青年 / 门户立业', topic_career: '事业宫·立业窗口（事业起点社会层级）' },
  { pillar: '日', start_age: 33, end_age: 48, stage_index: 2, topic: '中年 / 自身婚姻', topic_career: '事业主轴·权责承载' },
  { pillar: '时', start_age: 49, end_age: 64, stage_index: 3, topic: '晚景 / 子女归宿', topic_career: '事业收成、退居或滑坡' },
];

const EXTENDED_START_AGE = 65;

/**
 * 年龄 → 四柱运限。
 * @param {number} age 1 起算的生命年序
 * @returns {{pillar:'年'|'月'|'日'|'时', stage_index:number, age_range:string,
 *            weight_status:'primary'|'extended', topic:string, topic_career:string,
 *            is_career_window:boolean}}
 */
function getYunxian(age) {
  if (typeof age !== 'number' || !Number.isFinite(age)) {
    throw new TypeError(`getYunxian: age 必须为有限数字，收到 ${age}`);
  }
  const a = Math.max(1, Math.floor(age));

  if (a >= EXTENDED_START_AGE) {
    // 65+ 时柱延伸：显式声明规则，不默认时柱无限延长而不标注（PRD §16）
    return {
      pillar: '时',
      stage_index: 3,
      age_range: `${EXTENDED_START_AGE}+`,
      weight_status: 'extended',
      topic: YUNXIAN_STAGES[3].topic,
      topic_career: '时柱延伸（权重衰减）',
      is_career_window: false,
    };
  }

  const stage = YUNXIAN_STAGES.find((s) => a >= s.start_age && a <= s.end_age) || YUNXIAN_STAGES[0];
  return {
    pillar: stage.pillar,
    stage_index: stage.stage_index,
    age_range: `${stage.start_age}-${stage.end_age}`,
    weight_status: 'primary',
    topic: stage.topic,
    topic_career: stage.topic_career,
    is_career_window: stage.pillar === '月', // 月柱=事业宫
  };
}

/** 拆分干支字符串为 { stem, branch, stemIndex, branchIndex }，非法返回 null。 */
function parseGanzhi(gz) {
  if (typeof gz !== 'string' || gz.length < 2) return null;
  const stem = gz[0];
  const branch = gz[1];
  const stemIndex = TIANGAN.indexOf(stem);
  const branchIndex = DIZHI.indexOf(branch);
  if (stemIndex < 0 || branchIndex < 0) return null;
  return { stem, branch, stemIndex, branchIndex };
}

/**
 * 天克地冲（反吟）：天干相差 6（即互为七杀且对位，如 甲↔庚）且地支相差 6（六冲）。
 * 这是框架 R1「一级干支扭曲」的判定基础。
 */
function isTianKeDiChong(gz1, gz2) {
  const a = parseGanzhi(gz1);
  const b = parseGanzhi(gz2);
  if (!a || !b) return false;
  const ganClash = (a.stemIndex - b.stemIndex + 10) % 10 === 6 || (b.stemIndex - a.stemIndex + 10) % 10 === 6;
  const zhiClash = (a.branchIndex - b.branchIndex + 12) % 12 === 6;
  return ganClash && zhiClash;
}

/**
 * 冲提运：大运与月柱（提纲）天克地冲。
 * @param {string} monthGz 月柱干支
 * @param {string} dayunGz 大运干支
 */
function isChongTiYun(monthGz, dayunGz) {
  return isTianKeDiChong(monthGz, dayunGz);
}

/**
 * 组合标注：给定年龄、月柱、当前大运，输出运限 + 是否冲提。
 * 冲提运且落在月柱/日柱运限段时，标为事业结构性风险点（供 R1 否决参考）。
 */
function annotateYunxian({ age, monthGz, dayunGz } = {}) {
  const yunxian = getYunxian(age);
  const chongTi = monthGz && dayunGz ? isChongTiYun(monthGz, dayunGz) : false;
  return {
    ...yunxian,
    chong_ti_yun: chongTi,
    // 冲提运摧毁青年期建立的社会门户 → 事业结构性风险标记
    career_structural_risk: chongTi,
    note: chongTi ? '冲提运：大运天克地冲月柱（提纲），事业门户受冲，结构性风险' : null,
  };
}

module.exports = {
  TIANGAN,
  DIZHI,
  YUNXIAN_STAGES,
  getYunxian,
  parseGanzhi,
  isTianKeDiChong,
  isChongTiYun,
  annotateYunxian,
};
