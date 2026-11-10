// prepack：把 xuanxue-mcp/prompts/ 复制进本包，发布后的 skill 正文与 MCP prompts 同源
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../xuanxue-mcp/prompts/', import.meta.url));
const out = fileURLToPath(new URL('../prompts/', import.meta.url));
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
console.log('xuanxue-dsh prepack：已复制 prompts/');
