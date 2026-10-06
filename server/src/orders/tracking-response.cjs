function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function buildPublicTrackingResponse(order) {
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item) => ({
        title: item.productSnapshot?.title || 'Sản phẩm',
        sku: item.productSnapshot?.sku || '',
        image: item.productSnapshot?.image || '',
        variant: item.productSnapshot?.variant || null,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        subtotal: item.subtotal ?? (item.unitPrice || 0) * (item.quantity || 1),
      }))
    : (order.cart?.items || []).map((item) => ({
        title: item.item?.title || 'Sản phẩm',
        sku: item.item?.sku || '',
        image: item.item?.mainImage?.url || item.item?.images?.[0] || '',
        variant: item.item?.variants?.[0]
          ? {
              color: item.item.variants[0].color,
              size: item.item.variants[0].size,
              classification: item.item.variants[0].classification,
            }
          : (item.variant || null),
        quantity: item.qty || 1,
        unitPrice: item.price || 0,
        subtotal: (item.price || 0) * (item.qty || 1),
      }));

  const logs = Array.isArray(order.shipping?.logs) && order.shipping.logs.length > 0
    ? order.shipping.logs
    : (Array.isArray(order.shippingLogs) ? order.shippingLogs : []);
  const payment = order.payment || {};
  const paymentStatus = firstValue(order.paymentStatus, payment.status);

  return {
    orderId: String(firstValue(order.orderId, order._id, '')),
    status: firstValue(order.status, order.shipping?.status, 'PENDING'),
    trackingNumber: firstValue(order.trackingNumber, order.shipping?.trackingNumber, null),
    trackingUrl: firstValue(order.trackingUrl, order.shipping?.trackingUrl, null),
    carrierName: firstValue(order.shipping?.carrierName, order.shippingProvider, order.shippingMethodSnapshot?.name, null),
    estimatedDelivery: firstValue(order.shipping?.estimatedDelivery, order.estimatedDeliveryDate, null),
    dateAdded: firstValue(order.dateAdded, order.createdAt, null),
    shippedAt: firstValue(order.shippedAt, null),
    deliveredAt: firstValue(order.deliveredAt, null),
    shippingLogs: logs.map((log) => ({
      status: log.status || '',
      timestamp: firstValue(log.timestamp, log.updatedAt, null),
    })),
    statusHistory: (Array.isArray(order.statusHistory) ? order.statusHistory : []).map((entry) => ({
      status: entry.status || '',
      updatedAt: firstValue(entry.updatedAt, entry.timestamp, null),
    })),
    items,
    paymentMethod: firstValue(order.type, order.paymentMethod, order.paymentMethodSnapshot?.name, 'COD'),
    paymentStatus: paymentStatus || null,
    refundedAmount: firstValue(order.refundedAmount, payment.refundedAmount, order.refund?.amount, 0),
    refundedAt: firstValue(order.refundedAt, payment.refundedAt, order.refund?.refundedAt, null),
    subtotal: firstValue(order.cart?.totalPrice, order.subtotal, 0),
    shippingFee: firstValue(order.cart?.shippingCost, order.shippingFee, 0),
    totalAmount: firstValue(order.amount, order.totalAmount, 0),
    currency: order.currency || 'VND',
  };
}

module.exports = { buildPublicTrackingResponse };
