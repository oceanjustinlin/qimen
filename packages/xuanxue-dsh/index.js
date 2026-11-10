// xuanxue-dsh：把 xuanxue-mcp 的四份解读守则注册为 dsh skill。
// 工具本身由 cordis.patch.yml 里的 dsh-mcp-client 行接入，这里只负责 skill。
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'xuanxue-skills';
export const inject = ['skills'];

// 与 cordis.patch.yml 的 serverName 一致；dsh 把 MCP 工具命名为 mcp__<serverName>__<tool>
export const SERVER_NAME = 'xuanxue';
const TOOL_NAMES = ['bazi', 'ziwei', 'qimen', 'astro', 'calendar'];

export const SKILLS = [
  {
    name: 'xuanxue-bazi',
    file: 'bazi_reading.md',
    description: '四柱八字排盘与解读守则：访谈生辰、调用 bazi 工具、按引擎结果解读命局与问事（AI 不心算排盘）',
    whenToUse: '用户提到八字、四柱、日主、十神、喜用神、格局、大运流年，或想用八字看性格、事业、财运、婚姻、某件事的应期',
  },
  {
    name: 'xuanxue-ziwei',
    file: 'ziwei_reading.md',
    description: '紫微斗数排盘与解读守则：访谈生辰、调用 ziwei 工具、按十二宫、主星、四化与证据分级解读（AI 不心算安星）',
    whenToUse: '用户提到紫微斗数、命盘十二宫、命宫身宫、主星、四化、大限流年',
  },
  {
    name: 'xuanxue-qimen',
    file: 'qimen_reading.md',
    description: '时家奇门起局与解读守则：确认所问之事、调用 qimen 工具、按用神宫与格局判断成败、时机、方位（AI 不心算起局）',
    whenToUse: '用户问具体一件事能不能成、何时动、往哪个方向，或明确提到奇门遁甲、奇门排盘',
  },
  {
    name: 'xuanxue-astro',
    file: 'astro_reading.md',
    description: '西洋占星本命盘（星盘）解读守则：访谈出生时间地点、调用 astro 工具、按行星落座落宫、宫位与相位解读（AI 不心算行星位置）',
    whenToUse: '用户提到星盘、本命盘、西洋占星、星座、太阳月亮上升、宫位、相位',
  },
];

// 发布后读包内 prompts/（prepack 复制），开发时退回同仓库的 xuanxue-mcp/prompts/
function promptsDir() {
  const packed = new URL('./prompts/', import.meta.url);
  if (existsSync(fileURLToPath(new URL('common.md', packed)))) return packed;
  return new URL('../xuanxue-mcp/prompts/', import.meta.url);
}

// 守则正文按 MCP 客户端写，工具名是 bazi、ziwei…；在 dsh 里要补一段工具名对照
function toolNameNote() {
  const rows = TOOL_NAMES.map((t) => `\`${t}\` → \`mcp__${SERVER_NAME}__${t}\``).join('，');
  return [
    '> 在 DeepSeek Harness 中，下文提到的工具名对应：' + rows + '。',
    '> 这些工具由 xuanxue-mcp 提供；若工具列表里没有它们，说明 MCP 服务未启动，应如实告诉用户，不要心算排盘。',
  ].join('\n');
}

export function skillContent(skill, dir = promptsDir()) {
  const read = (f) => readFileSync(new URL(f, dir), 'utf8').trim();
  return `${toolNameNote()}\n\n${read('common.md')}\n\n---\n\n${read(skill.file)}\n`;
}

export function apply(ctx) {
  const dir = promptsDir();
  for (const skill of SKILLS) {
    ctx.skills.register({
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      source: 'bundled',
      content: skillContent(skill, dir),
    });
  }
}
