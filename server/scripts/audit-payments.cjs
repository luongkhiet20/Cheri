// Read-only payment consistency audit. Never prints credentials or customer PII.
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
async function main() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();
    const order = await db.collection('orders').findOne({ orderId: process.argv[2] });
    const methods = await db.collection('payment_methods').find({}, { projection: { name: 1, code: 1, paymentType: 1, status: 1 } }).toArray();
    const transactions = order ? await db.collection('payment_transactions').find({ orderId: order._id }, { projection: { provider: 1, method: 1, status: 1, amount: 1, providerTransactionId: 1 } }).toArray() : [];
    const anomalies = await db.collection('orders').aggregate([
      { $match: { 'payment.provider': { $in: ['VNPAY', 'STRIPE'] } } },
      { $group: { _id: { provider: '$payment.provider', method: '$payment.method', snapshot: '$paymentMethodSnapshot.code', status: '$paymentStatus', nestedStatus: '$payment.status' }, count: { $sum: 1 } } },
    ]).toArray();
    const inconsistentOrders = await db.collection('orders').aggregate([
      { $match: { 'payment.provider': { $in: ['VNPAY', 'STRIPE'] }, $expr: { $ne: ['$paymentStatus', '$payment.status'] } } },
      { $lookup: { from: 'payment_transactions', localField: '_id', foreignField: 'orderId', as: 'transactions' } },
      { $project: { orderId: 1, paymentStatus: 1, 'payment.status': 1, 'payment.provider': 1, 'transactions.status': 1, 'transactions.provider': 1 } },
    ]).toArray();
    console.log(JSON.stringify({ database: db.databaseName, methods, inconsistentOrders, order: order ? {
      id: order._id, orderId: order.orderId, payment: order.payment, paymentStatus: order.paymentStatus,
      paymentMethodSnapshot: order.paymentMethodSnapshot, type: order.type, total: order.totalAmount, status: order.status,
      hasUser: !!(order._user || order.userId), hasAddress: !!order.shippingAddress?.address,
      hasRecipient: !!order.shippingAddress?.fullName,
      items: order.items?.map(item => ({ hasTitle: !!item.productSnapshot?.title, hasImage: !!item.productSnapshot?.image, quantity: item.quantity })),
    } : null, transactions, paymentGroups: anomalies }, null, 2));
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.name); process.exitCode = 1; });
