/**
 * Script xóa collection 'shipping_methods' (tên sai) khỏi MongoDB
 * Giữ lại 'shippingmethods' (collection gốc của CSDL)
 *
 * Chạy: node server/scripts/drop-shipping-methods.js
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI không được tìm thấy trong .env');
    process.exit(1);
  }

  console.log('🔗 Đang kết nối MongoDB...');
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  console.log('📋 Collections hiện có:', names.join(', '));

  if (names.includes('shipping_methods')) {
    await db.collection('shipping_methods').drop();
    console.log('✅ Đã xóa collection "shipping_methods" (collection sai tên)');
  } else {
    console.log('ℹ️  Collection "shipping_methods" không tồn tại — không cần xóa');
  }

  if (names.includes('shippingmethods')) {
    const count = await db.collection('shippingmethods').countDocuments();
    console.log(`✅ Collection "shippingmethods" (gốc) vẫn giữ nguyên — ${count} bản ghi`);
  }

  await mongoose.disconnect();
  console.log('🎉 Hoàn tất!');
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
