'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOutputLanguageBlock, buildUserLanguageReminder, appendOutputLanguage } = require('./outputLanguage');
const { buildQimenSystemPrompt } = require('../qimenPromptSections');

test('简体返回空串', () => {
  assert.equal(buildOutputLanguageBlock(), '');
  assert.equal(buildOutputLanguageBlock('zh-CN'), '');
  assert.equal(buildUserLanguageReminder('zh-CN'), '');
  assert.equal(appendOutputLanguage('abc'), 'abc');
});

test('英文块固定、无变量残留、含关键约定、长度受控', () => {
  const a = buildOutputLanguageBlock('en-US');
  assert.equal(a, buildOutputLanguageBlock('en-US'));
  assert.doesNotMatch(a, /\$\{/);
  for (const s of ['<<<SEC:', 'positive', 'mixed', 'warning', 'Open Door (开门)', '0.6']) assert.ok(a.includes(s), s);
  assert.ok(a.length < 7500, String(a.length)); // g2 术语表加了格局子类与神煞意译，约 2k token，走前缀缓存
  assert.equal(buildUserLanguageReminder('en-US'), 'Respond in English.');
});

test('奇门 system prompt：简体逐字不变，英文以语言块结尾且简体是其前缀', () => {
  const zh = buildQimenSystemPrompt();
  assert.equal(zh, buildQimenSystemPrompt('zh-CN'));
  const en = buildQimenSystemPrompt('en-US');
  assert.ok(en.startsWith(zh));
  assert.ok(en.endsWith(buildOutputLanguageBlock('en-US')));
});
