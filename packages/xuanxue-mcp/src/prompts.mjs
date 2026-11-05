import { readFileSync } from 'node:fs';

// prompts 目录与 SKILL.md 共用同一份正文，运行时按需读取
const promptsDir = new URL('../prompts/', import.meta.url);

export const PROMPTS = [
  { name: 'bazi_reading', description: '八字解读守则：访谈、调用 bazi 工具、解读顺序与安全措辞（AI 只翻译、不判断）', file: 'bazi_reading.md' },
  { name: 'ziwei_reading', description: '紫微斗数解读守则：访谈、调用 ziwei 工具、读盘次序、证据分级与安全措辞（AI 只翻译、不判断）', file: 'ziwei_reading.md' },
  { name: 'qimen_reading', description: '奇门遁甲解读守则：访谈、调用 qimen 工具、用神宫与格局解读及安全措辞（AI 只翻译、不判断）', file: 'qimen_reading.md' },
];

const read = (file) => readFileSync(new URL(file, promptsDir), 'utf8').trim();

// 正文 = common.md + 体系文件
export function promptText(prompt) {
  return `${read('common.md')}\n\n---\n\n${read(prompt.file)}\n`;
}
