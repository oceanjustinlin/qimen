'use strict';

/**
 * baziCareerDirection.js — 事业方向决策过程（框架 §3，R1→R4）
 * ──────────────────────────────────────────────────────────────────────────────
 * 依据：docs/bazi-career-framework-final.md（19 例 gold case 收敛，0 反例）。
 *
 * 决策严格按优先级短路：
 *   R1   结构坍塌否决（强制凶）：扭曲提纲/日柱、连环刑冲、拔日主唯一禄根
 *   R1'  用神/枢纽被破否决（强制凶）：冲破用神/相神(枢纽)/印局核心
 *   R2   特殊格顺逆（从/专旺/润下/阳刃）：顺势吉、逆势/犯旺神凶
 *   R3   普通格事业星制化（引动事业星时）：有制吉、无制/攻身凶
 *   R3b  去病/顺逆（未直接引动事业星时）：去病顺势吉、助病逆势凶
 *   R4   喜忌兜底：只偏置信，不翻 R1/R1'
 *
 * 三条铁律：R1/R1' 压一切；事业星非中性（看制化）；特殊格方向反向。
 *
 * 本函数为纯决策，输入为「原局画像」与「岁运情形」（由 picture/transit 上游产出，
 * 例如 baziInducement 扫描 + baziYunxian.isTianKeDiChong + 现有 relationScanner）。
 * ──────────────────────────────────────────────────────────────────────────────
 */

const DIRECTION = { JI: '吉', XIONG: '凶', NEUTRAL: '中性' };

function result(direction, rule, reason, extra = {}) {
  return { direction, rule, reason, ...extra };
}

/**
 * @param {object} picture 原局画像
 *   - pattern_type: '普通' | '特殊'
 *   - special_kind?: '从杀'|'专旺'|'润下'|'化气'|'阳刃' 等
 *   - baseline_direction?: '吉'|'凶'|'中性'  原局结构基线（无岁运时用，如 R 金木间隔成器）
 * @param {object} transit 岁运情形（针对某一大运/流年节点）
 *   - none?: boolean                          无岁运（静态）→ 返回 baseline
 *   - structural_collapse?: boolean           R1
 *   - yongshen_broken?: boolean               R1'
 *   - special_flow?: 'follow'|'against'|null   R2（仅特殊格）
 *   - star_induced?: boolean                  R3：事业星是否被引动
 *   - star_controlled?: boolean               R3：引动时是否得制化
 *   - flow?: 'follow'|'against'|null           R3b：顺/逆原局之势
 *   - disease?: 'remove'|'help'|null           R3b：去病/助病
 *   - favorable?: 'xi'|'ji'|null               R4：引动喜/忌
 * @returns {{direction:string, rule:string, reason:string}}
 */
function decideDirection(picture = {}, transit = {}) {
  const P = picture || {};
  const T = transit || {};

  // 静态 / 无岁运：返回原局结构基线
  if (T.none || Object.keys(T).length === 0) {
    return result(P.baseline_direction || DIRECTION.NEUTRAL, 'baseline', '原局结构基线（无岁运引动）');
  }

  // R1 结构坍塌否决（最高，强制凶）
  if (T.structural_collapse) {
    return result(DIRECTION.XIONG, 'R1', '结构坍塌：扭曲提纲/日柱、连环刑冲或拔日主禄根');
  }

  // R1' 用神/枢纽被破否决（强制凶）
  if (T.yongshen_broken) {
    return result(DIRECTION.XIONG, 'R1prime', '用神/相神(枢纽)/印局核心被冲破');
  }

  // R2 特殊格顺逆（方向反向）
  if (P.pattern_type === '特殊') {
    if (T.special_flow === 'against') {
      return result(DIRECTION.XIONG, 'R2', `特殊格(${P.special_kind || '从/专旺'})逆势·犯旺神`);
    }
    if (T.special_flow === 'follow') {
      return result(DIRECTION.JI, 'R2', `特殊格(${P.special_kind || '从/专旺'})顺势`);
    }
    // 特殊格但岁运未明顺逆 → 落 R3b/R4
  }

  // R3 普通格·事业星制化
  if (T.star_induced) {
    if (T.star_controlled) {
      return result(DIRECTION.JI, 'R3', '事业星被引动且得制化（七杀有印/食/刃；伤官有印/财）');
    }
    return result(DIRECTION.XIONG, 'R3', '事业星被引动但无制/见官/攻身');
  }

  // R3b 去病 / 顺逆（未直接引动事业星）
  if (T.disease === 'remove' || T.flow === 'follow') {
    return result(DIRECTION.JI, 'R3b', '去原局之病 / 顺原局之势');
  }
  if (T.disease === 'help' || T.flow === 'against') {
    return result(DIRECTION.XIONG, 'R3b', '助病 / 逆原局之势');
  }

  // R4 喜忌兜底（只偏置信，不翻方向）
  if (T.favorable === 'xi') {
    return result(DIRECTION.NEUTRAL, 'R4', '引动喜用，偏吉（仅调置信）', { lean: '吉' });
  }
  if (T.favorable === 'ji') {
    return result(DIRECTION.NEUTRAL, 'R4', '引动忌神，偏凶（仅调置信）', { lean: '凶' });
  }

  return result(DIRECTION.NEUTRAL, 'none', '无明显引动');
}

module.exports = { DIRECTION, decideDirection };
