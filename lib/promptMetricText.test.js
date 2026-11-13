const test = require('node:test');
const assert = require('node:assert/strict');
const { qualifyPromptMetrics } = require('./promptMetricText');

test('qualifyPromptMetrics 把内部数值改成定性档位', () => {
  const input = [
    '  · [大运·透干引动] 目标时柱｜机制强度65｜命主状态65%（承接较强）｜壬透干',
    '午与日柱未半三合（合力未满）（机制强度 9）',
    '【大运分析】壬戌（冠带，命主状态 0.25）',
    '日主身弱，综合强度2.6/10，内部细分为偏弱。',
    '形象判断：从财格，匹配度53.94%（未成象），仅作形象展示。',
    '金势偏旺为病（占比39%）',
    '1. 2028年 戊申（大运 壬戌）：候选强度 strong，排序分 87.5，事件类型 marriage',
    '【形象岁运诊断】status: neutral；score_delta: 0；text: 无；reason_codes: A_1, B_2',
  ].join('\n');
  const out = qualifyPromptMetrics(input);
  assert.match(out, /机制力度中等｜命主承接较强｜壬透干/);
  assert.match(out, /机制力度偏弱/);
  assert.match(out, /命主承接偏弱/);
  assert.match(out, /日主力量偏弱/);
  assert.match(out, /匹配度一般/);
  assert.match(out, /占比较高/);
  assert.doesNotMatch(out, /机制强度|命主状态|综合强度|排序分|score_delta|reason_codes|\d+(\.\d+)?%|\/10/);
  // 年份、干支等不受影响
  assert.match(out, /2028年 戊申/);
});

test('qualifyPromptMetrics 不动字数要求', () => {
  const input = 'summary.basis：80-160字；title ≤16字';
  assert.equal(qualifyPromptMetrics(input), input);
});
