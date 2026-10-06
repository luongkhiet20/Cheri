const test = require('node:test');
const assert = require('node:assert/strict');

process.env.STRIPE_SECRETKEY = 'sk_test_tracking_contract';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node' });
require('ts-node/register/transpile-only');
const { OrdersService } = require('../src/orders/orders.service.ts');

function serviceReturningNoOrder() {
  const service = Object.create(OrdersService.prototype);
  service.orderModel = { findOne: () => ({ lean: async () => null }) };
  return service;
}

test('missing identifier, missing verification, and incorrect lookup share one generic message', async () => {
  const service = serviceReturningNoOrder();
  const [missingIdentifier, missingContact, wrongPair] = await Promise.all([
    service.trackOrder({ authContact: 'buyer@example.test' }),
    service.trackOrder({ trackingCode: 'ORDER-1' }),
    service.trackOrder({ trackingCode: 'WRONG-ORDER', authContact: 'wrong@example.test' }),
  ]);

  assert.equal(missingIdentifier.error, missingContact.error);
  assert.equal(missingContact.error, wrongPair.error);
  assert.equal(missingIdentifier.error, 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.');
});
