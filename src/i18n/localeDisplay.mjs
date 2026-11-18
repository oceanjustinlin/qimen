// 语言的展示层副作用：<html lang>、繁体字体、整页简转繁、标题与 meta。
// 语言与主题互不读取：这里只写 lang，不碰 data-theme。
// 繁体相关模块（转换器、DOM 观察器、字体）全部懒加载，简体与英文用户不下载。
import { watch } from 'vue';

let hant = null; // { toHantSync, startHantDom }
let stopHant = null;
let currentLocale = 'zh-CN';

// 标题、description、og 标签、Canvas 文字等不在 DOM 文本里的字符串，显式过一遍。
export function displayText(text) {
  if (currentLocale === 'zh-TW' && hant) return hant.toHantSync(text);
  return text;
}

export async function prepareLocale(locale) {
  if (locale !== 'zh-TW' || hant) return;
  const [hantMod, domMod, fontMod] = await Promise.all([
    import('./hant.mjs'),
    import('./hantDom.mjs'),
    import('./hantFont.mjs'),
  ]);
  fontMod.ensureHantFont();
  await hantMod.loadHantConverter();
  hant = { toHantSync: hantMod.toHantSync, startHantDom: domMod.startHantDom };
}

async function apply(locale, onChange) {
  currentLocale = locale;
  if (globalThis.document) document.documentElement.lang = locale;
  if (locale === 'zh-TW') {
    try {
      await prepareLocale(locale);
    } catch (err) {
      console.warn('[i18n] zh-TW converter failed to load; showing Simplified for now', err);
      return;
    }
    if (currentLocale !== 'zh-TW') return; // 加载期间又切走了
    if (!stopHant) stopHant = hant.startHantDom(document.body, hant.toHantSync);
  } else if (stopHant) {
    stopHant();
    stopHant = null;
  }
  onChange?.(locale);
}

export function installLocaleDisplay(i18n, { onChange } = {}) {
  return watch(
    () => i18n.global.locale.value,
    (locale) => { apply(locale, onChange); },
    { immediate: true },
  );
}
