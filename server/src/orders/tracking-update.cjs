function trackingNumberUpdateFields(value) {
  const trackingNumber = value.trim();
  return {
    trackingNumber,
    'shipping.trackingNumber': trackingNumber,
  };
}

module.exports = { trackingNumberUpdateFields };
