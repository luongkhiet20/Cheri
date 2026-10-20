const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, target: 'ES2022',
});
require('ts-node/register/transpile-only');
const { ChatService } = require('../src/app/services/chat.service.ts');

test('chat service posts the contract to the storefront backend with no model credential', async () => {
  let call;
  const expected = { reply: 'Xin chào.', products: [] };
  const service = new ChatService({ post(url, body) {
    call = { url, body };
    return { subscribe(observer) { observer.next(expected); observer.complete(); return { unsubscribe() {} }; } };
  } }, { apiUrl: 'https://cheri.example' });
  const actual = await new Promise((resolve, reject) => service.send({
    message: '  Xin chào  ', history: [], lang: 'vi',
  }).subscribe({ next: resolve, error: reject }));
  assert.equal(call.url, 'https://cheri.example/api/chat');
  assert.deepEqual(call.body, { message: 'Xin chào', history: [], lang: 'vi' });
  assert.deepEqual(actual, expected);
  assert.doesNotMatch(JSON.stringify(call), /GEMINI_API_KEY|BACKEND_SENTINEL/);
});

test('chat service sends the validated previous ten turns and current language', async () => {
  let sent;
  const service = new ChatService({ post(_url, body) {
    sent = body;
    return { subscribe(observer) { observer?.next?.({ reply: 'Ok', products: [] }); observer?.complete?.(); return { unsubscribe() {} }; } };
  } }, { apiUrl: 'http://localhost:4000' });
  service.send({ message: 'Hello', history: Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user', text: `turn-${i}`,
  })), lang: 'en' }).subscribe();
  assert.equal(sent.history.length, 10);
  assert.equal(sent.lang, 'en');
});
