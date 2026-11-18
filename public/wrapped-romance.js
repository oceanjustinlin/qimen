'use strict';
/* ══════════════════════════════════════════════════
   婚恋合盘（spec §9、T2.1、T2.2）
   入口 /wrapped.html?type=romance。四问四章，不给总分、不给称号。
   依赖 wrapped.html 主脚本里的全局：REL、S、POS、POS_LABEL、POS_IDX、posOf、sumBen、benA、benB、
   marksFor、wxClass、escapeHTML、fillNames、sentence、countUpEl、showPhase、initDim、
   DIM_CFG、DIM_NEXT、DIM_PREV、dimTimers、pad2、resultDateText、caveatText、isWeChat。
   口径（理论文档第 8 节）：倾向性措辞；不给配偶贴吉凶标签，不按性别给不对称的评价；
   不对结婚、分手给指令；不对对方人品下断语。
══════════════════════════════════════════════════ */

const RQ = [
  { key: 'q1', dim: 'rq1', q: 'tie', ask: '有缘吗', no: '一' },
  { key: 'q2', dim: 'rq2', q: 'ease', ask: '处得顺吗', no: '二' },
  { key: 'q3', dim: 'rq3', q: 'benefit', ask: '谁成就谁', no: '三' },
  { key: 'q4', dim: 'rq4', q: 'lasting', ask: '走得远吗', no: '四' },
];
const RQ_BY_KEY = Object.fromEntries(RQ.map((r) => [r.key, r]));

/* 章节接入逐页演示框架：五页（开场、释义、依据、扫盘、等级） */
RQ.forEach((r, i) => {
  DIM_CFG[r.dim] = { slides: 5, scoreId: r.key, scoreSlide: 4 };
  DIM_NEXT[r.dim] = i < RQ.length - 1 ? RQ[i + 1].dim : 'suspense';
  if (i > 0) DIM_PREV[r.dim] = RQ[i - 1].dim;
});

const STABILITY_LABEL = { strong: '强旺稳固', stable: '平稳安静', dynamic: '动荡不稳', buried: '封藏入墓', damaged: '受损变质' };
const STABLE_GOOD = new Set(['strong', 'stable']);

/* 等级的颜色：pos 青、mid 墨、neg 朱、off 灰 */
const GRADE_TONE = {
  深: 'pos', 中: 'mid', 浅: 'mid',
  顺: 'pos', 有磨合: 'mid', 多摩擦: 'neg',
  互相: 'pos', 偏向一方: 'mid', 互耗: 'neg', 各不相干: 'mid',
  稳: 'pos', 看年份: 'mid', 多变: 'neg', 待开放: 'off',
  得益: 'pos', 平: 'mid', 受损: 'neg',
};
const GRADE_LINE = {
  tie: { 深: '牵连深，容易走近。', 中: '有些牵连，不远不近。', 浅: '牵连不多，各有各的轨道。' },
  ease: { 顺: '日常磕碰少。', 有磨合: '有几处要磨合。', 多摩擦: '摩擦偏多，多留些耐心。' },
  benefit: { 互相: '彼此滋养。', 互耗: '彼此都有消耗。', 各不相干: '谈不上谁成就谁。' },
};
const STRUCT_TONE = { 相成: 'pos', 淡益: 'pos', 偏济: 'mid', 平行: 'mid', 纠缠: 'neg' };
const STRUCT_LINE = {
  相成: '牵连深，而且彼此滋养。',
  纠缠: '牵连深，却彼此消耗。',
  偏济: '牵连深，一方付出更多。',
  淡益: '往来不多，但彼此有益。',
  平行: '各走各的，谈不上伤害。',
};

/* ── 证据 → 四问（与 lib/synastry/score.js 的来源一致） ── */
const RQ_EVIDENCE = {
  q1: (e) => e.layer !== 'baseline' && (e.tie || 0) > 0 && (e.tie || 0) >= (e.strain || 0),
  q2: (e) => (e.strain || 0) > 0,
  q3: (e) => e.layer !== 'baseline' && e.kind !== 'wealth_flow' && Math.abs(sumBen(e)) > 0.01,
  q4: (e) => e.layer === 'baseline' || e.kind === 'spouse_palace_clash' || e.kind === 'spouse_palace_he',
};
function rqEvidence(key) { return S.evidence.filter(RQ_EVIDENCE[key]); }
function rqTone(key, e) {
  if (key === 'q1') return 'hit';
  if (key === 'q2') return 'warn';
  if (key === 'q4') return e.kind === 'spouse_palace_clash' ? 'warn' : 'hit';
  return sumBen(e) < 0 ? 'warn' : 'hit';
}
const BASIS_COEF = { book: 1, derived: 1, tradition_unverified: 0.5, folk: 0 };
/* 排序用的分量：每一问只看它自己的量，依据等级打折；日柱天合地合优先 */
function rqMag(e, key) {
  const c = BASIS_COEF[e.basis] ?? 1;
  if (key === 'q1') return ((e.tie || 0) + (e.kind === 'double_he' ? 2 : 0)) * c;
  if (key === 'q2') return (e.strain || 0) * c;
  if (key === 'q3') return Math.abs(sumBen(e)) * c;
  return ((e.tie || 0) + (e.strain || 0) + Math.abs(sumBen(e))) * c;
}
function rqTop(list, n, key) { return list.slice().sort((a, b) => rqMag(b, key) - rqMag(a, key)).slice(0, n); }
function gradeSpan(g) { return `<span class="g-${GRADE_TONE[g] || 'mid'}">${escapeHTML(g)}</span>`; }

/* 谁成就谁：偏向一方时写明方向 */
function benefitLine(fq) {
  const b = fq.benefit;
  if (b.grade === '偏向一方') {
    const aGain = b.A >= b.B;
    const gain = aGain ? S.nameA : S.nameB;
    const give = aGain ? S.nameB : S.nameA;
    return `${give}成就${gain}更多。`;
  }
  return GRADE_LINE.benefit[b.grade] || '';
}
function lastingGrade(fq) { return fq.lasting && fq.lasting.available ? fq.lasting.grade : '待开放'; }

/* ══════════════════════════════════════════════════
   页面初始：落地页、向导的文案与性别
══════════════════════════════════════════════════ */
function applyRomanceCopy() {
  document.title = '奇门道 · 姻缘合盘';
  const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
  set('#landing .land-badge', '八字合盘 · 姻缘');
  set('#landing .land-title', '对的人，<br><span class="hi">对得上</span>。');
  set('#landing .land-chips', RQ.map((r) => `<span class="land-chip">${r.ask}</span>`).join(''));
  const chips = document.querySelector('#landing .land-chips');
  if (chips) chips.style.gridTemplateColumns = 'repeat(4,auto)';
  set('#landing .land-nudge', '<div class="ndot"></div>一分钟，四个问题');
  ['A', 'B'].forEach((suf) => {
    document.getElementById(`g${suf}-M`)?.classList.remove('on');
    document.getElementById(`g${suf}-F`)?.classList.remove('on');
  });
  document.querySelectorAll('#wizard .gender-row').forEach((row) => {
    if (!row.previousElementSibling?.querySelector('.f-hint')) {
      row.previousElementSibling?.insertAdjacentHTML('beforeend', '<span class="f-hint">（决定配偶星，请选）</span>');
    }
  });
}

/* ══════════════════════════════════════════════════
   接口返回 → 状态
══════════════════════════════════════════════════ */
function applyRomanceReport(report) {
  S.report = report;
  S.evidence = (report.evidence || []).filter((e) => e && e.basis !== 'folk');
  S.folk = (report.evidence || []).filter((e) => e && e.basis === 'folk');
  S.confidence = report.confidence || 'high';
  S.caveats = Array.isArray(report.caveats) ? report.caveats : [];
  S.fq = report.fourQuestions;
  S.structure = report.structure;
  S.baseline = report.baseline || {};
  S.total = 0; S.tier = ''; S.tierClass = '';
}

/* ══════════════════════════════════════════════════
   四章的内容
══════════════════════════════════════════════════ */
function buildRomanceContent() {
  RQ.forEach((r) => {
    buildRqAnalysis(r);
    buildRqScan(r);
    buildRqGrade(r);
  });
}

function rqGrade(r) {
  const fq = S.fq;
  if (r.q === 'lasting') return lastingGrade(fq);
  return fq[r.q].grade;
}

function buildRqAnalysis(r) {
  const wrap = document.getElementById(`${r.dim}-analysis`); if (!wrap) return;
  const list = rqEvidence(r.key);
  let delay = 0.1; const d = () => { delay += 0.15; return `animation-delay:${delay.toFixed(2)}s`; };
  const top = rqTop(list.filter((e) => e.layer !== 'baseline' && (r.key !== 'q3' || e.dir !== 'mutual')), 1, r.key)[0];
  const emptyTitle = { q1: '两张盘之间的牵连不多。', q2: '两张盘之间不见冲刑。', q3: '两张盘对彼此的增减都不明显。', q4: '先看各自命里的配偶星与配偶宫。' }[r.key];
  let html = `<div class="an-head afu" style="${d()}"><span class="k">第${r.no}问 ${r.ask}</span><span class="s">依据</span></div>`;
  html += `<div class="an-title afu" style="${d()}">${top && r.key !== 'q4' ? escapeHTML(sentence(top.seed)) : emptyTitle}</div>`;

  const fact = (e) => `<div class="an-fact">${escapeHTML(sentence(e.seed))}</div>`;
  const sec = (who, tag, items, extra = '') => `<div class="an-sec afu" style="${d()}"><div class="an-row"><span class="an-who">${who}</span>${tag}</div><div class="an-facts">${items}</div>${extra}</div>`;
  const nmA = escapeHTML(S.nameA), nmB = escapeHTML(S.nameB);

  if (r.key === 'q4') {
    ['A', 'B'].forEach((side) => {
      const st = S.baseline[side];
      const own = list.filter((e) => e.layer === 'baseline' && e.dir === (side === 'A' ? 'A<-B' : 'B<-A'));
      const tag = st ? `<span class="an-tag ${STABLE_GOOD.has(st) ? 'pos' : 'neg'}">${STABILITY_LABEL[st] || st}</span>` : '';
      html += sec(side === 'A' ? nmA : nmB, tag, own.map(fact).join('') || '<div class="an-fact">配偶星与配偶宫的情况见下页。</div>');
    });
    const palace = list.filter((e) => e.layer !== 'baseline');
    if (palace.length) html += sec('两人的配偶宫', '', rqTop(palace, 2).map(fact).join(''));
    html += `<div class="an-sec afu" style="${d()}"><div class="an-p">两人大运是否同步、哪些年份是关口，属于岁运部分，后续版本提供。</div></div>`;
  } else {
    const groups = r.key === 'q3'
      ? [
        { items: list.filter((e) => e.dir === 'A<-B'), who: `${nmA} <span class="arr">←</span> ${nmB}`, g: S.fq.benefit.gradeA },
        { items: list.filter((e) => e.dir === 'B<-A'), who: `${nmB} <span class="arr">←</span> ${nmA}`, g: S.fq.benefit.gradeB },
      ]
      : [
        { items: list.filter((e) => e.dir === 'mutual'), who: '两盘之间', g: '' },
        { items: list.filter((e) => e.dir !== 'mutual'), who: '彼此在对方盘里', g: '' },
      ];
    groups.forEach((gp) => {
      if (!gp.items.length) return;
      const tag = gp.g ? `<span class="an-tag ${GRADE_TONE[gp.g] === 'pos' ? 'pos' : GRADE_TONE[gp.g] === 'neg' ? 'neg' : ''}">${gp.g}</span>` : '';
      html += sec(gp.who, tag, rqTop(gp.items, 3, r.key).map(fact).join(''));
    });
    if (!list.length) html += `<div class="an-sec afu" style="${d()}"><div class="an-p">${emptyTitle}</div></div>`;
  }
  const g = rqGrade(r);
  const foot = r.q === 'benefit' ? benefitLine(S.fq) : r.q === 'lasting' ? '这里只看底色。' : (GRADE_LINE[r.q][g] || '');
  html += `<div class="an-foot afu" style="${d()}">${escapeHTML(foot)}</div>`;
  wrap.innerHTML = html;
}

function buildRqScan(r) {
  const wrap = document.getElementById(`${r.dim}-scan`); if (!wrap) return;
  const m = marksFor(r.key, rqEvidence(r.key), rqTone);
  if (r.key === 'q4') {
    // 配偶宫（日支）按各自的底色标记
    ['A', 'B'].forEach((side) => {
      const st = S.baseline[side];
      if (st && S.bazi[side]?.[2]?.zhi) {
        const c = m[side][2];
        if (c.zhi !== 'warn') c.zhi = STABLE_GOOD.has(st) ? 'hit' : 'warn';
      }
    });
  }
  const person = (side) => {
    let n = 0, warn = false;
    const cells = (S.bazi[side] || []).map((p, i) => {
      const mk = m[side][i];
      if (mk.gan) n++; if (mk.zhi) n++; if (mk.gan === 'warn' || mk.zhi === 'warn') warn = true;
      const g = p.gan ? `<span class="bzc-gan ${wxClass(p.gan)}">${p.gan}</span>` : '<span class="bzc-gan bzc-empty">—</span>';
      const z = p.zhi ? `<span class="bzc-zhi ${wxClass(p.zhi)}">${p.zhi}</span>` : '<span class="bzc-zhi bzc-empty">—</span>';
      return `<div class="bzc" data-mark-gan="${mk.gan}" data-mark-zhi="${mk.zhi}">${g}${z}<span class="bzc-lbl">${p.label}柱</span></div>`;
    }).join('');
    const nm = side === 'A' ? S.nameA : S.nameB;
    return `<div class="scan-person"><div class="sp-header"><span class="sp-pname">${escapeHTML(nm)}</span><span class="sp-count${warn ? ' warn' : ''}" id="${r.dim}-cnt-${side.toLowerCase()}">${n ? `标出 ${n} 字` : '无标记'}</span></div><div class="bz-row">${cells}</div></div>`;
  };
  wrap.innerHTML = person('A') + '<div class="bz-scan-divider"></div>' + person('B');
}

function buildRqGrade(r) {
  const g = rqGrade(r);
  const el = document.getElementById(`${r.key}-grade`);
  if (el) { el.textContent = g; el.className = `grade-big asi g-${GRADE_TONE[g] || 'mid'}`; el.style.animationDelay = '.6s'; }
  const sub = document.getElementById(`${r.key}-sub`);
  const sides = document.getElementById(`${r.key}-sides`);
  if (sides) sides.innerHTML = '';
  if (r.q === 'benefit') {
    if (sub) sub.textContent = benefitLine(S.fq);
    const b = S.fq.benefit;
    if (sides) {
      sides.innerHTML = `<div class="gs-row"><span>${escapeHTML(S.nameA)} ← ${escapeHTML(S.nameB)}</span>${gradeSpan(b.gradeA)}</div>`
        + `<div class="gs-row"><span>${escapeHTML(S.nameB)} ← ${escapeHTML(S.nameA)}</span>${gradeSpan(b.gradeB)}</div>`;
    }
  } else if (r.q === 'lasting') {
    if (sub) sub.textContent = '岁运部分尚未开放，这里只看各自的底色。';
    if (sides) {
      sides.innerHTML = ['A', 'B'].map((side) => {
        const st = S.baseline[side];
        const nm = side === 'A' ? S.nameA : S.nameB;
        const lbl = STABILITY_LABEL[st] || '—';
        return `<div class="gs-row"><span>${escapeHTML(nm)} 的配偶星与配偶宫</span><span class="g-${STABLE_GOOD.has(st) ? 'pos' : 'neg'}">${lbl}</span></div>`;
      }).join('');
    }
  } else if (sub) {
    sub.textContent = GRADE_LINE[r.q][g] || '';
  }
}

/* ══════════════════════════════════════════════════
   悬念页：揭示结构类型，不揭示分数
══════════════════════════════════════════════════ */
function runSuspenseRomance() {
  const steps = ['susp-0', 'susp-1', 'susp-2'];
  const showStep = (i) => steps.forEach((id, j) => {
    const el = document.getElementById(id);
    if (j === i) { el.style.transition = 'none'; void el.offsetWidth; el.style.transition = 'opacity .45s ease'; el.classList.add('ss-on'); }
    else { el.style.transition = 'none'; el.classList.remove('ss-on'); }
  });
  document.querySelector('#susp-0 .susp-icon').textContent = '四问看完';
  showStep(0);
  setTimeout(() => showStep(1), 1800);
  setTimeout(() => {
    const st = S.structure || '';
    document.getElementById('susp-steps').className = `susp-steps s-${STRUCT_TONE[st] || 'mid'}`;
    document.querySelector('#susp-2 .susp-label').textContent = '这段关系的结构';
    document.getElementById('susp-sign').textContent = '';
    document.getElementById('susp-num').textContent = st;
    document.getElementById('susp-tier').textContent = STRUCT_LINE[st] || '';
    showStep(2);
    setTimeout(() => { buildRomanceResult(); showPhase('result-r'); }, 2600);
  }, 3600);
}

/* ══════════════════════════════════════════════════
   结果页
══════════════════════════════════════════════════ */
const LINK_LABEL = { chong: '冲', xing: '刑', zixing: '刑', hai: '害', day_clash: '冲', spouse_palace_clash: '冲', gan_ke: '克', gan_ke_yy: '克', gan_same: '同', zhi_same: '同' };
/* 同一柱位上的两盘关系：合、冲、刑、害、克、同 */
function columnLinks() {
  return POS.map((pos) => {
    const same = S.evidence.filter((e) => e.layer === 'bond' && posOf(e.locus?.a) === pos && posOf(e.locus?.b) === pos);
    if (!same.length) return null;
    const he = same.find((e) => e.kind === 'double_he') || same.find((e) => (e.tie || 0) > (e.strain || 0) && !/same/.test(e.kind));
    if (he) return { label: '合', tone: 'he', ev: [he] };
    const clash = same.filter((e) => (e.strain || 0) > (e.tie || 0)).sort((a, b) => b.strain - a.strain)[0];
    if (clash) return { label: LINK_LABEL[clash.kind] || '冲', tone: 'clash', ev: [clash] };
    const sm = same.find((e) => /same/.test(e.kind));
    return sm ? { label: '同', tone: 'same', ev: [sm] } : null;
  });
}

function buildRomanceGrid() {
  const links = columnLinks();
  const hit = { A: POS.map(() => ({ gan: false, zhi: false })), B: POS.map(() => ({ gan: false, zhi: false })) };
  links.forEach((lk, i) => {
    if (!lk || lk.tone === 'same') return;
    lk.ev.forEach((e) => {
      [['a', 'A'], ['b', 'B']].forEach(([k, side]) => {
        const part = String(e.locus?.[k] || '').split('.')[1];
        if (!part || part === 'gan') hit[side][i].gan = lk.tone;
        if (!part || part === 'zhi') hit[side][i].zhi = lk.tone;
      });
    });
  });
  const cell = (side, i, part) => {
    const ch = S.bazi[side]?.[i]?.[part] || '';
    const h = hit[side][i][part];
    return `<span class="pc ${ch ? wxClass(ch) : 'empty'}${h === 'he' ? ' hit' : h === 'clash' ? ' warn' : ''}">${ch || '—'}</span>`;
  };
  const head = `<span></span>${POS.map((p) => `<span class="lb">${POS_LABEL[p]}</span>`).join('')}`;
  const rows = (side) => {
    const nm = side === 'A' ? S.nameA : S.nameB;
    return `<span class="nm">${escapeHTML(nm)}</span>${POS.map((_, i) => cell(side, i, 'gan')).join('')}`
      + `<span></span>${POS.map((_, i) => cell(side, i, 'zhi')).join('')}`;
  };
  const linkRow = `<span></span>${links.map((lk) => lk ? `<span class="lk lk-${lk.tone}"><i></i><b>${lk.label}</b><i></i></span>` : '<span></span>').join('')}`;
  return head + rows('A') + linkRow + rows('B');
}

function rqFactText(r) {
  const fq = S.fq;
  if (r.q === 'lasting') {
    if (!(fq.lasting && fq.lasting.available)) return escapeHTML('两人大运走势与关键年份，后续版本提供');
  }
  if (r.q === 'benefit') {
    const one = (dir, from, to) => {
      const f = rqTop(rqEvidence('q3').filter((e) => e.dir === dir && (dir === 'A<-B' ? benA(e) : benB(e)) > 0), 1, 'q3')[0]
        || rqTop(rqEvidence('q3').filter((e) => e.dir === dir), 1, 'q3')[0];
      return f ? `${escapeHTML(from)} → ${escapeHTML(to)}：${escapeHTML(fillNames(f.seed))}` : '';
    };
    const lines = [one('A<-B', S.nameB, S.nameA), one('B<-A', S.nameA, S.nameB)].filter(Boolean);
    return lines.length ? lines.join('<br>') : escapeHTML(GRADE_LINE.benefit[fq.benefit.grade] || '');
  }
  if (r.q === 'ease') {
    const f = rqTop(rqEvidence('q2'), 1, 'q2')[0];
    return escapeHTML(f ? fillNames(f.seed) : '两张盘之间不见冲刑');
  }
  const f = rqTop(rqEvidence('q1'), 1, 'q1')[0];
  return escapeHTML(f ? fillNames(f.seed) : '两张盘之间的牵连不多');
}

/* 最要紧的一条：配偶星互见优先，其次是分量最大的证据 */
function keyFact() {
  const stars = S.evidence.filter((e) => e.kind === 'spouse_star_seen');
  if (stars.length) return stars.map((e) => sentence(e.seed)).join('');
  const f = rqTop(S.evidence.filter((e) => e.layer !== 'baseline' && e.kind !== 'wealth_flow'), 1)[0];
  return f ? sentence(f.seed) : '两张盘之间没有特别突出的关系。';
}

function buildRomanceResult() {
  const st = S.structure || '';
  document.getElementById('rr-date').textContent = resultDateText();
  document.getElementById('rr-names').innerHTML = `${escapeHTML(S.nameA)}<span class="rsep">×</span>${escapeHTML(S.nameB)}`;
  const seal = document.getElementById('rr-seal');
  seal.textContent = st; seal.className = `rr-seal s-${STRUCT_TONE[st] || 'mid'}`;
  document.getElementById('rr-struct-line').textContent = STRUCT_LINE[st] || '';
  document.getElementById('rr-grid').innerHTML = buildRomanceGrid();
  document.getElementById('rr-qs').innerHTML = RQ.map((r) => {
    const g = rqGrade(r);
    return `<div class="rq-row"><span class="rq-ask">${r.ask}</span><span class="rq-grade g-${GRADE_TONE[g] || 'mid'}">${escapeHTML(g)}</span><span class="rq-fact${g === '待开放' ? ' off' : ''}">${rqFactText(r)}</span></div>`;
  }).join('');
  document.getElementById('rr-key').textContent = keyFact();
  const folk = document.getElementById('rr-folk');
  const sx = S.folk?.find((e) => e.kind === 'shengxiao');
  const ft = sx ? `${sentence(sx.seed)}本报告以日主与全局为主。` : '';
  folk.textContent = ft; folk.hidden = !ft;
  const cav = document.getElementById('rr-caveat');
  const ct = caveatText(); cav.textContent = ct; cav.hidden = !ct;
}

/* ══════════════════════════════════════════════════
   分享图：结构类型 + 四问，不含任何分数
══════════════════════════════════════════════════ */
function renderRomanceShareBlob() {
  const root = getComputedStyle(document.documentElement);
  const v = (n, f) => root.getPropertyValue(n).trim() || f;
  const C = {
    paper: v('--paper', '#f7f4ee'), card: v('--card', '#fffdf8'), ink: v('--ink', '#0b0b0b'), ink2: v('--ink2', '#45484c'), ink3: v('--ink3', '#63676c'),
    line: v('--line', 'rgba(11,11,11,.14)'), line2: v('--line2', 'rgba(11,11,11,.3)'), gold: v('--goldtxt', '#765818'), goldfill: v('--goldfill', '#b58d3b'),
    teal: v('--teal', '#0b6f66'), crimson: v('--crimson', '#b03a35'),
  };
  const toneColor = (t) => (t === 'pos' ? C.teal : t === 'neg' ? C.crimson : t === 'off' ? C.ink3 : C.ink2);
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 1120;
  const ctx = canvas.getContext('2d');
  const font = "'Noto Serif SC','Songti SC','STSong',serif";
  const W = 720, X0 = 54, X1 = 666;
  const text = (t, x, y, size, weight, color, align = 'left') => { ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(String(t), x, y); };
  const hline = (y, color = C.line2) => { ctx.fillStyle = color; ctx.fillRect(X0, y, X1 - X0, 1); };
  const wrap = (t, x, y, maxW, lineH, size, weight, color, limit) => {
    ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let line = ''; const lines = [];
    String(t || '').split('').forEach((ch) => { const tt = line + ch; if (ctx.measureText(tt).width > maxW && line) { lines.push(line); line = ch; } else line = tt; });
    if (line) lines.push(line);
    const out = lines.slice(0, limit);
    if (lines.length > limit) out[limit - 1] = out[limit - 1].slice(0, -1) + '…';
    out.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
    return out.length;
  };

  const st = S.structure || '';
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, 1120);
  ctx.fillStyle = C.goldfill; ctx.fillRect(0, 0, W, 6);
  text('八字双人合盘 · 姻缘', X0, 40, 18, '600', C.gold);
  text(resultDateText(), X1, 40, 16, '400', C.ink3, 'right');
  ctx.font = `900 52px ${font}`;
  const wa = ctx.measureText(S.nameA).width;
  text(S.nameA, X0, 84, 52, '900', C.ink);
  text('×', X0 + wa + 14, 92, 40, '400', C.gold);
  ctx.font = `400 40px ${font}`; const wx = ctx.measureText('×').width;
  text(S.nameB, X0 + wa + wx + 28, 84, 52, '900', C.ink);

  hline(176);
  const sc = toneColor(STRUCT_TONE[st]);
  ctx.strokeStyle = sc; ctx.lineWidth = 5; ctx.strokeRect(X0 + 2.5, 204, 168, 168);
  text(st, X0 + 86, 252, 64, '900', sc, 'center');
  text('这段关系的结构', X0 + 200, 238, 18, '400', C.ink3);
  wrap(STRUCT_LINE[st] || '', X0 + 200, 272, X1 - X0 - 200, 40, 28, '600', C.ink, 2);
  hline(400);

  RQ.forEach((r, i) => {
    const y = 420 + i * 112;
    const g = rqGrade(r);
    text(r.ask, X0, y + 6, 26, '900', C.ink);
    text(g, X0 + 150, y + 6, 26, '600', toneColor(GRADE_TONE[g]));
    // 多行事实（谁成就谁的两个方向）各占一行，单行事实可折两行
    const facts = rqFactText(r).split('<br>').map((t) => stripHTML(t));
    const lim = facts.length > 1 ? 1 : 2;
    facts.slice(0, 2).forEach((f, k) => wrap(f, X0 + 150, y + 46 + k * 28, X1 - X0 - 150, 28, 18, '400', g === '待开放' ? C.ink3 : C.ink2, lim));
    ctx.fillStyle = C.line; ctx.fillRect(X0, y + 104, X1 - X0, 1);
  });

  const ky = 878;
  ctx.fillStyle = C.card; ctx.fillRect(X0, ky, X1 - X0, 150);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(X0 + 0.5, ky + 0.5, X1 - X0 - 1, 149);
  text('最要紧的一条', X0 + 22, ky + 18, 16, '600', C.gold);
  wrap(keyFact(), X0 + 22, ky + 48, X1 - X0 - 44, 30, 20, '400', C.ink, 3);
  text('两张盘的结构关系，不是对两个人的判决', X0, 1064, 16, '400', C.ink3);
  text('长按分享', X1, 1064, 16, '600', C.gold, 'right');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('截图生成失败'))), 'image/png', 0.95));
}

/* ── 启动 ── */
if (REL === 'romance') {
  applyRomanceCopy();
  document.getElementById('rr-btn-share')?.addEventListener('click', resShare);
  document.getElementById('rr-btn-try')?.addEventListener('click', resTryAnother);
  document.getElementById('rr-btn-rewatch')?.addEventListener('click', resRewatch);
}
