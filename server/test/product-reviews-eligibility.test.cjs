const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Types } = require('mongoose');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const {
  normalizeReviewOrderStatus,
  getReviewPaymentStatus,
  getPurchasedProductIds,
  isReviewPurchaseEligible,
} = loadTypeScript(path.join(__dirname, '../src/products/reviews/purchase-eligibility.ts'));

const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const otherUserId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const productId = 'cccccccccccccccccccccccc';
const otherProductId = 'dddddddddddddddddddddddd';
const variantId = 'eeeeeeeeeeeeeeeeeeeeeeee';
const ownedPaidOrder = {
  userId, status: 'PENDING', paymentStatus: 'PAID',
  items: [{ productId, variantId }],
};
const ownedDeliveredOrder = { ...ownedPaidOrder, status: 'DELIVERED', paymentStatus: 'PENDING' };

test('purchase eligibility is tied to one owned order', () => {
  assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, productId), true);
  assert.equal(isReviewPurchaseEligible(ownedDeliveredOrder, userId, productId), true);
  assert.equal(isReviewPurchaseEligible(ownedPaidOrder, otherUserId, productId), false);
  assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, otherProductId), false);
  assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, status: 'RETURNED' }, userId, productId), false);
});

for (const [status, paymentStatus, eligible] of [
  ['PENDING', 'PAID', true],
  ['DELIVERED', 'PENDING', true],
  ['COMPLETED', 'PENDING', true],
  ['CANCELLED', 'PAID', false],
  ['CANCELED', 'PAID', false],
  ['RETURNED', 'PAID', false],
  ['DELIVERED', 'REFUNDED', false],
  ['COMPLETED', 'REFUNDED', false],
  ['PENDING', 'PENDING', false],
  ['SHIPPING', 'FAILED', false],
  ['DELIVERED', 'PARTIALLY_REFUNDED', true],
  ['PENDING', 'PARTIALLY_REFUNDED', false],
]) {
  test(`${status}/${paymentStatus} purchase eligibility is ${eligible}`, () => {
    assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, status, paymentStatus }, userId, productId), eligible);
  });
}

test('status normalization handles casing and surrounding whitespace without coercing malformed values', () => {
  assert.equal(normalizeReviewOrderStatus(' delivered '), 'DELIVERED');
  assert.equal(normalizeReviewOrderStatus(' canceled '), 'CANCELED');
  for (const value of [undefined, null, 1, {}, ['PAID']]) {
    assert.equal(normalizeReviewOrderStatus(value), '');
  }
  assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, status: ' canceled ', paymentStatus: ' paid ' }, userId, productId), false);
  assert.equal(isReviewPurchaseEligible({ ...ownedDeliveredOrder, paymentStatus: ' refunded ' }, userId, productId), false);
});

test('top-level payment state takes precedence over stale nested PAID', () => {
  for (const paymentStatus of ['PENDING', 'REFUNDED', 'FAILED', 'PARTIALLY_REFUNDED', '']) {
    const order = { ...ownedPaidOrder, paymentStatus, payment: { status: 'PAID' } };
    assert.equal(getReviewPaymentStatus(order), paymentStatus);
    assert.equal(isReviewPurchaseEligible(order, userId, productId), false);
  }
});

test('nested payment state is used only when the primary field is absent', () => {
  for (const paymentStatus of [undefined, null]) {
    const order = { ...ownedPaidOrder, paymentStatus, payment: { status: ' paid ' } };
    assert.equal(getReviewPaymentStatus(order), 'PAID');
    assert.equal(isReviewPurchaseEligible(order, userId, productId), true);
  }
  assert.equal(getReviewPaymentStatus({}), '');
  assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, paymentStatus: undefined }, userId, productId), false);
});

test('both owner fields accept String or real ObjectId with canonical hexadecimal comparison', () => {
  for (const field of ['userId', '_user']) {
    for (const owner of [userId, new Types.ObjectId(userId)]) {
      const { userId: unused, ...withoutOwner } = ownedPaidOrder;
      const order = { ...withoutOwner, [field]: owner, items: [{ productId: new Types.ObjectId(productId) }] };
      assert.equal(isReviewPurchaseEligible(order, userId.toUpperCase(), productId.toUpperCase()), true);
      assert.equal(isReviewPurchaseEligible(order, otherUserId, productId), false);
    }
  }
});

test('guest orders do not gain ownership from a matching email', () => {
  const guest = { ...ownedPaidOrder, userId: null, _user: null, customerEmail: 'fixture@example.invalid' };
  assert.equal(isReviewPurchaseEligible(guest, userId, productId), false);
  assert.equal(isReviewPurchaseEligible(guest, 'fixture@example.invalid', productId), false);
});

test('product extraction uses only productId, deduplicates variants, and ignores malformed identifiers', () => {
  const order = { items: [
    { productId, variantId },
    { productId: new Types.ObjectId(productId) },
    { productId: otherProductId.toUpperCase() },
    { variantId: productId },
    { productId: 'invalid' }, null, {},
  ] };
  assert.deepEqual(getPurchasedProductIds(order), [productId, otherProductId]);
  assert.deepEqual(getPurchasedProductIds({}), []);
  assert.deepEqual(getPurchasedProductIds({ items: {} }), []);
  assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, variantId), false);
  assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, items: [{ variantId: productId }] }, userId, productId), false);
});

test('ownership in order A and the product in order B cannot be combined', () => {
  const orders = [
    { ...ownedPaidOrder, items: [{ productId: otherProductId }] },
    { ...ownedPaidOrder, userId: otherUserId },
  ];
  assert.equal(orders.some((order) => isReviewPurchaseEligible(order, userId, productId)), false);
});

test('eligible old orders have no 30-day deadline', () => {
  assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, createdAt: new Date('2000-01-01') }, userId, productId), true);
});

test('missing and malformed identifiers fail closed', () => {
  for (const id of ['', undefined, null, 123, {}, 'invalid']) {
    assert.equal(isReviewPurchaseEligible(ownedPaidOrder, id, productId), false);
    assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, id), false);
    assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, userId: id }, userId, productId), false);
  }
  assert.equal(isReviewPurchaseEligible(null, userId, productId), false);
});

test('audited legacy cart products grant eligibility only in their owned order', () => {
  for (const items of [undefined, null, []]) {
    const order = { ...ownedPaidOrder, items, cart: { items: [{ item: { _id: productId } }] } };
    assert.deepEqual(getPurchasedProductIds(order), [productId]);
    assert.equal(isReviewPurchaseEligible(order, userId, productId), true);
    assert.equal(isReviewPurchaseEligible(order, otherUserId, productId), false);
    assert.equal(isReviewPurchaseEligible(order, userId, otherProductId), false);
    assert.equal(isReviewPurchaseEligible({ ...order, status: 'RETURNED' }, userId, productId), false);
  }
});

test('nonempty modern items take precedence over stale legacy cart products', () => {
  const order = { ...ownedPaidOrder, items: [{ productId: otherProductId }], cart: { items: [{ item: { _id: productId } }] } };
  assert.deepEqual(getPurchasedProductIds(order), [otherProductId]);
  assert.equal(isReviewPurchaseEligible(order, userId, productId), false);
  assert.equal(isReviewPurchaseEligible(order, userId, otherProductId), true);
  assert.equal(isReviewPurchaseEligible({ ...order, items: [{ variantId: productId }] }, userId, productId), false);
});

test('legacy extraction uses only the audited item._id path and ignores direct cart identifiers', () => {
  const order = { ...ownedPaidOrder, items: [], cart: { items: [
    { productId: otherProductId, id: otherProductId, variantId: otherProductId },
    { item: { _id: productId } }, { item: { _id: productId } },
    { item: { _id: 'invalid' } }, null, {},
  ] } };
  assert.deepEqual(getPurchasedProductIds(order), [productId]);
  assert.equal(isReviewPurchaseEligible(order, userId, otherProductId), false);
  assert.deepEqual(getPurchasedProductIds({ cart: { items: {} } }), []);
});
