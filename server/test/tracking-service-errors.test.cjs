const test = require('node:test');
const assert = require('node:assert/strict');

process.env.STRIPE_SECRETKEY = 'sk_test_tracking_contract';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node' });
require('ts-node/register/transpile-only');
const { OrdersService } = require('../src/orders/orders.service.ts');

function serviceReturningNoOrder() {
  let queries = 0;
  const service = Object.create(OrdersService.prototype);
  service.orderModel = { findOne: () => { queries += 1; return { lean: async () => null }; } };
  return { service, getQueryCount: () => queries };
}

test('missing identifier, missing verification, and incorrect lookup share one generic message', async () => {
  const { service } = serviceReturningNoOrder();
  const [missingIdentifier, missingContact, wrongPair] = await Promise.all([
    service.trackOrder({ authContact: 'buyer@example.test' }),
    service.trackOrder({ trackingCode: 'ORDER-1' }),
    service.trackOrder({ trackingCode: 'WRONG-ORDER', authContact: 'wrong@example.test' }),
  ]);

  assert.equal(missingIdentifier.error, missingContact.error);
  assert.equal(missingContact.error, wrongPair.error);
  assert.equal(missingIdentifier.error, 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.');
});

test('punctuation-only verification is rejected before querying default-empty phone fields', async () => {
  const { service, getQueryCount } = serviceReturningNoOrder();
  const result = await service.trackOrder({ trackingCode: 'ORDER-1', authContact: '---()' });

  assert.equal(result.error, 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.');
  assert.equal(getQueryCount(), 0);
});
