const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeCsvTextField, paymentStatusLabel } = require('./orders-report-csv.cjs');

test('encodes text-formula fields as valid CSV while preserving leading zeros and embedded delimiters', () => {
  assert.equal(
    escapeCsvTextField('001, "A"\r\nB'),
    '"=""001, """"A""""\r\nB"""',
  );
});

test('encodes empty text values as an empty CSV cell', () => {
  assert.equal(escapeCsvTextField(''), '""');
  assert.equal(escapeCsvTextField(null), '""');
});

test('shows localized labels for all schema payment statuses, including refunds', () => {
  assert.equal(paymentStatusLabel('PENDING'), 'Chờ thanh toán');
  assert.equal(paymentStatusLabel('PAID'), 'Đã thanh toán');
  assert.equal(paymentStatusLabel('FAILED'), 'Thất bại');
  assert.equal(paymentStatusLabel('REFUNDED'), 'Đã hoàn tiền');
  assert.equal(paymentStatusLabel('PARTIALLY_REFUNDED'), 'Hoàn tiền một phần');
  assert.equal(paymentStatusLabel('NEW_PROVIDER_STATE'), 'NEW_PROVIDER_STATE');
});
