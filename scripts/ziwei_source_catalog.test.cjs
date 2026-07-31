'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_ROOT = path.join(ROOT, 'knowledge', 'ziwei');
const SOURCES_ROOT = path.join(KNOWLEDGE_ROOT, 'sources');

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_ROOT, relativePath), 'utf8'));
}

function loadJsonLines(relativePath) {
  return fs.readFileSync(path.join(SOURCES_ROOT, relativePath), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${relativePath}:${index + 1} 不是合法 JSON：${error.message}`);
      }
    });
}

function sha256(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

test('书目目录固定登记两本扫描资料及可审计文件元数据', () => {
  const catalog = loadJson(path.join('sources', 'catalog.yaml'));
  const sources = catalog.sources;

  assert.equal(catalog.schema_version, 'ziwei-sources/v1');
  assert.deepEqual(
    sources.map((source) => source.id),
    ['mingli-tianji', 'feixing-ziwei'],
  );
  assert.deepEqual(
    sources.map((source) => source.page_count),
    [504, 336],
  );
  sources.forEach((source) => {
    assert.equal(source.media_type, 'application/pdf');
    assert.equal(source.text_layer, 'none');
    assert.match(source.file_sha256, /^[a-f0-9]{64}$/);
    assert.equal(path.isAbsolute(source.original_filename), false);
    assert.equal(source.usage, 'internal-research');
  });

  const classical = sources.find((source) => source.id === 'feixing-ziwei');
  assert.equal(classical.attribution_status, 'unverified_metadata');
});

test('页码映射只使用有效 PDF 页，并保留印刷页、章节和视觉复核状态', () => {
  const catalog = loadJson(path.join('sources', 'catalog.yaml'));
  const sourceById = new Map(catalog.sources.map((source) => [source.id, source]));

  for (const sourceId of sourceById.keys()) {
    const rows = loadJsonLines(path.join(sourceId, 'page-map.jsonl'));
    assert.ok(rows.length > 0, `${sourceId} 应至少有一个页码映射`);
    const uniquePages = new Set();

    rows.forEach((row) => {
      assert.equal(row.source_id, sourceId);
      assert.ok(Number.isInteger(row.pdf_page) && row.pdf_page >= 1);
      assert.ok(row.pdf_page <= sourceById.get(sourceId).page_count);
      assert.ok(Number.isInteger(row.printed_page) && row.printed_page >= 1);
      assert.ok(row.section);
      assert.ok(Array.isArray(row.topics) && row.topics.length > 0);
      assert.equal(row.ocr_status, 'visually_verified');
      assert.equal(uniquePages.has(row.pdf_page), false, `${sourceId} PDF 页重复：${row.pdf_page}`);
      uniquePages.add(row.pdf_page);
    });
  }
});

test('最短摘录通过来源 Schema，并可回溯到页码映射和内容哈希', () => {
  const schema = loadJson(path.join('schemas', 'source.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);

  for (const sourceId of ['mingli-tianji', 'feixing-ziwei']) {
    const pageMap = loadJsonLines(path.join(sourceId, 'page-map.jsonl'));
    const mappedPages = new Set(pageMap.map((row) => row.pdf_page));
    const excerpts = loadJsonLines(path.join(sourceId, 'excerpts.jsonl'));

    assert.ok(excerpts.length > 0, `${sourceId} 应至少有一条摘录`);
    excerpts.forEach((excerpt) => {
      assert.equal(validate(excerpt), true, JSON.stringify(validate.errors, null, 2));
      assert.equal(excerpt.source_id, sourceId);
      assert.equal(mappedPages.has(excerpt.pdf_page), true);
      assert.equal(excerpt.ocr_status, 'visually_verified');
      assert.ok(excerpt.ocr_text.length > 0);
      assert.ok(excerpt.corrected_text.length <= 220, `${excerpt.id} 不是最短摘录`);
      assert.equal(excerpt.content_hash, sha256(excerpt.corrected_text));
    });
  }
});

test('首批来源覆盖斗君、流时推进、四化层级、推断顺序和古籍大限', () => {
  const excerpts = [
    ...loadJsonLines(path.join('mingli-tianji', 'excerpts.jsonl')),
    ...loadJsonLines(path.join('feixing-ziwei', 'excerpts.jsonl')),
  ];
  const ids = new Set(excerpts.map((excerpt) => excerpt.id));

  [
    'source.mingli-tianji.p408.doujun',
    'source.mingli-tianji.p408.flow-day-hour',
    'source.mingli-tianji.p409.period-scope',
    'source.mingli-tianji.p416.analysis-order',
    'source.feixing-ziwei.p126.decadal',
    'source.feixing-ziwei.p127.doujun',
    'source.feixing-ziwei.p250.relations',
  ].forEach((id) => assert.equal(ids.has(id), true, `缺少首批来源：${id}`));
});
