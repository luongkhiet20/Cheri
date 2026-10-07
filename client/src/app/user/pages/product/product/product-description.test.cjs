const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');
const { ProductComponent } = require('./product.component.ts');

function displayedBullets(descriptionFull, rootBullets = []) {
  const vi = Object.freeze({ descriptionFull: Object.freeze(descriptionFull), quantity: 5, regularPrice: 100000 });
  const product = Object.freeze({
    title: 'Đầm cotton', vi, descriptionFull: Object.freeze(rootBullets), variants: [],
  });
  const component = Object.create(ProductComponent.prototype);
  component.product$ = () => product;
  component.initProductState(product);
  return component.productDescriptionFull;
}

test('detail bullets omit empty and malformed entries without inventing text', () => {
  assert.deepEqual(displayedBullets(['', '  ', '\n\t', null, 42, {}, 'Chất liệu: cotton 100%.']), ['Chất liệu: cotton 100%.']);
});

test('detail bullets deduplicate whitespace-equivalent lines and preserve the original first line', () => {
  assert.deepEqual(displayedBullets([
    '  Chất liệu: cotton 100%.  ', 'Chất liệu:  cotton 100%.', 'Giặt ở 30°C.', 'Giặt ở 30°C.',
  ]), ['  Chất liệu: cotton 100%.  ', 'Giặt ở 30°C.']);
});

test('detail bullets deduplicate canonically equivalent Vietnamese text', () => {
  assert.deepEqual(displayedBullets(['Màu đỏ', 'Màu đỏ'.normalize('NFD')]), ['Màu đỏ']);
});

test('useful Vietnamese product facts and prose remain verbatim and in order', () => {
  const facts = ['Chất liệu cao cấp: 100% cotton.', 'Thiết kế phù hợp đi làm và đi chơi.', 'Màu sắc: đỏ.', 'Màu sắc: xanh.'];
  assert.deepEqual(displayedBullets(facts), facts);
});

test('an all-empty localized description yields no bullets instead of exposing legacy root content', () => {
  assert.deepEqual(displayedBullets([' ', null], ['Mô tả cũ']), []);
});

test('legacy root descriptions use the same cleanup when localized bullets are absent', () => {
  assert.deepEqual(displayedBullets([], ['', 'Dài 90 cm.', 'Dài 90 cm.']), ['Dài 90 cm.']);
});
