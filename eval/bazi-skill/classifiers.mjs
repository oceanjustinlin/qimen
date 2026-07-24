/**
 * eval/bazi-skill/classifiers.mjs
 * 两个可插拔分类器 arm：
 *   - baseline：确定性、无需 API，立即可跑。
 *       trigger → 关键词启发式；route → 脚本 inferBaziRouteFromQuestion。
 *   - llm：headless 调用（OpenAI 兼容 endpoint，复用 gemini-flash-accuracy 约定）。
 *       需 GEMINI_API_KEY；prompt 由 SKILL.md 的触发范围/路由规则蒸馏而来。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { callLLM, parseJsonLoose, LLM_AVAILABLE as _LLM_AVAILABLE } from './llm.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const { inferBaziRouteFromQuestion, normalizeBaziSemanticRoute } = require(resolve(ROOT, 'lib', 'baziQuestionCore.js'));

// ── time_scope 归一：把引擎 time_scope 映射到数据集标签口径 ────────────────
const SCOPE_TYPES = new Set(['current_year', 'next_3_years', 'next_5_years', 'next_10_years']);
export function normalizeScopeType(timeScope) {
  if (!timeScope) return null;
  const t = timeScope.type;
  if (SCOPE_TYPES.has(t)) return t;
  // 带具体年份的区间 → specific
  if (Number.isFinite(Number(timeScope.start_year)) || Number.isFinite(Number(timeScope.end_year))) return 'specific';
  if (t === 'specific' || t === 'custom' || t === 'range') return 'specific';
  return null;
}

// ── baseline ───────────────────────────────────────────────────────────────
// 八字体系专属线索（含则倾向触发）
const BAZI_CUES = ['八字', '四柱', '日主', '日柱', '天干', '地支', '十神', '大运', '流年', '喜用神', '用神', '喜忌', '格局', '身强', '身弱', '旺衰', '伤官', '食神', '正官', '七杀', '正印', '偏印', '比劫', '五行', '命盘', '命局', '生辰', '合婚', '调候'];
// 其他体系/非命理专属线索（含则倾向不触发本 skill）
const OTHER_EXCLUSIVE = ['紫微', '斗数', '命宫', '主星', '化忌', '大限', '奇门', '遁甲', '起局', '值符', '星座', '上升', '星盘', '塔罗', '黄道吉日'];

export function baselineTrigger(prompt) {
  const hasOther = OTHER_EXCLUSIVE.some((k) => prompt.includes(k));
  const hasBazi = BAZI_CUES.some((k) => prompt.includes(k));
  if (hasOther && !hasBazi) return false;
  return hasBazi;
}

export function baselineRoute(question) {
  const r = normalizeBaziSemanticRoute(inferBaziRouteFromQuestion(question, { branch: 'bazi' }));
  return { analysis_mode: r.analysis_mode || null, time_scope_type: normalizeScopeType(r.time_scope) };
}

// ── llm arm（headless）───────────────────────────────────────────────────────
export const LLM_AVAILABLE = _LLM_AVAILABLE;

const TRIGGER_PROMPT = (prompt) => `你是「四柱八字」技能的触发判定器。仅当用户明确或强暗示要用【八字/四柱】体系分析（排盘、日主旺衰、十神、格局、喜用神、大运流年、合婚等），才应触发。
下列情况【不触发】：用户要用紫微斗数、奇门遁甲、西方占星/星座/塔罗等其他体系；只是闲聊或科普八字原理、找书；与命理无关的日常请求。
用户输入：「${prompt}」
只输出 JSON：{"trigger": true 或 false}`;

const ROUTE_PROMPT = (question) => `你是「四柱八字」技能的分析类型判定器。把问题归到一种 analysis_mode：
- timing：问「何时/哪一年/哪个阶段」会发生、什么时候动（应期）。
- status：问当下/近期这件事的吉凶走势，不强调具体哪一年。
- pattern：问格局、成败、命局结构、身强弱喜忌。
- character：问性格、才性、适合的方向。
再定 time_scope_type（仅 timing/status 需要，其余给 null）：current_year / next_3_years / next_5_years / next_10_years / specific（问句带具体年份）/ null（不限时间）。
问题：「${question}」
只输出 JSON：{"analysis_mode":"...","time_scope_type":"..."}`;

export async function llmTrigger(prompt) {
  const out = parseJsonLoose(await callLLM(TRIGGER_PROMPT(prompt)));
  return Boolean(out.trigger);
}

export async function llmRoute(question) {
  const out = parseJsonLoose(await callLLM(ROUTE_PROMPT(question)));
  const mode = ['timing', 'status', 'pattern', 'character'].includes(out.analysis_mode) ? out.analysis_mode : null;
  let scope = out.time_scope_type;
  if (scope === 'null' || scope === undefined) scope = null;
  return { analysis_mode: mode, time_scope_type: scope };
}
