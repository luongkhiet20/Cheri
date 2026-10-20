const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { createMongoLimiter } = require('../shared/chat/chat-limit.cjs');

const uri = process.env.CHAT_TEST_MONGO_URI;

test('two Mongo clients enforce one shared chat request bucket', { skip: !uri && 'Set CHAT_TEST_MONGO_URI to an isolated MongoDB test server' }, async () => {
  const firstClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const secondClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const dbName = `cheri_chat_test_${randomUUID().replace(/-/g, '')}`;
  let connected = false;
  try {
    await Promise.all([firstClient.connect(), secondClient.connect()]);
    connected = true;
    const firstDb = firstClient.db(dbName);
    const secondDb = secondClient.db(dbName);
    const first = createMongoLimiter(async () => firstDb);
    const second = createMongoLimiter(async () => secondDb);
    const results = await Promise.all(Array.from({ length: 11 }, (_, index) =>
      (index % 2 ? first : second).consume('203.0.113.24', 360_000)));
    assert.equal(results.filter((entry) => entry.allowed).length, 10);
    assert.equal(results.filter((entry) => !entry.allowed).length, 1);
    assert.equal((await firstDb.collection('chat_rate_limits').countDocuments()), 1);
  } finally {
    if (connected) await firstClient.db(dbName).dropDatabase().catch(() => {});
    await Promise.allSettled([firstClient.close(), secondClient.close()]);
  }
});
