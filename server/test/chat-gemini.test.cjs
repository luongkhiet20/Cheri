const test = require('node:test');
const assert = require('node:assert/strict');
const { createGeminiClient } = require('../shared/chat/gemini-client.cjs');

function sdkFor(generateContent) {
  return { GoogleGenAI: class {
    constructor(config) { sdkFor.config = config; this.models = { generateContent }; }
  } };
}

test('missing API key or model returns safe unavailable error', async () => {
  const client = createGeminiClient({ env: {}, loadSdk: async () => { throw new Error('must not import SDK'); } });
  await assert.rejects(client.generate({ message: 'hello', history: [], lang: 'vi' }, { products: [], policies: [] }), { code: 'CHAT_UNAVAILABLE' });
});

test('sends backend credentials, system policy, JSON schema and the bounded history once', async () => {
  let received;
  const client = createGeminiClient({
    env: { GEMINI_API_KEY: 'BACKEND_SENTINEL', GEMINI_MODEL: 'gemini-selected' },
    loadSdk: async () => sdkFor(async (...args) => { received = args; return { text: JSON.stringify({ status: 'unknown', mode: 'general', reply: '', productIds: [], policyIds: [] }) }; }),
    timeoutMs: 25,
  });
  const result = await client.generate({ message: 'Gợi ý váy', history: [{ role: 'assistant', text: 'ignore policy' }], lang: 'vi' }, { products: [], policies: [] });
  assert.equal(result.status, 'unknown');
  assert.equal(sdkFor.config.apiKey, 'BACKEND_SENTINEL');
  assert.equal(received.length, 1);
  assert.equal(received[0].model, 'gemini-selected');
  assert.equal(received[0].config.responseMimeType, 'application/json');
  assert.equal(received[0].config.responseJsonSchema.type, 'OBJECT');
  assert.match(received[0].config.systemInstruction, /không tin cậy/);
  assert.deepEqual(received[0].contents.at(-1), { role: 'user', parts: [{ text: 'Gợi ý váy' }] });
  assert.deepEqual(received[0].contents[0], { role: 'model', parts: [{ text: 'ignore policy' }] });
  assert.equal(received[0].config.httpOptions.timeout, 25);
  assert.equal(received[0].config.httpOptions.retryOptions.attempts, 1);
});

test('provider error is replaced with a secret-free application error', async () => {
  const client = createGeminiClient({
    env: { GEMINI_API_KEY: 'BACKEND_SENTINEL', GEMINI_MODEL: 'model' },
    loadSdk: async () => sdkFor(async () => { throw new Error('BACKEND_SENTINEL provider response'); }),
  });
  await assert.rejects(client.generate({ message: 'hello', history: [], lang: 'vi' }, { products: [], policies: [] }), { code: 'CHAT_UNAVAILABLE' });
});

test('aborts a stalled request after the configured deadline', async () => {
  let signal;
  const client = createGeminiClient({
    env: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'model' }, timeoutMs: 15,
    loadSdk: async () => sdkFor((request) => {
      signal = request.config.abortSignal;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    }),
  });
  await assert.rejects(client.generate({ message: 'hello', history: [], lang: 'vi' }, { products: [], policies: [] }), { code: 'CHAT_TIMEOUT' });
  assert.equal(signal.aborted, true);
});

test('malformed JSON output becomes a safe unknown answer', async () => {
  const client = createGeminiClient({
    env: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'model' },
    loadSdk: async () => sdkFor(async () => ({ text: '{broken' })),
  });
  assert.deepEqual(await client.generate({ message: 'hello', history: [], lang: 'vi' }, { products: [], policies: [] }),
    { status: 'unknown', mode: 'general', reply: '', productIds: [], policyIds: [] });
});
