// 给上游大模型请求加超时。
// 非流式：响应头要等整段生成完才回来，只设一个总时限。
// 流式（SSE）：先限首包（响应头）时间，之后每收到一块数据就重置空闲计时，另有总时限兜底，
// 避免上游一直发 keep-alive 注释或慢速吐字导致连接无限挂起。
// 超时会中止上游连接，并以 status 504 的错误抛给调用方（fetch 阶段或读 body 阶段）。

const LLM_JSON_TIMEOUTS = { headersMs: 120000, idleMs: 120000, totalMs: 120000 };
const LLM_STREAM_TIMEOUTS = { headersMs: 30000, idleMs: 45000, totalMs: 300000 };

function createLlmTimeoutError(phase, ms) {
  const err = new Error('上游大模型响应超时');
  err.status = 504;
  err.llmTimeout = true;
  err.details = `${phase} timeout after ${ms}ms`;
  return err;
}

async function fetchWithLlmTimeout(url, init, limits, fetchImpl = fetch) {
  const controller = new AbortController();
  const deadline = Date.now() + limits.totalMs;
  let timer;
  let failure;
  let reader;

  const arm = (ms, phase) => {
    clearTimeout(timer);
    const remaining = deadline - Date.now();
    const wait = Math.max(0, Math.min(ms, remaining));
    const firedPhase = ms > remaining ? 'total' : phase;
    const firedMs = firedPhase === 'total' ? limits.totalMs : ms;
    timer = setTimeout(() => {
      failure = createLlmTimeoutError(firedPhase, firedMs);
      controller.abort(failure);
      reader?.cancel(failure).catch(() => {});
    }, wait);
  };

  arm(limits.headersMs, 'headers');
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    throw failure || error;
  }

  if (!response.body) {
    clearTimeout(timer);
    return response;
  }

  arm(limits.idleMs, 'idle');
  reader = response.body.getReader();
  const body = new ReadableStream({
    async pull(stream) {
      try {
        const { done, value } = await reader.read();
        if (failure) {
          stream.error(failure);
        } else if (done) {
          clearTimeout(timer);
          stream.close();
        } else {
          arm(limits.idleMs, 'idle');
          stream.enqueue(value);
        }
      } catch (error) {
        clearTimeout(timer);
        stream.error(failure || error);
      }
    },
    cancel(reason) {
      clearTimeout(timer);
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

module.exports = {
  LLM_JSON_TIMEOUTS,
  LLM_STREAM_TIMEOUTS,
  createLlmTimeoutError,
  fetchWithLlmTimeout,
};
