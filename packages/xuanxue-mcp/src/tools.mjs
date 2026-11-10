import { z } from 'zod';
import { loadEngine } from './engine.mjs';
import { summarizeEnvelope } from './summarize.mjs';

// 出生信息：字段全部宽松可选，缺失/非法值交给引擎给出 TIME_REQUIRED 等具体错误码；
// looseObject 保留旧格式（year/month/day/hour/minute）等额外字段。
const location = z.looseObject({
  place: z.string().optional().describe('出生地名，如“杭州”（仅限中国境内）'),
  longitude: z.number().optional().describe('出生地经度（东经 73–135）；与 place 同时给出时以经度为准'),
});

const birth = z.looseObject({
  date: z.string().optional().describe('公历出生日期 YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '格式应为 HH:mm').optional().describe('出生时间 HH:mm（必填于排盘；缺失返回 TIME_REQUIRED）'),
  gender: z.string().optional().describe('男 | 女'),
  location: location.optional().describe('出生地：{ place } 或 { longitude }，或两者'),
  time_basis: z.enum(['clock', 'true_solar']).optional().describe('clock（默认，钟表时间）| true_solar（已是真太阳时）'),
});

// 西洋星盘的出生地：需要纬度与时区，不限中国
const astroLocation = z.looseObject({
  place: z.string().optional().describe('出生地名，如“杭州”“纽约”；地名库以中国为主，海外城市请改传坐标与时区'),
  latitude: z.number().optional().describe('纬度（北正南负，-90～90）；与 longitude 同时给出时优先于 place'),
  longitude: z.number().optional().describe('经度（东正西负，-180～180）'),
  timezone: z.string().optional().describe('IANA 时区，如 Asia/Shanghai、America/New_York；只给坐标时必填'),
});

const astroBirth = z.looseObject({
  date: z.string().optional().describe('公历出生日期 YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '格式应为 HH:mm').optional().describe('出生当地钟表时间 HH:mm（必填；缺失返回 TIME_REQUIRED）'),
  location: astroLocation.optional().describe('出生地（必填）：{ place } 或 { latitude, longitude, timezone }'),
});

const current_year = z.number().int().optional().describe('当前年份，默认取系统年份');

const timeScope = z.looseObject({
  type: z.string().optional().describe('natal | decadal | yearly 等，沿用引擎现有取值'),
  start_year: z.number().int().optional(),
  end_year: z.number().int().optional().describe('一次最多 10 个流年'),
});

const detail = z.enum(['summary', 'full']).optional()
  .describe('summary（默认）精简大块字段以控制输出长度；full 返回引擎完整外层');

const DESCRIPTIONS = {
  bazi: '四柱八字排盘与问事：命局结构、性格禀赋、旺衰喜忌、大运流年、问事应期。Bazi (Four Pillars) chart and question analysis.',
  ziwei: '紫微斗数排盘与证据：十二宫、主星、四化、大限流年。Zi Wei Dou Shu chart and evidence.',
  qimen: '时家奇门起局与问事：具体事件成败、时机、方位。不需要生辰。Qimen Dunjia for concrete events, timing and direction.',
  calendar: '历法工具：公历转农历与四柱、真太阳时换算、节气查询。Calendar conversion, true solar time, solar terms.',
  astro: '西洋占星本命盘（星盘）：行星落座落宫、上升天顶、宫位、主相位。需要出生日期、时间（到分钟）和出生地。Western astrology natal chart: planets, angles, houses, aspects.',
};

const SHAPES = {
  bazi: {
    birth: birth.describe('出生信息（必填）'),
    mode: z.enum(['chart', 'question']).optional().describe('chart（默认）| question'),
    question: z.string().optional().describe('question 模式必填'),
    current_year,
    detail,
  },
  ziwei: {
    birth: birth.describe('出生信息（必填）'),
    mode: z.enum(['chart', 'evidence']).optional().describe('chart（默认）| evidence'),
    // 不用 z.enum：topic 不在支持范围时应由引擎返回 TOPIC_UNSUPPORTED 与指引
    topic: z.string().optional().describe('overall | career | wealth | relationship'),
    time_scope: timeScope.optional().describe('时间范围，一次最多 10 个流年'),
    current_year,
    detail,
  },
  qimen: {
    mode: z.enum(['chart', 'question']).optional().describe('chart（默认）| question'),
    question: z.string().optional().describe('question 模式必填'),
    cast_time: z.string().optional().describe('起局时间（ISO），默认当前时刻'),
    timezone: z.string().optional().describe('IANA 时区，默认 Asia/Shanghai'),
    birth: birth.optional().describe('选填，作为八字背景'),
    detail,
  },
  astro: {
    birth: astroBirth.describe('出生信息（必填）；西洋星盘不需要性别，不做真太阳时'),
    mode: z.string().optional().describe('目前只支持 chart（本命盘，默认）'),
    options: z.looseObject({
      house_system: z.string().optional().describe('placidus（默认）| whole_sign | equal'),
      node: z.string().optional().describe('mean（默认，平均交点）| true'),
      orbs: z.string().optional().describe('standard（默认）| tight'),
    }).optional().describe('排盘口径，均可省略'),
    detail,
  },
  calendar: {
    action: z.enum(['convert', 'true_solar', 'jieqi']).describe('convert | true_solar | jieqi'),
    date: z.string().optional().describe('公历日期 YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/, '格式应为 HH:mm').optional().describe('HH:mm'),
    location: z.union([z.string(), location]).optional().describe('true_solar 必填：{ place } 或 { longitude }'),
    year: z.number().int().optional().describe('jieqi：查询整年节气'),
  },
};

function formatIssues(error) {
  return error.issues
    .map((i) => `${i.path.length ? i.path.join('.') : '(根)'}：${i.message}`)
    .join('；');
}

let cached;
const getEngine = () => (cached ??= loadEngine());

// 引擎或 cliEnvelope 都加载失败时的本地兜底，绝不把原始异常或绝对路径带给客户端
const ENGINE_FALLBACK = () => ({
  ok: false,
  code: 'ENGINE_ERROR',
  message: '引擎加载失败（详情已隐藏）',
  hint: '引擎出现非预期错误。请不要自行心算排盘；可检查输入后重试，仍失败请向用户如实说明',
});

// input_summary 只记录工具名与 mode/action，不含出生信息
function summarize(name, args) {
  const sel = args && typeof args === 'object' ? (args.mode ?? args.action) : undefined;
  return typeof sel === 'string' ? `${name}:${sel}` : name;
}

function makeRun(name) {
  const schema = z.object(SHAPES[name]);
  return (args) => {
    try {
      const { cliEnvelope, [name]: engineRun } = getEngine();
      const parsed = schema.safeParse(args ?? {});
      if (!parsed.success) {
        return cliEnvelope.fail('BAD_JSON', `参数校验失败：${formatIssues(parsed.error)}`);
      }
      // detail 只属于 MCP 层，不传给引擎（CLI 契约不变）
      const { detail: level = 'summary', ...engineArgs } = parsed.data;
      try {
        const env = engineRun(engineArgs);
        return level === 'full' ? env : summarizeEnvelope(name, env);
      } catch (err) {
        return cliEnvelope.toFailure(err, { input_summary: summarize(name, args) });
      }
    } catch {
      return ENGINE_FALLBACK();
    }
  };
}

export const TOOLS = Object.keys(SHAPES).map((name) => ({
  name,
  description: DESCRIPTIONS[name],
  inputSchema: SHAPES[name],
  run: makeRun(name),
}));

export function toToolResult(env) {
  return {
    // 紧凑 JSON：缩进会让 token 数接近翻倍
    content: [{ type: 'text', text: JSON.stringify(env) }],
    structuredContent: env,
    isError: env.ok === false,
  };
}

// 按工具名分发；未知工具返回失败外层而不是协议错误
export function runTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return {
      ok: false,
      code: 'BAD_JSON',
      message: `未知工具：${name}。可用工具：${TOOLS.map((t) => t.name).join('、')}`,
      hint: '输入不是合法 JSON。请检查引号、逗号和括号后重新生成输入',
    };
  }
  return tool.run(args);
}
