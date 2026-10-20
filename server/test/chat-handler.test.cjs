const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatHandler } = require('../shared/chat/chat-handler.cjs');

function setup(overrides = {}) {
  let providerCalls = 0;
  const dependencies = {
    getDb: async () => ({}),
    limiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 60 }) },
    loadContext: async () => ({ products: [], policies: [] }),
    gemini: { generate: async () => { providerCalls++; return { status: 'unknown' }; } },
    finalize: (answer) => ({ reply: answer.status, products: [] }),
    logger: { warn() {} },
    ...overrides,
  };
  return { handler: createChatHandler(dependencies), get providerCalls() { return providerCalls; } };
}

test('returns finalized response for a valid message', async () => {
  const instance = setup();
  assert.deepEqual(await instance.handler({ message: 'hello' }, 'client'), { status: 200, body: { reply: 'unknown', products: [] }, headers: {} });
  assert.equal(instance.providerCalls, 1);
});

test('rejects malformed messages before spending a provider call', async () => {
  const instance = setup();
  const result = await instance.handler({ message: 'x'.repeat(1001) }, 'client');
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_REQUEST');
  assert.equal(instance.providerCalls, 0);
});

test('enforces rate limits and reports Retry-After', async () => {
  const instance = setup({ limiter: { consume: async () => ({ allowed: false, retryAfterSeconds: 21 }) } });
  const result = await instance.handler({ message: 'hello' }, 'client');
  assert.equal(result.status, 429);
  assert.equal(result.headers['Retry-After'], '21');
  assert.equal(instance.providerCalls, 0);
});

test('maps deadline and context errors to sanitized application errors', async () => {
  const timedOut = setup({ gemini: { generate: async () => { throw Object.assign(new Error('private'), { code: 'CHAT_TIMEOUT' }); } } });
  assert.equal((await timedOut.handler({ message: 'hello' }, 'client')).status, 504);
  const contextFailed = setup({ loadContext: async () => { throw new Error('mongodb private uri'); } });
  assert.deepEqual(await contextFailed.handler({ message: 'hello' }, 'client'), {
    status: 503,
    body: { error: { code: 'CHAT_UNAVAILABLE', message: 'Chat hiện chưa thể phản hồi. Bạn thử lại sau nhé.' } },
    headers: {},
  });
});
