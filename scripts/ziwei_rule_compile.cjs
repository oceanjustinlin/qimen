#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const YAML = require('yaml');

const DEFAULT_KNOWLEDGE_ROOT = path.join(__dirname, '..', 'knowledge', 'ziwei');
const RULE_SCHEMA_VERSION = 'ziwei-rules/v1';
const COMPILED_SCHEMA_VERSION = 'ziwei-compiled-rules/v1';
const RULE_FILES = [
  'rules/relation/palace-relations.yaml',
  'rules/calculation/doujun.yaml',
  'rules/calculation/flow-periods.yaml',
  'rules/activation/period-scopes.yaml',
];

function makeRuleError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseRuleDocument(text, sourcePath = '<memory>') {
  let document;
  try {
    document = YAML.parse(text, {
      maxAliasCount: 0,
      prettyErrors: true,
    });
  } catch (error) {
    throw makeRuleError(
      'RULE_DOCUMENT_INVALID',
      `${sourcePath} 不是合法 YAML：${error.message}`,
    );
  }

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw makeRuleError('RULE_DOCUMENT_INVALID', `${sourcePath} 的顶层必须是对象。`);
  }
  if (document.schema_version !== RULE_SCHEMA_VERSION) {
    throw makeRuleError(
      'RULE_DOCUMENT_INVALID',
      `${sourcePath} 的 schema_version 必须是 ${RULE_SCHEMA_VERSION}。`,
    );
  }
  if (!Array.isArray(document.rules)) {
    throw makeRuleError('RULE_DOCUMENT_INVALID', `${sourcePath} 的 rules 必须是数组。`);
  }
  return document;
}

function loadRuleSchema(knowledgeRoot = DEFAULT_KNOWLEDGE_ROOT) {
  const schemaPath = path.join(knowledgeRoot, 'schemas', 'rule.schema.json');
  try {
    return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    throw makeRuleError(
      'RULE_SCHEMA_UNAVAILABLE',
      `无法读取规则 Schema ${schemaPath}：${error.message}`,
    );
  }
}

function stableDigest(value) {
  const content = JSON.stringify(value);
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function compileRuleDocuments(documents, options = {}) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw makeRuleError('RULE_DOCUMENT_INVALID', '至少需要一个规则文档。');
  }

  const schema = options.schema || loadRuleSchema(options.knowledgeRoot);
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const rules = [];
  const seenRuleIds = new Set();

  documents.forEach((entry, documentIndex) => {
    const sourcePath = entry?.source_path || `<document:${documentIndex}>`;
    const document = entry?.document;
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw makeRuleError('RULE_DOCUMENT_INVALID', `${sourcePath} 的顶层必须是对象。`);
    }
    if (document.schema_version !== RULE_SCHEMA_VERSION || !Array.isArray(document.rules)) {
      throw makeRuleError(
        'RULE_DOCUMENT_INVALID',
        `${sourcePath} 必须符合 ${RULE_SCHEMA_VERSION} 文档结构。`,
      );
    }

    document.rules.forEach((rule, ruleIndex) => {
      if (!validate(rule)) {
        throw makeRuleError(
          'RULE_SCHEMA_INVALID',
          `${sourcePath} 第 ${ruleIndex + 1} 条规则未通过 Schema 校验。`,
          clone(validate.errors || []),
        );
      }
      if (seenRuleIds.has(rule.id)) {
        throw makeRuleError('RULE_ID_DUPLICATE', `规则 ID 重复：${rule.id}`);
      }
      seenRuleIds.add(rule.id);
      rules.push(clone(rule));
    });
  });

  return {
    schema_version: COMPILED_SCHEMA_VERSION,
    rule_count: rules.length,
    source_digest: stableDigest(rules),
    rules,
  };
}

function compileRules(options = {}) {
  const knowledgeRoot = options.knowledgeRoot || DEFAULT_KNOWLEDGE_ROOT;
  const documents = RULE_FILES.map((relativePath) => {
    const absolutePath = path.join(knowledgeRoot, relativePath);
    let text;
    try {
      text = fs.readFileSync(absolutePath, 'utf8');
    } catch (error) {
      throw makeRuleError(
        'RULE_DOCUMENT_UNAVAILABLE',
        `无法读取规则文档 ${absolutePath}：${error.message}`,
      );
    }
    return {
      source_path: relativePath,
      document: parseRuleDocument(text, relativePath),
    };
  });

  return compileRuleDocuments(documents, {
    knowledgeRoot,
    schema: loadRuleSchema(knowledgeRoot),
  });
}

function serializeError(error) {
  return {
    code: error.code || 'RULE_COMPILE_FAILED',
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(compileRules(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: serializeError(error) })}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  COMPILED_SCHEMA_VERSION,
  DEFAULT_KNOWLEDGE_ROOT,
  RULE_FILES,
  RULE_SCHEMA_VERSION,
  compileRuleDocuments,
  compileRules,
  parseRuleDocument,
};
