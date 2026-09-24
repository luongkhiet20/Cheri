/**
 * Seed script: Tạo dữ liệu mẫu cho shipping_methods và payment_methods
 * Đồng thời xóa sạch orders cũ (môi trường dev)
 *
 * Chạy: npx ts-node -r tsconfig-paths/register server/src/scripts/seed-orders-config.ts
 */

import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/cheri';

async function run() {
  const conn = await mongoose.connect(MONGO_URI);
  console.log(' Connected to MongoDB:', MONGO_URI);

  const db = conn.connection.db;

  // ─── Xóa dữ liệu cũ ──────────────────────────────────────────────────────
  console.log('\n  Xóa orders cũ...');
  const delOrders = await db.collection('orders').deleteMany({});
  console.log(`   Đã xóa ${delOrders.deletedCount} orders`);

  // ─── Seed shipping_methods ────────────────────────────────────────────────
  console.log('\n📦 Seed shipping_methods...');
  await db.collection('shipping_methods').deleteMany({});

  const shippingMethods = [
    {
      name: 'Giao hàng tiêu chuẩn',
      code: 'STANDARD',
      baseFee: 30000,
      estimatedDeliveryTime: '3-5 ngày làm việc',
      deliveryScope: 'NATIONWIDE',
      deliveryAreas: [],
      freeShippingCondition: {
        enabled: true,
        minimumOrderValue: 500000,
        description: 'Miễn phí vận chuyển cho đơn hàng từ 500.000đ',
      },
      status: 'ACTIVE',
      description: 'Giao hàng toàn quốc qua đơn vị vận chuyển tiêu chuẩn',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Giao hàng nhanh',
      code: 'EXPRESS',
      baseFee: 60000,
      estimatedDeliveryTime: '1-2 ngày làm việc',
      deliveryScope: 'SPECIFIC_AREAS',
      deliveryAreas: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng'],
      freeShippingCondition: {
        enabled: false,
        minimumOrderValue: 0,
        description: '',
      },
      status: 'ACTIVE',
      description: 'Giao hàng nhanh trong ngày hoặc ngày hôm sau tại các thành phố lớn',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Nhận tại cửa hàng',
      code: 'PICKUP',
      baseFee: 0,
      estimatedDeliveryTime: 'Trong ngày',
      deliveryScope: 'SPECIFIC_AREAS',
      deliveryAreas: ['Hà Nội'],
      freeShippingCondition: {
        enabled: false,
        minimumOrderValue: 0,
        description: '',
      },
      status: 'ACTIVE',
      description: 'Đặt online, nhận tại cửa hàng Chéri',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const shippingResult = await db.collection('shipping_methods').insertMany(shippingMethods);
  console.log(`   Đã thêm ${shippingResult.insertedCount} shipping methods`);

  // ─── Seed payment_methods ─────────────────────────────────────────────────
  console.log('\n Seed payment_methods...');
  await db.collection('payment_methods').deleteMany({});

  const paymentMethods = [
    {
      name: 'Thanh toán khi nhận hàng (COD)',
      code: 'COD',
      paymentType: 'CASH',
      description: 'Thanh toán bằng tiền mặt khi nhận hàng từ shipper',
      transactionFee: {
        enabled: false,
        type: 'FIXED',
        value: 0,
      },
      logo: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Thẻ tín dụng / Stripe',
      code: 'STRIPE',
      paymentType: 'PAYMENT_GATEWAY',
      description: 'Thanh toán an toàn qua cổng Stripe — hỗ trợ Visa, Mastercard',
      transactionFee: {
        enabled: true,
        type: 'PERCENTAGE',
        value: 2.9,
      },
      logo: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Chuyển khoản ngân hàng',
      code: 'BANK_TRANSFER',
      paymentType: 'BANK_TRANSFER',
      description: 'Chuyển khoản trực tiếp vào tài khoản ngân hàng Chéri',
      transactionFee: {
        enabled: false,
        type: 'FIXED',
        value: 0,
      },
      logo: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Ví MoMo',
      code: 'MOMO',
      paymentType: 'E_WALLET',
      description: 'Thanh toán qua ví điện tử MoMo',
      transactionFee: {
        enabled: true,
        type: 'FIXED',
        value: 5000,
      },
      logo: '',
      status: 'INACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const paymentResult = await db.collection('payment_methods').insertMany(paymentMethods);
  console.log(`   Đã thêm ${paymentResult.insertedCount} payment methods`);

  // ─── Kết quả ──────────────────────────────────────────────────────────────
  console.log('\n Seed hoàn tất!\n');

  const shippingList = await db.collection('shipping_methods').find({}).toArray();
  console.log('shipping_methods:');
  shippingList.forEach(s => console.log(`   [${s._id}] ${s.code} — ${s.name} — ${s.baseFee}đ`));

  const paymentList = await db.collection('payment_methods').find({}).toArray();
  console.log('\npayment_methods:');
  paymentList.forEach(p => console.log(`   [${p._id}] ${p.code} — ${p.name}`));

  await mongoose.disconnect();
  console.log('\n Disconnected\n');
}

run().catch((err) => {
  console.error(' Seed thất bại:', err);
  process.exit(1);
});
