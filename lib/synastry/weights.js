'use strict';
/**
 * 合盘引擎的全部数值。规则依据见 docs/compatibility-theory.md，
 * 取值说明见 docs/compatibility-redesign-spec.md §5、§6。
 * 其他文件不写魔法数字；改这里之后重跑 scripts/synastry_calibrate.cjs。
 */

module.exports = {
  engineVersion: 'synastry/1',

  // §5.2 需求向量
  needTier: { yong: 1.5, xi: 1.0, xian: 0, chou: -1.0, ji: -1.3 },

  // 依据等级的系数（§4.1）
  basisCoef: { book: 1, derived: 1, tradition_unverified: 0.5, folk: 0 },

  // §5.3 位置系数（两端相乘后开方）
  position: {
    romance: { day: 1.5, month: 1.2, time: 0.9, year: 0.6 },
    friend: { day: 1.2, month: 1.5, time: 0.7, year: 0.6 },
  },

  // §5.3 勾连的基础量
  bond: {
    ganHe: { tie: 2, strain: 0 },
    ganKeYinYang: { tie: 0.5, strain: 0.5 },   // 异性相克
    ganKeSame: { tie: 0, strain: 1.5 },        // 同性相克
    ganSame: { tie: 1, strain: 0 },
    liuhe: { tie: 2, strain: 0 },
    banhe: { tie: 1.2, strain: 0 },            // 半三合、拱合
    complete: { tie: 2.5, strain: 0 },         // 两盘补全三合、三会
    chong: { tie: 0.5, strain: 2.5 },
    xing: { tie: 0, strain: 1.5 },
    hai: { tie: 0, strain: 1.2 },
    zhiSame: { tie: 1, strain: 0 },
    zixing: { tie: 0, strain: 0.8 },
    dayDoubleHe: { tie: 1.5, strain: 0 },
    dayClash: { tie: 0, strain: 1.5 },
    spousePalaceClash: { tie: 0, strain: 1.0 },
  },

  // §5.3 顺逆：benefit = −need × 系数（作用于忌神为正，作用于喜用为负）
  bondBenefit: {
    chong: 1.0,
    ke: 0.8,          // 只作用于被克的一方
    xing: 0.6,
    hai: 0.5,
    heOnJi: 0.6,      // 合住忌神
    heOnFav: 0.2,     // 合住喜用（轻微的负）
    complete: 1.0,    // 成局五行 × 需求
  },

  // §5.2 互济
  complement: {
    dayMasterBonus: 0.15,          // 日主五行在占比之外另加
    demandNeutral: 0.6,            // 中和命局的需求强度
    demandExtreme: 1.0,            // 极强极弱的需求强度
    needSupplyScale: 2.0,          // 内积 × 需求强度 × 本系数 = benefit
    daymasterYong: 1.0,
    daymasterXi: 0.6,
    tiaohou: 0.8,
    tiaohouPrime: 1.2,             // 出现在月干或日干
    remedyThreshold: 0.25,
    remedy: 1.0,
    aggravateThreshold: 0.30,
    aggravate: -1.0,
    harmYongThreshold: 0.12,
    harmYong: -1.2,
    unstableFactor: 0.5,           // 时辰不详且结论不稳时量值减半
  },

  // §5.4 角色
  role: {
    archetypeTie: { xianghe: 2.5, tongdao: 1.5, qifa: 1.5, gongyang: 1.2, jinghe: 1.0, jiayu: 0.8 },
    starSeen: 1.5,       // 星见，derived
    starShown: 1.0,      // 星透，tradition_unverified
    palaceHe: 1.0,       // 宫合，tradition_unverified
    friendStar: 0.6,     // 朋友：对方日主为我的比劫、食伤、印
  },

  // §5.6 辅证
  aux: {
    tianyiTie: 0.8,
    tianyiBenefit: 0.5,
  },

  // §6.1 相处密度
  density: { romance: 1.0, friend: 0.6 },

  // §6.1 等级与结构类型的分界
  grade: {
    tieDeep: 60, tieMid: 40,
    easeSmooth: 60, easeMid: 40,
    benefit: 15,
    lastingStable: 70, lastingMid: 40,
  },

  // 底色等级到「久」的分值
  stabilityScore: { strong: 90, stable: 70, dynamic: 50, buried: 35, damaged: 20 },
  spousePalaceClashLasting: 10,

  // 强弱临界（§13.0）
  borderline: { low: 4.5, high: 5.5 },

  // §7 时辰不详：十二组里至少几组一致
  hourStableMin: 10,

  // §6.2 朋友合盘五维度：页面原有权重
  friend: {
    dimSourceWeights: {
      d1: { s1: 0.55, s3: 0.45 },
      d2: { s1: 0.55, s3: 0.45 },
      d3: { s1: 0.50, s3: 0.50 },
      d4: { s1: 0.60, s3: 0.40 },
      d5: { s1: 0.55, s3: 0.45 },
    },
    totalWeights: { d1: 0.30, d2: 0.25, d3: 0.20, d4: 0.15, d5: 0.10 },
    // 八档的目标人群占比，由高到低
    tierShares: [0.05, 0.12, 0.20, 0.18, 0.18, 0.14, 0.09, 0.04],
    tierLabels: ['天生对盘', '很对盘', '对得上', '还算对盘', '不咸不淡', '有点拧', '不太对盘', '不对盘'],
    tierClasses: ['tc-amber', 'tc-green', 'tc-blue', 'tc-slate', 'tc-slate', 'tc-orange', 'tc-rose', 'tc-red'],
    // 钱财维度
    robWealthThreshold: 0.30,   // 对方盘中我的比劫占比
    feedWealthThreshold: 0.25,  // 对方盘中我的食伤占比
  },
};
