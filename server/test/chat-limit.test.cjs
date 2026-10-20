const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoLimiter, resolveClientKey } = require('../shared/chat/chat-limit.cjs');

function memoryDb() {
  const records = new Map();
  const indexes = [];
  return {
    records, indexes,
    collection(name) {
      assert.equal(name, 'chat_rate_limits');
      return {
        async createIndex(keys, options) { indexes.push({ keys, options }); },
        async findOneAndUpdate(filter, update, options) {
          assert.equal(options.upsert, true);
          const row = records.get(filter._id) || { ...update.$setOnInsert, count: 0, _id: filter._id };
          row.count += update.$inc.count;
          records.set(filter._id, row);
          return structuredClone(row);
        },
        async updateOne(filter, update) {
          const row = records.get(filter._id);
          if (row) row.count += update.$inc.count;
          return { matchedCount: row ? 1 : 0 };
        },
        async findOne(filter) { return structuredClone(records.get(filter._id) ?? null); },
      };
    },
  };
}

test('ten requests per client-minute are shared across limiter instances', async () => {
  const db = memoryDb();
  const first = createMongoLimiter(async () => db);
  const second = createMongoLimiter(async () => db);
  const results = await Promise.all(Array.from({ length: 11 }, (_, i) =>
    (i % 2 ? first : second).consume('198.51.100.18', 180_000)));
  assert.equal(results.filter((entry) => entry.allowed).length, 10);
  assert.equal(results.filter((entry) => !entry.allowed).length, 1);
  assert.equal(db.indexes.length, 1);
  assert.deepEqual(db.indexes[0], { keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } });
  assert.doesNotMatch([...db.records.keys()][0], /198\.51\.100\.18/);
});

test('minute boundary resets request quota even if TTL cleanup has not run', async () => {
  const db = memoryDb();
  const limiter = createMongoLimiter(async () => db);
  for (let i = 0; i < 10; i++) await limiter.consume('client', 180_001);
  assert.equal((await limiter.consume('client', 180_002)).allowed, false);
  assert.equal((await limiter.consume('client', 240_001)).allowed, true);
});

test('untrusted forwarded headers do not control client identity', () => {
  assert.equal(resolveClientKey({ headers: { 'x-forwarded-for': '203.0.113.9' }, socket: { remoteAddress: '10.0.0.2' } }, false), '10.0.0.2');
  assert.equal(resolveClientKey({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.2' } }, true), '203.0.113.9');
  assert.equal(resolveClientKey({ headers: { 'x-forwarded-for': 'not-an-ip, forged' } }, true), 'unknown');
});
