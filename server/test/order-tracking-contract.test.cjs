const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPublicTrackingResponse } = require('../src/orders/tracking-response.cjs');
const {
  getTrackingIdentifierFromQuery,
  hasSensitiveTrackingQueryParams,
  findOwnedTrackingOrder,
} = require('../../client/src/app/user/pages/order-tracking/tracking-query.cjs');

test('public tracking response exposes a minimized current-order summary', () => {
  const result = buildPublicTrackingResponse({
    orderId: 'ORD-100',
    customerEmail: 'buyer@example.test',
    customerPhone: '0901234567',
    status: 'RETURNED',
    shippingAddress: {
      name: 'Buyer Name',
      phone: '0901234567',
      line1: '123 Private Street',
      city: 'Hanoi',
      email: 'buyer@example.test',
    },
    shipping: {
      trackingNumber: 'TRACK-100',
      carrierName: 'Demo carrier',
      logs: [{ status: 'RETURNED', description: 'Private staff note', location: 'Private depot', timestamp: '2026-01-01T00:00:00.000Z' }],
    },
    statusHistory: [{ status: 'RETURNED', updatedAt: '2026-01-01T00:00:00.000Z', note: 'Private staff note' }],
    items: [{ productSnapshot: { title: 'Sample item', sku: 'SKU-1', image: '/item.jpg' }, quantity: 2, unitPrice: 15, subtotal: 30 }],
    subtotal: 30,
    shippingFee: 5,
    amount: 35,
    paymentMethod: 'Card',
    paymentStatus: 'REFUNDED',
    refund: { amount: 35, refundedAt: '2026-01-02T00:00:00.000Z' },
  });

  assert.equal(result.orderId, 'ORD-100');
  assert.equal(result.status, 'RETURNED');
  assert.equal(result.paymentStatus, 'REFUNDED');
  assert.equal(result.refundedAmount, 35);
  assert.deepEqual(result.statusHistory, [{ status: 'RETURNED', updatedAt: '2026-01-01T00:00:00.000Z' }]);
  assert.deepEqual(result.shippingLogs, [{ status: 'RETURNED', timestamp: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(result.items[0].title, 'Sample item');

  const serialized = JSON.stringify(result);
  for (const forbidden of ['buyer@example.test', '0901234567', '123 Private Street', 'Buyer Name', 'Private staff note', 'Private depot']) {
    assert.equal(serialized.includes(forbidden), false, `response must not expose ${forbidden}`);
  }
});

test('public tracking response supports legacy cart/address/tracking shapes without returning address PII', () => {
  const result = buildPublicTrackingResponse({
    orderId: 'LEGACY-7',
    addresses: [{ fullName: 'Legacy Buyer', phone: '0911111111', address: 'Legacy private address', email: 'legacy@example.test' }],
    cart: { items: [{ item: { title: 'Legacy item', sku: 'OLD-1', mainImage: { url: '/legacy.jpg' } }, qty: 1, price: 12 }], totalPrice: 12, shippingCost: 2 },
    shipping: { trackingNumber: 'LEGACY-TRACK', status: 'SHIPPING', logs: [] },
    statusHistory: [{ status: 'SHIPPING', timestamp: '2026-02-01T00:00:00.000Z', description: 'Internal note' }],
    totalAmount: 14,
  });

  assert.equal(result.orderId, 'LEGACY-7');
  assert.equal(result.trackingNumber, 'LEGACY-TRACK');
  assert.equal(result.items[0].title, 'Legacy item');
  assert.equal(result.totalAmount, 14);
  assert.equal(JSON.stringify(result).includes('Legacy private address'), false);
  assert.equal(JSON.stringify(result).includes('legacy@example.test'), false);
  assert.equal(JSON.stringify(result).includes('Internal note'), false);
});

test('a synthetic demo order produces a tracking-safe returned/refunded response', () => {
  // Keep the tracking contract independent of the retired Mongo seed runner.
  const returned = {
    orderId: 'DEMO-ORDER-2026-003',
    status: 'RETURNED',
    paymentStatus: 'REFUNDED',
    refundedAmount: 23,
    customerEmail: 'demo@example.invalid',
    customerPhone: '0000000000',
    shippingAddress: { line1: 'Đơn giả lập, không giao hàng' },
    notes: 'DEMO-SEED:v1:003',
    items: [{
      productId: 'synthetic-product',
      productSnapshot: { title: 'Demo item', sku: 'DEMO', image: '' },
      quantity: 1, unitPrice: 20, subtotal: 20,
    }],
    subtotal: 20, shippingFee: 3, totalAmount: 23,
    paymentMethodSnapshot: { name: 'Demo pay', code: 'DEMO', paymentType: 'TEST' },
    shippingMethodSnapshot: { name: 'Demo ship', code: 'DEMO' },
    statusHistory: [{ status: 'RETURNED', updatedAt: '2026-10-06T00:00:00.000Z' }],
  };
  const response = buildPublicTrackingResponse(returned);

  assert.equal(response.orderId, 'DEMO-ORDER-2026-003');
  assert.equal(response.status, 'RETURNED');
  assert.equal(response.paymentStatus, 'REFUNDED');
  assert.equal(response.refundedAmount, 23);
  assert.equal(JSON.stringify(response).includes('example.invalid'), false);
  assert.equal(JSON.stringify(response).includes('không giao hàng'), false);
});

test('tracking query only yields a non-sensitive identifier and flags legacy verification parameters', () => {
  const query = { orderId: 'ORD-100', email: 'buyer@example.test', phone: '0901234567' };
  assert.equal(getTrackingIdentifierFromQuery(query), 'ORD-100');
  assert.equal(hasSensitiveTrackingQueryParams(query), true);
  assert.equal(getTrackingIdentifierFromQuery({ email: 'buyer@example.test', phone: '0901234567' }), null);
  assert.equal(hasSensitiveTrackingQueryParams({ id: 'ORD-100' }), false);
});

test('member selection only resolves identifiers in the authenticated order list supplied to it', () => {
  const ownOrders = [{ orderId: 'OWN-1' }, { _id: 'OWN-2' }];
  assert.equal(findOwnedTrackingOrder(ownOrders, 'OWN-1'), ownOrders[0]);
  assert.equal(findOwnedTrackingOrder(ownOrders, 'OWN-2'), ownOrders[1]);
  assert.equal(findOwnedTrackingOrder(ownOrders, 'OTHER-1'), null);
  assert.equal(findOwnedTrackingOrder(null, 'OWN-1'), null);
});
