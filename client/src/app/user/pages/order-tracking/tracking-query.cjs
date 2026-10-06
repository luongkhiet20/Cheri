function getTrackingIdentifierFromQuery(params) {
  const value = params.orderId || params.id || params.trackingNumber;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasSensitiveTrackingQueryParams(params) {
  return ['email', 'phone'].some((key) => Object.prototype.hasOwnProperty.call(params, key));
}

function findOwnedTrackingOrder(orders, identifier) {
  if (!Array.isArray(orders) || !identifier) return null;
  return orders.find((order) =>
    order.orderId === identifier || order._id === identifier || order.trackingNumber === identifier
  ) || null;
}

module.exports = { getTrackingIdentifierFromQuery, hasSensitiveTrackingQueryParams, findOwnedTrackingOrder };
