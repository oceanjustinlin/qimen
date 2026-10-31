const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchWithLlmTimeout } = require('./llmFetch');

const LIMITS = { headersMs: 50, idleMs: 50, totalMs: 1000 };

// 模拟上游：按给定间隔逐块吐出 SSE 数据，并响应 abort 信号
function fakeSseFetch(chunks, { headerDelayMs = 0, gapMs = 0 } = {}) {
  return (url, init) => new Promise((resolve, reject) => {
    const onAbort = () => reject(init.signal.reason);
    init.signal.addEventListener('abort', onAbort, { once: true });
    setTimeout(() => {
      init.signal.removeEventListener('abort', onAbort);
      const encoder = new TextEncoder();
      let i = 0;
      const body = new ReadableStream({
        async pull(controller) {
          if (i >= chunks.length) return controller.close();
          await new Promise(r => setTimeout(r, gapMs));
          controller.enqueue(encoder.encode(chunks[i++]));
        },
      });
      resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    }, headerDelayMs);
  });
}

test('fetchWithLlmTimeout passes a normal stream through untouched', async () => {
  const response = await fetchWithLlmTimeout('x', {}, LIMITS, fakeSseFetch(['data: a\n\n', 'data: b\n\n'], { gapMs: 10 }));
  assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
  assert.equal(await response.text(), 'data: a\n\ndata: b\n\n');
});

test('fetchWithLlmTimeout rejects with 504 when headers never arrive', async () => {
  await assert.rejects(
    fetchWithLlmTimeout('x', {}, LIMITS, fakeSseFetch([], { headerDelayMs: 500 })),
    err => err.status === 504 && err.llmTimeout && /headers/.test(err.details),
  );
});

test('fetchWithLlmTimeout errors the body when the stream goes idle', async () => {
  const response = await fetchWithLlmTimeout('x', {}, LIMITS, fakeSseFetch(['data: a\n\n', 'data: b\n\n'], { gapMs: 200 }));
  await assert.rejects(response.text(), err => err.status === 504 && /idle/.test(err.details));
});

test('fetchWithLlmTimeout enforces the total deadline even while chunks keep coming', async () => {
  const chunks = Array.from({ length: 50 }, () => ': keep-alive\n\n');
  const response = await fetchWithLlmTimeout('x', {}, { headersMs: 50, idleMs: 50, totalMs: 120 }, fakeSseFetch(chunks, { gapMs: 20 }));
  await assert.rejects(response.text(), err => err.status === 504 && /total/.test(err.details));
});
