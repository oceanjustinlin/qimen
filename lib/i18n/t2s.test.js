'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const OpenCC = require('opencc-js/cn2t');

const { toSimplified } = require('./t2s.js');
const { classifyByRules, ruleRouteHint } = require('../divinationRouter.js');

const toHant = OpenCC.Converter({ from: 'cn', to: 'tw' });

test('toSimplified 基本用例', () => {
  assert.equal(toSimplified('這段感情還值得繼續嗎'), '这段感情还值得继续吗');
  assert.equal(toSimplified('臺北'), '台北');
  assert.equal(toSimplified('廈門市思明區'), '厦门市思明区');
  assert.equal(toSimplified('乾宮'), '乾宫'); // 乾 在简体里也是正常用字，不映射
  assert.equal(toSimplified('已经是简体'), '已经是简体');
  assert.equal(toSimplified('offer 2026'), 'offer 2026');
  assert.equal(toSimplified(''), '');
  assert.equal(toSimplified(undefined), undefined);
});

test('t2s.js 体积不超过 40 KB', () => {
  assert.ok(fs.statSync(path.join(__dirname, 't2s.js')).size <= 40 * 1024);
});

// 从现有路由测试里取出全部问题，转成繁体后规则路由结果应与简体一致
function routerQuestions() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'divinationRouter.test.js'), 'utf8');
  const re = /(?:classifyByRules|ruleRouteHint|classifyDivinationQuestion)\(\s*(['"`])((?:(?!\1).)+)\1/g;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) out.add(m[2]);
  // 再加上路由评测集里的问题
  const evalCases = require('../../eval/bazi-skill/route-cases.js');
  const list = Array.isArray(evalCases) ? evalCases : (evalCases.CASES || evalCases.cases || []);
  for (const c of list) if (c.question) out.add(c.question);
  return [...out];
}

test('繁体问题的规则路由与简体一致', () => {
  const questions = routerQuestions();
  assert.ok(questions.length >= 30, `只找到 ${questions.length} 条`);
  let changed = 0;
  for (const q of questions) {
    assert.equal(toSimplified(q), q, `简体输入不应被改写：${q}`);
    const hant = toHant(q);
    if (hant !== q) changed += 1;
    const a = classifyByRules(q);
    const b = classifyByRules(hant);
    for (const key of ['branch', 'category', 'subcategory', 'confidence']) {
      assert.equal(b[key], a[key], `${key}：${q} / ${hant}`);
    }
    const ha = ruleRouteHint(q);
    const hb = ruleRouteHint(hant);
    assert.equal(hb.analysis_mode_hint, ha.analysis_mode_hint, hant);
  }
  assert.ok(changed >= 5, '繁体用例里应有实际变化的问题');
});
