'use strict';
/**
 * 辅证层：天乙贵人互见，以及只作展示的生肖、纳音（spec §5.6，理论文档 4.6）。
 */

const R = require('../constants/relations');
const { G_SHENS } = require('../constants/shensha');
const E = require('./elements');
const W = require('./weights');
const { makeEvidence } = require('./evidence');

const SHENGXIAO = { 子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇', 午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪' };

/** 某日干的天乙贵人地支（与页面 tianyiBranches 等价） */
function tianyiBranches(dayGan) {
  return String((G_SHENS.天乙 || {})[dayGan] || '').split('');
}

function zhiFolkRelation(a, b) {
  if (!a || !b) return null;
  if (a === b) return '相同';
  if (R.ZHI_ATTS[a] && R.ZHI_ATTS[a].六 === b) return '六合';
  if (R.ZHI_HALF_3HES[a + b] || R.ZHI_HALF_3HES[b + a]) return '三合';
  if (R.ZHI_CHONGS[a] === b) return '相冲';
  if (R.XINGS[a] === b || R.XINGS[b] === a) return '相刑';
  if (R.ZHI_HAIS[a] === b) return '相害';
  return null;
}

function nayinOf(V) {
  const pl = ((V.detail.matrix && V.detail.matrix.pillars) || []).find((p) => p.name === '年');
  return (pl && pl.nayin) || '';
}

function collectAux(A, B) {
  const out = [];

  // 天乙贵人互见：对方的日支是我的天乙贵人
  const tianyi = (Self, Other, dir) => {
    if (!tianyiBranches(Self.dayGan).includes(Other.dayZhi)) return;
    const selfIsA = dir === 'A<-B';
    out.push(makeEvidence({
      id: 'aux.tianyi', layer: 'aux', kind: 'tianyi', dir,
      locus: selfIsA ? { a: 'day.gan', b: 'day.zhi' } : { a: 'day.zhi', b: 'day.gan' },
      chars: selfIsA ? { a: Self.dayGan, b: Other.dayZhi } : { a: Other.dayZhi, b: Self.dayGan },
      tie: W.aux.tianyiTie,
      benefit: selfIsA ? { A: W.aux.tianyiBenefit, B: 0 } : { A: 0, B: W.aux.tianyiBenefit },
      basis: 'tradition_unverified', confidence: 'mid',
      seed: `${selfIsA ? '{B}' : '{A}'}的日支${Other.dayZhi}，是${selfIsA ? '{A}' : '{B}'}日干${Self.dayGan}的天乙贵人`,
    }));
  };
  tianyi(A, B, 'A<-B');
  tianyi(B, A, 'B<-A');

  // 生肖（民俗，只展示）
  const ya = A.pillars.find((p) => p.pos === 'year');
  const yb = B.pillars.find((p) => p.pos === 'year');
  if (ya && yb) {
    const rel = zhiFolkRelation(ya.zhi, yb.zhi);
    out.push(makeEvidence({
      id: 'aux.shengxiao', layer: 'aux', kind: 'shengxiao', dir: 'mutual',
      locus: { a: 'year.zhi', b: 'year.zhi' }, chars: { a: ya.zhi, b: yb.zhi },
      basis: 'folk', confidence: 'low',
      seed: rel
        ? `属相${SHENGXIAO[ya.zhi]}与${SHENGXIAO[yb.zhi]}，民间称${rel}`
        : `属相${SHENGXIAO[ya.zhi]}与${SHENGXIAO[yb.zhi]}，民间不作冲合论`,
    }));
  }

  // 年柱纳音（民俗，只展示）
  const na = nayinOf(A), nb = nayinOf(B);
  const wa = E.charWuxing(na.slice(-1)) || (['金', '木', '水', '火', '土'].includes(na.slice(-1)) ? na.slice(-1) : null);
  const wb = E.charWuxing(nb.slice(-1)) || (['金', '木', '水', '火', '土'].includes(nb.slice(-1)) ? nb.slice(-1) : null);
  if (wa && wb) {
    let rel = '比和';
    if (E.SHENG[wa] === wb) rel = `${wa}生${wb}`;
    else if (E.SHENG[wb] === wa) rel = `${wb}生${wa}`;
    else if (E.KE[wa] === wb) rel = `${wa}克${wb}`;
    else if (E.KE[wb] === wa) rel = `${wb}克${wa}`;
    out.push(makeEvidence({
      id: 'aux.nayin', layer: 'aux', kind: 'nayin', dir: 'mutual',
      locus: { a: 'year', b: 'year' }, chars: { a: na, b: nb },
      basis: 'folk', confidence: 'low',
      seed: `年柱纳音${na}与${nb}，${rel}`,
    }));
  }
  return out;
}

module.exports = { collectAux, tianyiBranches, SHENGXIAO };
