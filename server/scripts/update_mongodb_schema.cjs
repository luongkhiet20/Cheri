const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";

const COLLECTION_DESCRIPTIONS = {
  users: "Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/admin.",
  orders: "Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái, yêu cầu trả hàng/hủy.",
  products: "Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục.",
  categories: "Danh mục sản phẩm theo cây phân cấp (level1, level2).",
  coupons: "Mã giảm giá: loại, giá trị, điều kiện, thời hạn sử dụng.",
  shippingmethods: "Phương thức vận chuyển: tên, phí, trạng thái, vùng giao hàng.",
  payment_methods: "Phương thức thanh toán: COD, Stripe, v.v.",
  settings: "Cấu hình toàn site: thông tin cửa hàng, bảo trì, tiền tệ, liên hệ.",
  session: "Session người dùng lưu giỏ hàng khách vãng lai và auth token.",
  "notification-popup": "Thông báo popup hiển thị cho người dùng.",
  grapesjs_projects: "Dự án thiết kế trang GrapesJS (lưu JSON thiết kế).",
  grapesjs_published: "Trang đã xuất bản từ GrapesJS editor.",
  pages_home: "Nội dung trang chủ (hero, banner, sections).",
  pages_about: "Nội dung trang giới thiệu.",
  pages_policies: "Nội dung các trang chính sách (điều khoản, bảo mật, v.v.).",
  pages: "Các trang tĩnh khác của website.",
  translations: "Dữ liệu đa ngôn ngữ cho giao diện.",
  product_reviews: "Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt).",
  user_interactions: "Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System).",
  ml_bootstrap_interactions: "Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế.",
  passwordresets: "Token đặt lại mật khẩu (email, token, hết hạn).",
  configs: "Cấu hình hệ thống nội bộ (reserved).",
  themes: "Theme giao diện website (reserved).",
  product_variants: "Biến thể sản phẩm độc lập (deprecated/reserved).",
  shipping_methods: "Phương thức vận chuyển (alias/deprecated, dùng shippingmethods).",
  orders_backup_20261005: "Backup đơn hàng trước migration ngày 05/10/2026.",
  orders_backup_fk_20261005: "Backup đơn hàng có foreign-key trước migration ngày 05/10/2026.",
  guest_carts: "Giỏ hàng tạm thời của khách vãng lai (lưu theo guestId, items, thông tin sản phẩm và phân loại).",
  payment_transactions: "Nhật ký giao dịch thanh toán trực tuyến / cổng thanh toán (mã giao dịch, trạng thái, số tiền, phương thức).",
  newsletter_subscribers: "Danh sách khách hàng và khách vãng lai đăng ký nhận bản tin ưu đãi (email, trạng thái SUBSCRIBED/UNSUBSCRIBED, nguồn đăng ký, thời gian).",
  conversations: "Phiên hội thoại hỗ trợ khách hàng với nhân viên (trạng thái WAITING_ADMIN, IN_PROGRESS, CLOSED, thông tin khách, phân công admin, yêu cầu hủy 5s).",
  conversation_messages: "Tin nhắn trong cuộc hội thoại hỗ trợ giữa khách hàng, nhân viên admin và hệ thống (CUSTOMER, ADMIN, SYSTEM, timestamp, systemEvent).",
  chatbot_sessions: "Phiên trò chuyện của người dùng với AI Assistant / Chatbot Chéri (lịch sử tin nhắn, sessionId, guestId, ngữ cảnh tư vấn).",
  chat_rate_limits: "Giới hạn tần suất gửi tin nhắn chat của người dùng / IP để chống spam và tấn công DoS."
};

function getType(val) {
  if (val === null) return 'Null';
  if (val === undefined) return 'Undefined';
  if (val instanceof Date) return 'Date';
  if (val instanceof ObjectId || (val && val._bsontype === 'ObjectId') || (val && val.constructor && val.constructor.name === 'ObjectId')) return 'ObjectId';
  if (Array.isArray(val)) return 'Array';
  if (Buffer.isBuffer(val)) return 'Binary';
  if (typeof val === 'boolean') return 'Boolean';
  if (typeof val === 'number') return 'Number';
  if (typeof val === 'bigint') return 'Number';
  if (typeof val === 'string') return 'String';
  if (typeof val === 'object') return 'Object';
  return typeof val;
}

function extractDocPaths(val, currentPath, docPathsMap) {
  if (val === undefined) return;
  const t = getType(val);

  if (currentPath) {
    if (!docPathsMap.has(currentPath)) {
      docPathsMap.set(currentPath, new Set());
    }
    docPathsMap.get(currentPath).add(t);
  }

  if (t === 'Object' && val !== null) {
    for (const key of Object.keys(val)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      extractDocPaths(val[key], childPath, docPathsMap);
    }
  } else if (t === 'Array') {
    const itemPath = `${currentPath}[]`;
    for (const item of val) {
      extractDocPaths(item, itemPath, docPathsMap);
    }
  }
}

function getFieldName(p) {
  const parts = p.split('.');
  return parts[parts.length - 1];
}

async function generateSchema() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('cheri');
  console.log('Connected to database "cheri"');

  const rawCollections = await db.listCollections().toArray();
  const allNames = rawCollections.map(c => c.name);

  // Preferred ordering
  const preferredOrder = [
    'users', 'orders', 'products', 'categories', 'coupons',
    'shippingmethods', 'payment_methods', 'settings', 'session',
    'notification-popup', 'grapesjs_projects', 'grapesjs_published',
    'pages_home', 'pages_about', 'pages_policies', 'pages',
    'translations', 'product_reviews', 'user_interactions',
    'ml_bootstrap_interactions', 'passwordresets', 'configs',
    'themes', 'product_variants', 'shipping_methods',
    'orders_backup_20261005', 'orders_backup_fk_20261005',
    'guest_carts', 'payment_transactions',
    'newsletter_subscribers', 'conversations', 'conversation_messages',
    'chatbot_sessions', 'chat_rate_limits'
  ];

  const sortedNames = [];
  for (const name of preferredOrder) {
    if (allNames.includes(name)) {
      sortedNames.push(name);
    }
  }
  for (const name of allNames) {
    if (!sortedNames.includes(name)) {
      sortedNames.push(name);
    }
  }

  console.log(`Analyzing ${sortedNames.length} collections...`);
  const collectionsResult = [];

  for (let i = 0; i < sortedNames.length; i++) {
    const collName = sortedNames[i];
    const coll = db.collection(collName);
    const docCount = await coll.countDocuments();

    // Sample documents: up to 500 docs if large, otherwise all docs
    const sampleLimit = docCount > 500 ? 500 : (docCount === 0 ? 0 : docCount);
    let docs = [];
    if (sampleLimit > 0) {
      docs = await coll.find({}).limit(sampleLimit).toArray();
    }
    const sampledCount = docs.length;

    // Track path counts and types across all sampled docs
    const pathDocCounts = new Map(); // path -> number of docs containing this path
    const pathTypes = new Map();     // path -> Set of types

    for (const doc of docs) {
      const docPathsMap = new Map();
      extractDocPaths(doc, '', docPathsMap);

      for (const [p, typesSet] of docPathsMap.entries()) {
        pathDocCounts.set(p, (pathDocCounts.get(p) || 0) + 1);
        if (!pathTypes.has(p)) {
          pathTypes.set(p, new Set());
        }
        for (const t of typesSet) {
          pathTypes.get(p).add(t);
        }
      }
    }

    // Build fields array
    const sortedPaths = Array.from(pathDocCounts.keys()).sort();
    const fields = sortedPaths.map(p => {
      const types = Array.from(pathTypes.get(p)).sort();
      return {
        name: getFieldName(p),
        path: p,
        types: types,
        type: types.join(' | '),
        frequency: `${pathDocCounts.get(p)}/${sampledCount}`
      };
    });

    console.log(`[${i + 1}/${sortedNames.length}] ${collName}: ${docCount} docs (sampled ${sampledCount}, ${fields.length} fields)`);

    collectionsResult.push({
      name: collName,
      documentCount: docCount,
      sampledCount: sampledCount,
      fields: fields
    });
  }

  const nowIso = new Date().toISOString();
  const schemaJson = {
    database: "cheri",
    updatedAt: nowIso,
    totalCollections: collectionsResult.length,
    collections: collectionsResult
  };

  const jsonPath = path.resolve(__dirname, '../../cheri_mongodb_schema.json');
  fs.writeFileSync(jsonPath, JSON.stringify(schemaJson, null, 2), 'utf-8');
  console.log(`Saved updated JSON schema to: ${jsonPath}`);

  // Generate updated Markdown documentation as well
  let md = `# CHERI MongoDB Schema\n\n`;
  md += `> **Database**: \`cheri\`  \n`;
  md += `> **Cập nhật**: ${nowIso}  \n`;
  md += `> **Tổng số collection**: ${collectionsResult.length}  \n\n`;
  md += `## Danh sách Collections\n\n`;
  md += `| # | Collection | Docs | Fields | Mô tả |\n`;
  md += `|---|-----------|------|--------|-------|\n`;

  collectionsResult.forEach((c, idx) => {
    const desc = COLLECTION_DESCRIPTIONS[c.name] || 'Dữ liệu collection hệ thống.';
    md += `| ${idx + 1} | \`${c.name}\` | ${c.documentCount} | ${c.fields.length} | ${desc} |\n`;
  });

  md += `\n---\n\n`;

  collectionsResult.forEach(c => {
    const desc = COLLECTION_DESCRIPTIONS[c.name] || 'Dữ liệu collection hệ thống.';
    md += `## \`${c.name}\`\n\n`;
    md += `> ${desc}\n\n`;
    md += `- **Documents**: ${c.documentCount}  \n`;
    md += `- **Sampled**: ${c.sampledCount}  \n`;
    md += `- **Fields**: ${c.fields.length}  \n\n`;

    if (c.fields.length > 0) {
      md += `| Field (path) | Type | Frequency |\n`;
      md += `|-------------|------|----------|\n`;
      c.fields.forEach(f => {
        md += `| \`${f.path}\` | \`${f.type}\` | ${f.frequency} |\n`;
      });
      md += `\n`;
    } else {
      md += `*Collection hiện đang rỗng (chưa có tài liệu)*\n\n`;
    }
  });

  const mdPath = path.resolve(__dirname, '../../cheri_mongodb_schema.md');
  fs.writeFileSync(mdPath, md, 'utf-8');
  console.log(`Saved updated Markdown schema to: ${mdPath}`);

  await client.close();
  console.log('MongoDB connection closed.');
}

generateSchema().catch(err => {
  console.error('Error updating schema:', err);
  process.exit(1);
});
