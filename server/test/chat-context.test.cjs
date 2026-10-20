const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPublicContext } = require('../shared/chat/chat-context.cjs');

function mockDb(products, policies = []) {
  const calls = [];
  return {
    calls,
    collection(name) {
      return {
        find(filter, options) {
          calls.push({ name, filter, options });
          return { sort() { return this; }, limit() { return this; }, async toArray() {
            return name === 'products' ? products : policies;
          } };
        },
      };
    },
  };
}

test('context resolves translated product fields and omits hidden records and private fields', async () => {
  const db = mockDb([
    { _id: 'public1', titleUrl: 'dam-den', visibility: true, vi: { visibility: true, title: 'Đầm đen', regularPrice: 700000, salePrice: 560000, onSale: true, sizes: ['S'] }, stock: 'unknown', mainImage: { url: 'https://img.test/1.jpg' }, secret: 'INTERNAL_MARKER', reviews: [{ comment: 'PRIVATE_REVIEW' }] },
    { _id: 'hidden', titleUrl: 'hidden', visibility: false, vi: { title: 'Đầm đen bí mật' }, secret: 'HIDDEN_MARKER' },
    { _id: 'hidden-lang', titleUrl: 'hidden-lang', visibility: true, vi: { visibility: false, title: 'Đầm đen riêng' } },
  ]);
  const context = await loadPublicContext(db, { message: 'đầm đen', history: [], lang: 'vi' });
  assert.equal(context.products.length, 1);
  assert.deepEqual(context.products[0], {
    id: 'public1', title: 'Đầm đen', path: '/vi/product/dam-den',
    imageUrl: 'https://img.test/1.jpg', price: 560000,
    description: '', categories: [], colors: [], sizes: ['S'], availability: 'unknown',
  });
  assert.doesNotMatch(JSON.stringify(context), /INTERNAL_MARKER|HIDDEN_MARKER|PRIVATE_REVIEW/);
});

test('zero sale price is not treated as a valid discount', async () => {
  const db = mockDb([
    { _id: 'p1', titleUrl: 'ao', visibility: true, vi: { title: 'Áo', regularPrice: 450000, salePrice: 0, onSale: true } },
  ]);
  const context = await loadPublicContext(db, { message: 'áo', history: [], lang: 'vi' });
  assert.equal(context.products[0].price, 450000);
});

test('english storefront still excludes a product hidden in Vietnamese visibility', async () => {
  const db = mockDb([
    { _id: 'hidden-in-vi', titleUrl: 'dress', visibility: true, vi: { visibility: false, title: 'Black dress' }, en: { visibility: true, title: 'Black dress' } },
  ]);
  assert.deepEqual((await loadPublicContext(db, { message: 'black dress', history: [], lang: 'en' })).products, []);
});

test('limits returned products and public context size', async () => {
  const products = Array.from({ length: 12 }, (_, i) => ({
    _id: `p${i}`, titleUrl: `dam-${i}`, visibility: true,
    vi: { title: 'Đầm đen linen', regularPrice: 200000 },
  }));
  const db = mockDb(products);
  const context = await loadPublicContext(db, { message: 'đầm đen', history: [], lang: 'vi' });
  assert.ok(context.products.length <= 8);
  assert.ok(Buffer.byteLength(JSON.stringify(context)) <= 12000);
  assert.ok(db.calls.find((call) => call.name === 'products').filter.$and[1].$or.length > 0);
});

test('policy context includes only explicitly published public page content', async () => {
  const db = mockDb([], [
    { _id: 'public', titleUrl: 'doi-tra', status: 'published', isPublished: true, vi: { title: 'Đổi trả', contentHTML: '<p>Liên hệ Chéri.</p>' } },
    { _id: 'draft', titleUrl: 'draft', status: 'draft', isPublished: false, vi: { title: 'Bản nháp', contentHTML: 'DRAFT_MARKER' } },
    { _id: 'unmarked', titleUrl: 'unknown', vi: { title: 'Chưa xác nhận', contentHTML: 'UNKNOWN_MARKER' } },
    { _id: 'injected', titleUrl: 'inject', status: 'published', vi: { title: 'Đổi trả', contentHTML: '<script>BAD_SCRIPT</script><p>Gọi cửa hàng.</p>' } },
    { _id: 'irrelevant', titleUrl: 'ba-mat', status: 'published', vi: { title: 'Bảo mật', contentHTML: '<p>NO_IRRELEVANT_POLICY</p>' } },
  ]);
  const context = await loadPublicContext(db, { message: 'đổi trả', history: [], lang: 'vi' });
  assert.deepEqual(context.policies, [
    { id: 'public', title: 'Đổi trả', path: '/vi/cheri/doi-tra', text: 'Liên hệ Chéri.' },
    { id: 'injected', title: 'Đổi trả', path: '/vi/cheri/inject', text: 'Gọi cửa hàng.' },
  ]);
  assert.doesNotMatch(JSON.stringify(context.policies), /NO_IRRELEVANT_POLICY/);
});
