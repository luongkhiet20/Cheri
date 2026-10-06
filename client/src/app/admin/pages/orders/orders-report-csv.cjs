function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeCsvTextField(value) {
  if (value === null || value === undefined || value === '') return '""';
  const formula = `="${String(value).replace(/"/g, '""')}"`;
  return escapeCsvField(formula);
}

function paymentStatusLabel(status) {
  if (!status) return 'Chưa xác định';
  const normalized = String(status).trim().toUpperCase();
  const labels = {
    PAID: 'Đã thanh toán',
    PENDING: 'Chờ thanh toán',
    FAILED: 'Thất bại',
    REFUNDED: 'Đã hoàn tiền',
    PARTIALLY_REFUNDED: 'Hoàn tiền một phần',
  };
  return labels[normalized] || status;
}

module.exports = { escapeCsvField, escapeCsvTextField, paymentStatusLabel };
