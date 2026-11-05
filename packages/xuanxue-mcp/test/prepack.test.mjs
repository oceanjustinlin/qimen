// I4：prepack 原子替换 engine/；根 test 脚本把 pack 测试放在其余测试之后串行运行
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEngine } from '../scripts/prepack.mjs';

const rootPkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));

test('根 test 脚本：先跑其余测试，再单独跑 pack.test.mjs', () => {
  const parts = rootPkg.scripts.test.split('&&').map((s) => s.trim());
  assert.equal(parts.length, 2, rootPkg.scripts.test);
  const [first, second] = parts;
  assert.match(first, /^node --test /);
  assert.ok(!first.split(/\s+/).includes('packages/xuanxue-mcp/test/pack.test.mjs'));
  assert.doesNotMatch(first, /packages\/xuanxue-mcp\/test\/\*\.test\.mjs/, '通配会把 pack.test.mjs 并行带进来');
  for (const g of ['lib/*.test.js', 'lib/*.test.cjs', 'scripts/*.test.cjs', 'src/**/*.test.mjs']) assert.ok(first.includes(g), g);
  // 包内除 pack.test.mjs 外的测试文件都在第一段
  for (const f of readdirSync(new URL('.', import.meta.url)).filter((n) => n.endsWith('.test.mjs') && n !== 'pack.test.mjs')) {
    assert.ok(first.split(/\s+/).includes(`packages/xuanxue-mcp/test/${f}`), `第一段缺 ${f}`);
  }
  assert.equal(second, 'node --test packages/xuanxue-mcp/test/pack.test.mjs');
});

const withTmp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'xuanxue-prepack-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('buildEngine 先写入临时目录，完成后才替换目标目录', () => withTmp((dir) => {
  const out = join(dir, 'engine');
  mkdirSync(out);
  writeFileSync(join(out, 'old.txt'), 'old');
  let seen;
  buildEngine({
    outRoot: out,
    onStaged(staging) {
      // 暂存目录已完整，目标目录仍是旧内容
      seen = {
        stagedCli: existsSync(join(staging, 'scripts/bazi_cli.cjs')),
        stagedPkg: existsSync(join(staging, 'package.json')),
        targetOld: existsSync(join(out, 'old.txt')),
        targetCli: existsSync(join(out, 'scripts/bazi_cli.cjs')),
      };
    },
  });
  assert.deepEqual(seen, { stagedCli: true, stagedPkg: true, targetOld: true, targetCli: false });
  assert.ok(existsSync(join(out, 'scripts/bazi_cli.cjs')));
  assert.ok(!existsSync(join(out, 'old.txt')));
  assert.deepEqual(readdirSync(dir), ['engine'], '不留暂存目录');
}));

test('构建中途失败：目标目录保持原样，暂存目录被清理', () => withTmp((dir) => {
  const out = join(dir, 'engine');
  mkdirSync(out);
  writeFileSync(join(out, 'old.txt'), 'old');
  assert.throws(() => buildEngine({ outRoot: out, onStaged() { throw new Error('boom'); } }), /boom/);
  assert.equal(readFileSync(join(out, 'old.txt'), 'utf8'), 'old');
  assert.deepEqual(readdirSync(dir), ['engine']);
}));
