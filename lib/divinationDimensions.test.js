const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ANSWER_SLOTS,
  BAZI_SLOT_MAP,
  CONTENT_FACETS,
  QIMEN_SLOT_MAP,
  findContentFacet,
  getContentFacets,
  isValidSlot,
  validateDimensionRegistry,
} = require('./divinationDimensions');
const { FRAMEWORK } = require('./baziQuestionCore');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

test('共享维度注册表结构自洽，内容维度只挂在主题树中已有的子类上', () => {
  assert.deepEqual(validateDimensionRegistry(), []);
  assert.ok(isValidSlot('support'));
  assert.equal(isValidSlot('stability'), false);
  assert.deepEqual(getContentFacets('career_business', 'job_search'), []);
  assert.equal(findContentFacet('relationship', 'partner_profile', 'partner_traits').slot, 'portrait');
  Object.values(CONTENT_FACETS).flat().forEach((facet) => {
    assert.ok(ANSWER_SLOTS[facet.slot], facet.id);
  });
});

test('奇门映射的字段确实存在于奇门报告 prompt 契约中', () => {
  const qimenPrompt = source('qimenPromptSections.js');
  Object.keys(QIMEN_SLOT_MAP).forEach((fieldPath) => {
    const [module, field] = fieldPath.split('.');
    assert.ok(qimenPrompt.includes(module), module);
    assert.ok(qimenPrompt.includes(field), field);
  });
});

test('八字映射与 framework 轴一致，字段确实存在于统一输出 schema 中', () => {
  const baziSource = source('baziQuestionCore.js');
  assert.deepEqual(
    Object.keys(BAZI_SLOT_MAP.frameworks).sort(),
    Object.values(FRAMEWORK).sort(),
  );
  const fields = [
    ...Object.keys(BAZI_SLOT_MAP.envelope),
    ...Object.values(BAZI_SLOT_MAP.frameworks).flatMap((map) => Object.keys(map)),
  ].map((fieldPath) => fieldPath.replace(/^readings\./, ''));
  [...new Set(fields)].forEach((field) => {
    assert.ok(baziSource.includes(`"${field}"`), `baziQuestionCore 输出 schema 中缺少 ${field}`);
  });
});
