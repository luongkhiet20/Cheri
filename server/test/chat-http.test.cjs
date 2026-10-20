const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createChatRouter, createChatBodyGate } = require('../src/routes/chat-routes.js');

async function withServer(router, run) {
  const app = express();
  app.use('/api/chat', router);
  app.use(express.json({ limit: '10mb' }));
  app.post('/other', (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
}

test('Express chat endpoint returns the same handler contract and trusted client address', async () => {
  let forwardedClient;
  const router = createChatRouter({
    isVercel: () => true,
    resolve(req, vercel) { forwardedClient = req.headers['x-forwarded-for']; return vercel ? 'verified-proxy-client' : 'socket-client'; },
    handler: async (body, client) => ({ status: 200, headers: {}, body: { reply: body.message, products: [], client } }),
  });
  await withServer(router, async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.3' }, body: JSON.stringify({ message: 'hello' }) });
    assert.deepEqual(await response.json(), { reply: 'hello', products: [], client: 'verified-proxy-client' });
    assert.equal(forwardedClient, '198.51.100.3');
  });
});

test('Express rejects over-limit JSON before the global parser and keeps its error private', async () => {
  let called = false;
  const router = createChatRouter({ handler: async () => { called = true; return { status: 200, headers: {}, body: {} }; } });
  await withServer(router, async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung gửi quá dài.' } });
    assert.equal(called, false);
  });
});

test('Express translates malformed JSON and wrong methods without exposing parser details', async () => {
  const router = createChatRouter({ handler: async () => ({ status: 200, headers: {}, body: {} }) });
  await withServer(router, async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_REQUEST', message: 'Tin nhắn chưa hợp lệ. Bạn kiểm tra lại nội dung nhé.' } });
  });
});

test('Nest body gate runs before the application 10 MiB body parser', async () => {
  const gate = createChatBodyGate({ express });
  await withServer(gate, async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  });
});

test('the production Express store mount checks the 16 KiB limit before its 10 MiB parser', async () => {
  const hadUri = Object.hasOwn(process.env, 'MONGO_URI');
  if (!hadUri) process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/chat_route_test';
  let app;
  try {
    app = require('../admin-server').app;
  } finally {
    if (!hadUri) delete process.env.MONGO_URI;
  }
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(17000) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
