const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const mongoose = require('mongoose');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const { validateReviewDraft, buildReviewUpdatePipeline, summarizeReviews, toPublicReview } =
  loadTypeScript(path.join(__dirname, '../src/products/reviews/review-write.ts'));
const { ProductReviewsService } =
  loadTypeScript(path.join(__dirname, '../src/products/reviews/product-reviews.service.ts'));
const { Types } = mongoose;
const productId = 'cccccccccccccccccccccccc';
const userId = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
const otherUserId = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');
const reviewId = new Types.ObjectId('dddddddddddddddddddddddd');
const date = new Date('2026-01-01T00:00:00Z');
const user = { _id: userId, name: 'Tên thử nghiệm', fullName: '', email: 'fixture@example.invalid' };
const draft = { rating: 5, comment: '$price <b>plain text</b>' };
const publicFixture = {
  id: 'dddddddddddddddddddddddd', authorName: 'Tên thử nghiệm', rating: 5, comment: 'Tốt',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
function review(overrides = {}) {
  return { _id: reviewId, userId, authorName: user.name, rating: 5, comment: 'Tốt', createdAt: date, updatedAt: date, ...overrides };
}
function repositories({ product = { _id: new Types.ObjectId(productId), reviews: [] }, orders, updated, readError, writeError, orderError } = {}) {
  const reads = [], writes = [], orderReads = [];
  const productModel = {
    findOne(filter, projection) {
      reads.push({ filter, projection });
      return { lean: async () => { if (readError) throw readError; return product; } };
    },
    findOneAndUpdate(filter, pipeline, options) {
      writes.push({ filter, pipeline, options });
      return { lean: async () => { if (writeError) throw writeError; return updated === undefined ? product : updated; } };
    },
  };
  const orderModel = { collection: { find(filter, options) {
    orderReads.push({ filter, options });
    return { toArray: async () => {
      if (orderError) throw orderError;
      return orders ?? [{ userId, status: 'PENDING', paymentStatus: 'PAID', items: [{ productId }] }];
    } };
  } } };
  return { service: new ProductReviewsService(productModel, orderModel), reads, writes, orderReads };
}

test('draft validation trims text and preserves the exact 1000 character boundary', () => {
  assert.deepEqual(validateReviewDraft({ rating: 5, comment: '  Tốt  ' }), { rating: 5, comment: 'Tốt' });
  assert.deepEqual(validateReviewDraft({ rating: 1, comment: 'x'.repeat(1000) }), { rating: 1, comment: 'x'.repeat(1000) });
  assert.deepEqual(validateReviewDraft(draft), draft);
});
for (const input of [null, [], {}, { rating: 0, comment: 'Tốt' }, { rating: 6, comment: 'Tốt' }, { rating: 1.5, comment: 'Tốt' }, { rating: '5', comment: 'Tốt' }, { rating: 5, comment: '  ' }, { rating: 5, comment: 'x'.repeat(1001) }, { rating: 5, comment: 9 }, ...['userId', 'variantId', 'authorName', 'createdAt', 'average'].map((field) => ({ rating: 5, comment: 'Tốt', [field]: 'forged' }))]) {
  test(`draft rejects malformed or extra input ${JSON.stringify(input).slice(0, 100)}`, () => {
    assert.throws(() => validateReviewDraft(input), (error) => error.getStatus() === 400);
  });
}
test('summary counts only stored reviews and retains unrounded averages', () => {
  assert.deepEqual(summarizeReviews([]), { average: null, count: 0 });
  assert.deepEqual(summarizeReviews([{ rating: 5 }, { rating: 4 }]), { average: 4.5, count: 2 });
  assert.deepEqual(summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { average: 13 / 3, count: 3 });
});
test('public projection includes only safe fields and never an email author', () => {
  const result = toPublicReview(review({ authorName: 'fixture@example.invalid', orderId: 'secret', email: 'fixture@example.invalid' }));
  assert.deepEqual(Object.keys(result).sort(), ['authorName', 'comment', 'createdAt', 'id', 'rating', 'updatedAt']);
  assert.equal(result.authorName, 'Khách hàng');
  assert.equal(result.id, 'dddddddddddddddddddddddd');
  assert.equal(result.createdAt, '2026-01-01T00:00:00.000Z');
});
test('pipeline uses literals, dedups the owner, preserves original ID/date, and computes rating after replacement', () => {
  const pipeline = buildReviewUpdatePipeline(userId, reviewId, '$name', draft, date);
  assert.equal(pipeline.length, 2);
  const expression = pipeline[0].$set.reviews.$let;
  assert.deepEqual(expression.vars.reviews, { $ifNull: ['$reviews', []] });
  const update = expression.in.$let;
  assert.deepEqual(update.vars.existing.$arrayElemAt[0].$filter.cond, { $eq: [{ $toLower: { $convert: { input: '$$review.userId', to: 'string', onError: '', onNull: '' } } }, { $literal: 'aaaaaaaaaaaaaaaaaaaaaaaa' }] });
  const [remaining, replacement] = update.in.$concatArrays;
  assert.equal(remaining.$filter.cond.$ne[1].$literal, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(replacement.length, 1);
  const entry = replacement[0];
  assert.deepEqual(entry._id, { $ifNull: ['$$existing._id', { $literal: reviewId }] });
  assert.deepEqual(entry.createdAt, { $ifNull: ['$$existing.createdAt', { $literal: date }] });
  assert.deepEqual(entry.userId, { $literal: userId });
  assert.deepEqual(entry.authorName, { $literal: '$name' });
  assert.deepEqual(entry.comment, { $literal: '$price <b>plain text</b>' });
  assert.deepEqual(entry.rating, { $literal: 5 });
  assert.deepEqual(entry.updatedAt, { $literal: date });
  assert.deepEqual(pipeline[1].$set.rating, { $cond: [{ $eq: [{ $size: '$reviews' }, 0] }, null, { $avg: '$reviews.rating' }] });
});
test('schema embeds reviews in existing Product without rating defaults counting as reviews', () => {
  const ProductSchema = loadTypeScript(path.join(__dirname, '../src/products/schemas/product.schema.ts')).default;
  const Product = mongoose.model('ReviewPersistenceSyntheticProduct', ProductSchema);
  const product = new Product({ titleUrl: 'synthetic', mainImage: { url: 'synthetic' } });
  assert.deepEqual(product.reviews.toObject(), []);
  product.reviews.push(review());
  assert.equal(product.validateSync(), undefined);
  assert.equal(product.reviews[0].userId.toHexString(), 'aaaaaaaaaaaaaaaaaaaaaaaa');
});
test('page returns newest reviews with stable descending ID tie break and safe projection', async () => {
  const newerId = new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeeee');
  const { service, reads } = repositories({ product: { _id: new Types.ObjectId(productId), rating: 5, reviews: [review(), review({ _id: newerId, userId: otherUserId, rating: 4 })] } });
  const result = await service.getPage(productId.toUpperCase(), 1, 1);
  assert.deepEqual(result, { productId, summary: { average: 4.5, count: 2 }, reviews: [{ ...publicFixture, id: 'eeeeeeeeeeeeeeeeeeeeeeee', rating: 4 }], page: 1, pageSize: 1, total: 2 });
  assert.deepEqual(reads[0].projection, { _id: 1, reviews: 1 });
  assert.equal(reads[0].filter.visibility.$ne, false);
  assert.equal(reads[0].filter['vi.visibility'].$ne, false);
  assert.deepEqual((await service.getPage(productId, 3, 1)).reviews, []);
});
test('page ignores legacy default rating when there are no reviews', async () => {
  const { service } = repositories({ product: { _id: new Types.ObjectId(productId), rating: 5 } });
  assert.deepEqual((await service.getPage(productId, 1, 10)).summary, { average: null, count: 0 });
});
test('pagination and product identifiers reject invalid input before database reads', async () => {
  const { service, reads } = repositories();
  for (const args of [['slug', 1, 10], [productId, 0, 10], [productId, 1.5, 10], [productId, 1, 0], [productId, 1, 51], [productId, 1, '10']]) {
    await assert.rejects(service.getPage(...args), (error) => error.getStatus() === 400);
  }
  assert.equal(reads.length, 0);
});
test('eligibility query preserves native String/ObjectId owner alternatives and returns only own review', async () => {
  const { service, orderReads } = repositories({ product: { _id: new Types.ObjectId(productId), reviews: [review({ userId: otherUserId }), review()] }, orders: [{ _user: userId.toHexString(), payment: { status: 'PAID' }, cart: { items: [{ item: { _id: productId } }] } }] });
  const result = await service.getMine(productId, user);
  assert.deepEqual(result, { productId, eligible: true, reason: 'ELIGIBLE', myReview: publicFixture });
  assert.deepEqual(orderReads[0].filter, { $or: [{ userId: { $in: [userId, 'aaaaaaaaaaaaaaaaaaaaaaaa'] } }, { _user: { $in: [userId, 'aaaaaaaaaaaaaaaaaaaaaaaa'] } }] });
  assert.deepEqual(Object.keys(orderReads[0].options.projection).sort(), ['_user', 'cart.items.item._id', 'items.productId', 'payment.status', 'paymentStatus', 'status', 'userId']);
});
test('revoked eligibility retains own review but cannot save even for admin', async () => {
  const { service, writes } = repositories({ product: { _id: new Types.ObjectId(productId), reviews: [review()] }, orders: [{ userId, items: [{ productId }], status: 'DELIVERED', paymentStatus: 'REFUNDED' }] });
  const mine = await service.getMine(productId, { ...user, roles: ['admin'] });
  assert.equal(mine.eligible, false);
  assert.equal(mine.reason, 'NOT_PURCHASED');
  assert.deepEqual(mine.myReview, publicFixture);
  await assert.rejects(service.saveMine(productId, user, draft), (error) => error.getStatus() === 403);
  assert.equal(writes.length, 0);
});
test('ownership and purchase cannot be borrowed from body or another order', async () => {
  const { service, writes } = repositories({ orders: [{ userId: otherUserId, customerEmail: user.email, status: 'DELIVERED', paymentStatus: 'PAID', items: [{ productId }] }] });
  await assert.rejects(service.saveMine(productId, user, draft), (error) => error.getStatus() === 403);
  await assert.rejects(service.saveMine(productId, user, { ...draft, userId: otherUserId }), (error) => error.getStatus() === 400);
  await assert.rejects(service.saveMine(productId, { ...user, _id: null }, draft), (error) => error.getStatus() === 401);
  assert.equal(writes.length, 0);
});
test('save makes one atomic write and builds summary/page/own review from returned document', async () => {
  const returned = review({ rating: 3, comment: 'Đã lưu', updatedAt: new Date('2026-02-01') });
  const { service, reads, writes } = repositories({ updated: { _id: new Types.ObjectId(productId), reviews: [returned, review({ _id: new Types.ObjectId('eeeeeeeeeeeeeeeeeeeeeeee'), userId: otherUserId, rating: 4 })] } });
  const result = await service.saveMine(productId, user, { rating: 3, comment: 'Đã lưu' });
  assert.equal(writes.length, 1);
  assert.deepEqual(reads.map((read) => read.projection), [{ _id: 1 }]);
  assert.equal(writes[0].options.returnDocument, 'after');
  assert.equal(writes[0].filter.visibility.$ne, false);
  assert.equal(writes[0].filter['vi.visibility'].$ne, false);
  assert.deepEqual(result.summary, { average: 3.5, count: 2 });
  assert.equal(result.total, 2);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 10);
  assert.deepEqual(result.myReview, { ...publicFixture, rating: 3, comment: 'Đã lưu', updatedAt: '2026-02-01T00:00:00.000Z' });
  assert.equal(result.myReview.createdAt, '2026-01-01T00:00:00.000Z');
});
test('save derives author only from authenticated name with email fallback protection', async () => {
  const { service, writes } = repositories({ updated: { _id: new Types.ObjectId(productId), reviews: [review()] } });
  await service.saveMine(productId, { ...user, fullName: 'fixture@example.invalid', name: '' }, draft);
  assert.equal(writes[0].pipeline[0].$set.reviews.$let.in.$let.in.$concatArrays[1][0].authorName.$literal, 'Khách hàng');
});
test('unavailable products fail every operation before checking orders or writing', async () => {
  const { service, writes, orderReads } = repositories({ product: null });
  for (const call of [() => service.getPage(productId, 1, 10), () => service.getMine(productId, user), () => service.saveMine(productId, user, draft)]) {
    await assert.rejects(call(), (error) => error.getStatus() === 404);
  }
  assert.equal(writes.length, 0);
  assert.equal(orderReads.length, 0);
});
test('a product hidden during save is not reported as a successful write', async () => {
  const { service } = repositories({ updated: null });
  await assert.rejects(service.saveMine(productId, user, draft), (error) => error.getStatus() === 404);
});
test('database read, eligibility, and write failures propagate instead of reporting empty or success', async () => {
  const failure = new Error('Synthetic database unavailable');
  await assert.rejects(repositories({ readError: failure }).service.getPage(productId, 1, 10), failure);
  await assert.rejects(repositories({ orderError: failure }).service.getMine(productId, user), failure);
  await assert.rejects(repositories({ writeError: failure }).service.saveMine(productId, user, draft), failure);
});
