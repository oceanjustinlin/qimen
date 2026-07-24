/**
 * eval/bazi-skill/reader.mjs — LLM 解读器 arm（headless，需 GEMINI_API_KEY）。
 * 蒸馏自 .claude/skills/bazi/references/reading-guide.md：拿 CLI 的 chart+static，
 * 产出简洁解读，并在末尾附机器可读 <CLAIMS> 块供 extract 抽取（真实 skill 不展示该块）。
 */

import { callLLM } from './llm.mjs';

function compactStatic(s = {}) {
  const fs = s.five_shens || {};
  return {
    geju: s.geju, strong_weak: s.strong_weak,
    yong: fs.yong, xi: fs.xi, ji: fs.ji,
    favorable_gods: s.favorable_gods, unfavorable_gods: s.unfavorable_gods,
  };
}

const READ_PROMPT = (chart, staticBlock) => `你是四柱八字研究者。下面是引擎排好的确定性命盘数据（权威，不可推翻）：
四柱：${chart.bazi_str}　日主：${chart.day_master}
原局决策：${JSON.stringify(compactStatic(staticBlock), null, 0)}

请基于以上数据写一段简洁解读（150-250字）：说明身强弱、格局、喜用忌与性格倾向。
要求：解读结论必须与上面数据一致，不得自行改判身强弱、格局或用神。
末尾另起一行输出机器可读断语（严格 JSON，用神只填十神名）：
<CLAIMS>{"geju":"…","strength":"…","yong":["…"]}</CLAIMS>`;

export async function buildReading({ chart, static: staticBlock }) {
  return callLLM(READ_PROMPT(chart, staticBlock));
}
