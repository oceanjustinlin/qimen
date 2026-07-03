const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSanMingPattern } = require('./sanMingPatternResolver.js');
const fixtures = [
  require('../fixtures/classical-golden-cases/qiongtong-high-confidence.json'),
  require('../fixtures/classical-golden-cases/ziping-high-confidence.json'),
  require('../fixtures/classical-golden-cases/sanming-high-confidence.json'),
  require('../fixtures/classical-golden-cases/sanming-patterns-high-confidence.json'),
];
const { CASES: baziProfileCases } = require('../eval/baziprofile-accuracy/gold-cases.js');

const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const ELEMENT = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
const VALID_SCOPE = new Set(['geju', 'strength', 'image', 'yong', 'xiji', 'method']);

function tenGod(dayMaster, targetStem) {
  const dayElement = ELEMENT[dayMaster];
  const targetElement = ELEMENT[targetStem];
  const samePolarity = YANG.has(dayMaster) === YANG.has(targetStem);
  if (targetElement === dayElement) return samePolarity ? '比肩' : '劫财';
  if (GENERATES[targetElement] === dayElement) return samePolarity ? '偏印' : '正印';
  if (GENERATES[dayElement] === targetElement) return samePolarity ? '食神' : '伤官';
  if (CONTROLS[dayElement] === targetElement) return samePolarity ? '偏财' : '正财';
  if (CONTROLS[targetElement] === dayElement) return samePolarity ? '七杀' : '正官';
  throw new Error(`Cannot resolve ten god: ${dayMaster}/${targetStem}`);
}

test('classical PDF gold cases have valid pillars, provenance and sparse scoring contracts', () => {
  const allCases = fixtures.flatMap(fixture => fixture.cases);
  for (const fixture of fixtures) {
    assert.equal(fixture._meta.count, fixture.cases.length);
    assert.equal(fixture._meta.source_sha256.length, 64);
  }
  assert.equal(new Set(allCases.map(item => item.id)).size, allCases.length);

  const validJiazi = new Set(Array.from({ length: 60 }, (_, index) =>
    `${STEMS[index % 10]}${BRANCHES[index % 12]}`));

  for (const item of allCases) {
    assert.equal(item.input.pillars.length, 4, item.id);
    for (const pillar of item.input.pillars) assert.ok(validJiazi.has(pillar), `${item.id}: ${pillar}`);
    const dayMaster = item.input.pillars[2][0];
    assert.equal(item.source.visual_verified, true, item.id);
    assert.equal(item.source.ocr_only, false, item.id);
    assert.ok(item.source.pdf_page > 0 && item.source.printed_page > 0, item.id);
    assert.ok(item.source.source_excerpt.length <= 45, item.id);
    assert.ok(item.scoringScope.length > 0, item.id);
    for (const scope of item.scoringScope) assert.ok(VALID_SCOPE.has(scope), `${item.id}: ${scope}`);

    for (const yong of item.gold.yong) {
      if (!yong.stem) continue;
      assert.equal(ELEMENT[yong.stem], yong.wuxing, `${item.id}: ${yong.stem}`);
      assert.equal(tenGod(dayMaster, yong.stem), yong.shen, `${item.id}: ${yong.stem}`);
    }
  }
});

test('classical PDF gold cases are included in the Bazi profile gold set', () => {
  const fixtureIds = fixtures.flatMap(fixture => fixture.cases.map(item => item.id));
  const profileIds = new Set(baziProfileCases.map(item => item.id));

  for (const id of fixtureIds) {
    assert.ok(profileIds.has(id), `${id} should be included in baziprofile gold-cases`);
  }
});

test('SanMing resolver identifies first-batch display-only classical patterns', () => {
  const sanmingPatterns = require('../fixtures/classical-golden-cases/sanming-patterns-high-confidence.json').cases;
  const targetIds = new Set([
    'sm2_pdf_001_chonglu_gengyin',
    'sm2_pdf_002_chonglu_jiashen',
    'sm2_pdf_003_chonglu_xinmao',
    'sm2_pdf_016_tianyuan_anlu_wenyuan',
    'sm2_pdf_017_tianyuan_anlu_panhuang',
    'sm2_pdf_018_tianyuan_anlu_duchayuan',
    'sm2_pdf_019_tianyuan_anlu_fushi',
    'sm2_pdf_020_tianyuan_anlu_zhixian',
    'sm2_pdf_023_liuren_yihuan_jisi',
    'sm2_pdf_024_liuren_yihuan_renqilongbei',
    'sm2_pdf_025_liuren_yihuan_zaohua',
    'sm2_pdf_026_liuren_yihuan_gonggui',
    'sm2_pdf_027_liuren_yihuan_buce',
    'sm2_pdf_028_ziwu_shuangbao_liangwu_liangzi',
    'sm2_pdf_029_ziwu_shuangbao_baowu_1',
    'sm2_pdf_030_ziwu_shuangbao_baowu_2',
    'sm2_pdf_031_ziwu_shuangbao_baowu_3',
    'sm2_pdf_032_ziwu_shuangbao_baozi_1',
  ]);

  const targets = sanmingPatterns.filter(item => targetIds.has(item.id));
  assert.equal(targets.length, targetIds.size);

  for (const item of targets) {
    const result = resolveSanMingPattern({ pillars: item.input.pillars });
    assert.ok(result, `${item.id} should resolve a SanMing display pattern`);
    assert.equal(result.name, item.gold.geju.primary, item.id);
    for (const tag of item.gold.methodTags) {
      assert.ok(result.methodTags.includes(tag), `${item.id} should include method tag ${tag}`);
    }
    assert.equal(result.scoreScope, 'display_only', item.id);
  }
});

test('SanMing resolver does not overmatch three-Wu one-Zi charts as 子午双包', () => {
  const tangTaizong = require('../fixtures/classical-golden-cases/sanming-patterns-high-confidence.json')
    .cases.find(item => item.id === 'sm2_pdf_005_caiguan_shuangmei_taizong');

  const result = resolveSanMingPattern({ pillars: tangTaizong.input.pillars });

  assert.notEqual(result?.name, '子午双包格');
});

test('SanMing resolver identifies all scanned SanMing pattern fixtures as display-only candidates', () => {
  const sanmingPatterns = require('../fixtures/classical-golden-cases/sanming-patterns-high-confidence.json').cases;

  for (const item of sanmingPatterns) {
    const result = resolveSanMingPattern({ pillars: item.input.pillars });
    assert.ok(result, `${item.id} should resolve a SanMing display pattern`);
    assert.equal(result.name, item.gold.geju.primary, item.id);
    for (const alias of item.gold.geju.aliases || []) {
      assert.ok(result.aliases.includes(alias), `${item.id} should include alias ${alias}`);
    }
    for (const tag of item.gold.methodTags) {
      assert.ok(result.methodTags.includes(tag), `${item.id} should include method tag ${tag}`);
    }
    assert.equal(result.scoreScope, 'display_only', item.id);
  }
});
