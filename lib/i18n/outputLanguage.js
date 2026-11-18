'use strict';
// LLM 输出语言块（i18n spec T3.2 / §5.6）。
// prompt 主体保持中文；英文请求只在 system prompt（或单段 prompt）末尾追加下面的固定英文块，
// 简体返回空串，保证简体 prompt 与改造前逐字相同、DeepSeek 前缀缓存可复用。
// 块内只有常量与术语表，不含任何请求相关变量（连续生成两次逐字相同）。

const glossary = require('./glossary');

const OUTPUT_LANGUAGE_BLOCK_VERSION = 'ol1';

const RULES = [
  `## Output language (${OUTPUT_LANGUAGE_BLOCK_VERSION})`,
  'The instructions above are written in Chinese. Follow every rule above, but write everything the user will read in natural, plain English.',
  '- Keep all structural markers exactly as specified: section sentinels such as <<<SEC:...>>>, JSON keys, field names and enum values (for example positive | mixed | warning) must stay untranslated.',
  '- The first time a technical term appears, write it as English (汉字), for example Open Door (开门), Zhen 3 (震3宫), Seven Killings (七杀). After that, use the English name only.',
  '- Length limits above are given in Chinese characters. Convert them to English words at about 0.6 words per character (N characters ≈ 0.6 N words). Titles are 4–9 words.',
  '- Examples above are in Chinese. Learn their structure, tone and level of certainty only; your output is still in English.',
  '- The rule against absolute claims applies in English too: never write will definitely, guaranteed, certainly or 100%.',
  '- Never mention internal words such as backend, system, engine, model, prompt, pre-score or score of.',
  '- Chart symbols (stems, branches, palaces, doors, stars, deities) keep their Chinese characters inside parentheses only; do not write whole sentences in Chinese.',
].join('\n');

let cachedBlock = null;

/** zh-CN（及缺省）→ ''；en-US → 固定英文块 + 术语对照。 */
function buildOutputLanguageBlock(contentLocale = 'zh-CN') {
  if (contentLocale !== 'en-US') return '';
  if (cachedBlock === null) cachedBlock = `${RULES}\n\n${glossary.buildPromptGlossaryBlock()}`;
  return cachedBlock;
}

/** user prompt 最后一行的提醒：zh-CN → ''；en-US → 'Respond in English.' */
function buildUserLanguageReminder(contentLocale = 'zh-CN') {
  return contentLocale === 'en-US' ? 'Respond in English.' : '';
}

/** 在 prompt 文本末尾追加语言块；简体原样返回。 */
function appendOutputLanguage(prompt, contentLocale = 'zh-CN') {
  const block = buildOutputLanguageBlock(contentLocale);
  if (!block) return prompt;
  return `${prompt}\n\n${block}`;
}

module.exports = {
  OUTPUT_LANGUAGE_BLOCK_VERSION,
  buildOutputLanguageBlock,
  buildUserLanguageReminder,
  appendOutputLanguage,
};
