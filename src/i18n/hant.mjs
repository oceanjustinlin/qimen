// 简转繁（i18n spec T1.1）。OpenCC 的 cn → tw 字典约 450 KB（gzip），只在繁体下懒加载。
// 转换管线：先过命理保护词表（lib/i18n/hantProtect.js），其余文字交给 OpenCC。
// 保护词表与 OpenCC 一起懒加载，主入口 chunk 不含它们。
let convertWithProtect = null;

const CJK = /[\u3400-\u9fff]/;
const CACHE_LIMIT = 4000;

let openccConvert = null;
let loading = null;
const cache = new Map();

function remember(input, output) {
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(input, output);
  return output;
}

function convertNow(text) {
  if (typeof text !== 'string' || !text || !CJK.test(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  return remember(text, convertWithProtect(text, openccConvert));
}

// 测试与预渲染用：直接注入通用转换函数（如 opencc 的 Converter），跳过动态加载。
export async function installHantConverter(convert) {
  await loadProtect();
  openccConvert = convert;
  cache.clear();
  return convertNow;
}

async function loadProtect() {
  if (convertWithProtect) return;
  const mod = await import('../../lib/i18n/hantProtect.js');
  convertWithProtect = (mod.default || mod).convertWithProtect;
}

export async function loadHantConverter() {
  if (openccConvert) return convertNow;
  if (!loading) {
    loading = Promise.all([import('opencc-js/cn2t'), loadProtect()])
      .then(([OpenCC]) => {
        const mod = OpenCC.Converter ? OpenCC : OpenCC.default;
        openccConvert = mod.Converter({ from: 'cn', to: 'tw' });
        cache.clear();
        return convertNow;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

// 转换器未就绪时原样返回，不抛错。
export function toHantSync(text) {
  if (!openccConvert) return text;
  return convertNow(text);
}

export function isHantReady() {
  return Boolean(openccConvert);
}
