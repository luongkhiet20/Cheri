const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { buildDemoOrders, openSeedDatabase, syncDemoOrders } = require('./demo-order-seed-core.cjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const connection = await openSeedDatabase(process.env, (uri, options) => mongoose.connect(uri, options));
  try {
    const db = connection.connection.db;
    const products = await db.collection('products')
      .find({ visibility: { $ne: false } })
      .sort({ createdAt: 1, _id: 1 })
      .limit(100)
      .toArray();
    const product = products.find(item => Number(item.salePrice > 0 ? item.salePrice : item.regularPrice || 0) >= 0);
    if (!product) throw new Error('No visible product is available for demo order snapshots.');

    const paymentMethods = await db.collection('payment_methods').find({}).sort({ code: 1 }).toArray();
    const shippingMethod = await db.collection('shippingmethods').findOne({
      $or: [{ status: 'ACTIVE' }, { isActive: true }],
    }, { sort: { code: 1 } });
    const demoOrders = buildDemoOrders({ product, paymentMethods, shippingMethod });
    const orders = db.collection('orders');

    if (process.env.SEED_DEMO_DRY_RUN === 'true') {
      console.log(`Dry run for authorized development database ${process.env.SEED_DEMO_DB_NAME}: ${demoOrders.length} synthetic orders prepared; no records written.`);
      return;
    }

    const { inserted, refreshed } = await syncDemoOrders(orders, demoOrders);

    console.log(`Demo seed completed for authorized development database ${process.env.SEED_DEMO_DB_NAME}: ${inserted} inserted, ${refreshed} refreshed.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`Demo order seed stopped (${error?.name || 'Error'}). No non-demo records are intentionally modified; connection details are omitted.`);
  process.exitCode = 1;
});
