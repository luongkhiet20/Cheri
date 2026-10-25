const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('reflect-metadata');
require('ts-node').register({ project: 'server/tsconfig.json', transpileOnly: true });
const { PaymentService } = require('./payment.service.ts');

test('VNPAY signs outgoing URLs and verifies form-encoded callbacks', async () => {
  const keys = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_PAYMENT_URL', 'VNPAY_RETURN_URL', 'STRIPE_SECRETKEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    VNPAY_TMN_CODE: 'TESTCODE', VNPAY_HASH_SECRET: 'test-secret-only',
    VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: 'http://localhost:4000/api/orders/payment/vnpay/return',
    STRIPE_SECRETKEY: '',
  });
  try {
    const service = new PaymentService({
      create: async data => ({ ...data, _id: '507f1f77bcf86cd799439011' }),
      updateOne: async () => ({ modifiedCount: 1 }),
    });
    const { paymentUrl } = await service.createVnpayPayment({
      orderId: '507f1f77bcf86cd799439012', orderCode: 'CHERI 123',
      provider: 'VNPAY', method: 'VNPAY', amount: 150000, currency: 'VND',
    }, '127.0.0.1');
    const url = new URL(paymentUrl);
    const signature = url.searchParams.get('vnp_SecureHash');
    url.searchParams.delete('vnp_SecureHash');
    url.searchParams.sort();
    assert.match(paymentUrl, /vnp_OrderInfo=Thanh\+toan\+don\+hang\+CHERI\+123&/);
    assert.equal(signature, crypto.createHmac('sha512', 'test-secret-only')
      .update(url.searchParams.toString()).digest('hex'));

    // Fixed wire payload, independent of the service's query builder.
    const payload = 'vnp_Amount=15000000&vnp_OrderInfo=Thanh+toan+CHERI+123%2BA&vnp_ResponseCode=00&vnp_TxnRef=123';
    const query = Object.fromEntries(new URLSearchParams(payload));
    query.vnp_SecureHash = crypto.createHmac('sha512', 'test-secret-only').update(payload).digest('hex');
    assert.equal(service.verifyVnpayResponse(query), true);
    assert.equal(service.verifyVnpayResponse({ ...query, vnp_Amount: '100' }), false);
    assert.equal(service.verifyVnpayResponse({ ...query, vnp_SecureHash: '' }), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('querydr signs its request and rejects a tampered gateway response', async () => {
  const previous = Object.fromEntries(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_QUERY_URL'].map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, {
    VNPAY_TMN_CODE: 'TESTCODE', VNPAY_HASH_SECRET: 'test-secret-only',
    VNPAY_QUERY_URL: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  });
  const transaction = {
    _id: '507f1f77bcf86cd799439011', orderCode: 'CHE123', amount: 150000,
    paymentLink: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_CreateDate=20261024110000',
  };
  const responseFields = [
    'vnp_ResponseId', 'vnp_Command', 'vnp_ResponseCode', 'vnp_Message',
    'vnp_TmnCode', 'vnp_TxnRef', 'vnp_Amount', 'vnp_BankCode',
    'vnp_PayDate', 'vnp_TransactionNo', 'vnp_TransactionType',
    'vnp_TransactionStatus', 'vnp_OrderInfo', 'vnp_PromotionCode', 'vnp_PromotionAmount',
  ];
  try {
    let tamper = false;
    global.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      const requestFields = [
        'vnp_RequestId', 'vnp_Version', 'vnp_Command', 'vnp_TmnCode',
        'vnp_TxnRef', 'vnp_TransactionDate', 'vnp_CreateDate', 'vnp_IpAddr', 'vnp_OrderInfo',
      ];
      assert.equal(request.vnp_SecureHash, crypto.createHmac('sha512', 'test-secret-only')
        .update(requestFields.map(key => request[key] || '').join('|')).digest('hex'));
      assert.equal(request.vnp_TransactionDate, '20261024110000');
      const body = {
        vnp_ResponseId: 'response1', vnp_Command: 'querydr', vnp_ResponseCode: '00',
        vnp_Message: 'success', vnp_TmnCode: request.vnp_TmnCode,
        vnp_TxnRef: request.vnp_TxnRef, vnp_Amount: '15000000',
        vnp_BankCode: 'NCB', vnp_PayDate: '20261024110500',
        vnp_TransactionNo: '12345', vnp_TransactionType: '01',
        vnp_TransactionStatus: '00', vnp_OrderInfo: 'Thanh toan',
      };
      body.vnp_SecureHash = crypto.createHmac('sha512', 'test-secret-only')
        .update(responseFields.map(key => body[key] || '').join('|')).digest('hex');
      if (tamper) body.vnp_Amount = '100';
      return { ok: true, json: async () => body };
    };
    const service = new PaymentService({});
    assert.equal((await service.queryVnpayTransaction(transaction)).vnp_TransactionStatus, '00');
    tamper = true;
    await assert.rejects(() => service.queryVnpayTransaction(transaction), /Invalid VNPAY query response/);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
