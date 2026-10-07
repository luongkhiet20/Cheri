const PRODUCTION_MARKER = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

function resolveDemoSeedTarget(env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Demo order seeding is refused when NODE_ENV is production.');
  }
  if (env.SEED_DEMO_ORDERS !== 'true') {
    throw new Error('Explicitly enable demo seeding with SEED_DEMO_ORDERS=true.');
  }

  const databaseName = String(env.SEED_DEMO_DB_NAME || '').trim();
  const allowedDatabase = String(env.SEED_DEMO_ALLOWED_DATABASE || '').trim();
  const mongoUri = String(env.MONGO_URI || env.DATABASE_URL || '').trim();
  if (!databaseName || !allowedDatabase || !mongoUri || databaseName !== allowedDatabase) {
    throw new Error('SEED_DEMO_DB_NAME, SEED_DEMO_ALLOWED_DATABASE, and the Mongo URI must explicitly match.');
  }

  let uriDatabase;
  try {
    const uri = new URL(mongoUri);
    if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) throw new Error('unsupported scheme');
    uriDatabase = decodeURIComponent(uri.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('MONGO_URI must be a valid MongoDB URI with an explicit database name.');
  }

  if (!uriDatabase || uriDatabase !== databaseName) {
    throw new Error('The Mongo URI database does not match SEED_DEMO_DB_NAME.');
  }
  if (PRODUCTION_MARKER.test(databaseName)) {
    throw new Error('Demo order seeding is refused for production database names.');
  }

  return { databaseName, mongoUri };
}

async function openSeedDatabase(env, connect) {
  const target = resolveDemoSeedTarget(env);
  return connect(target.mongoUri, { dbName: target.databaseName });
}

function buildDemoOrders({ product, paymentMethods, shippingMethod }) {
  if (!product?._id) throw new Error('A real existing product is required to create demo orders.');
  if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
    throw new Error('At least one existing payment method is required to create demo orders.');
  }
  if (!shippingMethod?._id) throw new Error('An existing shipping method is required to create demo orders.');

  const title = product.title || product.vi?.title || product.en?.title || 'Sản phẩm mẫu';
  const sku = product.sku || product.id || 'DEMO-PRODUCT';
  const unitPrice = Number(product.salePrice > 0 ? product.salePrice : product.regularPrice || 0);
  const image = product.mainImage?.url || product.images?.[0] || '';
  const fee = Number(shippingMethod.baseFee || 0);
  const baseDate = new Date('2026-10-01T09:00:00.000Z');
  const activePaymentMethod = paymentMethods.find(method => method.status !== 'INACTIVE' && method.isActive !== false)
    || paymentMethods[0];
  const historicalPaymentMethod = paymentMethods.find(method => method.status === 'INACTIVE' || method.isActive === false)
    || paymentMethods[1]
    || activePaymentMethod;
  const cases = [
    { sequence: '001', status: 'PENDING', paymentStatus: 'PENDING', trackingNumber: '', method: activePaymentMethod },
    { sequence: '002', status: 'SHIPPING', paymentStatus: 'PAID', trackingNumber: 'DEMO-TRACK-2026-002', method: activePaymentMethod },
    { sequence: '003', status: 'RETURNED', paymentStatus: 'REFUNDED', trackingNumber: 'DEMO-TRACK-2026-003', method: historicalPaymentMethod },
  ];

  return cases.map((entry, index) => {
    const paymentMethod = entry.method;
    const orderId = `DEMO-ORDER-2026-${entry.sequence}`;
    const amount = unitPrice + fee;
    const createdAt = new Date(baseDate.getTime() + index * 60 * 60 * 1000);
    const history = [{ status: 'PENDING', updatedAt: createdAt, updatedBy: null, note: 'Đơn mẫu được tạo để kiểm thử.' }];
    if (entry.status !== 'PENDING') {
      history.push({ status: 'PROCESSING', updatedAt: createdAt, updatedBy: null, note: 'Đơn mẫu được xử lý.' });
      history.push({ status: entry.status, updatedAt: createdAt, updatedBy: null, note: 'Trạng thái mẫu phục vụ kiểm thử.' });
    }

    return {
      orderId,
      userId: null,
      _user: null,
      customer: {
        name: `Khách demo ${entry.sequence}`,
        email: `demo-order-${entry.sequence}@example.invalid`,
        phone: '0000000000',
      },
      customerEmail: `demo-order-${entry.sequence}@example.invalid`,
      customerPhone: '0000000000',
      status: entry.status,
      notes: `DEMO-SEED:v1:${entry.sequence}`,
      items: [{
        productId: product._id,
        variantId: null,
        productSnapshot: { title, sku, image, variant: { color: '', size: '', classification: '' } },
        quantity: 1,
        unitPrice,
        subtotal: unitPrice,
      }],
      shippingAddress: {
        fullName: `Khách demo ${entry.sequence}`,
        phone: '0000000000',
        address: 'Địa chỉ giả lập — không giao hàng',
        ward: 'Phường mẫu',
        district: 'Quận mẫu',
        province: 'Hà Nội',
        provinceName: 'Hà Nội',
      },
      addresses: [{ fullName: `Khách demo ${entry.sequence}`, phone: '0000000000', address: 'Địa chỉ giả lập — không giao hàng' }],
      shipping: {
        method: shippingMethod.code || 'STANDARD',
        provider: shippingMethod.name || '',
        trackingNumber: entry.trackingNumber,
        estimatedDeliveryDate: entry.trackingNumber ? new Date(createdAt.getTime() + 3 * 86400000) : null,
        shippedAt: entry.status === 'SHIPPING' || entry.status === 'RETURNED' ? createdAt : null,
        deliveredAt: entry.status === 'RETURNED' ? createdAt : null,
      },
      shippingMethodId: shippingMethod._id,
      shippingMethodSnapshot: {
        name: shippingMethod.name || 'Giao hàng mẫu',
        code: shippingMethod.code || 'STANDARD',
        fee,
        estimatedDeliveryTime: shippingMethod.estimatedDeliveryTime || shippingMethod.estimatedDays || '',
      },
      shippingFee: fee,
      shippingProvider: shippingMethod.name || '',
      trackingNumber: entry.trackingNumber,
      trackingUrl: '',
      estimatedDeliveryDate: entry.trackingNumber ? new Date(createdAt.getTime() + 3 * 86400000) : null,
      shippedAt: entry.status === 'SHIPPING' || entry.status === 'RETURNED' ? createdAt : null,
      deliveredAt: entry.status === 'RETURNED' ? createdAt : null,
      payment: {
        method: paymentMethod.code,
        status: entry.paymentStatus,
        provider: paymentMethod.name,
        transactionId: null,
        paidAt: entry.paymentStatus === 'PAID' || entry.paymentStatus === 'REFUNDED' ? createdAt : null,
        refundedAmount: entry.paymentStatus === 'REFUNDED' ? amount : 0,
        refundedAt: entry.paymentStatus === 'REFUNDED' ? createdAt : null,
      },
      paymentMethodId: paymentMethod._id,
      paymentMethodSnapshot: {
        name: paymentMethod.name,
        code: paymentMethod.code,
        paymentType: paymentMethod.paymentType,
        paymentFee: 0,
      },
      paymentStatus: entry.paymentStatus,
      transactionId: '',
      paymentProvider: paymentMethod.name,
      paymentFee: 0,
      paidAt: entry.paymentStatus === 'PAID' || entry.paymentStatus === 'REFUNDED' ? createdAt : null,
      refundedAmount: entry.paymentStatus === 'REFUNDED' ? amount : 0,
      refundedAt: entry.paymentStatus === 'REFUNDED' ? createdAt : null,
      subtotal: unitPrice,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: amount,
      amount,
      currency: 'VND',
      dateAdded: createdAt,
      createdAt,
      updatedAt: createdAt,
      statusHistory: history,
      shippingLogs: entry.trackingNumber ? [{
        status: entry.status === 'SHIPPING' ? 'IN_TRANSIT' : 'RETURNED',
        location: 'Điểm trung chuyển mẫu',
        description: 'Sự kiện vận chuyển giả lập; không có kiện hàng thật.',
        timestamp: createdAt,
      }] : [],
    };
  });
}

async function syncDemoOrders(ordersCollection, demoOrders) {
  for (const order of demoOrders) {
    const existing = await ordersCollection.findOne({ orderId: order.orderId });
    if (existing && existing.notes !== order.notes) {
      throw new Error(`Refusing to replace non-demo order with reserved ID ${order.orderId}.`);
    }
  }

  let inserted = 0;
  let refreshed = 0;
  for (const order of demoOrders) {
    let result;
    try {
      result = await ordersCollection.replaceOne(
        { orderId: order.orderId, notes: order.notes },
        order,
        { upsert: true },
      );
    } catch (error) {
      if (error?.code === 11000) {
        throw new Error(`Refusing to replace non-demo order with reserved ID ${order.orderId}.`);
      }
      throw error;
    }
    if (result.upsertedCount) inserted += 1;
    else if (result.matchedCount) refreshed += 1;
  }
  return { inserted, refreshed };
}

module.exports = { resolveDemoSeedTarget, openSeedDatabase, buildDemoOrders, syncDemoOrders };
