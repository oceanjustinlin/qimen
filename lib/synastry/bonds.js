'use strict';
/**
 * 第 2 层 勾连：两盘干支的合冲刑害（spec §5.3，理论文档 4.3）。
 * 不改动单盘的 baziRelationScanner，直接用 constants/relations.js 的关系表两两比对。
 *
 * seed 里的 {A}、{B} 是两个人名字的占位符，由展示层替换。
 */

const R = require('../constants/relations');
const E = require('./elements');
const W = require('./weights');
const { makeEvidence, clamp3 } = require('./evidence');

const POS_LABEL = { year: '年', month: '月', day: '日', time: '时' };
const POS_ORDER = ['day', 'month', 'year', 'time'];
const WX_EN = { 金: 'metal', 木: 'wood', 水: 'water', 火: 'fire', 土: 'earth' };

function pairKey(pa, pb) {
  if (pa === pb) return pa;
  const [x, y] = [pa, pb].sort((u, v) => POS_ORDER.indexOf(u) - POS_ORDER.indexOf(v));
  return `${x}_${y}`;
}

function where(pa, pb, part) {
  // 「日干」或「年干与月干」这样的位置描述
  const p = part === 'gan' ? '干' : '支';
  return pa === pb ? `${POS_LABEL[pa]}${p}` : null;
}

/** 作用于某个字时，对其主人的益损：作用于忌神为正，作用于喜用为负 */
function hitBenefit(need, ch, coef) {
  const n = need[E.charWuxing(ch)] || 0;
  return clamp3(-n * coef);
}

/** 合住某个字：合住忌神为正；合住喜用为轻微的负 */
function heBenefit(need, ch) {
  const n = need[E.charWuxing(ch)] || 0;
  return clamp3(n < 0 ? -n * W.bondBenefit.heOnJi : -n * W.bondBenefit.heOnFav);
}

function ganHeKey(a, b) { return R.GAN_HES[a + b] || R.GAN_HES[b + a] || null; }
function halfHe(a, b) { return R.ZHI_HALF_3HES[a + b] || R.ZHI_HALF_3HES[b + a] || null; }

/**
 * @param {object} A toView 的结果
 * @param {object} B toView 的结果
 * @param {'friend'|'romance'} relationType
 * @returns {object[]} evidence
 */
function scanBonds(A, B, relationType = 'friend') {
  const out = [];
  const push = (f) => out.push(makeEvidence({ layer: 'bond', basis: 'derived', dir: 'mutual', ...f }));
  const lowConf = (A.borderline || B.borderline || A.special || B.special) ? 'mid' : 'high';
  // 任一方时辰不详，两边都不用时柱（spec §7）
  const noHour = A.hourKnown === false || B.hourKnown === false;
  const pillarsOf = (V) => (noHour ? V.pillars.filter((p) => p.pos !== 'time') : V.pillars);
  const PA = pillarsOf(A);
  const PB = pillarsOf(B);

  for (const pa of PA) {
    for (const pb of PB) {
      const key = pairKey(pa.pos, pb.pos);
      const needsHour = pa.pos === 'time' || pb.pos === 'time';
      const base = (part) => ({
        locus: { a: `${pa.pos}.${part}`, b: `${pb.pos}.${part}` },
        needsHour,
        confidence: lowConf,
      });
      const lbl = (part) => {
        const same = where(pa.pos, pb.pos, part);
        const ca = part === 'gan' ? pa.gan : pa.zhi;
        const cb = part === 'gan' ? pb.gan : pb.zhi;
        return same
          ? `${same}${ca}${cb}`
          : `{A}${POS_LABEL[pa.pos]}${part === 'gan' ? '干' : '支'}${ca}与{B}${POS_LABEL[pb.pos]}${part === 'gan' ? '干' : '支'}${cb}`;
      };

      // ── 天干 ──
      const ga = pa.gan, gb = pb.gan;
      if (ga && gb) {
        const wa = E.ganWuxing(ga), wb = E.ganWuxing(gb);
        if (ganHeKey(ga, gb)) {
          push({ ...base('gan'), id: `bond.${key}_gan.ganhe`, kind: 'ganhe', chars: { a: ga, b: gb },
            tie: W.bond.ganHe.tie, strain: W.bond.ganHe.strain,
            benefit: { A: heBenefit(A.need, ga), B: heBenefit(B.need, gb) },
            basis: 'book', seed: `${lbl('gan')}相合` });
        } else if (ga === gb) {
          push({ ...base('gan'), id: `bond.${key}_gan.gan_same`, kind: 'gan_same', chars: { a: ga, b: gb },
            tie: W.bond.ganSame.tie, strain: W.bond.ganSame.strain,
            seed: pa.pos === pb.pos ? `${POS_LABEL[pa.pos]}干同为${ga}` : `${lbl('gan')}相同` });
        } else if (E.KE[wa] === wb || E.KE[wb] === wa) {
          const sameSex = E.isYangGan(ga) === E.isYangGan(gb);
          const q = sameSex ? W.bond.ganKeSame : W.bond.ganKeYinYang;
          const aKeB = E.KE[wa] === wb;
          push({ ...base('gan'), id: `bond.${key}_gan.${sameSex ? 'gan_ke' : 'gan_ke_yy'}`,
            kind: sameSex ? 'gan_ke' : 'gan_ke_yy', chars: { a: ga, b: gb },
            tie: q.tie, strain: q.strain,
            benefit: {
              A: aKeB ? 0 : hitBenefit(A.need, ga, W.bondBenefit.ke),
              B: aKeB ? hitBenefit(B.need, gb, W.bondBenefit.ke) : 0,
            },
            seed: `${lbl('gan')}，${aKeB ? `${ga}克${gb}` : `${gb}克${ga}`}${sameSex ? '' : '，阴阳相异'}` });
        }
      }

      // ── 地支 ──
      const za = pa.zhi, zb = pb.zhi;
      if (za && zb) {
        if (R.ZHI_ATTS[za] && R.ZHI_ATTS[za].六 === zb) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.liuhe`, kind: 'liuhe', chars: { a: za, b: zb },
            tie: W.bond.liuhe.tie, strain: W.bond.liuhe.strain,
            benefit: { A: heBenefit(A.need, za), B: heBenefit(B.need, zb) },
            basis: 'book', seed: `${lbl('zhi')}相合` });
        }
        if (halfHe(za, zb)) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.banhe`, kind: 'banhe', chars: { a: za, b: zb },
            tie: W.bond.banhe.tie, strain: W.bond.banhe.strain,
            benefit: { A: heBenefit(A.need, za), B: heBenefit(B.need, zb) },
            basis: 'book', seed: `${lbl('zhi')}半合${halfHe(za, zb)}` });
        }
        if (R.ZHI_CHONGS[za] === zb) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.chong`, kind: 'chong', chars: { a: za, b: zb },
            tie: W.bond.chong.tie, strain: W.bond.chong.strain,
            benefit: { A: hitBenefit(A.need, za, W.bondBenefit.chong), B: hitBenefit(B.need, zb, W.bondBenefit.chong) },
            basis: 'book', seed: `${lbl('zhi')}相冲` });
        }
        if (za !== zb && (R.XINGS[za] === zb || R.XINGS[zb] === za)) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.xing`, kind: 'xing', chars: { a: za, b: zb },
            tie: W.bond.xing.tie, strain: W.bond.xing.strain,
            benefit: { A: hitBenefit(A.need, za, W.bondBenefit.xing), B: hitBenefit(B.need, zb, W.bondBenefit.xing) },
            basis: 'book', seed: `${lbl('zhi')}相刑` });
        }
        if (R.ZHI_HAIS[za] === zb) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.hai`, kind: 'hai', chars: { a: za, b: zb },
            tie: W.bond.hai.tie, strain: W.bond.hai.strain,
            benefit: { A: hitBenefit(A.need, za, W.bondBenefit.hai), B: hitBenefit(B.need, zb, W.bondBenefit.hai) },
            basis: 'book', seed: `${lbl('zhi')}相害` });
        }
        if (za === zb) {
          push({ ...base('zhi'), id: `bond.${key}_zhi.zhi_same`, kind: 'zhi_same', chars: { a: za, b: zb },
            tie: W.bond.zhiSame.tie, strain: W.bond.zhiSame.strain,
            seed: pa.pos === pb.pos ? `${POS_LABEL[pa.pos]}支同为${za}` : `${lbl('zhi')}相同` });
          if (R.ZI_XINGS.includes(za)) {
            push({ ...base('zhi'), id: `bond.${key}_zhi.zixing`, kind: 'zixing', chars: { a: za, b: zb },
              tie: W.bond.zixing.tie, strain: W.bond.zixing.strain,
              benefit: { A: hitBenefit(A.need, za, W.bondBenefit.xing) * 0.5, B: hitBenefit(B.need, zb, W.bondBenefit.xing) * 0.5 },
              basis: 'book', seed: `${lbl('zhi')}，${za}${zb}自刑` });
          }
        }
      }

      // ── 日柱的额外证据 ──
      if (pa.pos === 'day' && pb.pos === 'day' && ga && gb && za && zb) {
        if (ganHeKey(ga, gb) && R.ZHI_ATTS[za] && R.ZHI_ATTS[za].六 === zb) {
          push({ ...base('pillar'), locus: { a: 'day', b: 'day' }, id: 'bond.day_pillar.double_he', kind: 'double_he',
            chars: { a: ga + za, b: gb + zb }, tie: W.bond.dayDoubleHe.tie, strain: W.bond.dayDoubleHe.strain,
            basis: 'derived', seed: `日柱天合地合：${ga}${gb}相合，${za}${zb}相合` });
        }
        const wa = E.ganWuxing(ga), wb = E.ganWuxing(gb);
        if ((E.KE[wa] === wb || E.KE[wb] === wa) && R.ZHI_CHONGS[za] === zb) {
          push({ ...base('pillar'), locus: { a: 'day', b: 'day' }, id: 'bond.day_pillar.clash', kind: 'day_clash',
            chars: { a: ga + za, b: gb + zb }, tie: W.bond.dayClash.tie, strain: W.bond.dayClash.strain,
            basis: 'derived', seed: `日柱天克地冲：${ga}${gb}相克，${za}${zb}相冲` });
        }
      }
    }
  }

  // ── 两盘补全三合、三会 ──
  const sets = [
    ...Object.entries(R.ZHI_3HES).map(([s, wx]) => ({ s, wx, kind: 'sanhe', name: '三合' })),
    ...Object.entries(R.ZHI_HUIS).map(([s, wx]) => ({ s, wx, kind: 'sanhui', name: '三会' })),
  ];
  const bestPos = (V, chars) => {
    const coef = W.position[relationType] || W.position.friend;
    const hits = pillarsOf(V).filter((p) => chars.includes(p.zhi));
    hits.sort((x, y) => coef[y.pos] - coef[x.pos]);
    return hits[0] || null;
  };
  for (const { s, wx, kind, name } of sets) {
    const chars = s.split('');
    const hasA = new Set(PA.map((p) => p.zhi).filter((z) => chars.includes(z)));
    const hasB = new Set(PB.map((p) => p.zhi).filter((z) => chars.includes(z)));
    const union = new Set([...hasA, ...hasB]);
    if (union.size === 3 && hasA.size < 3 && hasB.size < 3 && hasA.size > 0 && hasB.size > 0) {
      const pa = bestPos(A, chars), pb = bestPos(B, chars);
      push({
        id: `bond.complete.${kind}_${WX_EN[wx]}`, kind: `complete_${kind}`,
        locus: { a: `${pa.pos}.zhi`, b: `${pb.pos}.zhi` },
        chars: { a: [...hasA].join(''), b: [...hasB].join('') },
        tie: W.bond.complete.tie, strain: W.bond.complete.strain,
        benefit: {
          A: clamp3((A.need[wx] || 0) * W.bondBenefit.complete),
          B: clamp3((B.need[wx] || 0) * W.bondBenefit.complete),
        },
        needsHour: false,
        confidence: lowConf,
        basis: 'derived',
        seed: `{A}的${[...hasA].join('')}与{B}的${[...hasB].join('')}合成${s}${name}${wx}局`,
      });
    }
  }

  // ── 婚恋：冲配偶宫 ──
  if (relationType === 'romance') {
    const palace = (Self, Other, dir) => {
      for (const po of pillarsOf(Other)) {
        if (R.ZHI_CHONGS[Self.dayZhi] === po.zhi) {
          const selfIsA = dir === 'A<-B';
          push({
            id: 'bond.spouse_palace.clash', kind: 'spouse_palace_clash', dir,
            locus: selfIsA ? { a: 'day.zhi', b: `${po.pos}.zhi` } : { a: `${po.pos}.zhi`, b: 'day.zhi' },
            chars: selfIsA ? { a: Self.dayZhi, b: po.zhi } : { a: po.zhi, b: Self.dayZhi },
            tie: W.bond.spousePalaceClash.tie, strain: W.bond.spousePalaceClash.strain,
            needsHour: po.pos === 'time', confidence: lowConf, basis: 'derived',
            seed: `${selfIsA ? '{B}' : '{A}'}${POS_LABEL[po.pos]}支${po.zhi}冲${selfIsA ? '{A}' : '{B}'}日支${Self.dayZhi}（配偶宫）`,
          });
        }
      }
    };
    palace(A, B, 'A<-B');
    palace(B, A, 'B<-A');
  }

  return out;
}

module.exports = { scanBonds, POS_LABEL, pairKey };
