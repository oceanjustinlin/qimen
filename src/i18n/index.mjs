import { createI18n as createVueI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.mjs';
import enUS from './locales/en-US.mjs';

export const DEFAULT_LOCALE = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'qimen-locale';
export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US'];
// 上线开关：菜单里能切到的语言。M1 繁體上线时为 zh-CN + zh-TW；M3 加入 en-US（2026-11-18 Justin 拍板跳过评测直接开放）。
// 浏览器语言为英文且没手动选过的访客，首次进入即为英文。
export const ENABLED_LOCALES = ['zh-CN', 'zh-TW', 'en-US'];

// 每种语言的自称，不翻译。
export const LOCALE_NATIVE_NAMES = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
};

const HANS_TAGS = new Set(['zh', 'zh-cn', 'zh-hans', 'zh-sg', 'zh-hans-cn', 'zh-hans-sg', 'zh-my']);
const HANT_TAGS = new Set(['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant', 'zh-hant-tw', 'zh-hant-hk', 'zh-hant-mo']);

// 繁体没有自己的词条：界面文字用简体词条，再由展示层整页转繁。
const messages = {
  'zh-CN': zhCN,
  'zh-TW': zhCN,
  'en-US': enUS,
};

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

export function normalizeLocale(input) {
  if (!input || typeof input !== 'string') return DEFAULT_LOCALE;
  const tag = input.trim().replace(/_/g, '-').toLowerCase();
  if (!tag) return DEFAULT_LOCALE;
  if (HANS_TAGS.has(tag)) return 'zh-CN';
  if (HANT_TAGS.has(tag)) return 'zh-TW';
  if (tag.startsWith('zh-hant')) return 'zh-TW';
  if (tag.startsWith('zh-hans')) return 'zh-CN';
  if (tag === 'en' || tag.startsWith('en-')) return 'en-US';
  return DEFAULT_LOCALE;
}

// 内容语言：内容实际以什么语言生成和存储。繁体共用简体内容。
export function contentLocaleOf(uiLocale) {
  return normalizeLocale(uiLocale) === 'en-US' ? 'en-US' : 'zh-CN';
}

function readQueryLocale() {
  try {
    const search = globalThis.location?.search;
    if (!search) return null;
    return new URLSearchParams(search).get('locale');
  } catch {
    return null;
  }
}

function readPersistedLocale() {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readBrowserLocale() {
  return globalThis.navigator?.language || null;
}

// 顺序：?locale= 查询串 → localStorage → navigator.language → zh-CN。
// 结果不在 ENABLED_LOCALES 内且不是来自查询串时回落到 zh-CN。
export function getInitialLocale(enabled = ENABLED_LOCALES) {
  const fromQuery = readQueryLocale();
  if (fromQuery) return normalizeLocale(fromQuery);
  const candidate = normalizeLocale(readPersistedLocale() || readBrowserLocale());
  return enabled.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

export function persistLocale(locale) {
  const normalizedLocale = normalizeLocale(locale);
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, normalizedLocale);
  } catch {
    // 隐私模式或测试环境里写不进去，忽略。
  }
  return normalizedLocale;
}

// 菜单单击循环：按 enabled 的顺序取下一个；当前语言不在列表里（查询串强制进入）时回到第一个。
export function nextLocale(current, enabled = ENABLED_LOCALES) {
  if (!enabled.length) return DEFAULT_LOCALE;
  const idx = enabled.indexOf(normalizeLocale(current));
  if (idx < 0) return enabled[0];
  return enabled[(idx + 1) % enabled.length];
}

function applyDocumentLang(locale) {
  const root = globalThis.document?.documentElement;
  if (root) root.lang = locale;
}

export function createI18n(locale = getInitialLocale()) {
  return createVueI18n({
    legacy: false,
    globalInjection: true,
    locale: normalizeLocale(locale),
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  });
}

const i18n = createI18n();

// 归一 → 写 localStorage → 改 i18n.global.locale → 写 <html lang> → 返回归一值
export function setLocale(input, instance = i18n) {
  const locale = persistLocale(input);
  instance.global.locale.value = locale;
  applyDocumentLang(locale);
  return locale;
}

export function currentLocale(instance = i18n) {
  return instance.global.locale.value;
}

export default i18n;
