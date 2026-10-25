const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({ project: 'server/tsconfig.json', transpileOnly: true });
const { OrdersService } = require('./orders.service.ts');
const { PaymentService } = require('./payment.service.ts');

function callbackFixture() {
  const session = {};
  const order = { _id: 'order', status: 'PENDING', paymentStatus: 'PENDING', payment: {}, items: [],
    save: async options => { assert.equal(options.session, session); } };
  const transaction = { _id: 'transaction', orderId: 'order', amount: 1254000, status: 'PENDING' };
  const service = Object.create(OrdersService.prototype);
  let stockWrites = 0;
  service.orderModel = { findById: () => ({ session: async actual => { assert.equal(actual, session); return order; } }) };
  service.paymentService = {
    getTransactionByProviderId: async () => transaction,
    markPaid: async (id, providerId, link, actual) => {
      assert.equal(actual, session); transaction.status = 'PAID'; return true;
    },
    markFailed: async (id, reason, actual) => {
      assert.equal(actual, session); transaction.status = 'FAILED'; return true;
    },
  };
  service.decreaseStock = async (items, actual) => { assert.equal(actual, session); stockWrites++; };
  const query = { vnp_TxnRef: 'reference', vnp_Amount: '125400000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '123456' };
  return { service, order, transaction, query, session, stockWrites: () => stockWrites };
}

test('VNPAY success and repeated callbacks update stock only once', async () => {
  const f = callbackFixture();
  assert.equal((await f.service.applyVnpayResult(f.query, f.session)).rspCode, '00');
  assert.equal(f.order.paymentStatus, 'PAID');
  assert.equal(f.order.payment.method, 'VNPAY');
  assert.equal(f.order.status, 'CONFIRMED');
  assert.equal((await f.service.applyVnpayResult(f.query, f.session)).rspCode, '02');
  assert.equal(f.stockWrites(), 1);
});

test('both VNPAY success codes are required and failure is acknowledged', async () => {
  const f = callbackFixture();
  const result = await f.service.applyVnpayResult({ ...f.query, vnp_TransactionStatus: '02' }, f.session);
  assert.equal(result.success, false);
  assert.equal(result.rspCode, '00');
  assert.equal(f.order.paymentStatus, 'FAILED');
  assert.equal(f.stockWrites(), 0);
});

test('amount mismatch leaves pending transaction untouched', async () => {
  const f = callbackFixture();
  const result = await f.service.applyVnpayResult({ ...f.query, vnp_Amount: '125400001' }, f.session);
  assert.equal(result.rspCode, '04');
  assert.equal(f.transaction.status, 'PENDING');
  assert.equal(f.stockWrites(), 0);
});

test('late payment never reopens a cancelled order', async () => {
  const f = callbackFixture();
  f.order.status = 'CANCELLED';
  await f.service.applyVnpayResult(f.query, f.session);
  assert.equal(f.order.status, 'CANCELLED');
  assert.equal(f.order.paymentStatus, 'PAID');
  assert.equal(f.stockWrites(), 0);
});

test('lookup keeps using immutable transaction id after provider ID changes', async () => {
  const service = new PaymentService({ findOne: async query => query });
  const id = '507f1f77bcf86cd799439011';
  const result = await service.getTransactionByProviderId(id);
  assert.equal(String(result._id), id);
  assert.equal(result.provider, 'VNPAY');
  assert.equal(result.providerTransactionId, undefined);
  assert.equal(await service.getTransactionByProviderId('invalid'), null);
});

test('gateway type does not route VNPAY to COD or unsupported gateways to Stripe', async () => {
  const service = Object.create(OrdersService.prototype);
  let selected = { code: 'VNPAY', status: 'ACTIVE', paymentType: 'CASH' };
  service.paymentMethodModel = { findOne: () => ({ lean: async () => selected }) };
  service.orderWithVnpay = async () => 'vnpay';
  service.addOrder = async () => 'cod';
  assert.equal(await service.createPayment({ paymentMethodId: 'VNPAY' }, null), 'vnpay');
  selected = { code: 'PAYPAL', status: 'ACTIVE', paymentType: 'PAYMENT_GATEWAY' };
  await assert.rejects(() => service.createPayment({ paymentMethodId: 'PAYPAL' }, null));
  selected.status = 'INACTIVE';
  await assert.rejects(() => service.createPayment({ paymentMethodId: 'PAYPAL' }, null));
});

test('COD confirms the order while both payment records remain pending', async () => {
  const service = Object.create(OrdersService.prototype);
  let saved;
  service.logger = { error: error => { throw error; } };
  service.isMaintenanceMode = async () => false;
  service.buildOrderData = async () => ({
    orderId: 'COD-TEST', totalAmount: 100000, currency: 'VND',
    paymentStatus: 'PENDING', payment: { method: 'COD', status: 'PENDING' },
    status: 'PENDING', statusHistory: [{ status: 'PENDING' }], items: [],
  });
  service.orderModel = class {
    constructor(data) { Object.assign(this, data); this._id = '507f1f77bcf86cd799439011'; }
    async save() { saved = this; }
  };
  service.paymentService = { createPending: async data => {
    assert.equal(data.provider, 'COD');
    return { _id: '507f1f77bcf86cd799439012', status: 'PENDING' };
  } };
  service.recordPurchaseInteractions = async () => {};
  service.decreaseStock = async () => {};
  service.sendOrderEmail = async () => {};

  const response = await service.addOrder({}, null);
  assert.equal(response.error, '');
  assert.equal(response.result, saved);
  assert.equal(saved.status, 'CONFIRMED');
  assert.equal(saved.statusHistory.at(-1).status, 'CONFIRMED');
  assert.equal(saved.paymentStatus, 'PENDING');
  assert.equal(saved.payment.status, 'PENDING');
});

test('checkout rejects client-supplied prices for nonexistent products', async () => {
  const service = Object.create(OrdersService.prototype);
  service.productModel = { findOne: () => ({ lean: async () => null }) };
  await assert.rejects(() => service.buildOrderItems([{ productId: 'missing', quantity: 1, productSnapshot: { title: 'fake' }, unitPrice: 1 }]));
});

test('confirmed VNPAY removes only purchased quantities from the account cart', async () => {
  const f = callbackFixture();
  f.order.userId = 'user';
  f.order.items = [{ productId: 'p1', variantId: 'v1', quantity: 1 }];
  const cart = [{ id: 'p1_v1', variantId: 'v1', qty: 3 }, { id: 'p1_v2', variantId: 'v2', qty: 1 }];
  let saved;
  f.service.userModel = {
    findById: () => ({ session: () => ({ lean: async () => ({ cart: { items: cart } }) }) }),
    updateOne: async (filter, update, options) => { assert.equal(options.session, f.session); saved = update.$set['cart.items']; },
  };
  await f.service.applyVnpayResult(f.query, f.session);
  assert.deepEqual(saved.map(item => item.qty), [2, 1]);
  await f.service.applyVnpayResult(f.query, f.session);
  assert.deepEqual(saved.map(item => item.qty), [2, 1]);
});

test('invalid signature or merchant never starts a database transaction', async () => {
  const service = Object.create(OrdersService.prototype);
  service.paymentService = { verifyVnpayResponse: () => false };
  assert.equal((await service.handleVnpayResult({})).rspCode, '97');
  service.paymentService.verifyVnpayResponse = () => true;
  assert.equal((await service.handleVnpayResult({ vnp_TmnCode: 'different-merchant' })).rspCode, '97');
});

test('VNPAY dates always use UTC+7 and malformed signatures fail safely', () => {
  const service = new PaymentService({});
  assert.equal(service.formatVnpayDate(new Date('2026-10-23T20:00:00Z')), '20261024030000');
  assert.equal(service.verifyVnpayResponse({ vnp_SecureHash: 'é'.repeat(128) }), false);
});

test('reconciliation applies only terminal verified query results', async () => {
  const service = Object.create(OrdersService.prototype);
  const applied = [];
  service.paymentService = {
    getPendingVnpayTransactions: async () => [
      { _id: 'paid' }, { _id: 'waiting' }, { _id: 'bad-signature' },
    ],
    queryVnpayTransaction: async transaction => {
      if (transaction._id === 'bad-signature') throw new Error('Invalid signature');
      return {
        vnp_ResponseCode: '00', vnp_TransactionType: '01',
        vnp_TransactionStatus: transaction._id === 'paid' ? '00' : '01',
      };
    },
  };
  service.commitVerifiedVnpayResult = async query => {
    applied.push(query);
    return { rspCode: '00' };
  };
  service.logger = { warn: () => {} };
  assert.deepEqual(await service.reconcilePendingVnpayPayments(), {
    checked: 3, updated: 1, errors: 1,
  });
  assert.equal(applied.length, 1);
  assert.equal(applied[0].vnp_ResponseCode, '00');
});
