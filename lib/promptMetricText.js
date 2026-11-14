'use strict';

// 把后端证据块里的内部量化数值改写成定性档位，再交给大模型。
// 线上审计（2026-11）：八字回答约 1/3 把“机制强度85”“综合强度2.5/10”“承接65%”原样写给了用户。
// prompt 里“严禁泄漏数值”的约束挡不住——模型没见过数字才不会说出数字。
// 只按关键词匹配改写，不影响字数要求、年份、干支等其他数字。

const num = (value) => Number.parseFloat(value);

function bandStrength(value) {
  const n = num(value);
  if (n >= 70) return '强';
  if (n >= 40) return '中等';
  return '偏弱';
}

function bandVigor(value) {
  let n = num(value);
  if (n <= 1) n *= 100; // 0.65 与 65% 两种写法
  if (n >= 50) return '较强';
  if (n >= 35) return '中等';
  return '偏弱';
}

function bandDayMaster(value) {
  const n = num(value);
  if (n >= 6) return '偏强';
  if (n >= 4) return '中和上下';
  return '偏弱';
}

function bandRatio(value, high, mid) {
  const n = num(value);
  if (n >= high) return '较高';
  if (n >= mid) return '一般';
  return '较低';
}

const NUMBER = '(-?\\d+(?:\\.\\d+)?)';

const RULES = [
  // 机制强度85 / 机制强度 9 / （机制强度 16.9）
  [new RegExp(`机制强度\\s*${NUMBER}`, 'g'), (_, v) => `机制力度${bandStrength(v)}`],
  // 命主状态65%（承接较强） → 命主承接较强（括号里的重复说明一并去掉）
  [new RegExp(`命主状态\\s*${NUMBER}%（承接[^）]*）`, 'g'), (_, v) => `命主承接${bandVigor(v)}`],
  [new RegExp(`命主状态\\s*${NUMBER}%?`, 'g'), (_, v) => `命主承接${bandVigor(v)}`],
  // 综合强度为2.6/10 / 综合强度8.3/10
  [new RegExp(`综合强度为?\\s*${NUMBER}\\s*/\\s*10`, 'g'), (_, v) => `日主力量${bandDayMaster(v)}`],
  // 匹配度53.94%
  [new RegExp(`匹配度\\s*${NUMBER}%`, 'g'), (_, v) => `匹配度${bandRatio(v, 70, 50)}`],
  // 占比39%
  [new RegExp(`占比\\s*${NUMBER}%`, 'g'), (_, v) => `占比${bandRatio(v, 35, 20)}`],
  // 候选年排序用的内部分数
  [new RegExp(`，?排序分\\s*${NUMBER}`, 'g'), () => ''],
  // 形象岁运诊断里的调试字段
  [new RegExp(`[；;]?\\s*score_delta:\\s*${NUMBER}`, 'g'), () => ''],
  [/[；;]?\s*reason_codes:\s*[A-Za-z0-9_,\s]+/g, () => ''],
];

function qualifyPromptMetrics(text) {
  if (typeof text !== 'string' || !text) return text;
  return RULES.reduce((out, [pattern, replacer]) => out.replace(pattern, replacer), text);
}

module.exports = { qualifyPromptMetrics };
