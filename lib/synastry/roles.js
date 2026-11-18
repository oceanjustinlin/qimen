'use strict';
/**
 * 第 3 层 角色：日干原型与星宫互见（spec §5.4，理论文档 4.4）。
 * 益损不在这一层给，由互济层的日主入用决定。
 */

const R = require('../constants/relations');
const E = require('./elements');
const W = require('./weights');
const { makeEvidence } = require('./evidence');

// B 的日干对 A 而言的十神 → 原型
const ARCHETYPE = {
  比肩: 'tongdao', 劫财: 'jinghe',
  食神: 'gongyang', 偏印: 'gongyang',
  伤官: 'qifa', 正印: 'qifa',
  偏财: 'jiayu', 七杀: 'jiayu',
  正财: 'xianghe', 正官: 'xianghe',
};
const ARCHETYPE_LABEL = {
  tongdao: '同道', jinghe: '竞合', gongyang: '供养与受养', qifa: '启发与庇护', jiayu: '驾驭与受制', xianghe: '相合',
};

function archetypeOf(dayGanA, dayGanB) {
  const tg = E.tenGod(dayGanA, dayGanB);
  return tg ? ARCHETYPE[tg] : null;
}

function archetypeSeed(A, B, kind) {
  const wa = A.dayWx, wb = B.dayWx;
  const base = `日干${A.dayGan}${B.dayGan}`;
  switch (kind) {
    case 'tongdao': return `${base}，同为${wa}，阴阳相同`;
    case 'jinghe': return `${base}，同为${wa}，一阴一阳`;
    case 'gongyang':
    case 'qifa': {
      const aGivesB = E.SHENG[wa] === wb;
      return `${base}，${aGivesB ? `{A}的${A.dayGan}${wa}生{B}的${B.dayGan}${wb}` : `{B}的${B.dayGan}${wb}生{A}的${A.dayGan}${wa}`}`;
    }
    case 'jiayu': {
      const aKeB = E.KE[wa] === wb;
      return `${base}，${aKeB ? `{A}的${A.dayGan}${wa}克{B}的${B.dayGan}${wb}` : `{B}的${B.dayGan}${wb}克{A}的${A.dayGan}${wa}`}，阴阳相同`;
    }
    case 'xianghe': return `${base}相合`;
    default: return base;
  }
}

/** 本人的配偶星类别：男看财，女看官杀 */
function spouseClass(gender) {
  if (gender === 'M') return { cls: '财', shens: ['正财', '偏财'], name: '妻星' };
  if (gender === 'F') return { cls: '官杀', shens: ['正官', '七杀'], name: '夫星' };
  return null;
}

function favWord(need) {
  if (need >= W.needTier.yong) return '用神';
  if (need >= W.needTier.xi) return '喜神';
  if (need <= W.needTier.ji) return '忌神';
  if (need <= W.needTier.chou) return '仇神';
  return '闲神';
}

function hiddenOfDay(V) {
  const pl = ((V.detail.matrix && V.detail.matrix.pillars) || []).find((p) => p.name === '日');
  return ((pl && pl.hidden_stems) || []).map((h) => (typeof h === 'string' ? h : h.gan));
}

/** 婚恋：Self 受 Other 的星见、星透、宫合 */
function spouseEvidence(Self, Other, dir) {
  const out = [];
  const selfIsA = dir === 'A<-B';
  const S_ = selfIsA ? '{A}' : '{B}';
  const O_ = selfIsA ? '{B}' : '{A}';
  const loc = (selfPos, otherPos) => (selfIsA ? { a: selfPos, b: otherPos } : { a: otherPos, b: selfPos });
  const chr = (selfCh, otherCh) => (selfIsA ? { a: selfCh, b: otherCh } : { a: otherCh, b: selfCh });
  const sc = spouseClass(Self.gender);

  if (sc) {
    // 星见：对方日主五行正是我的配偶星五行
    if (E.relationClass(Self.dayWx, Other.dayWx) === sc.cls) {
      const n = Self.need[Other.dayWx] || 0;
      out.push(makeEvidence({
        id: 'role.spouse_star_seen', layer: 'role', kind: 'spouse_star_seen', dir,
        locus: loc(undefined, 'day.gan'), chars: chr(undefined, Other.dayGan),
        tie: W.role.starSeen, basis: 'derived', confidence: 'high',
        seed: `${O_}的日主${Other.dayGan}${Other.dayWx}，是${S_}命里的${sc.name}，对${S_}为${favWord(n)}`,
      }));
    }
    // 星透：对方日干正是我盘中透出的配偶星本字
    const tg = E.tenGod(Self.dayGan, Other.dayGan);
    if (sc.shens.includes(tg)) {
      const shown = Self.pillars.find((p) => p.pos !== 'day' && p.gan === Other.dayGan);
      if (shown) {
        out.push(makeEvidence({
          id: 'role.spouse_star_shown', layer: 'role', kind: 'spouse_star_shown', dir,
          locus: loc(`${shown.pos}.gan`, 'day.gan'), chars: chr(shown.gan, Other.dayGan),
          tie: W.role.starShown, basis: 'tradition_unverified', confidence: 'mid',
          needsHour: shown.pos === 'time',
          seed: `${S_}的${({ year: '年', month: '月', time: '时' })[shown.pos]}干透出${tg}${shown.gan}，正是${O_}的日干`,
        }));
      }
    }
  }

  // 宫合：对方日支与我的日支六合、半合，或我的日支藏干里有对方的日干（不分性别）
  const za = Self.dayZhi, zb = Other.dayZhi;
  const liuhe = R.ZHI_ATTS[za] && R.ZHI_ATTS[za].六 === zb;
  const half = R.ZHI_HALF_3HES[za + zb] || R.ZHI_HALF_3HES[zb + za];
  const hidden = hiddenOfDay(Self).includes(Other.dayGan);
  if (liuhe || half || hidden) {
    const how = liuhe ? `日支${za}${zb}六合` : half ? `日支${za}${zb}半合` : `${S_}日支${za}藏${Other.dayGan}，正是${O_}的日干`;
    out.push(makeEvidence({
      id: 'role.spouse_palace_he', layer: 'role', kind: 'spouse_palace_he', dir,
      locus: hidden && !liuhe && !half ? loc('day.zhi', 'day.gan') : loc('day.zhi', 'day.zhi'),
      chars: hidden && !liuhe && !half ? chr(za, Other.dayGan) : chr(za, zb),
      tie: W.role.palaceHe, basis: 'tradition_unverified', confidence: 'mid',
      seed: `配偶宫相合：${how}`,
    }));
  }
  return out;
}

const FRIEND_STAR = { 比劫: ['friend_peer', '同道'], 食伤: ['friend_play', '玩伴'], 印: ['friend_care', '照应'] };

/**
 * @returns {object[]} evidence
 */
function mapRoles(A, B, relationType = 'friend') {
  const out = [];
  const kind = archetypeOf(A.dayGan, B.dayGan);
  if (kind) {
    out.push(makeEvidence({
      id: 'role.archetype', layer: 'role', kind, dir: 'mutual',
      locus: { a: 'day.gan', b: 'day.gan' }, chars: { a: A.dayGan, b: B.dayGan },
      tie: W.role.archetypeTie[kind], basis: kind === 'xianghe' ? 'book' : 'derived',
      confidence: 'high',
      seed: `${archetypeSeed(A, B, kind)}，相处的原型是「${ARCHETYPE_LABEL[kind]}」`,
    }));
  }

  if (relationType === 'romance') {
    out.push(...spouseEvidence(A, B, 'A<-B'));
    out.push(...spouseEvidence(B, A, 'B<-A'));
  } else {
    const friend = (Self, Other, dir) => {
      const cls = E.relationClass(Self.dayWx, Other.dayWx);
      const hit = FRIEND_STAR[cls];
      if (!hit) return;
      const selfIsA = dir === 'A<-B';
      out.push(makeEvidence({
        id: 'role.friend_star', layer: 'role', kind: hit[0], dir,
        locus: selfIsA ? { b: 'day.gan' } : { a: 'day.gan' },
        chars: selfIsA ? { b: Other.dayGan } : { a: Other.dayGan },
        tie: W.role.friendStar, basis: 'derived', confidence: 'high',
        seed: `${selfIsA ? '{B}' : '{A}'}的日主${Other.dayGan}，对${selfIsA ? '{A}' : '{B}'}是${cls}，取象为${hit[1]}`,
      }));
    };
    friend(A, B, 'A<-B');
    friend(B, A, 'B<-A');
  }
  return out;
}

/** 婚恋类型下因性别缺失而跳过的说明 */
function roleCaveats(A, B, relationType) {
  if (relationType !== 'romance') return [];
  const missing = [];
  if (!A.gender) missing.push('{A}');
  if (!B.gender) missing.push('{B}');
  return missing.length ? [`${missing.join('、')}未填性别，配偶星一项未评估，只看日支宫位与日干原型`] : [];
}

module.exports = { mapRoles, archetypeOf, roleCaveats, ARCHETYPE_LABEL, spouseClass };
