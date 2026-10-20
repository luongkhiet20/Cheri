const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatRouter } = require('../src/routes/chat-routes.js');
const { resolveClientKey } = require('../shared/chat/chat-limit.cjs');

test('forwarded client IP is trusted only when the platform is Vercel', () => {
  const request = { headers: { 'x-forwarded-for': '203.0.113.7, 192.168.0.1' }, socket: { remoteAddress: '10.1.0.1' } };
  assert.equal(resolveClientKey(request, false), '10.1.0.1');
  assert.equal(resolveClientKey(request, true), '203.0.113.7');
});

test('chat routes mount as an Express router without exposing Gemini dependencies to the router', () => {
  const route = createChatRouter({ handler: async () => ({ status: 200, headers: {}, body: { reply: 'ok', products: [] } }) });
  assert.equal(typeof route, 'function');
  assert.equal(route.stack.some((layer) => layer.route?.path === '/'), true);
});

test('shared route returns stable status, error and retry headers from the core handler', async () => {
  const router = createChatRouter({ handler: async () => ({
    status: 429, headers: { 'Retry-After': '17' },
    body: { error: { code: 'RATE_LIMITED', message: 'Thử lại sau nhé.' } },
  }) });
  const app = require('express')();
  const http = require('node:http');
  app.use('/api/chat', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello' }),
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '17');
    assert.deepEqual((await response.json()).error.code, 'RATE_LIMITED');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
