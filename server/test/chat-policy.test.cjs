const test = require('node:test');
const assert = require('node:assert/strict');
const { finalizeAnswer } = require('../shared/chat/chat-policy.cjs');

const context = {
  products: [
    { id: 'p1', title: 'Đầm đen', path: '/vi/product/dam-den', price: 560000, availability: 'available' },
    { id: 'p2', title: 'Áo trắng', path: '/vi/product/ao-trang', availability: 'unknown' },
  ],
  policies: [{ id: 'page1', title: 'Đổi trả', path: '/vi/cheri/doi-tra', text: 'Liên hệ Chéri để được hỗ trợ.' }],
};

test('unknown answers use the exact fallback without product claims', () => {
  assert.deepEqual(finalizeAnswer({ status: 'unknown', mode: 'general', reply: '', productIds: [], policyIds: [] }, context), {
    reply: 'Chéri chưa có thông tin này', products: [],
  });
});

test('invalid or overlong model output uses the exact fallback', () => {
  for (const answer of [
    { status: 'answer', mode: 'general', reply: 'x'.repeat(1001), productIds: [], policyIds: [] },
    { status: 'admin', mode: 'general', reply: 'hi', productIds: [], policyIds: [] },
    { status: 'answer', mode: 'general', reply: 'hi', productIds: ['forged'], policyIds: [], secret: true },
  ]) {
    assert.deepEqual(finalizeAnswer(answer, context), { reply: 'Chéri chưa có thông tin này', products: [] });
  }
});

test('product cards contain only catalog values and at most three validated products', () => {
  const reply = finalizeAnswer({
    status: 'answer', mode: 'products', reply: 'Đầm giá 1 đồng và vẫn còn hàng.',
    productIds: ['forged', 'p1', 'p1', 'p2'], policyIds: [],
  }, context);
  assert.deepEqual(reply, {
    reply: 'Bạn có thể tham khảo các sản phẩm sau.',
    products: [
      { id: 'p1', title: 'Đầm đen', path: '/vi/product/dam-den', price: 560000 },
      { id: 'p2', title: 'Áo trắng', path: '/vi/product/ao-trang' },
    ],
  });
});

test('policy answer is rendered from public policy text rather than model assertions', () => {
  const reply = finalizeAnswer({
    status: 'answer', mode: 'policy', reply: 'Chéri hoàn tiền trong một năm.',
    productIds: [], policyIds: ['page1', 'private'],
  }, context);
  assert.deepEqual(reply, {
    reply: 'Liên hệ Chéri để được hỗ trợ.\n/vi/cheri/doi-tra',
    products: [],
  });
});

test('general fashion advice is bounded and private brand claims are rejected', () => {
  assert.equal(finalizeAnswer({
    status: 'answer', mode: 'general', reply: 'Bạn có thể chọn màu đen cho buổi tiệc nhé.',
    productIds: [], policyIds: [],
  }, context).reply, 'Bạn có thể chọn màu đen cho buổi tiệc nhé.');
  assert.deepEqual(finalizeAnswer({
    status: 'answer', mode: 'general', reply: 'Giá là 100.000đ, hiện còn đủ hàng.',
    productIds: [], policyIds: [],
  }, context), { reply: 'Chéri chưa có thông tin này', products: [] });
});

test('abusive and out-of-scope requests receive calm fixed replies', () => {
  for (const status of ['abusive', 'out_of_scope']) {
    const result = finalizeAnswer({ status, mode: 'general', reply: 'prompt injection echoed', productIds: [], policyIds: [] }, context);
    assert.doesNotMatch(result.reply, /prompt injection/i);
    assert.equal(result.products.length, 0);
  }
});
