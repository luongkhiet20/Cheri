const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicTrackingResponse } = require('../src/orders/tracking-response.cjs');

test('public tracking reflects the admin-corrected top-level number and URL', () => {
  const response = buildPublicTrackingResponse({
    orderId: 'ORDER-1',
    trackingNumber: 'ADMIN-CORRECTION',
    trackingUrl: 'https://carrier.example.test/new',
    shipping: {
      trackingNumber: 'OLD-CODE',
      trackingUrl: 'https://carrier.example.test/old',
    },
  });

  assert.equal(response.trackingNumber, 'ADMIN-CORRECTION');
  assert.equal(response.trackingUrl, 'https://carrier.example.test/new');
});
