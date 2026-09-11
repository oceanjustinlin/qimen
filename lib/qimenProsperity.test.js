const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStarElement,
  getSeasonElement,
  prosperityOf,
  getNineStarProsperity,
  annotateProsperity
} = require('./qimenProsperity');
const { calculateQimenScore } = require('./qimenScoringEngine');

// ── 基础映射 ──

test('九星五行映射正确（含繁体星名归一化）', () => {
  assert.equal(getStarElement('天蓬'), '水');
  assert.equal(getStarElement('天任'), '土');
  assert.equal(getStarElement('天英'), '火');
  assert.equal(getStarElement('天心'), '金');
  assert.equal(getStarElement('天禽'), '土');
  // 繁体 + 「星」后缀也能识别
  assert.equal(getStarElement('天沖'), '木'); // 繁体冲
  assert.equal(getStarElement('天輔星'), '木'); // 繁体辅 + 后缀
});

test('月令五行：单字月支与完整月柱都能解析', () => {
  assert.equal(getSeasonElement('卯'), '木'); // 春
  assert.equal(getSeasonElement('午'), '火'); // 夏
  assert.equal(getSeasonElement('酉'), '金'); // 秋
  assert.equal(getSeasonElement('子'), '水'); // 冬
  assert.equal(getSeasonElement('未'), '土'); // 四季土月
  assert.equal(getSeasonElement('戊午'), '火'); // 完整月柱取地支
  assert.equal(getSeasonElement(''), '');
});

test('《遁甲演义》九星相旺废休囚定义（以春木月令为例）', () => {
  assert.equal(prosperityOf('木', '木'), '相'); // 与我同行
  assert.equal(prosperityOf('水', '木'), '旺'); // 我生之月
  assert.equal(prosperityOf('火', '木'), '废'); // 废于父母
  assert.equal(prosperityOf('金', '木'), '休'); // 休于财
  assert.equal(prosperityOf('土', '木'), '囚'); // 囚于鬼
  assert.equal(prosperityOf('', '木'), '');
});

test('getNineStarProsperity：春月（卯）下九星旺衰', () => {
  assert.equal(getNineStarProsperity('天冲', '卯'), '相');
  assert.equal(getNineStarProsperity('天英', '卯'), '废');
  assert.equal(getNineStarProsperity('天蓬', '卯'), '旺');
  assert.equal(getNineStarProsperity('天柱', '卯'), '休');
  assert.equal(getNineStarProsperity('天芮', '卯'), '囚');
});

test('annotateProsperity：按月令补字段，且尊重已有 prosperity', () => {
  const palaces = [
    { index: 0, star: '天冲' },
    { index: 1, star: '天芮' },
    { index: 2, star: '天柱', prosperity: '旺' } // 已有则不覆盖
  ];
  const out = annotateProsperity(palaces, '卯');
  assert.equal(out[0].prosperity, '相');
  assert.equal(out[1].prosperity, '囚');
  assert.equal(out[2].prosperity, '旺'); // 保留原值，未被算成「囚」
  // 不改原数组
  assert.equal(palaces[0].prosperity, undefined);
});

// ── 生产路径：annotateProsperity → calculateQimenScore，ground 真正生效 ──

// 复刻 worker 构建 timingPalaces 的最小骨架：只给一宫挂上目标九星，
// 让它成为评分引擎的核心宫（core palace），从而进入 yongshen_nodes。
function scoreWithStar(star, monthBranch) {
  const palaces = annotateProsperity(
    [{ index: 0, name: '坎一宫', star, door: '休门', god: '值符' }],
    monthBranch
  );
  const result = calculateQimenScore({
    intent: { category: 'general' },
    palaces,
    yongshenRule: {
      outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: [`${star}星`] }
    }
  });
  const node = result.yongshen_nodes.find((n) => n.palace_index === 0);
  assert.ok(node, '目标九星宫应进入 yongshen_nodes');
  return node.components.ground;
}

test('生产路径：相旺废休囚五档按古籍状态进入工程指标', () => {
  // 春月（卯）当令木
  assert.equal(scoreWithStar('天蓬', '卯'), 8); // 旺
  assert.equal(scoreWithStar('天冲', '卯'), 5); // 相
  assert.equal(scoreWithStar('天英', '卯'), -7); // 废
  assert.equal(scoreWithStar('天芮', '卯'), -5); // 囚
  assert.equal(scoreWithStar('天柱', '卯'), 0); // 休
});

test('生产路径回归：未补 prosperity 时 ground 旺衰部分恒为 0（修复前的死代码状态）', () => {
  // 不经 annotateProsperity，模拟修复前的 timingPalaces
  const result = calculateQimenScore({
    intent: { category: 'general' },
    palaces: [{ index: 0, name: '坎一宫', star: '天冲', door: '休门', god: '值符' }],
    yongshenRule: {
      outputRequirements: { scoreAuditMustIncludeAtLeastOneOf: ['天冲星'] }
    }
  });
  const node = result.yongshen_nodes.find((n) => n.palace_index === 0);
  assert.equal(node.components.ground, 0); // 无 prosperity → 底板失效
});
