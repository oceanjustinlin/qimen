import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  ENABLED_LOCALES,
  contentLocaleOf,
  createI18n,
  getInitialLocale,
  nextLocale,
  setLocale,
  isSupportedLocale,
  normalizeLocale,
} from './index.mjs';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

afterEach(() => {
  restoreGlobal('localStorage', originalLocalStorage);
  restoreGlobal('navigator', originalNavigator);
});

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}

function mockGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

test('detects and normalizes supported locales', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
  assert.deepEqual(SUPPORTED_LOCALES, ['zh-CN', 'zh-TW', 'en-US']);
  assert.equal(isSupportedLocale('en-US'), true);
  assert.equal(isSupportedLocale('fr-FR'), false);
  assert.equal(normalizeLocale('en'), 'en-US');
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('fr-FR'), 'zh-CN');
});

test('uses persisted locale before browser locale', () => {
  mockGlobal('localStorage', {
    getItem(key) {
      return key === 'qimen-locale' ? 'en-US' : null;
    },
  });
  mockGlobal('navigator', { language: 'zh-CN' });

  assert.equal(getInitialLocale(['zh-CN', 'zh-TW', 'en-US']), 'en-US');
  // 未开放的语言不会从 localStorage 进入
  assert.equal(getInitialLocale(['zh-CN', 'zh-TW']), 'zh-CN');
});

test('creates an i18n instance with expected messages', () => {
  const i18n = createI18n('en-US');

  assert.equal(i18n.global.locale.value, 'en-US');
  assert.equal(i18n.global.t('nav.qimen'), 'Qimen');
  assert.equal(i18n.global.t('nav.bazi'), 'Bazi');
  assert.equal(i18n.global.t('nav.fortune'), 'Fortune');
});

test('normalizeLocale 归一表', () => {
  const table = {
    'zh-CN': ['zh', 'zh-CN', 'zh-Hans', 'zh-SG', 'zh-Hans-CN', 'zh_CN'],
    'zh-TW': ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh-hant-hk'],
    'en-US': ['en', 'en-US', 'en-GB', 'en-AU', 'EN'],
  };
  for (const [expected, inputs] of Object.entries(table)) {
    for (const input of inputs) assert.equal(normalizeLocale(input), expected, input);
  }
  for (const input of ['fr', 'ja-JP', '', '   ', null, undefined, 42, {}]) {
    assert.equal(normalizeLocale(input), 'zh-CN', String(input));
  }
});

test('contentLocaleOf：繁体共用简体内容', () => {
  assert.equal(contentLocaleOf('zh-CN'), 'zh-CN');
  assert.equal(contentLocaleOf('zh-TW'), 'zh-CN');
  assert.equal(contentLocaleOf('zh-HK'), 'zh-CN');
  assert.equal(contentLocaleOf('en-US'), 'en-US');
  assert.equal(contentLocaleOf(undefined), 'zh-CN');
});

test('setLocale 归一、持久化、改 i18n 与 <html lang>', () => {
  const store = {};
  mockGlobal('localStorage', {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const documentElement = { lang: 'zh-CN' };
  mockGlobal('document', { documentElement });
  try {
    const i18n = createI18n('zh-CN');
    assert.equal(setLocale('zh-HK', i18n), 'zh-TW');
    assert.equal(store['qimen-locale'], 'zh-TW');
    assert.equal(i18n.global.locale.value, 'zh-TW');
    assert.equal(documentElement.lang, 'zh-TW');
    // 繁体词条就是简体词条
    assert.equal(i18n.global.t('nav.bazi'), '八字');
  } finally {
    restoreGlobal('document', originalDocument);
  }
});

test('浏览器语言是英文但英文未开放时回落简体', () => {
  mockGlobal('localStorage', { getItem: () => null });
  mockGlobal('navigator', { language: 'en-GB' });
  assert.equal(getInitialLocale(['zh-CN', 'zh-TW']), 'zh-CN');
  mockGlobal('navigator', { language: 'zh-HK' });
  assert.equal(getInitialLocale(['zh-CN', 'zh-TW']), 'zh-TW');
});

test('查询串 ?locale= 可强制进入未开放的语言', () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  mockGlobal('localStorage', { getItem: () => 'zh-TW' });
  mockGlobal('location', { search: '?mock=qimen&locale=en-US' });
  try {
    assert.equal(getInitialLocale(['zh-CN']), 'en-US');
  } finally {
    restoreGlobal('location', originalLocation);
  }
});

test('nextLocale 按开放顺序循环', () => {
  const all = ['zh-CN', 'zh-TW', 'en-US'];
  let cur = 'zh-CN';
  const seen = [];
  for (let i = 0; i < 3; i += 1) { cur = nextLocale(cur, all); seen.push(cur); }
  assert.deepEqual(seen, ['zh-TW', 'en-US', 'zh-CN']);
  assert.equal(nextLocale('en-US', ['zh-CN', 'zh-TW']), 'zh-CN');
  assert.deepEqual(ENABLED_LOCALES, ['zh-CN', 'zh-TW', 'en-US']);
});
