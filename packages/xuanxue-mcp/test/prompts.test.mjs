import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const promptsDir = new URL('../prompts/', import.meta.url);
const safetyPath = new URL('../../../knowledge/ziwei/policies/safety.yaml', import.meta.url);
const NAMES = ['bazi_reading', 'ziwei_reading', 'qimen_reading', 'astro_reading'];
const ENVELOPE = ['chart', 'judgments', 'evidence', 'confidence', 'limitations', 'warnings', 'conventions'];
let client;

before(async () => {
  client = new Client({ name: 'prompts-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
});
after(async () => { await client.close(); });

const readPrompt = (f) => readFileSync(new URL(f, promptsDir), 'utf8');
const body = async (name) => {
  const r = await client.getPrompt({ name });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].role, 'user');
  assert.equal(r.messages[0].content.type, 'text');
  return r.messages[0].content.text;
};

test('listPrompts 返回四套解读守则，带描述', async () => {
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), [...NAMES].sort());
  assert.ok(prompts.every((p) => p.description && p.description.length > 5));
});

test('prompt 正文 = common.md + 体系文件，含 limitations 与统一外层字段', async () => {
  const common = readPrompt('common.md');
  const firstLine = common.split('\n')[0];
  for (const name of NAMES) {
    const text = await body(name);
    assert.ok(text.includes(firstLine), `${name} 缺 common.md 首行`);
    assert.ok(text.includes(readPrompt(`${name}.md`).trim()), `${name} 缺体系文件正文`);
    assert.ok(text.includes('limitations'));
    for (const f of ENVELOPE) assert.ok(text.includes(f), `${name} 缺字段 ${f}`);
    assert.match(text, /ok.*false/s);
  }
});

test('各体系 prompt 指明工具名与口径', async () => {
  assert.match(await body('bazi_reading'), /`bazi`[\s\S]*夜子时算当日/);
  assert.match(await body('ziwei_reading'), /`ziwei`[\s\S]*晚子时算次日/);
  assert.match(await body('astro_reading'), /`astro`[\s\S]*不做真太阳时/);
  const q = await body('qimen_reading');
  assert.match(q, /`qimen`/);
  assert.match(q, /qimen_method/);
});

test('common.md 列出 safety.yaml 的每个 blocked_phrases 作禁用示例', () => {
  const { blocked_phrases: phrases } = parse(readFileSync(safetyPath, 'utf8'));
  assert.ok(phrases.length > 0);
  const common = readPrompt('common.md');
  for (const p of phrases) assert.ok(common.includes(p), `common.md 缺禁用词：${p}`);
});

test('未知 prompt 报错', async () => {
  await assert.rejects(client.getPrompt({ name: 'nope_reading' }));
});

test('prompt 文件环境中立：不得禁止运行脚本', () => {
  for (const f of ['common.md', ...NAMES.map((n) => `${n}.md`)]) {
    assert.ok(!readPrompt(f).includes('不要运行任何脚本'), `${f} 含“不要运行任何脚本”`);
  }
});
