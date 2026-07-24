/**
 * eval/bazi-skill/llm.mjs — 共享 headless LLM 调用（OpenAI 兼容 endpoint）。
 * 复用 gemini-flash-accuracy 约定：GEMINI_API_KEY + yinli.one。Phase 0/1 共用。
 */

const API_KEY = process.env.GEMINI_API_KEY;
export const EVAL_MODEL = process.env.EVAL_MODEL || 'gemini-3-flash-preview';
const LLM_API_URL = process.env.LLM_API_URL || 'https://yinli.one/v1/chat/completions';
export const LLM_AVAILABLE = Boolean(API_KEY);

export async function callLLM(prompt, { maxRetries = Number(process.env.LLM_MAX_RETRIES) || 4 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const resp = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: EVAL_MODEL, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text.trim()) throw new Error('empty content');
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function parseJsonLoose(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no json in: ${text.slice(0, 120)}`);
  return JSON.parse(m[0]);
}
