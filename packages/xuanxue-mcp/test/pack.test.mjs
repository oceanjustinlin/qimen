import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let tmp, installed, tgz;

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'xuanxue-pack-'));
  const out = execFileSync(npm, ['pack', '--json', '--pack-destination', tmp], { cwd: pkgDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const info = JSON.parse(out)[0];
  tgz = join(tmp, info.filename);
  console.error(`pack: ${info.filename} size=${info.size} unpacked=${info.unpackedSize} files=${info.entryCount}`);
  const app = join(tmp, 'app');
  mkdirSync(app);
  execFileSync(npm, ['init', '-y'], { cwd: app, stdio: 'ignore' });
  execFileSync(npm, ['install', tgz, '--no-audit', '--no-fund'], { cwd: app, stdio: 'inherit' });
  installed = join(app, 'node_modules', 'xuanxue-mcp');
});

after(() => {
  rmSync(tmp, { recursive: true, force: true });
  // 避免遗留的 engine/ 让开发态 loadEngine() 误用打包副本
  rmSync(join(pkgDir, 'engine'), { recursive: true, force: true });
});

test('npm pack 产物可在临时目录独立运行', { timeout: 180_000 }, async () => {
  const client = new Client({ name: 'pack', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(installed, 'src/server.mjs')], cwd: join(tmp, 'app') }));
  try {
    const birth = { date: '1990-05-01', time: '14:00', gender: '男' };
    const r = await client.callTool({ name: 'ziwei', arguments: { birth, mode: 'evidence', topic: 'career' } });
    assert.equal(r.structuredContent.ok, true, JSON.stringify(r.structuredContent).slice(0, 500));
    assert.ok(r.structuredContent.evidence.length > 0);
    const b = await client.callTool({ name: 'bazi', arguments: { birth, mode: 'chart' } });
    assert.equal(b.structuredContent.ok, true);
    const q = await client.callTool({ name: 'qimen', arguments: { mode: 'question', question: '这次面试能成吗', cast_time: '2026-11-05T14:30:00' } });
    assert.equal(q.structuredContent.ok, true);
    // 杭州走 birthplaces 数据（src/data/birthplaces.mjs）
    const c = await client.callTool({ name: 'calendar', arguments: { action: 'true_solar', date: '1990-05-01', time: '14:00', location: { place: '杭州' } } });
    assert.equal(c.structuredContent.ok, true);
  } finally {
    await client.close();
  }
});

test('包内所有 excerpts.jsonl 都不含正文字段', () => {
  const files = walk(installed).filter((f) => f.endsWith('excerpts.jsonl'));
  assert.ok(files.length > 0);
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
      const o = JSON.parse(line);
      for (const k of ['ocr_text', 'corrected_text', 'correction_notes']) assert.ok(!(k in o), `${f} 含 ${k}`);
    }
  }
});

test('包内不含 fixtures/、.test. 文件，reports/ 仅有运行时报告模板', () => {
  for (const f of walk(installed)) {
    const rel = f.slice(installed.length);
    assert.doesNotMatch(rel, /[\\/]fixtures[\\/]/, rel);
    // reports/ 是引擎运行时必读的报告模板（ziwei_report_evidence 读取），只允许 knowledge/ziwei/reports/*.yaml
    if (/[\\/]reports[\\/]/.test(rel)) assert.match(rel, /[\\/]engine[\\/]knowledge[\\/]ziwei[\\/]reports[\\/][^\\/]+\.yaml$/, rel);
    assert.doesNotMatch(rel, /\.test\./, rel);
  }
});
