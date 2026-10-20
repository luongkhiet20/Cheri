const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, emitDecoratorMetadata: true, target: 'ES2022',
});
require('ts-node/register/transpile-only');

const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const express = require('express');
const { ChatController } = require('../src/chat/chat.controller.ts');
const { ChatService } = require('../src/chat/chat.service.ts');
const { createChatBodyGate } = require('../src/routes/chat-routes.js');

class TestChatService {
  async handle(body, key) {
    if (body?.message === 'unavailable') {
      return { status: 503, headers: {}, body: { error: { code: 'CHAT_UNAVAILABLE', message: 'Chat unavailable' } } };
    }
    return { status: 200, headers: {}, body: { reply: body.message, products: [], key } };
  }
}
class ChatTestModule {}
Module({ controllers: [ChatController], providers: [{ provide: ChatService, useClass: TestChatService }] })(ChatTestModule);

async function withNest(run) {
  const app = await NestFactory.create(ChatTestModule, { logger: false, bodyParser: false });
  const adapter = app.getHttpAdapter().getInstance();
  adapter.use('/api/chat', createChatBodyGate({ express }));
  await app.listen(0, '127.0.0.1');
  try { await run(`http://127.0.0.1:${app.getHttpServer().address().port}`); }
  finally { await app.close(); }
}

test('Nest route uses the shared API shape and status mapping', async () => {
  await withNest(async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'hello');
    const unavailable = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'unavailable' }) });
    assert.equal(unavailable.status, 503);
  });
});

test('Nest route rejects large bodies before parsing application JSON', async () => {
  await withNest(async (base) => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  });
});
