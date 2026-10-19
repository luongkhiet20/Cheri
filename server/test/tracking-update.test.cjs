const test = require('node:test');
const assert = require('node:assert/strict');
const { trackingNumberUpdateFields } = require('../src/orders/tracking-update.cjs');

test('admin tracking-number edits synchronize both supported fields, including clear', () => {
  assert.deepEqual(trackingNumberUpdateFields(' ADMIN-CORRECTION '), {
    trackingNumber: 'ADMIN-CORRECTION',
    'shipping.trackingNumber': 'ADMIN-CORRECTION',
  });
  assert.deepEqual(trackingNumberUpdateFields(''), {
    trackingNumber: '',
    'shipping.trackingNumber': '',
  });
});
