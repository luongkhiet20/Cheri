const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { loadTypeScript } = require('../helpers/load-typescript.cjs');

// Authorization is deliberately separate from configuration. These gates must
// only be set after the database and isolated-fixture grants are confirmed.
const enabled = process.env.REVIEW_MONGO_INTEGRATION === '1';
const granted = process.env.REVIEW_MONGO_FIXTURE_GRANT === 'cheri-isolated-fixtures';
const confirmed = process.env.REVIEW_MONGO_DATABASE === 'cheri';
const skip = !enabled || !granted || !confirmed
  ? 'Live Mongo writes disabled: explicit integration, cheri target confirmation, and isolated-fixture grant are all required.'
  : false;

test('real Mongo review concurrency, literal text, edit identity and fresh-service persistence', { skip }, async (t) => {
  let connection;
  let phase = 'configuration';
  const owned = [];
  const run = `review-integration-${randomUUID()}`;
  let interrupted = false;
  const stop = () => { interrupted = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const check = () => { if (interrupted) throw new Error('Integration interrupted; cleaning owned fixtures.'); };
  const inventory = async (db) => {
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name).sort();
    const indexes = {};
    for (const name of collections) indexes[name] = await db.collection(name).listIndexes().toArray();
    return { collections, indexes };
  };

  try {
    // URI values remain in process memory, never in command arguments or output.
    const local = process.env.REVIEW_MONGO_CONFIG_FILE
      ? require('dotenv').parse(fs.readFileSync(process.env.REVIEW_MONGO_CONFIG_FILE)) : {};
    const uri = process.env.MONGO_URI || local.MONGO_URI || local.MONGODB_URI;
    if (!uri) throw new Error('Local Mongo configuration unavailable.');
    if (decodeURIComponent(new URL(uri).pathname.slice(1)) !== 'cheri') {
      throw new Error('Effective database is not the confirmed development target.');
    }
    phase = 'connection';
    connection = mongoose.createConnection(uri, {
      autoIndex: false, autoCreate: false, dbName: 'cheri', serverSelectionTimeoutMS: 15000,
    });
    await connection.asPromise();
    assert.equal(connection.db.databaseName, 'cheri');
    assert.equal(connection.config.autoIndex, false);
    assert.equal(connection.config.autoCreate, false);
    const before = await inventory(connection.db);
    for (const name of ['users', 'products', 'orders']) {
      assert.ok(before.collections.includes(name), `Required existing collection ${name} missing; no fixture created.`);
    }
    assert.equal(before.collections.some(name => /^reviews?$/i.test(name)), false);
    t.diagnostic('Connected only to confirmed development database cheri; existing collections verified; autoIndex/autoCreate disabled.');

    const src = path.resolve(__dirname, '../../src');
    const ProductSchema = loadTypeScript(path.join(src, 'products/schemas/product.schema.ts')).default;
    const OrderSchema = loadTypeScript(path.join(src, 'orders/schemas/order.schema.ts')).default;
    const { ProductReviewsService } = loadTypeScript(path.join(src, 'products/reviews/product-reviews.service.ts'));
    const productModel = connection.model('Product', ProductSchema, 'products');
    const orderModel = connection.model('Order', OrderSchema, 'orders');
    const userIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const productId = new mongoose.Types.ObjectId();
    const emails = userIds.map((_, i) => `${run}-${i}@example.invalid`);
    const users = userIds.map((_id, i) => ({ _id, name: `Synthetic reviewer ${i + 1}`, email: emails[i], _reviewTestRun: run }));
    const fixtures = [
      ...users.map(document => ({ collection: 'users', document })),
      { collection: 'products', document: {
        _id: productId, _reviewTestRun: run, title: 'Synthetic integration product',
        sku: run, titleUrl: run, visibility: true, vi: { visibility: true }, rating: 5, reviews: [],
      } },
      ...users.map((user, i) => ({ collection: 'orders', document: {
        _id: new mongoose.Types.ObjectId(), _reviewTestRun: run, orderId: `${run}-${i}`,
        userId: user._id, _user: user._id, items: [{ productId }],
        status: i === 0 ? 'PENDING' : 'DELIVERED', paymentStatus: i === 0 ? 'PAID' : 'PENDING',
      } })),
    ];
    phase = 'collision checks';
    assert.equal(await connection.db.collection('users').countDocuments({ $or: [{ email: { $in: emails } }, { name: { $in: users.map(u => u.name) }, _reviewTestRun: run }] }), 0);
    assert.equal(await connection.db.collection('products').countDocuments({ $or: [{ sku: run }, { titleUrl: run }] }), 0);
    assert.equal(await connection.db.collection('orders').countDocuments({ orderId: { $in: fixtures.filter(f => f.collection === 'orders').map(f => f.document.orderId) } }), 0);
    for (const fixture of fixtures) assert.equal(await connection.db.collection(fixture.collection).countDocuments({ _id: fixture.document._id }), 0);
    check();
    t.diagnostic('Collision checks passed; creating exactly two synthetic users, one product and two orders with run-owned IDs and ownership markers.');
    phase = 'fixture insertion';
    for (const fixture of fixtures) {
      check();
      // Track before acknowledgement: an uncertain insert must also be cleaned.
      owned.push(fixture);
      await connection.db.collection(fixture.collection).insertOne(fixture.document);
    }
    const service = new ProductReviewsService(productModel, orderModel);
    const id = productId.toHexString();
    let first;
    phase = 'concurrent writes';
    await t.test('ten concurrent saves produce one review for the same buyer and product', async () => {
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.saveMine(id, users[0], { rating: 5, comment: 'Concurrent synthetic review' })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 10);
      first = await service.getPage(id, 1, 10);
      assert.deepEqual(first.summary, { average: 5, count: 1 });
      assert.equal(first.reviews.length, 1);
      const persisted = await connection.db.collection('products').findOne({ _id: productId, _reviewTestRun: run }, { projection: { reviews: 1, rating: 1 } });
      assert.equal(persisted.reviews.length, 1);
      assert.equal(persisted.rating, 5);
    });
    check();
    phase = 'second buyer';
    await t.test('paid before delivery and delivered buyers are eligible; ratings five and three average four', async () => {
      assert.equal((await service.getMine(id, users[0])).eligible, true);
      assert.equal((await service.getMine(id, users[1])).eligible, true);
      const saved = await service.saveMine(id, users[1], { rating: 3, comment: 'Second synthetic review' });
      assert.deepEqual(saved.summary, { average: 4, count: 2 });
    });
    check();
    phase = 'edit and literal text';
    await t.test('editing keeps count, ID and createdAt; dollar-prefixed comment remains literal', async () => {
      const saved = await service.saveMine(id, users[0], { rating: 1, comment: '$price' });
      assert.deepEqual(saved.summary, { average: 2, count: 2 });
      assert.equal(saved.myReview.id, first.reviews[0].id);
      assert.equal(saved.myReview.createdAt, first.reviews[0].createdAt);
      assert.equal(saved.myReview.comment, '$price');
      const persisted = await connection.db.collection('products').findOne({ _id: productId, _reviewTestRun: run }, { projection: { reviews: 1, rating: 1 } });
      assert.equal(persisted.rating, 2);
      assert.equal(persisted.reviews.length, 2);
      assert.equal(persisted.reviews.find(review => review.userId.equals(userIds[0])).comment, '$price');
    });
    check();
    phase = 'fresh-service reads';
    await t.test('fresh service reads the persisted aggregate and safe public review projection', async () => {
      const fresh = new ProductReviewsService(productModel, orderModel);
      const page = await fresh.getPage(id, 1, 10);
      assert.deepEqual(page.summary, { average: 2, count: 2 });
      assert.equal((await fresh.getMine(id, users[0])).myReview.comment, '$price');
      assert.deepEqual(Object.keys(page.reviews[0]).sort(), ['authorName', 'comment', 'createdAt', 'id', 'rating', 'updatedAt']);
    });
    phase = 'collection and index invariance';
    await t.test('no collection or index is created, including a Review collection', async () => {
      assert.deepEqual(await inventory(connection.db), before);
    });
  } catch (error) {
    // Driver/config error messages can include secrets. Never expose their cause.
    if (error instanceof assert.AssertionError) throw error;
    throw new Error(`Mongo integration failed during ${phase}; underlying details suppressed.`);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (connection?.readyState === 1) {
      let remaining = 0;
      let refused = 0;
      let cleanupErrors = 0;
      for (const fixture of [...owned].reverse()) {
        try {
          const collection = connection.db.collection(fixture.collection);
          const existing = await collection.findOne({ _id: fixture.document._id }, { projection: { _reviewTestRun: 1 } });
          if (existing && existing._reviewTestRun !== run) { refused++; continue; }
          if (existing) await collection.deleteOne({ _id: fixture.document._id, _reviewTestRun: run });
          remaining += await collection.countDocuments({ _id: fixture.document._id });
        } catch { cleanupErrors++; }
      }
      t.diagnostic(`Exact-ID ownership cleanup: ${owned.length} tracked fixtures; remaining ${remaining}; refused ${refused}; errors ${cleanupErrors}.`);
      await connection.close();
      assert.equal(cleanupErrors, 0, 'Cleanup could not verify every owned fixture.');
      assert.equal(refused, 0, 'Cleanup refused an ownership mismatch.');
      assert.equal(remaining, 0, 'Owned fixtures remain after cleanup.');
    } else await connection?.close().catch(() => {});
  }
});
