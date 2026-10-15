const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { PassportModule } = require('@nestjs/passport');
const { JwtService } = require('@nestjs/jwt');
const { getModelToken } = require('@nestjs/mongoose');
const { Types } = require('mongoose');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

// Never load AuthModule/AppModule configuration or admin-server startup in this harness.
class TestAuthModule {}
Module({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })] })(TestAuthModule);
const { ProductsModule } = loadTypeScript(path.join(__dirname, '../src/products/products.module.ts'), {
  '../auth/auth.module': { AuthModule: TestAuthModule },
});
const providers = Reflect.getMetadata('providers', ProductsModule);
const ProductsService = providers.find((value) => value.name === 'ProductsService');
const { JwtStrategy } = loadTypeScript(path.join(__dirname, '../src/auth/strategy/jwt.strategy.ts'));
const { prepareProduct } = loadTypeScript(path.join(__dirname, '../src/shared/utils/prepareUtils.ts'));
const ProductSchema = loadTypeScript(path.join(__dirname, '../src/products/schemas/product.schema.ts')).default;
const ProductDocument = require('mongoose').model('ReviewApiSyntheticProduct', ProductSchema);
const productId = 'cccccccccccccccccccccccc';
const hiddenId = 'dddddddddddddddddddddddd';
const missingId = 'eeeeeeeeeeeeeeeeeeeeeeee';
const variantId = 'ffffffffffffffffffffffff';
const buyer = { _id: new Types.ObjectId(), email: `${crypto.randomUUID()}@example.invalid`, fullName: 'Người mua thử', status: true };
const nonBuyer = { _id: new Types.ObjectId(), email: `${crypto.randomUUID()}@example.invalid`, fullName: 'Chưa mua', status: true, roles: ['admin'] };
const date = new Date('2026-01-01T00:00:00Z');
const stored = (rating, owner = buyer._id) => ({ _id: new Types.ObjectId(), userId: owner, authorName: 'Người mua thử', rating, comment: 'Tốt', createdAt: date, updatedAt: date });
let app, url, tokens, oldSecret, state;
const writes = [];
function reset() {
  state = {
    product: { _id: new Types.ObjectId(productId), titleUrl: 'san-pham-thu', rating: 5, reviews: [stored(4, nonBuyer._id)], vi: { title: 'Sản phẩm thử', salePrice: 50, regularPrice: 100, quantity: 2, visibility: true }, variants: [{ _id: variantId, price: 100, discountPrice: 50, stock: 2 }] },
    error: null,
  };
  writes.length = 0;
}
reset();
function query(read) { return { lean: async () => read(), then: (resolve, reject) => Promise.resolve().then(read).then(resolve, reject) }; }
function readProduct(filter) {
  if (state.error) throw state.error;
  if (filter.titleUrl) return filter.titleUrl === state.product.titleUrl ? state.product : null;
  if (filter._id && String(filter._id) === hiddenId) return filter.visibility ? null : { ...state.product, visibility: false };
  return filter._id && String(filter._id) === productId ? state.product : null;
}
class ProductModel {
  constructor(value) { Object.assign(this, value); this._id = new Types.ObjectId(); }
  async save() { writes.push(structuredClone(this)); }
  static findOne(filter) { return query(() => readProduct(filter)); }
  static findById(id) { return query(() => readProduct({ _id: id })); }
  static async paginate() { return { all: [state.product], total: 1, page: 1, pages: 1 }; }
  static findOneAndUpdate(filter, update) {
    return query(() => {
      if (state.error) throw state.error;
      if (!Array.isArray(update)) { writes.push(structuredClone(update.$set)); return state.product; }
      // Mongo boundary returns a known persisted document, not a JS pipeline emulator.
      state.product.reviews = [state.product.reviews[0], stored(5)];
      return state.product;
    });
  }
}
const orderModel = { collection: { find(filter) {
  assert.equal(String(filter.$or[0].userId.$in[0]), String(filter.$or[1]._user.$in[0]));
  return { toArray: async () => {
    if (state.error) throw state.error;
    return String(filter.$or[0].userId.$in[0]) === String(buyer._id)
      ? [{ userId: buyer._id, paymentStatus: 'PAID', status: 'PENDING', items: [{ productId }] }] : [];
  } };
} } };
before(async () => {
  oldSecret = process.env.JWT_SECRET;
  const secret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = secret;
  const jwt = new JwtService({ secret });
  tokens = { buyer: jwt.sign({ email: buyer.email }), nonBuyer: jwt.sign({ email: nonBuyer.email }), expired: jwt.sign({ email: buyer.email }, { expiresIn: -1 }) };
  class ApiTestModule {}
  Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: Reflect.getMetadata('controllers', ProductsModule),
    providers: [...providers, JwtStrategy,
      { provide: getModelToken('Product'), useValue: ProductModel },
      { provide: getModelToken('Order'), useValue: orderModel },
      { provide: getModelToken('User'), useValue: { findOne: async ({ email }) => [buyer, nonBuyer].find((user) => user.email === email) } },
      { provide: getModelToken('Category'), useValue: { findOne: async () => null } },
      { provide: getModelToken('ProductVariant'), useValue: { find: () => query(() => []) } },
    ],
  })(ApiTestModule);
  app = await NestFactory.create(ApiTestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});
after(async () => {
  await app?.close();
  if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  tokens = null;
});
async function request(route, { method = 'GET', actor, body } = {}) {
  const response = await fetch(url + route, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const base = `/api/products/${productId}/reviews`;

test('guest page uses canonical ID/default pagination and public projection', async () => {
  reset();
  const result = await request(base);
  assert.equal(result.status, 200);
  assert.equal(result.body.productId, productId);
  assert.deepEqual(result.body.summary, { average: 4, count: 1 });
  assert.equal(result.body.page, 1);
  assert.equal(result.body.pageSize, 10);
  assert.equal(result.body.total, 1);
  assert.deepEqual(Object.keys(result.body.reviews[0]).sort(), ['authorName', 'comment', 'createdAt', 'id', 'rating', 'updatedAt']);
  assert.equal(JSON.stringify(result.body).includes('userId'), false);
  assert.equal((await request(`${base}?page=2&pageSize=1`)).body.reviews.length, 0);
});
test('me and PUT require valid JWT; admin cannot bypass purchase eligibility', async () => {
  reset();
  assert.equal((await request(`${base}/me`)).status, 401);
  assert.equal((await request(`${base}/me`, { actor: 'expired' })).status, 401);
  assert.equal((await request(`${base}/me`, { method: 'PUT', body: { rating: 5, comment: 'Tốt' } })).status, 401);
  const mine = await request(`${base}/me`, { actor: 'nonBuyer' });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.eligible, false);
  assert.equal(mine.body.reason, 'NOT_PURCHASED');
  assert.equal((await request(`${base}/me`, { method: 'PUT', actor: 'nonBuyer', body: { rating: 5, comment: 'Tốt' } })).status, 403);
});
test('eligible PUT returns persisted first page and own review with summary', async () => {
  reset();
  assert.equal((await request(`${base}/me`, { actor: 'buyer' })).body.eligible, true);
  const result = await request(`${base}/me`, { method: 'PUT', actor: 'buyer', body: { rating: 5, comment: '  Tốt  ' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, { average: 4.5, count: 2 });
  assert.equal(result.body.page, 1);
  assert.equal(result.body.pageSize, 10);
  assert.equal(result.body.myReview.rating, 5);
  assert.equal(result.body.myReview.comment, 'Tốt');
  assert.equal(result.body.reviews.length, 2);
  assert.equal(JSON.stringify(result.body).includes('userId'), false);
});
test('pagination/body validation rejects invalid numbers, whitespace and forged fields', async () => {
  reset();
  for (const query of ['page=0', 'page=1.5', 'pageSize=51', 'pageSize=0', 'page=abc']) {
    assert.equal((await request(`${base}?${query}`)).status, 400, query);
  }
  for (const body of [{ rating: '5', comment: 'Tốt' }, { rating: 1.5, comment: 'Tốt' }, { rating: 6, comment: 'Tốt' }, { rating: 5, comment: '  ' }, { rating: 5, comment: 'x'.repeat(1001) }, { rating: 5, comment: 'Tốt', userId: String(nonBuyer._id) }, { rating: 5, comment: 'Tốt', variantId }]) {
    assert.equal((await request(`${base}/me`, { method: 'PUT', actor: 'buyer', body })).status, 400);
  }
  assert.equal((await request(`${base}/me`, { method: 'PUT', actor: 'buyer', body: { rating: 5, comment: `  ${'x'.repeat(1000)}  ` } })).status, 200);
});
test('invalid IDs fail 400; absent/hidden/variant products fail 404 for every operation', async () => {
  reset();
  for (const [id, status] of [['san-pham-thu', 400], ['bad', 400], [missingId, 404], [hiddenId, 404], [variantId, 404]]) {
    const path = `/api/products/${id}/reviews`;
    assert.equal((await request(path)).status, status);
    assert.equal((await request(`${path}/me`, { actor: 'buyer' })).status, status);
    assert.equal((await request(`${path}/me`, { method: 'PUT', actor: 'buyer', body: { rating: 5, comment: 'Tốt' } })).status, status);
  }
});
test('unexpected model errors become generic 5xx without URI/stack disclosure', async () => {
  reset();
  const internalUri = `mongodb://${crypto.randomUUID()}.invalid`;
  state.error = new Error(`synthetic internal connection details ${internalUri}`);
  for (const options of [{}, { actor: 'buyer' }, { method: 'PUT', actor: 'buyer', body: { rating: 5, comment: 'Tốt' } }]) {
    const result = await request(options.actor ? `${base}/me` : base, options);
    assert.equal(result.status, 500);
    assert.equal(JSON.stringify(result.body).includes('synthetic internal'), false);
    assert.equal(JSON.stringify(result.body).includes(internalUri), false);
    assert.equal(Object.hasOwn(result.body, 'stack'), false);
  }
});
test('product serializers return canonical summary after polluted language data and omit raw review identity', async () => {
  reset();
  Object.assign(state.product.vi, { reviews: state.product.reviews, review: { userId: 'private' }, userId: 'private', rating: 99, reviewSummary: { average: 99, count: 99 }, reviewCount: 99 });
  for (const input of [state.product, new ProductDocument(state.product)]) {
    for (const light of [false, true]) {
      const result = prepareProduct(input, 'vi', light);
      assert.deepEqual(result.reviewSummary, { average: 4, count: 1 });
      assert.equal(Object.hasOwn(result, 'reviews'), false);
      assert.equal(JSON.stringify(result).includes('userId'), false);
      assert.equal(result.rating, 5);
      assert.equal(result.salePrice, 50);
      assert.equal(result.quantity, 2);
    }
  }
  assert.deepEqual(prepareProduct({ rating: 5, vi: { title: 'Chưa đánh giá' } }, 'vi').reviewSummary, { average: null, count: 0 });
  for (const route of ['/api/products/san-pham-thu', '/api/products/san-pham-thu?lang=vi', '/api/products?lang=vi']) {
    const result = await request(route);
    assert.equal(result.status, 200);
    const product = result.body.all ? result.body.all[0] : result.body;
    assert.equal(product._id, productId);
    assert.deepEqual(product.reviewSummary, { average: 4, count: 1 });
    assert.equal(Object.hasOwn(product, 'reviews'), false);
    assert.equal(JSON.stringify(product).includes('userId'), false);
  }
});
test('public language whitelist retains legacy SKU, media and embedded variant output', () => {
  const variants = [{ sku: 'VAR', price: 100, stock: 3 }];
  const result = prepareProduct({ _id: new Types.ObjectId(productId), vi: { title: 'Cũ', sku: 'LANG', mainImage: { url: 'legacy' }, images: ['legacy'], tags: ['Thử'], variants } }, 'vi');
  assert.equal(result.sku, 'LANG');
  assert.equal(result.mainImage.url, 'legacy');
  assert.deepEqual(result.images, ['legacy']);
  assert.deepEqual(result.tags, ['Thử']);
  assert.deepEqual(result.variants, variants);
});

test('profile deep link resolves a canonical product ID even without a slug', async () => {
  reset();
  delete state.product.titleUrl;
  const result = await request(`/api/products/${productId}?lang=vi`);
  assert.equal(result.status, 200);
  assert.equal(result.body._id, productId);
  assert.equal(result.body.title, 'Sản phẩm thử');
  assert.deepEqual(result.body.reviewSummary, { average: 4, count: 1 });
  assert.equal(result.body.variants[0]._id, variantId);
});

test('canonical detail links preserve hidden-product visibility and cannot open private review operations', async () => {
  reset();
  const detail = await request(`/api/products/${hiddenId}?lang=vi`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.visibility, false);
  for (const options of [{}, { actor: 'buyer' }, { method: 'PUT', actor: 'buyer', body: { rating: 5, comment: 'Fixture' } }]) {
    const route = `/api/products/${hiddenId}/reviews${options.actor ? '/me' : ''}`;
    assert.equal((await request(route, options)).status, 404);
  }
});
function writeBody() {
  return { titleUrl: 'new-product', title: 'Hợp lệ', mainImage: { url: 'fixture' }, tags: [], reviews: [stored(1)], rating: 1, reviewSummary: { average: 1, count: 1 }, reviewCount: 1,
    'reviews.0.rating': 1, 'vi.reviewSummary.count': 9, $set: { rating: 1 },
    vi: { title: 'Hợp lệ', categoryLevel1: 'Thử', regularPrice: 100, salePrice: 50, quantity: 3, reviews: [stored(1)], rating: 1, reviewSummary: { average: 1, count: 1 }, reviewCount: 1, 'reviews.0.rating': 1 },
  };
}
function assertProtected(value) {
  for (const key of Object.keys(value)) {
    assert.equal(key.startsWith('$'), false, key);
    assert.equal(key.split('.').some((segment) => ['reviews', 'rating', 'reviewSummary', 'reviewCount'].includes(segment)), false, key);
  }
  if (value.vi) assertProtected(value.vi);
}
test('Nest add/edit/import preserve product data while excluding protected/dotted/operator writes', async () => {
  reset();
  const service = app.get(ProductsService);
  await service.addProduct(writeBody(), buyer);
  await service.editProduct({ ...writeBody(), _id: productId });
  assert.deepEqual(await service.importProducts([writeBody()], buyer), { imported: 1, errors: [] });
  assert.equal(writes.length, 3);
  for (const value of writes) {
    assertProtected(value);
    assert.equal(value['vi.title'] || value.vi.title, 'Hợp lệ');
    assert.equal(value['vi.salePrice'] || value.vi.salePrice, 50);
  }
});

// Extract only the existing route callbacks and stateless format/slug helpers.
// Source parsing is a harness, never an assertion: all checks below execute real consumers.
function adminHandlers(collection) {
  const file = path.join(__dirname, '../admin-server.js');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const wanted = new Set(['post /api/products', 'put /api/products/:id', 'post /api/products/import-csv', 'get /api/products', 'get /api/products/:id']);
  const context = vm.createContext({ db: { collection: () => collection }, ObjectId: Types.ObjectId, console,
    sanitizeProductWrite: fs.existsSync(path.join(__dirname, '../shared/product-write-fields.cjs')) ? require('../shared/product-write-fields.cjs').sanitizeProductWrite : undefined });
  const routes = {};
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && ['generateSlug', 'formatProduct', 'omitReviewArrays'].includes(node.name?.text)) vm.runInContext(node.getText(source), context);
    if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) continue;
    const call = node.expression;
    if (!ts.isPropertyAccessExpression(call.expression) || call.expression.expression.getText(source) !== 'app' || !ts.isStringLiteral(call.arguments[0])) continue;
    const key = `${call.expression.name.text} ${call.arguments[0].text}`;
    if (wanted.has(key)) routes[key] = vm.runInContext(`(${call.arguments[1].getText(source)})`, context);
  }
  return { ...routes, formatProduct: context.formatProduct };
}
function response() { return { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
test('public fallback list and detail responses omit embedded reviewer identities and include canonical summary', async () => {
  const sourceProduct = { _id: new Types.ObjectId(productId), titleUrl: 'sample', rating: 5,
    reviews: [{ userId: 'private-user', rating: 4, comment: 'Great' }, { userId: 'another-private-user', rating: 2 }],
    vi: { title: 'Sample', reviews: [{ userId: 'nested-private-user', rating: 1 }] } };
  const collection = {
    countDocuments: async () => 1,
    find: () => ({ sort() { return this; }, skip() { return this; }, limit() { return this; }, toArray: async () => [sourceProduct] }),
    findOne: async () => sourceProduct,
  };
  const handlers = adminHandlers(collection);
  const list = response();
  await handlers['get /api/products']({ query: {}, headers: {} }, list);
  const detail = response();
  await handlers['get /api/products/:id']({ params: { id: productId }, query: {}, headers: {} }, detail);
  assert.equal(JSON.stringify(detail.body.raw).includes('private-user'), false);
  for (const product of [list.body.products[0], detail.body.data]) {
    assert.equal(JSON.stringify(product.reviewSummary), JSON.stringify({ average: 3, count: 2 }));
    assert.equal(Array.isArray(product.raw.reviews), false, JSON.stringify(product.raw));
    assert.equal(JSON.stringify(product).includes('private-user'), false);
  }
  assert.equal(sourceProduct.reviews.length, 2);
});
test('admin add/edit/import execute real whitelist consumers without startup and preserve existing review state', async () => {
  let document = { _id: new Types.ObjectId(productId), titleUrl: 'existing', reviews: [stored(4)], rating: 4, reviewSummary: { average: 4, count: 1 }, reviewCount: 1, vi: { title: 'Cũ', regularPrice: 100, salePrice: 50 } };
  const saved = [];
  const collection = {
    findOne: async () => document,
    insertOne: async (value) => { saved.push(value); return { insertedId: new Types.ObjectId() }; },
    updateOne: async (_filter, update) => { saved.push(update.$set); for (const [key, value] of Object.entries(update.$set)) { if (!key.includes('.')) document[key] = value; } },
  };
  const handlers = adminHandlers(collection);
  for (const [key, body] of [['post /api/products', writeBody()], ['put /api/products/:id', writeBody()], ['post /api/products/import-csv', { products: [writeBody()] }]]) {
    const res = response();
    await handlers[key]({ params: { id: productId }, body }, res);
    assert.ok(res.statusCode < 300, key);
  }
  assert.equal(saved.length, 3);
  for (const value of saved) { assertProtected(value); assert.equal(value['vi.title'] || value.vi.title, 'Hợp lệ'); }
  assert.equal(document.reviews.length, 1);
  assert.equal(document.rating, 4);
  assert.deepEqual(document.reviewSummary, { average: 4, count: 1 });
  // Exercise admin CSV create branch as well as existing-product update.
  document = null;
  const res = response();
  await handlers['post /api/products/import-csv']({ body: { products: [writeBody()] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.createdCount, 1);
  assertProtected(saved[3]);
});
