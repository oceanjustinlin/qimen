'use strict';
// 输出语言校验（i18n spec T3.3）。英文请求下检查模型正文是否真的是英文；中文请求不校验。
// 括号里的汉字是允许的术语对照（如 `Open Door (开门)`），计算前先去掉。

const CJK_RE = /[㐀-鿿豈-﫿　-〿＀-￯]/g;
const LATIN_RE = /[A-Za-z]/g;
const PAREN_RE = /\([^()]*\)|（[^（）]*）|【[^【】]*】|「[^「」]*」/g;

function stripParens(text) {
  return String(text || '').replace(PAREN_RE, ' ');
}

/** 去掉括号内容后：CJK 字符数 / 非空白字符数 */
function cjkRatio(text) {
  const body = stripParens(text).replace(/\s+/g, '');
  if (!body) return 0;
  return (body.match(CJK_RE) || []).length / body.length;
}

function latinRatio(text) {
  const body = stripParens(text).replace(/\s+/g, '');
  if (!body) return 0;
  return (body.match(LATIN_RE) || []).length / body.length;
}

function proseMatchesLocale(text, contentLocale, { maxCjkRatio = 0.15, minLatinRatio = 0.5 } = {}) {
  if (contentLocale !== 'en-US') return true;
  const body = stripParens(text).replace(/\s+/g, '');
  if (!body) return true; // 空段交给结构校验处理
  return cjkRatio(text) <= maxCjkRatio && latinRatio(text) >= minLatinRatio;
}

/** 多段正文：任一段不匹配即 false。接受数组或 { key: text } 对象 */
function sectionsMatchLocale(sections, contentLocale, opts) {
  if (contentLocale !== 'en-US') return true;
  const list = Array.isArray(sections) ? sections : Object.values(sections || {});
  return list.every((t) => typeof t !== 'string' || proseMatchesLocale(t, contentLocale, opts));
}

/** JSON 结果：收集所有字符串叶子（跳过枚举类短值与 key） */
function collectProse(value, out = []) {
  if (typeof value === 'string') {
    if (value.trim().length >= 8) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectProse(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectProse(v, out));
  }
  return out;
}

function jsonMatchesLocale(value, contentLocale, opts) {
  if (contentLocale !== 'en-US') return true;
  return sectionsMatchLocale(collectProse(value), contentLocale, opts);
}

/**
 * 英文请求下：第一次结果不是目标语言就再调一次；仍不对照常返回并标 mixed。中文请求只调一次、不校验。
 * call(attempt) → Promise<result>；isOk(result) → boolean
 */
async function withLocaleRetry(call, { contentLocale, isOk = (r) => jsonMatchesLocale(r, contentLocale) } = {}) {
  const first = await call(0);
  if (contentLocale !== 'en-US' || isOk(first)) return { result: first, mixed: false, attempts: 1 };
  const second = await call(1);
  return { result: second, mixed: !isOk(second), attempts: 2 };
}

module.exports = { withLocaleRetry, cjkRatio, proseMatchesLocale, sectionsMatchLocale, jsonMatchesLocale, collectProse };
