import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveSource } from '../i18n/testing/resolveSource.mjs'

const source = resolveSource(readFileSync(new URL('./EngineeringView.vue', import.meta.url), 'utf8'))
const currentUpdatesBlock = source.slice(
  source.indexOf('const currentUpdates = ['),
  source.indexOf('const historyUpdates = [')
)

test('关于页改为教程向系统说明', () => {
  assert.match(source, /<div class="about-title">关于<\/div>/)
  assert.match(source, /这个项目不是让人工智能直接算命/)
  assert.match(source, /最近更新/)
  assert.doesNotMatch(source, /本轮更新/)
  assert.match(source, /历史更新/)
  assert.match(source, /古籍命例评测纠偏/)
  assert.match(source, /动态展示取材逻辑/)
  assert.match(source, /两条线判断/)
  assert.doesNotMatch(currentUpdatesBlock, /title:\s*'历史记录安全回放'/)
  assert.doesNotMatch(currentUpdatesBlock, /tag:\s*'兼容'/)
  assert.match(source, /第三步 · 约束解读/)
  assert.match(source, /第四步 · 页面展示/)
  assert.match(source, /反馈会变成下一轮规则和提示词的依据/)
  assert.doesNotMatch(source, /QIMEN DAO SYSTEM GUIDE|WHY IT MATTERS|STEP \d|LLM|Prompt|prompt|schema|hybrid|fallback|UI RENDERING|CONTRACT|ROUTER|ENGINE/)
  assert.doesNotMatch(source, /panel|Panel|framework|target_source|state_report|dynamic_report|timing_candidates|analysis_mode/)
  assert.doesNotMatch(source, /生成合同/)
  assert.doesNotMatch(source, /查看系统架构/)
  assert.doesNotMatch(source, /了解功能模块/)
})

test('关于页移动端锁定一屏一模块滚动并适配浅色背景', () => {
  assert.match(source, /background:[\s\S]{0,180}var\(--paper\)/)
  assert.match(source, /\.about-scroll[\s\S]{0,180}scroll-snap-type:\s*y mandatory/)
  assert.match(source, /\.about-section[\s\S]{0,180}scroll-snap-align:\s*start/)
  assert.match(source, /@media\(max-width:\s*820px\)[\s\S]{0,520}scroll-snap-stop:\s*always/)
})
