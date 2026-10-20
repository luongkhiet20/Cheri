const test = require('node:test');
const assert = require('node:assert/strict');

const hadMongoUri = Object.hasOwn(process.env, 'MONGO_URI');
if (!hadMongoUri) process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/chat_proxy_test';
const api = require('./index.js');
if (!hadMongoUri) delete process.env.MONGO_URI;

function response() {
  return {
    statusCode: 200, body: null,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('Vercel wrapper sanitizes Mongo initialization failure for chat', async () => {
  const handler = api.createApiHandler({
    app() { throw new Error('must not invoke route'); },
    connectToMongo: async () => { throw new Error('private mongodb uri'); },
  });
  const res = response();
  await handler({ method: 'POST', originalUrl: '/api/chat' }, res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: { code: 'CHAT_UNAVAILABLE', message: 'Chat hiện chưa thể phản hồi. Bạn thử lại sau nhé.' } });
});

test('Vercel wrapper preserves non-chat connection failure without leaking details', async () => {
  const handler = api.createApiHandler({ app() {}, connectToMongo: async () => { throw new Error('private uri'); } });
  await assert.rejects(handler({ method: 'GET', originalUrl: '/api/products' }, response()), { message: 'Backend database connection failed' });
});

test('Vercel wrapper forwards normal requests after the shared Mongo connection is ready', async () => {
  const req = { method: 'POST', originalUrl: '/api/chat' };
  const res = response();
  const handler = api.createApiHandler({
    connectToMongo: async () => ({ ok: true }),
    app(actualReq, actualRes) { assert.equal(actualReq, req); actualRes.status(200).json({ reply: 'ok' }); },
  });
  await handler(req, res);
  assert.deepEqual(res.body, { reply: 'ok' });
});
