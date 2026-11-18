'use strict';
// 简转繁的命理保护词表（i18n spec T1.1）。纯数据 + 纯函数，不依赖 opencc，前后端共用。
//
// 背景：opencc-js 的 cn → tw 对通用文字可用，但命理用字有系统性错误：
//   时干 → 時幹、丑未冲 → 醜未衝、斗君 → 鬥君、透干 → 透幹 ……
// 做法：先用本表在文本上标出「受保护」的字（每个字取覆盖它的最长词条给出的写法），
// 受保护的连续片段直接用词表写法输出，其余文字交给 OpenCC。
//
// 词条允许互相重叠（不是贪心切分），所以 `丑未冲` 里 `丑未` 与 `未冲` 两条都能生效；
// 同一个字被多条覆盖时，最长的词条优先（`出丑 → 出醜` 胜过 `丑 → 丑`）。

const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
const ELEMENTS = '木火土金水'.split('');

// 只覆盖生成词条时用到的字；不是通用简繁表。
const CHAR_HANT = {
  时: '時', 宫: '宮', 阳: '陽', 阴: '陰', 盘: '盤', 禄: '祿', 冲: '沖', 克: '剋', 门: '門',
  数: '數', 动: '動', 开: '開', 运: '運', 岁: '歲', 杀: '殺', 伤: '傷', 财: '財', 刑: '刑',
  对: '對', 为: '為', 坏: '壞', 战: '戰', 泄: '洩', 耗: '耗', 气: '氣', 来: '來', 头: '頭',
  丑: '丑', 斗: '斗', 干: '干', 杂: '雜', 带: '帶', 发: '發', 库: '庫', 宝: '寶', 会: '會',
  无: '無', 庙: '廟', 损: '損', 制: '制', 败: '敗', 绝: '絕', 胜: '勝', 势: '勢', 灾: '災',
  贵: '貴', 账: '帳', 应: '應', 临: '臨', 强: '強', 异: '異', 隐: '隱', 号: '號', 户: '戶', 周: '周', 末: '末', 内: '內', 度: '度', 榜: '榜', 每: '每', 本: '本', 上: '上', 下: '下', 与: '與', 杀: '殺', 恶: '惡', 煞: '煞', 帮: '幫', 残: '殘', 转: '轉', 扰: '擾', 预: '預', 柄: '柄', 君: '君', 北: '北', 南: '南', 紫: '紫', 微: '微', 填: '填', 亡: '亡',
  合: '合', 局: '局', 处: '處', 关: '關', 视: '視', 输: '輸', 赢: '贏',
};

function hant(simp) {
  return simp.split('').map((c) => CHAR_HANT[c] || c).join('');
}

function pair(simp, out) {
  return [simp, out === undefined ? hant(simp) : out];
}

function buildProtect() {
  const list = [];
  const add = (simp, out) => list.push(pair(simp, out));

  // ── 干（天干）──────────────────────────────────────────────
  const GAN_PREFIX = [
    '天', '日', '时', '月', '年', '十', '藏', '宫', '年命', '用', '本', '透', '坐', '落', '柱', '禄',
    '天盘', '地盘', '阳', '阴', '同', '异', '比', '旬', '遁', '隐', '命', '值符', '值使', '庚',
  ];
  for (const p of GAN_PREFIX) add(`${p}干`);
  for (const s of STEMS) add(`${s}干`);
  for (const w of ['干支', '干合', '干克', '干冲', '干透', '干头', '干神', '干强', '干弱', '干旺', '干上', '干下', '干落', '干临', '干为', '干五合', '干化']) add(w);
  for (const s of STEMS) for (const b of BRANCHES) add(`${s}${b}`); // 六十甲子组合（含 X丑）
  // 通用词里繁体仍写「干」的（OpenCC 对已是繁体的这些词会再转成「幹」，这里固定下来保证幂等）
  add('干扰', '干擾'); add('干预', '干預'); add('干涉', '干涉'); add('若干', '若干'); add('相干', '相干');
  add('干戈', '干戈'); add('干犯', '干犯'); add('不相干', '不相干');
  // 例外：不是天干的「干」
  for (const w of ['自己干', '一己干', '己干活', '庚干杯']) add(w, null);

  // ── 丑（地支）──────────────────────────────────────────────
  add('丑', '丑');
  for (const w of ['丑时', '丑月', '丑土', '丑未', '子丑', '丑年', '丑日', '丑宫', '丑中', '丑库', '丑寅', '丑亥']) add(w);
  // 普通词里的「丑」交给 OpenCC（醜）：最长匹配胜过单字保护
  for (const w of ['丑陋', '出丑', '丑恶', '丑闻', '丑化', '丢丑', '献丑', '丑态', '美丑', '家丑', '丑八怪', '丑事']) add(w, null);

  // ── 斗 ─────────────────────────────────────────────────────
  for (const w of ['斗君', '斗数', '北斗', '南斗', '斗柄', '紫微斗数', '斗宿']) add(w);
  add('斗转星移', '斗轉星移');

  // ── 冲（命理语境一律 沖）─────────────────────────────────────
  for (const w of ['相冲', '六冲', '冲克', '冲填', '冲开', '逢冲', '对冲', '冲合', '冲刑', '刑冲', '冲破', '冲动', '冲起', '冲出', '冲库', '冲提', '冲太岁', '冲年', '冲月', '冲日', '冲时', '冲宫', '受冲', '被冲', '暗冲', '冲战', '冲身', '冲命', '冲门', '空亡冲', '冲空', '天冲', '天冲星', '冲煞']) add(w);
  for (const b of BRANCHES) { add(`${b}冲`); add(`冲${b}`); }
  for (const s of STEMS) { add(`${s}冲`); add(`冲${s}`); }
  // 「冲动」在命理文里多指「被冲而动」，但在白话里是「衝動」（impulsive）。
  // 「冲动」之外的白话写法交回 OpenCC；「别冲动」「冲动行事」按白话处理。
  for (const w of ['别冲动', '冲动行事', '冲动消费', '冲动决定', '一时冲动', '不要冲动', '冲动的', '太冲动', '冲动型']) add(w, null);

  // ── 克（命理语境一律 剋）─────────────────────────────────────
  for (const w of ['相克', '受克', '克制', '生克', '克我', '我克', '被克', '克泄', '克耗', '克合', '冲克', '刑克', '克战', '反克', '克出', '克入', '来克', '去克', '克身', '克日', '克时', '克年', '克月', '宫克', '门克', '星克', '克宫', '克门', '克妻', '克夫', '克父', '克母', '克子', '克应', '克伐', '克害', '克制力']) add(w);
  for (const x of [...STEMS, ...BRANCHES, ...ELEMENTS]) { add(`${x}克`); add(`克${x}`); }

  // ── 凶（吉凶的凶；OpenCC 单字会转成「兇」）──────────────────────
  add('凶', '凶');
  for (const w of ['兇手', '凶手', '凶杀', '行凶', '凶狠', '凶猛', '凶器', '凶案', '帮凶', '元凶', '凶残', '凶神恶煞']) add(w, null);

  // ── 列举里单独出现的「干」（如「神、星、门、干」）──────────────────
  for (const w of ['、干', '干、', '干和', '干与', '门干', '星干', '神干', '干（', '（干']) add(w);

  // ── 界面惯用词（台湾习惯，spec §10 第 3 项默认）──────────────
  add('登录', '登入');
  add('默认', '預設');
  add('注册', '註冊');
  add('反馈', '回饋');
  add('账号', '帳號');
  add('账户', '帳戶');

  // ── 名称类 ────────────────────────────────────────────────
  add('螣蛇', '螣蛇');
  add('咸池', '咸池');
  add('复盘', '覆盤');
  for (const w of ['周运', '本周', '下周', '上周', '每周', '周末', '周内', '周一', '周二', '周三', '周四', '周五', '周六', '周日', '周天', '周度', '周榜']) add(w, hant(w).replace(/周/g, '週'));

  // 去重：同一个简体词保留最后一次的写法（例外表在后面覆盖前面）
  const map = new Map();
  for (const [s, o] of list) map.set(s, o);
  // 幂等：已经是繁体写法的文字也要受保护（`時干` 再转一次仍是 `時干`，不能变 `時幹`）
  for (const [s, o] of [...map.entries()]) {
    if (o && o !== s && !map.has(o)) map.set(o, o);
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1));
}

// [[简体, 繁体 | null]]，按简体长度降序。null 表示「这段交给 OpenCC」（用于压过更短的保护词）。
const PROTECT = buildProtect();

const TRIE = (() => {
  const root = new Map();
  for (const [simp, out] of PROTECT) {
    let node = root;
    for (const ch of simp) {
      if (!node.has(ch)) node.set(ch, new Map());
      node = node.get(ch);
    }
    node.set('\0', { simp, out });
  }
  return root;
})();

const PROTECT_CHARS = new Set(PROTECT.flatMap(([s]) => s.split('')));

// 这些字无论词表写法是否与简体相同都要锁定，不交给 OpenCC。
// 词条里的其他字：写法与简体不同才锁定（如 登录→登入 的「入」），相同则仍交给 OpenCC 转（如 隐干 的「隐→隱」）。
const SENSITIVE = new Set(['干', '丑', '斗', '冲', '克', '凶']);

/**
 * 把文本切成片段：
 *   { text, locked: true,  out }  受保护，直接输出 out
 *   { text, locked: false }       交给 OpenCC
 */
function splitProtected(text) {
  if (typeof text !== 'string' || !text) return [];
  const n = text.length;
  // 每个字：覆盖它的最长词条的长度与写法（null = 显式交给 OpenCC）
  const bestLen = new Int16Array(n);
  const bestOut = new Array(n);
  let any = false;
  for (let i = 0; i < n; i += 1) {
    if (!PROTECT_CHARS.has(text[i])) continue;
    let node = TRIE;
    for (let j = i; j < n; j += 1) {
      node = node.get(text[j]);
      if (!node) break;
      const hit = node.get('\0');
      if (!hit) continue;
      const len = j - i + 1;
      for (let k = i; k <= j; k += 1) {
        if (len > bestLen[k]) {
          bestLen[k] = len;
          bestOut[k] = hit.out === null ? null : hit.out[k - i];
          any = true;
        }
      }
    }
  }
  if (!any) return [{ text, locked: false }];

  const segments = [];
  let start = 0;
  let curLocked = false;
  let outBuf = '';
  const flush = (end) => {
    if (end <= start) return;
    const piece = text.slice(start, end);
    segments.push(curLocked ? { text: piece, locked: true, out: outBuf } : { text: piece, locked: false });
  };
  const isLocked = (i) => bestLen[i] > 0 && bestOut[i] !== null
    && (bestOut[i] !== text[i] || SENSITIVE.has(text[i]));
  curLocked = isLocked(0);
  for (let i = 0; i < n; i += 1) {
    const locked = isLocked(i);
    if (locked !== curLocked) {
      flush(i);
      start = i;
      curLocked = locked;
      outBuf = '';
    }
    if (locked) outBuf += bestOut[i];
  }
  flush(n);
  return segments;
}

// 整段文字恰好等于这些值时直接替换（界面上的单字标签，如运势页「日 / 周 / 月 / 年」页签）。
const EXACT = { 周: '週' };

/** 用给定的通用转换函数完成整段简转繁。convert 为空时只应用保护词表。 */
function convertWithProtect(text, convert) {
  if (typeof text !== 'string' || !text) return text;
  const trimmed = text.trim();
  if (EXACT[trimmed]) return text.replace(trimmed, EXACT[trimmed]);
  const segs = splitProtected(text);
  let out = '';
  for (const seg of segs) {
    if (seg.locked) out += seg.out;
    else out += convert ? convert(seg.text) : seg.text;
  }
  return out;
}

module.exports = {
  PROTECT,
  splitProtected,
  convertWithProtect,
};
