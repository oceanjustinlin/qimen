#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, runTool, toToolResult } from './tools.mjs';
import { PROMPTS, promptText } from './prompts.mjs';

const MIN_NODE = [22, 12];

// 引擎通过 require(esm) 复用 .mjs 工具函数，需要 Node 22.12+；过低版本给出明确中文提示而不是晦涩的加载错误
export function nodeVersionError(version = process.versions.node) {
  const [major, minor] = String(version).split('.').map(Number);
  const ok = major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok ? null : `xuanxue-mcp 需要 Node.js ${MIN_NODE.join('.')} 或更高版本，当前为 ${version}。请升级 Node 后重试。`;
}

export function createServer() {
  const server = new McpServer({ name: 'xuanxue-mcp', version: '0.1.0' });
  for (const tool of TOOLS) {
    // 注册仅用于 listTools 展示真实 inputSchema；调用由下方自定义 handler 接管
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args) => toToolResult(tool.run(args)),
    );
  }
  for (const prompt of PROMPTS) {
    server.registerPrompt(
      prompt.name,
      { description: prompt.description },
      () => ({
        description: prompt.description,
        messages: [{ role: 'user', content: { type: 'text', text: promptText(prompt) } }],
      }),
    );
  }
  // 自行分发 tools/call：校验失败与未知工具都返回 BAD_JSON 外层，而不是 SDK 默认错误文本
  server.server.setRequestHandler(CallToolRequestSchema, async (req) => (
    toToolResult(runTool(req.params.name, req.params.arguments))
  ));
  return server;
}

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('xuanxue-mcp 已启动（stdio）');
}

const isDirect = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isDirect) {
  const versionError = nodeVersionError();
  if (versionError) {
    console.error(versionError);
    process.exit(1);
  }
  main().catch((err) => {
    console.error('xuanxue-mcp 启动失败：', err && err.message);
    process.exit(1);
  });
}
