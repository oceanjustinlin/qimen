'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'i18n_lint.mjs');
const REPO = path.resolve(__dirname, '..');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-lint-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

test('当前仓库对提交的基线退出码 0', () => {
  const r = run(['--root', REPO]);
  assert.equal(r.status, 0, r.stderr);
});

test('新增一行中文字符串时退出码 1，并给出文件路径与行号', () => {
  const root = fixture({
    'src/a.mjs': "export const a = 'ok'\n",
    'src/b.vue': '<template>\n  <div>hi</div>\n</template>\n',
  });
  assert.equal(run(['--root', root, '--update']).status, 0);
  assert.equal(run(['--root', root]).status, 0);
  fs.appendFileSync(path.join(root, 'src/a.mjs'), "export const b = '新增文案'\n");
  const r = run(['--root', root]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /src\/a\.mjs:2/);
});

test('注释与 i18n-ignore 不计数；style 块不计数；测试与 locales 不扫描', () => {
  const root = fixture({
    'src/c.vue': [
      '<template>',
      '  <!-- 模板注释 -->',
      '  <div>{{ x }}</div>',
      '  <!--',
      '    多行注释',
      '  -->',
      '</template>',
      '<script setup>',
      '// 行注释',
      '/* 块注释',
      '   第二行 */',
      "const url = 'https://x.y' // 尾注释",
      "const SYM = ['甲', '乙'] // i18n-ignore",
      '// i18n-ignore-start',
      "const MOCK = { a: '模拟数据' }",
      '// i18n-ignore-end',
      '</script>',
      '<style>',
      '.ss-吉 { color: red }',
      '</style>',
    ].join('\n'),
    'src/d.test.mjs': "const s = '测试'\n",
    'src/i18n/locales/zh-CN.mjs': "export default { a: '中文' }\n",
    'src/data/x.mjs': "export default ['北京']\n",
  });
  assert.equal(run(['--root', root, '--update']).status, 0);
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/i18n/hardcoded-baseline.json'), 'utf8'));
  assert.deepEqual(baseline, {});
});

test('计数低于基线时提示刷新但仍通过', () => {
  const root = fixture({ 'src/e.mjs': "const a = '一'\nconst b = '二'\n" });
  run(['--root', root, '--update']);
  fs.writeFileSync(path.join(root, 'src/e.mjs'), "const a = '一'\n");
  const r = run(['--root', root]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--update/);
});
