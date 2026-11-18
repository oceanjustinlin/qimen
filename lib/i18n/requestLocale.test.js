'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveRequestLocale, localeCacheSuffix } = require('./requestLocale');
const { inferErrorCode, apiError, quotaError, ERROR_CODES } = require('./serverMessages');

test('resolveRequestLocale：繁体共用简体内容，未知值归简体', () => {
  assert.deepEqual(resolveRequestLocale({ bodyLocale: 'zh-TW' }), { uiLocale: 'zh-TW', contentLocale: 'zh-CN' });
  assert.deepEqual(resolveRequestLocale({ bodyLocale: 'en' }), { uiLocale: 'en-US', contentLocale: 'en-US' });
  assert.deepEqual(resolveRequestLocale({ queryLocale: 'en-US' }), { uiLocale: 'en-US', contentLocale: 'en-US' });
  assert.deepEqual(resolveRequestLocale({}), { uiLocale: 'zh-CN', contentLocale: 'zh-CN' });
  assert.deepEqual(resolveRequestLocale({ bodyLocale: 'fr' }), { uiLocale: 'zh-CN', contentLocale: 'zh-CN' });
  assert.deepEqual(resolveRequestLocale(), { uiLocale: 'zh-CN', contentLocale: 'zh-CN' });
});

test('localeCacheSuffix：简体键不变', () => {
  assert.equal(localeCacheSuffix('zh-CN'), '');
  assert.equal(localeCacheSuffix(undefined), '');
  assert.equal(localeCacheSuffix('en-US'), '::en-US');
});

test('错误 code 推断与构造', () => {
  assert.equal(inferErrorCode('Method not allowed', 405), 'METHOD_NOT_ALLOWED');
  assert.equal(inferErrorCode('未登录，请先登录', 401), 'AUTH_REQUIRED');
  assert.equal(inferErrorCode('认证失败', 401), 'AUTH_FAILED');
  assert.equal(inferErrorCode('档案不存在', 404), 'PROFILE_NOT_FOUND');
  assert.equal(inferErrorCode('今日 2 次占卜额度已用尽，请明日再来', 403), 'QUOTA_EXCEEDED');
  assert.equal(inferErrorCode('问题不能为空', 400), 'BAD_REQUEST');
  assert.equal(inferErrorCode('云端月运推演失败', 500), 'ENGINE_FAILED');
  assert.equal(inferErrorCode('Not Found', 404), 'NOT_FOUND');
  assert.deepEqual(apiError('AUTH_REQUIRED', { status: 401 }), { body: { error: '未登录，请先登录', code: 'AUTH_REQUIRED' }, status: 401 });
  const q = quotaError('额度已用尽');
  assert.equal(q.code, 'QUOTA_EXCEEDED');
  assert.equal(q.status, 403);
});

test('Worker 不再用文案判断额度；json 错误统一带 code', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../worker/src/index.js'), 'utf8');
  assert.doesNotMatch(src, /includes\(['"]额度['"]\)/);
  assert.match(src, /serverMessages\.inferErrorCode\(payload\.error, init\.status\)/);
});

test('en-US 词条覆盖全部错误 code', async () => {
  const { default: enUS } = await import('../../src/i18n/locales/en-US.mjs');
  for (const code of ERROR_CODES) assert.ok(enUS.error?.[code], code);
});
