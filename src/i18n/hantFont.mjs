// 繁体字体：进入 zh-TW 时插入 Noto Serif TC 的样式表（权重与现有 SC 相同），简体与英文下不请求。
export const HANT_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&display=swap';
const LINK_ID = 'font-noto-serif-tc';

export function ensureHantFont(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(LINK_ID)) return false;
  const link = doc.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = HANT_FONT_HREF;
  doc.head.appendChild(link);
  return true;
}
