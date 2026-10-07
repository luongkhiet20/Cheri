const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDemoOrders, openSeedDatabase, syncDemoOrders } = require('../src/scripts/demo-order-seed-core.cjs');

const allowedEnv = {
  SEED_DEMO_ORDERS: 'true',
  SEED_DEMO_DB_NAME: 'cheri_dev',
  SEED_DEMO_ALLOWED_DATABASE: 'cheri_dev',
  MONGO_URI: 'mongodb://127.0.0.1:27017/cheri_dev',
};

test('refuses to seed unless the caller explicitly opts in and names the development DB twice', async () => {
  await assert.rejects(openSeedDatabase({}, () => assert.fail('must not connect')), /explicitly enable demo seeding/i);
  await assert.rejects(openSeedDatabase({
    ...allowedEnv,
    SEED_DEMO_ORDERS: 'false',
  }, () => assert.fail('must not connect')), /explicitly enable demo seeding/i);
  await assert.rejects(openSeedDatabase({
    ...allowedEnv,
    SEED_DEMO_ALLOWED_DATABASE: '',
  }, () => assert.fail('must not connect')), /must explicitly match/i);
});

test('rejects production targets and a database name that differs from the URI', async () => {
  await assert.rejects(openSeedDatabase({
    SEED_DEMO_ORDERS: 'true',
    SEED_DEMO_DB_NAME: 'cheri_prod',
    SEED_DEMO_ALLOWED_DATABASE: 'cheri_prod',
    MONGO_URI: 'mongodb://127.0.0.1:27017/cheri_prod',
  }, () => assert.fail('must not connect')), /production/i);
  await assert.rejects(openSeedDatabase({
    SEED_DEMO_ORDERS: 'true',
    SEED_DEMO_DB_NAME: 'cheri_dev',
    SEED_DEMO_ALLOWED_DATABASE: 'cheri_dev',
    MONGO_URI: 'mongodb://127.0.0.1:27017/cheri_other_dev',
  }, () => assert.fail('must not connect')), /does not match/i);
});

test('connects only after exact development target authorization', async () => {
  let connectedTo;
  const connection = { close: async () => {} };
  const result = await openSeedDatabase(allowedEnv, async (uri, options) => {
    connectedTo = { uri, options };
    return connection;
  });
  assert.equal(result, connection);
  assert.deepEqual(connectedTo, {
    uri: allowedEnv.MONGO_URI,
    options: { dbName: 'cheri_dev' },
  });
});

test('builds the same clearly marked demo records without mutating source data', () => {
  const product = {
    _id: '507f1f77bcf86cd799439011', sku: 'SKU-1', title: 'Demo product',
    mainImage: { url: '/demo.png' }, regularPrice: 120000, salePrice: 99000,
  };
  const paymentMethods = [
    { _id: '507f1f77bcf86cd799439013', code: 'BANK', name: 'Bank transfer', paymentType: 'BANK_TRANSFER', status: 'INACTIVE' },
    { _id: '507f1f77bcf86cd799439012', code: 'COD', name: 'Cash', paymentType: 'CASH', status: 'ACTIVE' },
  ];
  const shippingMethod = {
    _id: '507f1f77bcf86cd799439014', code: 'STANDARD', name: 'Standard',
    baseFee: 10000, estimatedDeliveryTime: '3-5 days',
  };
  const source = { product, paymentMethods, shippingMethod };
  const first = buildDemoOrders(source);
  const second = buildDemoOrders(source);

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.ok(first.every(order => order.orderId.startsWith('DEMO-ORDER-2026-')));
  assert.ok(first.every(order => order.notes.startsWith('DEMO-SEED:v1:')));
  assert.ok(first.every(order => order.items[0].productId === product._id));
  assert.ok(first.every(order => order.paymentMethodId));
  assert.ok(first.every(order => order.customerEmail.endsWith('@example.invalid')));
  assert.equal(first[0].paymentMethodSnapshot.code, 'COD');
  assert.equal(first[2].paymentMethodSnapshot.code, 'BANK');
  assert.equal(first[2].status, 'RETURNED');
  assert.equal(first[2].paymentStatus, 'REFUNDED');
  assert.deepEqual(source, { product, paymentMethods, shippingMethod });
});

function inMemoryOrdersCollection(initial = []) {
  const documents = new Map(initial.map(document => [document.orderId, structuredClone(document)]));
  return {
    documents,
    async findOne({ orderId }) {
      return documents.has(orderId) ? structuredClone(documents.get(orderId)) : null;
    },
    async replaceOne(filter, replacement) {
      const existing = documents.get(filter.orderId);
      if (existing && existing.notes !== filter.notes) {
        const error = new Error('duplicate orderId');
        error.code = 11000;
        throw error;
      }
      documents.set(filter.orderId, structuredClone(replacement));
      return existing ? { matchedCount: 1, upsertedCount: 0 } : { matchedCount: 0, upsertedCount: 1 };
    },
  };
}

test('demo order synchronization is idempotent and refuses all writes on an ID collision', async () => {
  const demoOrders = [
    { orderId: 'DEMO-ORDER-2026-001', notes: 'DEMO-SEED:v1:001', value: 1 },
    { orderId: 'DEMO-ORDER-2026-002', notes: 'DEMO-SEED:v1:002', value: 2 },
  ];
  const collection = inMemoryOrdersCollection();

  assert.deepEqual(await syncDemoOrders(collection, demoOrders), { inserted: 2, refreshed: 0 });
  assert.deepEqual(await syncDemoOrders(collection, demoOrders), { inserted: 0, refreshed: 2 });
  assert.equal(collection.documents.size, 2);

  const collision = inMemoryOrdersCollection([
    { orderId: 'DEMO-ORDER-2026-002', notes: 'customer order', value: 'must stay untouched' },
  ]);
  await assert.rejects(syncDemoOrders(collision, demoOrders), /reserved ID/i);
  assert.deepEqual([...collision.documents.values()], [
    { orderId: 'DEMO-ORDER-2026-002', notes: 'customer order', value: 'must stay untouched' },
  ]);
});
