// Script seed và migration khởi tạo collection social_links trên MongoDB
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Lỗi: Thiếu biến môi trường MONGO_URI');
  process.exit(1);
}

const DEFAULT_PLATFORMS = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK'];

async function seedSocialLinks() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  try {
    console.log('Đang kết nối tới cơ sở dữ liệu MongoDB...');
    await client.connect();
    const db = client.db();
    const collection = db.collection('social_links');

    console.log('Tạo unique index cho trường `platform`...');
    await collection.createIndex({ platform: 1 }, { unique: true });

    console.log('Đang khởi tạo các nền tảng mạng xã hội...');
    const now = new Date();

    for (const platform of DEFAULT_PLATFORMS) {
      const result = await collection.updateOne(
        { platform },
        {
          $setOnInsert: {
            platform,
            url: '',
            isActive: false,
            createdAt: now,
          },
          $set: {
            updatedAt: now,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`+ Đã tạo mới document cho nền tảng: ${platform}`);
      } else {
        console.log(`= Nền tảng ${platform} đã tồn tại trong database (giữ nguyên dữ liệu hiện có).`);
      }
    }

    const allLinks = await collection.find({}).sort({ platform: 1 }).toArray();
    console.log('\n--- DỮ LIỆU HIỆN TẠI TRONG COLLECTION social_links ---');
    console.log(JSON.stringify(allLinks, null, 2));
    console.log(`Tổng cộng: ${allLinks.length} bản ghi.\n`);
    console.log('Khởi tạo hoàn tất thành công!');
  } catch (error) {
    console.error('Lỗi khi seed social_links:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedSocialLinks();

