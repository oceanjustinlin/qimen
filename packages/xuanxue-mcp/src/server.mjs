#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TOOLS, toToolResult } from './tools.mjs';

export function createServer() {
  const server = new McpServer({ name: 'xuanxue-mcp', version: '0.1.0' });
  // 入参由 tools.mjs 自行 safeParse 并返回 BAD_JSON 外层；
  // 这里跳过 SDK 自带校验，避免客户端收到 SDK 默认的错误文本（inputSchema 仍用于 listTools 展示）
  server.validateToolInput = async (_tool, args) => args ?? {};
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args) => toToolResult(tool.run(args)),
    );
  }
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
  main().catch((err) => {
    console.error('xuanxue-mcp 启动失败：', err && err.message);
    process.exit(1);
  });
}
