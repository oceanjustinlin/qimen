'use strict';
/**
 * 第 1 层 互济：气的补益与损耗（spec §5.2，理论文档 4.2）。
 * 核心命题「对方如运」：B 的盘对 A 而言像一步运，按 A 的喜忌论益损。
 */

const E = require('./elements');
const W = require('./weights');
const { makeEvidence, clamp3 } = require('./evidence');

const C = W.complement;

/** 需求强度：中和 0.6，极强极弱 1.0 */
function demandIntensity(score) {
  const dev = Math.min(1, Math.abs((Number(score) || 5) - 5) / 5);
  return C.demandNeutral + (C.demandExtreme - C.demandNeutral) * dev;
}

/** 供给向量：对方的五行占比，日主五行另加 0.15 */
function supplyVector(S) {
  const v = { ...S.ratio };
  if (S.dayWx) v[S.dayWx] = (v[S.dayWx] || 0) + C.dayMasterBonus;
  return v;
}

/** 受方的置信度与量值系数 */
function receiverQuality(R) {
  let confidence = 'high';
  let factor = 1;
  if (!R.hourKnown) confidence = 'mid';
  if (!R.hourKnown && !R.stable) { confidence = 'low'; factor = C.unstableFactor; }
  if (R.borderline || R.special) confidence = 'low';
  return { confidence, factor };
}

function topBy(obj, keys) {
  return keys.reduce((best, k) => ((obj[k] || 0) > (obj[best] || 0) ? k : best), keys[0]);
}

const pct = (x) => `${Math.round(x * 100)}%`;

/** S 盘中五行属于 wxList 的字（天干与地支），供页面高亮 */
function charsOfWx(S, wxList) {
  const set = new Set(wxList);
  return S.pillars
    .flatMap((p) => [p.gan, p.zhi])
    .filter((c) => c && set.has(E.charWuxing(c)))
    .join('');
}

/**
 * 一个方向：R 受 S。dir 为证据方向，side 为 R 在证据里的 A/B。
 */
function oneDirection(R, S, dir, side) {
  const out = [];
  const { confidence, factor } = receiverQuality(R);
  const sideOf = (v) => (side === 'A' ? { A: clamp3(v * factor), B: 0 } : { A: 0, B: clamp3(v * factor) });
  const R_ = side === 'A' ? '{A}' : '{B}';
  const S_ = side === 'A' ? '{B}' : '{A}';
  const push = (f) => out.push(makeEvidence({ layer: 'complement', dir, confidence, needsHour: false, ...f }));
  // 供方整盘里相关的字：locus 记 chart，chars 记具体的字
  const onSupplier = (wxList) => {
    const chars = charsOfWx(S, wxList);
    return side === 'A'
      ? { locus: { b: 'chart' }, chars: { b: chars } }
      : { locus: { a: 'chart' }, chars: { a: chars } };
  };

  // 1. 喜用互济
  const supply = supplyVector(S);
  const inner = E.WUXING.reduce((sum, wx) => sum + (R.need[wx] || 0) * (supply[wx] || 0), 0);
  const intensity = demandIntensity(R.strengthScore);
  const amount = inner * intensity * C.needSupplyScale;
  const favs = E.WUXING.filter((wx) => R.need[wx] > 0);
  const strongest = topBy(S.ratio, E.WUXING);
  const unfavs = E.WUXING.filter((wx) => R.need[wx] < 0);
  push({
    id: 'complement.need_supply', kind: 'need_supply',
    benefit: sideOf(amount),
    ...onSupplier(amount >= 0 ? favs : unfavs),
    basis: 'derived',
    seed: `${R_}喜${favs.join('、') || '（不明）'}；${S_}的盘里${strongest}最旺，约${pct(S.ratio[strongest] || 0)}`,
  });

  // 2. 日主入用
  const dmNeed = R.need[S.dayWx] || 0;
  if (dmNeed >= W.needTier.xi) {
    const isYong = dmNeed >= W.needTier.yong;
    push({
      id: 'complement.daymaster_as_yong', kind: 'daymaster_as_yong',
      locus: side === 'A' ? { b: 'day.gan' } : { a: 'day.gan' },
      chars: side === 'A' ? { b: S.dayGan } : { a: S.dayGan },
      benefit: sideOf(isYong ? C.daymasterYong : C.daymasterXi),
      basis: 'derived',
      seed: `${S_}的日主${S.dayGan}${S.dayWx}，是${R_}的${isYong ? '用神' : '喜神'}`,
    });
  }

  // 3. 调候互济
  const gods = (R.detail.tiaohou_detail && R.detail.tiaohou_detail.primary_gods) || [];
  const seenGan = new Set();
  for (const god of gods) {
    const gan = god && god.gan;
    if (!gan || seenGan.has(gan)) continue;
    const hit = S.pillars.filter((p) => p.gan === gan);
    if (!hit.length) continue;
    seenGan.add(gan);
    const prime = hit.some((p) => p.pos === 'month' || p.pos === 'day');
    const pos = (hit.find((p) => p.pos === 'day') || hit.find((p) => p.pos === 'month') || hit[0]).pos;
    push({
      id: 'complement.tiaohou', kind: 'tiaohou',
      locus: side === 'A' ? { b: `${pos}.gan` } : { a: `${pos}.gan` },
      chars: side === 'A' ? { b: gan } : { a: gan },
      benefit: sideOf(prime ? C.tiaohouPrime : C.tiaohou),
      needsHour: pos === 'time',
      basis: 'derived',
      seed: `${R_}调候需${gan}${E.ganWuxing(gan)}，${S_}的${({ year: '年', month: '月', day: '日', time: '时' })[pos]}干正是${gan}`,
    });
  }

  // 4. 得药或增病（至多一条）
  const jis = E.WUXING.filter((wx) => R.need[wx] < 0);
  if (jis.length) {
    const disease = topBy(R.ratio, jis);
    const remedyShare = (S.ratio[E.KE_BY[disease]] || 0) + (S.ratio[E.SHENG[disease]] || 0);
    const diseaseShare = S.ratio[disease] || 0;
    if (remedyShare >= C.remedyThreshold && remedyShare > diseaseShare) {
      push({
        id: 'complement.remedy', kind: 'remedy',
        benefit: sideOf(C.remedy),
        ...onSupplier([E.KE_BY[disease], E.SHENG[disease]]),
        basis: 'derived',
        seed: `${R_}的病在${disease}偏多；${S_}的盘里克它泄它的${E.KE_BY[disease]}、${E.SHENG[disease]}约占${pct(remedyShare)}`,
      });
    } else if (diseaseShare >= C.aggravateThreshold) {
      push({
        id: 'complement.aggravate', kind: 'aggravate',
        benefit: sideOf(C.aggravate),
        ...onSupplier([disease]),
        basis: 'derived',
        seed: `${R_}的病在${disease}偏多；${S_}的盘里${disease}又占${pct(diseaseShare)}`,
      });
    }
  }

  // 5. 伤用
  const yongWx = E.yongWuxing(R.detail);
  if (yongWx && E.KE[strongest] === yongWx && (R.ratio[yongWx] || 0) < C.harmYongThreshold) {
    push({
      id: 'complement.harm_yong', kind: 'harm_yong',
      benefit: sideOf(C.harmYong),
      ...onSupplier([strongest]),
      basis: 'derived',
      seed: `${R_}的用神${yongWx}本就不足；${S_}最旺的${strongest}正克${yongWx}`,
    });
  }

  // 6. 钱财流向（只作展示，量值为 0；朋友合盘的钱财维度另由 friendDims 计算）
  const caiWx = E.KE[R.dayWx];
  const feedWx = [E.KE[R.dayWx], E.SHENG[R.dayWx]];
  const feed = (S.ratio[caiWx] || 0) + (S.ratio[E.SHENG[R.dayWx]] || 0);
  const rob = S.ratio[R.dayWx] || 0;
  const caiNeed = R.need[caiWx] || 0;
  const caiWord = caiNeed > 0 ? '喜' : caiNeed < 0 ? '忌' : '不忌不喜';
  push({
    id: 'complement.wealth_flow', kind: 'wealth_flow',
    ...onSupplier(feed >= rob ? feedWx : [R.dayWx]),
    basis: 'derived',
    seed: `${R_}的财是${caiWx}，${R_}${caiWord}财；${S_}的盘里，助财的${feedWx.join('、')}约占${pct(feed)}，分财的${R.dayWx}约占${pct(rob)}`,
  });

  return out;
}

/**
 * @returns {object[]} evidence，两个方向
 */
function assessComplement(A, B /* , relationType */) {
  return [
    ...oneDirection(A, B, 'A<-B', 'A'),
    ...oneDirection(B, A, 'B<-A', 'B'),
  ];
}

module.exports = { assessComplement, demandIntensity, supplyVector };
