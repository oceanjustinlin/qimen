// Phase 1：把高频改动 + 偏静态的 prompt 函数同步注册为 Langfuse Prompt 对象，供版本可视化 diff。
// 不改变 Worker 运行时行为——Worker 仍然用 lib/**.js 里的函数直接拼 prompt，这里只是把渲染结果
// 定期同步一份到 Langfuse 做版本历史记录。每次改了下面列出的函数后，重跑本脚本即可打一个新版本。
// 用法：node scripts/sync-langfuse-prompts.mjs
// 凭证：优先读 process.env，缺失则回退读 worker/.dev.vars（本地开发用，已 gitignore）。

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadDevVars() {
  const p = path.join(ROOT, 'worker', '.dev.vars');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const devVars = loadDevVars();
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || devVars.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || devVars.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || devVars.LANGFUSE_BASE_URL;

if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY || !LANGFUSE_BASE_URL) {
  console.error('缺少 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL（环境变量或 worker/.dev.vars）');
  process.exit(1);
}

let gitSha = 'unknown';
try { gitSha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}

// POST /api/public/v2/prompts —— schema 来自官方 fern 定义（CreateTextPromptRequest），非猜测：
// https://github.com/langfuse/langfuse/blob/main/fern/apis/server/definition/prompts.yml
async function pushPrompt({ name, prompt, tags = [] }) {
  const auth = Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64');
  const res = await fetch(`${LANGFUSE_BASE_URL}/api/public/v2/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      name,
      type: 'text',
      prompt,
      tags: ['qimen-app', 'phase-1-sync', ...tags],
      commitMessage: `sync @ ${gitSha}`,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`✗ ${name}: HTTP ${res.status}`, JSON.stringify(body).slice(0, 300));
    return null;
  }
  console.log(`✓ ${name}  v${body.version}  (${prompt.length} 字符)`);
  return body;
}

// ── P0: lib/divinationRouter.js 两个路由 prompt ──
const divinationRouter = require('../lib/divinationRouter.js');
// ── P0: lib/wenshiFollowup.js 三个追问 prompt ──
const wenshiFollowup = require('../lib/wenshiFollowup.js');
// ── P1: lib/qimenPromptSections.js 四个纯静态 section ──
const qimenPromptSections = require('../lib/qimenPromptSections.js');
// ── P2: lib/baziQuestionCore.js 的 readings schema（按 mode）+ 两个共用纯静态块 ──
const baziQuestionCore = require('../lib/baziQuestionCore.js');
const BAZI_MODES = ['status', 'timing', 'pattern', 'character', 'profile_driven'];

const SAMPLE_QIMEN_QUESTION = '这个月适合谈判加薪吗';
const SAMPLE_BAZI_QUESTION = '近三年事业发展如何';

async function main() {
  const results = [];

  results.push(await pushPrompt({
    name: 'router/gemini-route-l1',
    prompt: divinationRouter.buildLlmRoutePrompt(SAMPLE_QIMEN_QUESTION, {}),
    tags: ['router'],
  }));

  results.push(await pushPrompt({
    name: 'router/bazi-semantic-route-l2',
    prompt: divinationRouter.buildBaziSemanticRoutePrompt(SAMPLE_BAZI_QUESTION, {}),
    tags: ['router', 'bazi'],
  }));

  results.push(await pushPrompt({
    name: 'followup/classifier',
    prompt: wenshiFollowup.buildFollowupClassifierPrompt({
      branch: 'qimen',
      followup: '那如果对方拖延怎么办',
      originQuestion: SAMPLE_QIMEN_QUESTION,
      originConclusion: '本月时机偏弱，建议再等一等。',
    }),
    tags: ['followup'],
  }));

  results.push(await pushPrompt({
    name: 'followup/qimen-patch',
    prompt: wenshiFollowup.buildFollowupPatchPrompt({
      branch: 'qimen',
      followup: '那如果对方拖延怎么办',
      evidence: {},
      sections: { conclusion: '本月时机偏弱，建议再等一等。' },
      targetSections: ['conclusion'],
      nature: 'deepen',
    }),
    tags: ['followup', 'qimen'],
  }));

  results.push(await pushPrompt({
    name: 'followup/bazi-decide',
    prompt: wenshiFollowup.buildBaziFollowupPrompt({
      followup: '那具体是哪一年比较关键',
      originQuestion: SAMPLE_BAZI_QUESTION,
      evidenceText: '（示例证据块，实际由首轮 pipelineResult 生成）',
      sections: { summary_conclusion: '未来三年整体呈上升趋势。' },
      route: { branch: 'bazi', analysis_mode: 'status' },
    }),
    tags: ['followup', 'bazi'],
  }));

  results.push(await pushPrompt({
    name: 'qimen/summary-section',
    prompt: qimenPromptSections.buildSummaryPromptSection(),
    tags: ['qimen', 'static'],
  }));

  results.push(await pushPrompt({
    name: 'qimen/report-schema',
    prompt: qimenPromptSections.buildReportSchemaPromptSection(),
    tags: ['qimen', 'static'],
  }));

  results.push(await pushPrompt({
    name: 'qimen/inference-rules',
    prompt: qimenPromptSections.buildQimenInferenceRulesSection(),
    tags: ['qimen', 'static'],
  }));

  results.push(await pushPrompt({
    name: 'qimen/frontend-copy-protocol',
    prompt: qimenPromptSections.buildFrontendCopyProtocolSection(),
    tags: ['qimen', 'static'],
  }));

  // ── P2: 5 个 mode 各自独立的 readings schema（无跨分支耦合，天然适合按 mode 拆成独立 prompt）──
  for (const mode of BAZI_MODES) {
    results.push(await pushPrompt({
      name: `bazi/readings-schema-${mode}`,
      prompt: baziQuestionCore.buildReadingsSchema(mode),
      tags: ['bazi', 'static', 'schema', `mode:${mode}`],
    }));
  }

  results.push(await pushPrompt({
    name: 'bazi/pipeline-context-block',
    prompt: baziQuestionCore.buildPipelineContextBlock(),
    tags: ['bazi', 'static'],
  }));

  results.push(await pushPrompt({
    name: 'bazi/grounding-constraint-block',
    prompt: baziQuestionCore.buildGroundingConstraintBlock(),
    tags: ['bazi', 'static'],
  }));

  // ── P1: worker/src/index.js 里的两个哨兵协议常量（不能 import worker 入口文件，
  //     它是 Cloudflare Worker ESM 入口，含 export default { fetch }，无法在纯 Node 里安全加载；
  //     这两段是纯静态/mode 无关文案，手动同步自 worker/src/index.js 的 SENTINEL_INSTRUCTION 常量，
  //     以后改了 worker/src/index.js 里的这段文案，要同步改这里再重跑脚本）──
  const SENTINEL_INSTRUCTION = readSentinelInstructionFromWorkerSource();
  results.push(await pushPrompt({
    name: 'qimen/sentinel-instruction',
    prompt: SENTINEL_INSTRUCTION,
    tags: ['qimen', 'protocol'],
  }));

  const failed = results.filter((r) => !r);
  console.log(`\n完成：${results.length - failed.length}/${results.length} 成功。`);
  if (failed.length) process.exitCode = 1;
}

// 从 worker/src/index.js 源码里原样提取 SENTINEL_INSTRUCTION 模板字符串（纯文本提取，不执行代码）。
// 这段常量本身不含插值（无 ${}），是安全的静态提取；如果源码改了这个常量的写法（比如加了插值），
// 这个提取函数会失效，需要跟着改。
function readSentinelInstructionFromWorkerSource() {
  const src = readFileSync(path.join(ROOT, 'worker', 'src', 'index.js'), 'utf8');
  const startMarker = 'const SENTINEL_INSTRUCTION = `';
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('SENTINEL_INSTRUCTION 声明未找到，worker/src/index.js 结构可能变了');
  const bodyStart = start + startMarker.length;
  const end = src.indexOf('`;', bodyStart);
  if (end === -1) throw new Error('SENTINEL_INSTRUCTION 结束反引号未找到');
  return src.slice(bodyStart, end);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
