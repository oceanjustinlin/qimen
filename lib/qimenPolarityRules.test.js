const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPolarityPromptSection,
  detectPolarityOverrides
} = require('./qimenPolarityRules');

test('polarity prompt is empty when no override matches', () => {
  const overrides = detectPolarityOverrides({
    intent: { category: 'career_business', subcategory: 'job_search' },
    palaces: [
      { name: '乾6宫', door: '开门', god: '值符', star: '天心', sky: '壬', earth: '戊' }
    ]
  });

  assert.deepEqual(overrides, []);
  assert.equal(buildPolarityPromptSection(overrides), '');
});

test('sports competition flips hurt door and white tiger into positive with risk', () => {
  const overrides = detectPolarityOverrides({
    intent: { category: 'health_action', subcategory: 'sports_competition' },
    palaces: [
      { name: '兑7宫', door: '伤门', god: '白虎', star: '天冲', sky: '庚', earth: '丙' }
    ]
  });

  const hurtTiger = overrides.find((override) => override.signal === '伤门+白虎');
  assert.ok(hurtTiger);
  assert.equal(hurtTiger.domain_polarity, 'positive_with_risk');
  assert.equal(hurtTiger.palace, '兑7宫');

  const section = buildPolarityPromptSection(overrides);
  assert.match(section, /格局极性翻转表命中/);
  assert.match(section, /不要把命中信号机械判为纯凶/);
  assert.doesNotMatch(section, /score_audit\.adjustments|建议分值处理/);
  assert.match(section, /用神卡片里相关卡的 evidence 和 tone/);
  assert.match(section, /有利面与风险面/);
  assert.doesNotMatch(section, /后端|工程指标|扣分/);
  assert.doesNotMatch(section, /domain_view/);
});

test('medical health keeps hurt door and white tiger as warning', () => {
  const overrides = detectPolarityOverrides({
    intent: { category: 'health_action', subcategory: 'medical_diagnosis' },
    palaces: [
      { name: '兑7宫', door: '伤门', god: '白虎', star: '天冲', sky: '庚', earth: '丙' }
    ]
  });

  const hurtTiger = overrides.find((override) => override.signal === '伤门+白虎');
  assert.ok(hurtTiger);
  assert.equal(hurtTiger.domain_polarity, 'warning');
});

test('debt repayment treats hurt door as useful pressure', () => {
  const overrides = detectPolarityOverrides({
    intent: { category: 'finance_wealth', subcategory: 'debt_repayment' },
    palaces: [
      { name: '震3宫', door: '伤门', god: '六合', star: '天冲', sky: '壬', earth: '戊' }
    ]
  });

  assert.equal(overrides.length, 1);
  assert.equal(overrides[0].signal, '伤门');
  assert.equal(overrides[0].domain_polarity, 'positive_with_risk');
});

test('privacy and technical work can use du door as protection', () => {
  const overrides = detectPolarityOverrides({
    intent: { category: 'career_business', subcategory: 'project_business' },
    palaces: [
      { name: '艮8宫', door: '杜门', god: '九地', star: '天辅', sky: '丁', earth: '己' }
    ]
  });

  assert.equal(overrides.length, 1);
  assert.equal(overrides[0].signal, '杜门');
  assert.equal(overrides[0].domain_polarity, 'mixed_or_positive');
});

test('jing door supports lawsuits and public speaking but warns ordinary plans', () => {
  const lawsuitOverrides = detectPolarityOverrides({
    intent: { category: 'lawsuit_legal', subcategory: 'civil_lawsuit' },
    palaces: [
      { name: '离9宫', door: '惊门', god: '腾蛇', star: '天英', sky: '辛', earth: '乙' }
    ]
  });

  assert.equal(lawsuitOverrides[0].signal, '惊门');
  assert.equal(lawsuitOverrides[0].domain_polarity, 'positive_with_risk');

  const generalOverrides = detectPolarityOverrides({
    intent: { category: 'general', subcategory: '' },
    palaces: [
      { name: '离9宫', door: '惊门', god: '腾蛇', star: '天英', sky: '辛', earth: '乙' }
    ]
  });

  assert.equal(generalOverrides[0].domain_polarity, 'warning');
});

test('xuanwu flips by investigation context but warns relationship secrecy', () => {
  const investigationOverrides = detectPolarityOverrides({
    intent: { category: 'item_transaction', subcategory: 'stolen_item' },
    palaces: [
      { name: '坎1宫', door: '休门', god: '玄武', star: '天蓬', sky: '癸', earth: '辛' }
    ]
  });

  assert.equal(investigationOverrides[0].signal, '玄武');
  assert.equal(investigationOverrides[0].domain_polarity, 'mixed_or_positive');

  const relationshipOverrides = detectPolarityOverrides({
    intent: { category: 'relationship', subcategory: 'online_romance' },
    palaces: [
      { name: '坎1宫', door: '休门', god: '玄武', star: '天蓬', sky: '癸', earth: '辛' }
    ]
  });

  assert.equal(relationshipOverrides[0].domain_polarity, 'warning');
});

test('heavenly stem combinations support contextual flips', () => {
  const illnessEscape = detectPolarityOverrides({
    intent: { category: 'health_action', subcategory: 'medical_diagnosis' },
    palaces: [
      { name: '巽4宫', door: '生门', god: '六合', star: '天辅', sky: '乙', earth: '辛' }
    ]
  });

  assert.equal(illnessEscape[0].signal, '乙+辛');
  assert.equal(illnessEscape[0].domain_polarity, 'positive_with_risk');

  const moneyComes = detectPolarityOverrides({
    intent: { category: 'finance_wealth', subcategory: 'trade_buy_sell' },
    palaces: [
      { name: '兑7宫', door: '开门', god: '九天', star: '天柱', sky: '庚', earth: '丙' }
    ]
  });

  assert.equal(moneyComes[0].signal, '庚+丙');
  assert.equal(moneyComes[0].domain_polarity, 'positive_with_risk');

  const diseaseLeaves = detectPolarityOverrides({
    intent: { category: 'health_action', subcategory: 'medical_diagnosis' },
    palaces: [
      { name: '乾6宫', door: '休门', god: '太阴', star: '天心', sky: '丙', earth: '庚' }
    ]
  });

  assert.equal(diseaseLeaves[0].signal, '丙+庚');
  assert.equal(diseaseLeaves[0].domain_polarity, 'positive_with_risk');
});

test('kong wang can be favorable when the bad thing falls empty', () => {
  const penaltyOverrides = detectPolarityOverrides({
    intent: { category: 'lawsuit_legal', subcategory: 'criminal_case' },
    palaces: [
      { name: '坤2宫', door: '死门', god: '白虎', star: '天芮', sky: '辛', earth: '癸', isKong: true }
    ]
  });

  assert.ok(penaltyOverrides.some((override) => override.signal === '空亡'));
  assert.ok(penaltyOverrides.some((override) => override.domain_polarity === 'mixed_or_positive'));
});
