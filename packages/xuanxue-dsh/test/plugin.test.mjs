// xuanxue-dsh：组合包声明、patch 行与 skill 注册的离线检查（不依赖 dsh 本体）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import * as plugin from '../index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const mcpPkg = JSON.parse(readFileSync(new URL('../../xuanxue-mcp/package.json', import.meta.url), 'utf8'));
const patch = YAML.parse(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'));
const rows = patch[0].insert;
const row = (id) => rows.find((r) => r.id === id);

test('package.json 声明 dsh 组合包', () => {
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.main, 'index.js');
  for (const f of ['index.js', 'cordis.patch.yml', 'prompts/']) assert.ok(pkg.files.includes(f), f);
});

test('patch 只有一个 insert，含 MCP 行与 skill 行', () => {
  assert.equal(patch.length, 1);
  assert.deepEqual(rows.map((r) => r.id), ['xuanxue-mcp', 'xuanxue-skills']);
  assert.equal(row('xuanxue-skills').name, pkg.name);
});

test('MCP 行：stdio + npx，版本钉在 xuanxue-mcp 当前版本', () => {
  const { name, config } = row('xuanxue-mcp');
  assert.equal(name, '@deepseek-ai/dsh-mcp-client');
  assert.equal(config.serverName, plugin.SERVER_NAME);
  assert.match(config.serverName, /^[A-Za-z0-9_-]{1,32}$/);
  assert.equal(config.transport, 'stdio');
  assert.equal(config.command, 'npx');
  assert.deepEqual(config.args, ['-y', `${mcpPkg.name}@${mcpPkg.version}`],
    'xuanxue-mcp 升版后要同步改 cordis.patch.yml 里的版本');
});

test('apply 注册四个 skill，名称合法、正文含守则与工具名对照', () => {
  const registered = [];
  plugin.apply({ skills: { register: (s) => { registered.push(s); return () => {}; } } });
  assert.deepEqual(registered.map((s) => s.name), ['xuanxue-bazi', 'xuanxue-ziwei', 'xuanxue-qimen', 'xuanxue-astro']);
  const common = readFileSync(new URL('../../xuanxue-mcp/prompts/common.md', import.meta.url), 'utf8').trim();
  for (const s of registered) {
    assert.match(s.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(s.description.length > 0 && s.whenToUse.length > 0);
    assert.equal(s.source, 'bundled');
    assert.ok(s.content.includes(common), `${s.name} 缺 common.md`);
    for (const t of ['bazi', 'ziwei', 'qimen', 'astro', 'calendar']) {
      assert.ok(s.content.includes(`mcp__xuanxue__${t}`), `${s.name} 缺 ${t} 工具名对照`);
    }
  }
});

test('inject 声明 skills 服务', () => {
  assert.deepEqual(plugin.inject, ['skills']);
});

test('export-repo 导出独立仓库：根目录即插件，prompts 已就位，无 prepack', async () => {
  const { mkdtempSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'xuanxue-dsh-export-'));
  try {
    execFileSync(process.execPath, [new URL('../scripts/export-repo.mjs', import.meta.url).pathname, dir]);
    const out = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.equal(out.dsh.bundle.patch, './cordis.patch.yml');
    assert.equal(out.scripts, undefined);
    for (const f of ['index.js', 'cordis.patch.yml', 'LICENSE', 'README.md', 'locale/zh.json', 'prompts/common.md', 'prompts/bazi_reading.md']) {
      assert.ok(existsSync(join(dir, f)), f);
    }
    const mod = await import(join(dir, 'index.js'));
    const seen = [];
    mod.apply({ skills: { register: (s) => seen.push(s) } });
    assert.equal(seen.length, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
