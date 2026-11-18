'use strict';
// T3.2 / T3.5：Worker 里每个出正文的 prompt 都要接上输出语言块；中文路径不变。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scoreLogicFallback } = require('./serverMessages.js');

const src = fs.readFileSync(path.join(__dirname, '../../worker/src/index.js'), 'utf8');

test('出正文的 prompt 构造都包在 appendOutputLanguage 里', () => {
  for (const builder of ['buildFollowupPatchPrompt', 'buildBaziFollowupPrompt', 'buildBaziProfileSectionPrompt']) {
    const re = new RegExp(`appendOutputLanguage\\(${builder}\\(`);
    assert.match(src, re, `${builder} 未接输出语言块`);
  }
  // 八字问事 / 纠偏 / 日运 / 月运：至少 4 处直接包 prompt 变量
  const wraps = src.match(/outputLanguage\.appendOutputLanguage\(/g) || [];
  assert.ok(wraps.length >= 7, `appendOutputLanguage 调用只有 ${wraps.length} 处`);
});

test('追问语言跟原报告：取 origin.output_locale', () => {
  const hits = src.match(/bodyLocale: body\?\.originLocale \|\| origin\.output_locale/g) || [];
  assert.equal(hits.length, 2);
});

test('结果带 output_locale：奇门、八字问事、日运、月运', () => {
  assert.match(src, /finalOutput\.output_locale = contentLocale/);
  assert.match(src, /subject_snapshot,\n\s*output_locale: contentLocale/);
  assert.equal((src.match(/output_locale: contentLocale, \.\.\.\(mixed \? \{ output_locale_actual: 'mixed' \}/g) || []).length, 2);
});

test('score_logic 缺省句：中文与旧句逐字一致，英文无汉字', () => {
  assert.equal(scoreLogicFallback(80, 'zh-CN'), '综合用神状态、主客关系、空亡与应期后，本局落在偏有利区间。');
  assert.equal(scoreLogicFallback(65), '综合用神状态、主客关系、空亡与应期后，本局落在中等可观察区间。');
  assert.equal(scoreLogicFallback(10, 'zh-CN'), '综合用神状态、主客关系、空亡与应期后，本局落在明显谨慎区间。');
  const en = scoreLogicFallback(45, 'en-US');
  assert.match(en, /leaning cautious/);
  assert.doesNotMatch(en, /[一-鿿]/);
});

test('Worker 不再内联中文缺省句', () => {
  assert.doesNotMatch(src, /本局落在\$\{/);
});

test('T3.3 英文校验接入：奇门、八字问事、两类追问、八字档案、JSON 接口', () => {
  assert.match(src, /qimenSectionsAreBad\(sec\) \|\| proseLocaleIsBad\(sec, QIMEN_PROSE_KEYS, contentLocale\)/);
  assert.match(src, /baziSectionsAreBad\(baziSec, _baziMode\) \|\| proseLocaleIsBad\(baziSec, BAZI_PROSE_KEYS, contentLocale\)/);
  assert.match(src, /!hasAny \|\| proseLocaleIsBad\(sec, fr\.target_sections, contentLocale\)/);
  assert.match(src, /proseLocaleIsBad\(supplements, Object\.keys\(supplements\), contentLocale\)/);
  assert.match(src, /proseLocaleIsBad\(llmSections, PROFILE_PROSE_KEYS, contentLocale\)/);
  assert.equal((src.match(/await requestLLMInLocale\(/g) || []).length, 3);
  assert.match(src, /if \(contentLocale !== 'en-US' \|\| !sec\) return false;/);
});
