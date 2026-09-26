require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.ADMIN_PORT || process.env.PORT_ADMIN || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";

const allowedOrigins = [
  'https://cheri-three.vercel.app',
  'http://localhost:3000',
  'http://localhost:4000',
  process.env.ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let db = null;
let client = null;

async function connectToMongo() {
  if (db && client) {
    return db;
  }
  try {
    client = new MongoClient(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db('cheri');
    console.log(' Successfully connected to MongoDB Database: cheri');
    return db;
  } catch (err) {
    console.error(' MongoDB Connection Error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD OVERVIEW STATS & TIMELINE
// ─────────────────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 5;

const ORDER_STATUS_CONFIG = [
  { code: 'PENDING', label: 'Chờ xác nhận', queryParam: 'Chờ xác nhận', variant: 'neutral' },
  { code: 'PROCESSING', label: 'Đang xử lý', queryParam: 'Đang xử lý', variant: 'warning' },
  { code: 'SHIPPING', label: 'Đang giao', queryParam: 'Đang giao', variant: 'primary' },
  { code: 'DELIVERED', label: 'Đã giao', queryParam: 'Đã giao', variant: 'success' },
  { code: 'CANCELLED', label: 'Đã hủy', queryParam: 'Đã hủy', variant: 'danger' }
];

function getRevenueTimeline(orders, timeRange) {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  if (timeRange === '30d') {
    startDate.setDate(now.getDate() - 29);
  } else if (timeRange === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (timeRange === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else {
    // default: 7d
    startDate.setDate(now.getDate() - 6);
  }
  startDate.setHours(0, 0, 0, 0);

  const dailyMap = new Map();
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const key = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`;
    const keyFull = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}/${cur.getFullYear()}`;
    dailyMap.set(key, { label: key, fullDate: keyFull, revenue: 0, ordersCount: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  for (const o of orders) {
    const rawSt = (o.statusHistory?.[0]?.status || o.status || '').toUpperCase();
    if (rawSt === 'DELIVERED') {
      const oDate = new Date(o.dateAdded || o.createdAt || (o._id ? o._id.getTimestamp() : null));
      if (!isNaN(oDate.getTime()) && oDate >= startDate && oDate <= endDate) {
        const key = `${String(oDate.getDate()).padStart(2, '0')}/${String(oDate.getMonth() + 1).padStart(2, '0')}`;
        const entry = dailyMap.get(key);
        if (entry) {
          const rev = Number(o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0));
          entry.revenue += isNaN(rev) ? 0 : rev;
          entry.ordersCount += 1;
        }
      }
    }
  }

  return Array.from(dailyMap.values());
}

const dashboardHandler = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '7d';

    // 1. Concurrent queries to MongoDB Atlas for high performance & low latency
    const [pingRes, orders, products, categoriesCount, users] = await Promise.all([
      db.command({ ping: 1 }).then(() => 'Connected').catch((err) => {
        console.error('db.command ping failed:', err);
        return 'Disconnected';
      }),
      db.collection('orders').find({}).sort({ dateAdded: -1, _id: -1 }).toArray(),
      db.collection('products').find({}, {
        projection: {
          'vi.title': 1, 'vi.sku': 1, 'vi.quantity': 1, 'vi.stock': 1, 'vi.salePrice': 1, 'vi.regularPrice': 1, 'vi.categoryLevel1': 1,
          title: 1, sku: 1, quantity: 1, variants: 1, mainImage: 1, images: 1, categoryLevel1: 1
        }
      }).toArray(),
      db.collection('categories').countDocuments(),
      db.collection('users').find({}, { projection: { createdAt: 1, dateAdded: 1 } }).toArray()
    ]);

    const mongoStatus = pingRes === 'Connected' ? 'Connected' : 'Disconnected';
    const mongoStatusText = pingRes === 'Connected' ? 'Đã kết nối thành công' : 'Mất kết nối MongoDB';

    // Calculate Total Revenue (orders with status DELIVERED)
    let totalRevenue = 0;
    orders.forEach(o => {
      const rawSt = (o.statusHistory?.[0]?.status || o.status || '').toUpperCase();
      if (rawSt === 'DELIVERED') {
        const p = Number(o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0));
        if (!isNaN(p)) totalRevenue += p;
      }
    });

    // 3. Orders by Status
    const statusCounts = {};
    ORDER_STATUS_CONFIG.forEach(c => statusCounts[c.code] = 0);
    orders.forEach(o => {
      const rawSt = (o.statusHistory?.[0]?.status || o.status || 'PENDING').toUpperCase();
      if (statusCounts[rawSt] !== undefined) {
        statusCounts[rawSt]++;
      } else {
        statusCounts.PENDING++;
      }
    });

    const ordersByStatus = ORDER_STATUS_CONFIG.map(c => ({
      code: c.code,
      label: c.label,
      queryParam: c.queryParam,
      count: statusCounts[c.code] || 0,
      variant: c.variant
    }));

    // 4. Revenue Timeline
    const revenueTimeline = getRevenueTimeline(orders, timeRange);

    // 5. Top Selling Products (From orders.cart.items)
    const topProductsMap = new Map();
    orders.forEach(o => {
      const items = o.cart?.items;
      if (Array.isArray(items)) {
        items.forEach(it => {
          const pId = (it.id || it.item?._id || it.item?.id || '').toString();
          const pName = it.item?.vi?.title || it.item?.title || it.name || 'Sản phẩm';
          const pImg = it.item?.mainImage?.url || it.item?.image || (Array.isArray(it.item?.images) ? it.item.images[0] : '');
          const pPrice = Number(it.price || it.item?.salePrice || it.item?.regularPrice || 0);
          const qty = Number(it.qty || it.quantity || 1);

          if (!topProductsMap.has(pId)) {
            topProductsMap.set(pId, {
              id: pId,
              name: pName,
              image: pImg,
              price: pPrice,
              totalSold: 0,
              revenue: 0
            });
          }
          const prod = topProductsMap.get(pId);
          prod.totalSold += qty;
          prod.revenue += qty * pPrice;
        });
      }
    });

    const topSellingProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    // 6. Products, Low Stock and Out of Stock
    const lowStockProducts = [];
    let outOfStockCount = 0;
    let inStockCount = 0;

    products.forEach(p => {
      const vi = p.vi || {};
      let qty = 0;
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        qty = p.variants.reduce((acc, v) => acc + Number(v.stock || 0), 0);
      } else if (vi.quantity !== undefined && !isNaN(Number(vi.quantity))) {
        qty = Number(vi.quantity);
      } else if (p.quantity !== undefined && !isNaN(Number(p.quantity))) {
        qty = Number(p.quantity);
      }

      if (qty === 0 || vi.stock === 'outOfStock') {
        outOfStockCount++;
      } else {
        inStockCount++;
        if (qty <= LOW_STOCK_THRESHOLD) {
          lowStockProducts.push({
            id: p._id.toString(),
            name: vi.title || p.title || p.titleUrl || 'Sản phẩm',
            sku: p.variants?.[0]?.sku || vi.sku || ('SP-' + p._id.toString().slice(-6).toUpperCase()),
            stock: qty,
            price: vi.salePrice || vi.regularPrice || p.regularPrice || 0,
            image: p.mainImage?.url || (Array.isArray(p.images) ? p.images[0] : ''),
            category: vi.categoryLevel1 || p.categoryLevel1 || 'Thời trang'
          });
        }
      }
    });

    lowStockProducts.sort((a, b) => a.stock - b.stock);
    const topLowStock = lowStockProducts.slice(0, 5);

    // 7. Users & New Customers
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let new7Days = 0;
    let new30Days = 0;
    users.forEach(u => {
      const uDate = u.createdAt ? new Date(u.createdAt) : (u.dateAdded ? new Date(u.dateAdded) : (u._id ? u._id.getTimestamp() : null));
      if (uDate && !isNaN(uDate.getTime())) {
        if (uDate >= sevenDaysAgo) new7Days++;
        if (uDate >= thirtyDaysAgo) new30Days++;
      }
    });

    // 8. Recent Orders
    const recentOrders = orders.slice(0, 6).map(o => {
      const address = o.addresses?.[0] || {};
      const statusHistory = o.statusHistory || [];
      const rawStatus = (statusHistory[0]?.status || o.status || 'PENDING').toUpperCase();
      const statusCfg = ORDER_STATUS_CONFIG.find(c => c.code === rawStatus) || { label: 'Chờ xác nhận', variant: 'neutral' };
      const totalPrice = o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0);

      return {
        id: o._id.toString(),
        _id: o._id.toString(),
        code: o.orderId || ('#DH' + o._id.toString().slice(-6).toUpperCase()),
        customer: address.name || o.customerEmail || 'Khách mua hàng',
        customerEmail: o.customerEmail || address.email || '',
        total: totalPrice,
        status: statusCfg.label,
        statusVariant: statusCfg.variant,
        statusCode: rawStatus,
        date: o.dateAdded || o.createdAt || new Date().toISOString()
      };
    });

    // 9. System Info
    const system = {
      database: 'cheri',
      cluster: 'cluster0.cbvni8r.mongodb.net',
      mongodb: mongoStatus,
      mongodbStatusText: mongoStatusText,
      backend: 'Online',
      serverUrl: 'http://localhost:5000',
      productsInStock: inStockCount,
      activeCategories: categoriesCount,
      totalOrders: orders.length,
      totalUsers: users.length,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      stats: {
        totalRevenue,
        ordersCount: orders.length,
        productsCount: products.length,
        usersCount: users.length,
        categoriesCount,
        outOfStockCount,
        lowStockCount: lowStockProducts.length,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        revenueTimeline,
        timeRange,
        ordersByStatus,
        topSellingProducts,
        lowStockProducts: topLowStock,
        recentOrders,
        customers: {
          total: users.length,
          new7Days,
          new30Days
        },
        system
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.get('/api/dashboard/stats', dashboardHandler);
app.get('/api/admin/dashboard', dashboardHandler);

// ─────────────────────────────────────────────────────────────
// 2. PRODUCTS API
// ─────────────────────────────────────────────────────────────
function formatProduct(p, lang = 'vi') {
  const langData = p[lang] || p.vi || p.en || {};
  const fallbackData = p.en || p.vi || {};

  const name = langData.title || fallbackData.title || p.title || (p.titleUrl ? p.titleUrl.replace(/-/g, ' ') : 'Sản phẩm chưa đặt tên');
  
  const regularPrice = Number(langData.regularPrice || fallbackData.regularPrice || p.regularPrice) || 0;
  const salePrice = Number(langData.salePrice || fallbackData.salePrice || p.salePrice) || regularPrice;
  const price = salePrice || regularPrice || 0;
  
  let quantity = 0;
  if (langData.quantity !== undefined && langData.quantity !== null && langData.quantity !== '') {
    quantity = Number(langData.quantity);
  } else if (fallbackData.quantity !== undefined && fallbackData.quantity !== null && fallbackData.quantity !== '') {
    quantity = Number(fallbackData.quantity);
  } else if (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') {
    quantity = Number(p.quantity);
  }
  if (isNaN(quantity) || quantity < 0) quantity = 0;

  const stock = langData.stock || fallbackData.stock || (quantity > 0 ? 'onStock' : 'out');
  const image = p.mainImage?.url || (Array.isArray(p.images) && p.images[0]) || '';
  const category = langData.categoryLevel1 || fallbackData.categoryLevel1 || p.categoryLevel1 || 'Thời trang';

  const isGloballyVisible = p.visibility !== false;
  const isLangVisible = langData.visibility !== false && p.vi?.visibility !== false;
  const visibility = isGloballyVisible && isLangVisible;

  let status = 'Đang bán';
  let statusVariant = 'success';
  if (!visibility) {
    status = 'Tạm ẩn';
    statusVariant = 'warning';
  } else if (quantity <= 0 && (stock === 'out' || stock === 'outOfStock')) {
    status = 'Hết hàng';
    statusVariant = 'danger';
  }

  return {
    id: p._id.toString(),
    _id: p._id.toString(),
    name,
    title: name,
    titleUrl: p.titleUrl || ('san-pham-' + p._id.toString()),
    category,
    price,
    salePrice: salePrice || price,
    regularPrice: regularPrice || price,
    onSale: Boolean(langData.onSale !== undefined ? langData.onSale : (salePrice > 0 && regularPrice > 0 && salePrice < regularPrice)),
    stock,
    quantity,
    visibility,
    status,
    statusVariant,
    image,
    mainImage: p.mainImage?.url ? p.mainImage : { url: image, name: name },
    images: Array.isArray(p.images) ? p.images : (image ? [image] : []),
    tags: Array.isArray(p.tags) ? p.tags : [],
    sku: p.sku || langData.sku || fallbackData.sku || ('SP-' + p._id.toString().slice(-6).toUpperCase()),
    description: langData.description || fallbackData.description || p.description || '',
    descriptionFull: langData.descriptionFull || fallbackData.descriptionFull || p.descriptionFull || [],
    rating: p.rating !== undefined ? p.rating : 5,
    colors: p.colors || langData.colors || fallbackData.colors || [],
    sizes: p.sizes || langData.sizes || fallbackData.sizes || [],
    hasColors: p.hasColors || false,
    hasSizes: p.hasSizes || false,
    raw: p
  };
}

function generateSlug(text) {
  if (!text) return 'san-pham-' + Date.now();
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 20;
    const search = req.query.search ? req.query.search.trim() : '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const stockParam = req.query.stock || '';
    const sortParam = req.query.sort || 'newest';
    const lang = req.query.lang || req.headers['lang'] || 'vi';

    let queryConditions = [];

    if (req.query.scope === 'user') {
      queryConditions.push({
        visibility: { $ne: false },
        'vi.visibility': { $ne: false }
      });
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      queryConditions.push({
        $or: [
          { 'vi.title': searchRegex },
          { 'en.title': searchRegex },
          { title: searchRegex },
          { titleUrl: searchRegex },
          { sku: searchRegex },
          { tags: searchRegex }
        ]
      });
    }

    if (category && category !== 'all') {
      const cats = String(category).split(',').map(c => c.trim()).filter(Boolean);
      if (cats.length > 0) {
        const catConditions = cats.map(cat => {
          const r = new RegExp(cat, 'i');
          return {
            $or: [
              { tags: r },
              { titleUrl: r },
              { 'vi.categoryLevel1': r },
              { 'vi.categoryLevel2': r },
              { categoryLevel1: r },
              { categoryLevel2: r },
              { 'en.categoryLevel1': r },
              { 'en.categoryLevel2': r }
            ]
          };
        });
        queryConditions.push({ $or: catConditions });
      }
    }

    if (status) {
      if (status === 'active') {
        queryConditions.push({
          $and: [
            { visibility: { $ne: false } },
            { 'vi.visibility': { $ne: false } },
            {
              $or: [
                { 'vi.quantity': { $gt: 0 } },
                { quantity: { $gt: 0 } }
              ]
            }
          ]
        });
      } else if (status === 'inactive') {
        queryConditions.push({
          $or: [
            { visibility: false },
            { 'vi.visibility': false }
          ]
        });
      } else if (status === 'out') {
        queryConditions.push({
          $or: [
            { 'vi.quantity': { $lte: 0 } },
            { quantity: { $lte: 0 } },
            { 'vi.stock': 'outOfStock' },
            { 'vi.stock': 'out' }
          ]
        });
      }
    }

    if (!isNaN(minPrice) && minPrice > 0) {
      queryConditions.push({
        $or: [
          { 'vi.salePrice': { $gte: minPrice } },
          { 'vi.regularPrice': { $gte: minPrice } },
          { 'en.salePrice': { $gte: minPrice } },
          { 'en.regularPrice': { $gte: minPrice } },
          { salePrice: { $gte: minPrice } },
          { regularPrice: { $gte: minPrice } }
        ]
      });
    }
    if (!isNaN(maxPrice) && maxPrice > 0) {
      queryConditions.push({
        $or: [
          { 'vi.salePrice': { $lte: maxPrice } },
          { 'vi.regularPrice': { $lte: maxPrice } },
          { 'en.salePrice': { $lte: maxPrice } },
          { 'en.regularPrice': { $lte: maxPrice } },
          { salePrice: { $lte: maxPrice } },
          { regularPrice: { $lte: maxPrice } }
        ]
      });
    }

    if (stockParam && stockParam !== 'all') {
      if (stockParam === 'onStock') {
        queryConditions.push({
          $or: [
            { 'vi.stock': 'onStock' },
            { 'en.stock': 'onStock' },
            { 'vi.quantity': { $gt: 0 } },
            { quantity: { $gt: 0 } }
          ]
        });
      } else if (stockParam === 'out' || stockParam === 'outOfStock' || stockParam === 'unavailable') {
        queryConditions.push({
          $or: [
            { 'vi.stock': 'out' },
            { 'vi.stock': 'outOfStock' },
            { 'en.stock': 'out' },
            { 'vi.quantity': { $lte: 0 } },
            { quantity: { $lte: 0 } }
          ]
        });
      }
    }

    let sortObj = { _id: -1 };
    if (sortParam === 'newest') sortObj = { _id: -1 };
    else if (sortParam === 'oldest') sortObj = { _id: 1 };
    else if (sortParam === 'price-asc') sortObj = { 'vi.salePrice': 1, 'vi.regularPrice': 1, _id: -1 };
    else if (sortParam === 'price-desc') sortObj = { 'vi.salePrice': -1, 'vi.regularPrice': -1, _id: -1 };
    else if (sortParam === 'title-asc') sortObj = { 'vi.title': 1, title: 1 };
    else if (sortParam === 'title-desc') sortObj = { 'vi.title': -1, title: -1 };

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const total = await db.collection('products').countDocuments(query);
    const productsRaw = await db.collection('products')
      .find(query)
      .sort(sortObj)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const data = productsRaw.map(p => formatProduct(p, lang));

    res.json({
      success: true,
      all: data,
      data,
      products: data,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize) || 1
      },
      maxPrice: 3000000,
      minPrice: 0
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// ── CSV PRODUCT IMPORT SYSTEM ──────────────────────────────────────────────────
// ==============================================================================

// Helper: parse RFC 4180 CSV text with quote handling and BOM stripping
function parseProductsCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = [];
  let currentField = '';
  let inQuotes = false;
  let currentRow = [];

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(f => f !== '')) lines.push(currentRow);
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(f => f !== '')) lines.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) lines.push(currentRow);
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.trim().toLowerCase());
  const records = [];

  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    const record = { _rowNumber: r + 1 };
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      const val = row[c] !== undefined ? row[c] : '';
      record[header] = val;
    }
    records.push(record);
  }

  return records;
}

// Helper: safe field extraction with aliases
function getCsvVal(record, ...keys) {
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (record[lk] !== undefined && record[lk] !== '') {
      return record[lk];
    }
  }
  return '';
}

// Helper: parse string attributes like "Phân loại=Áo|Màu=Đen|Size=M" or "Color=Red|Size=S"
function parseAttributeString(attrStr) {
  const result = { classification: '', color: '', size: '' };
  if (!attrStr || typeof attrStr !== 'string') return result;
  const parts = attrStr.split('|').map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const eqIdx = p.indexOf('=');
    if (eqIdx !== -1) {
      const k = p.slice(0, eqIdx).trim().toLowerCase();
      const v = p.slice(eqIdx + 1).trim();
      if (k.includes('phân loại') || k.includes('classification') || k.includes('loại')) {
        result.classification = v;
      } else if (k.includes('màu') || k.includes('color')) {
        result.color = v;
      } else if (k.includes('size') || k.includes('cỡ') || k.includes('kích cỡ')) {
        result.size = v;
      }
    }
  }
  return result;
}

// 1. GET /api/products/csv-template — Download standardized CSV template with BOM
app.get('/api/products/csv-template', (req, res) => {
  const headers = [
    'titleUrl',
    'vi.title',
    'vi.categoryLevel1',
    'vi.categoryLevel2',
    'vi.productType',
    'vi.description',
    'vi.descriptionFull',
    'mainImage',
    'images',
    'tags',
    'visibility',
    'vi.regularPrice',
    'vi.salePrice',
    'vi.onSale',
    'vi.quantity',
    'vi.stock',
    'variant.sku',
    'variant.classification',
    'variant.color',
    'variant.size',
    'variant.price',
    'variant.discountPrice',
    'variant.stock'
  ];

  const sampleRows = [
    // Simple product (No variants)
    [
      'ao-thun-cotton-basic-tron',
      'Áo Thun Cotton Basic Trơn',
      'Thời trang nam',
      'Áo thun',
      'clothing',
      'Áo thun cotton cao cấp phom Regular fit trẻ trung',
      '100% Cotton tự nhiên thoáng mát|Thấm hút mồ hôi tối đa|Đường may tỉ mỉ sắc nét|Phù hợp đi học đi chơi',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800',
      'ao-thun|cotton|basic',
      'true',
      '199000',
      '159000',
      'true',
      '50',
      'onStock',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ],
    // Variable product (Product with 3 variants sharing the same titleUrl)
    [
      'quan-jean-slimfit-denim-nam',
      'Quần Jean Slimfit Co Giãn Nam',
      'Thời trang nam',
      'Quần jean',
      'clothing',
      'Quần jean nam dáng slimfit ôm vừa tôn dáng',
      'Chất denim co giãn 4 chiều|Bền màu không bai nhão|Khóa kéo YKK mượt mà',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800',
      '',
      'quan-jean|slimfit|denim',
      'true',
      '',
      '',
      '',
      '',
      '',
      'JEAN-SLIM-XD-S',
      'Quần Jean',
      'Xanh Đậm',
      'S',
      '380000',
      '320000',
      '15'
    ],
    [
      'quan-jean-slimfit-denim-nam',
      'Quần Jean Slimfit Co Giãn Nam',
      'Thời trang nam',
      'Quần jean',
      'clothing',
      'Quần jean nam dáng slimfit ôm vừa tôn dáng',
      'Chất denim co giãn 4 chiều|Bền màu không bai nhão|Khóa kéo YKK mượt mà',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800',
      '',
      'quan-jean|slimfit|denim',
      'true',
      '',
      '',
      '',
      '',
      '',
      'JEAN-SLIM-XD-M',
      'Quần Jean',
      'Xanh Đậm',
      'M',
      '380000',
      '320000',
      '20'
    ],
    [
      'quan-jean-slimfit-denim-nam',
      'Quần Jean Slimfit Co Giãn Nam',
      'Thời trang nam',
      'Quần jean',
      'clothing',
      'Quần jean nam dáng slimfit ôm vừa tôn dáng',
      'Chất denim co giãn 4 chiều|Bền màu không bai nhão|Khóa kéo YKK mượt mà',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800',
      '',
      'quan-jean|slimfit|denim',
      'true',
      '',
      '',
      '',
      '',
      '',
      'JEAN-SLIM-DEN-L',
      'Quần Jean',
      'Đen Tuyển',
      'L',
      '380000',
      '0',
      '10'
    ],
    // Another Simple Product
    [
      'dam-xoe-hoa-nhi-vintage',
      'Đầm Xòe Nữ Hoa Nhí Vintage',
      'Thời trang nữ',
      'Đầm & Váy',
      'clothing',
      'Đầm voan hoa nhí dáng xòe thắt nơ eo nữ tính',
      'Chất voan tơ mềm mại|Thiết kế cổ vuông vintage|Lớp lót lụa cao cấp kín đáo',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800',
      '',
      'dam|vay|hoa-nhi',
      'true',
      '450000',
      '390000',
      'true',
      '30',
      'onStock',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]
  ];

  function escapeCsvCell(cell) {
    const str = String(cell || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const csvRows = [
    headers.join(','),
    ...sampleRows.map(r => r.map(escapeCsvCell).join(','))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cheri_product_import_template.csv"');
  res.status(200).send(csvContent);
});

// Helper: validate and process parsed CSV records
async function processCsvProducts(records) {
  if (!records || records.length === 0) {
    return {
      success: false,
      message: 'File CSV không chứa dữ liệu dòng sản phẩm nào.',
      summary: { totalRows: 0, validRows: 0, errorRows: 0, totalProducts: 0, newProducts: 0, updateProducts: 0 },
      rows: [],
      products: [],
      canImport: false
    };
  }

  // 1. Group records by titleUrl (or slug)
  const productGroups = new Map();
  const previewRows = [];

  for (const rec of records) {
    const rawRow = rec._rowNumber;
    const titleUrlRaw = getCsvVal(rec, 'titleUrl', 'slug', 'ma_slug', 'mã slug');
    const titleRaw = getCsvVal(rec, 'vi.title', 'title', 'name', 'tên sản phẩm');
    const slug = titleUrlRaw ? generateSlug(titleUrlRaw) : (titleRaw ? generateSlug(titleRaw) : '');

    const rowErrors = [];
    if (!titleUrlRaw && !titleRaw) {
      rowErrors.push('Thiếu titleUrl (slug) hoặc tên sản phẩm (vi.title)');
    }

    const skuRaw = getCsvVal(rec, 'variant.sku', 'sku', 'mã sku');
    const classRaw = getCsvVal(rec, 'variant.classification', 'classification', 'phân loại');
    const colorRaw = getCsvVal(rec, 'variant.color', 'color', 'màu', 'màu sắc');
    const sizeRaw = getCsvVal(rec, 'variant.size', 'size', 'kích cỡ', 'cỡ');
    const priceRaw = getCsvVal(rec, 'variant.price', 'price', 'giá bán');
    const discountRaw = getCsvVal(rec, 'variant.discountPrice', 'discountprice', 'giá km');
    const stockRaw = getCsvVal(rec, 'variant.stock', 'variantstock', 'tồn kho');
    const attrStr = getCsvVal(rec, 'variant.attributes', 'attributes', 'thuộc tính');

    const parsedAttr = parseAttributeString(attrStr);
    const finalClassification = classRaw || parsedAttr.classification;
    const finalColor = colorRaw || parsedAttr.color;
    const finalSize = sizeRaw || parsedAttr.size;

    const hasVariantFields = Boolean(skuRaw || priceRaw || finalColor || finalSize || finalClassification || attrStr);

    const previewRow = {
      rowNumber: rawRow,
      titleUrl: slug || titleUrlRaw,
      title: titleRaw || slug,
      category1: getCsvVal(rec, 'vi.categoryLevel1', 'categorylevel1', 'category1', 'category', 'danh mục cấp 1'),
      sku: skuRaw || '—',
      hasVariant: hasVariantFields,
      classification: finalClassification,
      color: finalColor,
      size: finalSize,
      price: hasVariantFields ? Number(priceRaw || 0) : Number(getCsvVal(rec, 'vi.regularPrice', 'regularprice', 'giá niêm yết') || 0),
      discountPrice: hasVariantFields ? Number(discountRaw || 0) : Number(getCsvVal(rec, 'vi.salePrice', 'saleprice', 'giá khuyến mãi') || 0),
      stock: hasVariantFields ? Number(stockRaw || 0) : Number(getCsvVal(rec, 'vi.quantity', 'quantity', 'số lượng kho') || 0),
      isUpdate: false,
      status: 'valid',
      errors: rowErrors,
      rawRecord: rec
    };

    previewRows.push(previewRow);

    const groupKey = slug || `unassigned-row-${rawRow}`;
    if (!productGroups.has(groupKey)) {
      productGroups.set(groupKey, []);
    }
    productGroups.get(groupKey).push(previewRow);
  }

  // 2. Query MongoDB to find which products already exist by titleUrl
  const allSlugs = Array.from(productGroups.keys()).filter(s => !s.startsWith('unassigned-row-'));
  const existingDocs = allSlugs.length > 0
    ? await db.collection('products').find({ titleUrl: { $in: allSlugs } }).toArray()
    : [];

  const existingMap = new Map();
  for (const doc of existingDocs) {
    existingMap.set(doc.titleUrl, doc);
  }

  const validatedProducts = [];
  let newProductCount = 0;
  let updateProductCount = 0;

  // 3. Validate each product group
  for (const [slugKey, groupRows] of productGroups.entries()) {
    const firstRow = groupRows[0];
    const rec0 = firstRow.rawRecord;
    const existingDoc = existingMap.get(slugKey);
    const isUpdate = Boolean(existingDoc);

    if (isUpdate) updateProductCount++;
    else newProductCount++;

    for (const r of groupRows) {
      r.isUpdate = isUpdate;
    }

    const title = getCsvVal(rec0, 'vi.title', 'title', 'name', 'tên sản phẩm').trim();
    const category1 = getCsvVal(rec0, 'vi.categoryLevel1', 'categorylevel1', 'category1', 'category', 'danh mục cấp 1').trim();
    const category2 = getCsvVal(rec0, 'vi.categoryLevel2', 'categorylevel2', 'category2', 'danh mục cấp 2').trim();
    const productType = getCsvVal(rec0, 'vi.productType', 'producttype', 'loại sản phẩm').trim() || 'clothing';
    const description = getCsvVal(rec0, 'vi.description', 'description', 'mô tả ngắn').trim();
    const descriptionFullRaw = getCsvVal(rec0, 'vi.descriptionFull', 'descriptionfull', 'mô tả chi tiết');
    const mainImageUrl = getCsvVal(rec0, 'mainImage', 'image', 'ảnh chính').trim();
    const imagesRaw = getCsvVal(rec0, 'images', 'ảnh phụ').trim();
    const tagsRaw = getCsvVal(rec0, 'tags', 'thẻ').trim();
    const visibilityVal = getCsvVal(rec0, 'visibility', 'trạng thái', 'hiển thị').trim().toLowerCase();
    const visibility = visibilityVal === 'false' || visibilityVal === '0' || visibilityVal === 'tạm ẩn' ? false : true;

    // Validate title and category1
    if (!title) {
      firstRow.errors.push('Tên sản phẩm (vi.title) không được để trống.');
      firstRow.status = 'error';
    }
    if (!category1) {
      firstRow.errors.push('Danh mục cấp 1 (vi.categoryLevel1) không được để trống.');
      firstRow.status = 'error';
    }

    const descriptionFull = descriptionFullRaw
      ? descriptionFullRaw.split('|').map(s => s.trim()).filter(Boolean)
      : [];

    const images = imagesRaw
      ? imagesRaw.split('|').map(s => s.trim()).filter(Boolean)
      : (mainImageUrl ? [mainImageUrl] : []);

    const tags = tagsRaw
      ? tagsRaw.split(/[,|]/).map(t => t.trim().toLowerCase()).filter(Boolean)
      : [];

    // Determine if this group is a Variable Product (has variants) or Simple Product
    const hasAnyVariant = groupRows.some(r => r.hasVariant);

    if (hasAnyVariant) {
      // ── VARIABLE PRODUCT ──────────────────────────────────────
      const seenSkus = new Set();
      const variants = [];
      const classSet = new Set();
      const colorSet = new Set();
      const sizeSet = new Set();

      for (let i = 0; i < groupRows.length; i++) {
        const row = groupRows[i];
        const vSku = (row.sku && row.sku !== '—') ? row.sku.trim().toUpperCase() : '';

        if (!vSku) {
          row.errors.push(`Dòng ${row.rowNumber}: Biến thể thiếu SKU.`);
          row.status = 'error';
        } else if (seenSkus.has(vSku)) {
          row.errors.push(`Dòng ${row.rowNumber}: Trùng SKU "${vSku}" trong cùng sản phẩm.`);
          row.status = 'error';
        } else {
          seenSkus.add(vSku);
        }

        const vPrice = Number(row.price);
        if (isNaN(vPrice) || vPrice < 0) {
          row.errors.push(`Dòng ${row.rowNumber}: Giá bán biến thể (${row.price}) không hợp lệ.`);
          row.status = 'error';
        }

        const vDiscount = Number(row.discountPrice || 0);
        if (isNaN(vDiscount) || vDiscount < 0) {
          row.errors.push(`Dòng ${row.rowNumber}: Giá khuyến mãi (${row.discountPrice}) không hợp lệ.`);
          row.status = 'error';
        } else if (vDiscount > 0 && vDiscount >= vPrice) {
          row.errors.push(`Dòng ${row.rowNumber}: Giá khuyến mãi (${vDiscount.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá bán (${vPrice.toLocaleString('vi-VN')}₫).`);
          row.status = 'error';
        }

        const vStock = Number(row.stock || 0);
        if (isNaN(vStock) || vStock < 0 || !Number.isInteger(vStock)) {
          row.errors.push(`Dòng ${row.rowNumber}: Tồn kho biến thể (${row.stock}) phải là số nguyên không âm.`);
          row.status = 'error';
        }

        if (row.classification) classSet.add(row.classification);
        if (row.color) colorSet.add(row.color);
        if (row.size) sizeSet.add(row.size);

        variants.push({
          sku: vSku || `SKU-${i + 1}`,
          classification: row.classification || '',
          color: row.color || '',
          size: row.size || '',
          price: vPrice >= 0 ? vPrice : 0,
          discountPrice: vDiscount >= 0 ? vDiscount : 0,
          stock: vStock >= 0 ? vStock : 0
        });
      }

      // Quantity is strictly SUM of all variant stocks
      const totalQuantity = variants.reduce((sum, v) => sum + v.stock, 0);
      const stockStatus = totalQuantity > 0 ? 'onStock' : 'outOfStock';
      const minPrice = variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0;
      const discountedVariants = variants.filter(v => v.discountPrice > 0 && v.discountPrice < v.price);
      const minSalePrice = discountedVariants.length > 0
        ? Math.min(...discountedVariants.map(v => v.discountPrice))
        : minPrice;
      const onSale = discountedVariants.length > 0;

      const classifications = Array.from(classSet);
      const colors = Array.from(colorSet).map(c => ({ name: c, hex: '#2563eb' }));
      const sizes = Array.from(sizeSet);

      validatedProducts.push({
        titleUrl: slugKey,
        isUpdate,
        existingId: existingDoc?._id,
        mainImage: {
          url: mainImageUrl,
          name: title || 'product-image'
        },
        images,
        tags,
        visibility,
        variants,
        attributes: {
          classifications,
          colors,
          sizes
        },
        vi: {
          title,
          description,
          descriptionFull,
          productType,
          regularPrice: minPrice,
          salePrice: minSalePrice,
          onSale,
          quantity: totalQuantity,
          stock: stockStatus,
          hasClassification: classifications.length > 0,
          classifications,
          hasColors: colors.length > 0,
          colors,
          hasSizes: sizes.length > 0,
          sizes,
          categoryLevel1: category1,
          categoryLevel2: category2,
          visibility
        }
      });

    } else {
      // ── SIMPLE PRODUCT (No variants) ──────────────────────────
      const row = groupRows[0];
      const rPrice = Number(row.price || 0);
      const sPrice = Number(row.discountPrice || 0);
      const pQuantity = Number(row.stock || 0);
      const onSaleVal = getCsvVal(rec0, 'vi.onSale', 'onsale', 'đang giảm giá').trim().toLowerCase();
      const onSale = onSaleVal === 'true' || onSaleVal === '1' || (sPrice > 0 && sPrice < rPrice);
      const stockVal = getCsvVal(rec0, 'vi.stock', 'stock', 'tình trạng kho').trim();
      const stock = stockVal || (pQuantity > 0 ? 'onStock' : 'outOfStock');

      if (isNaN(rPrice) || rPrice < 0) {
        row.errors.push(`Dòng ${row.rowNumber}: Giá niêm yết (${row.price}) không hợp lệ.`);
        row.status = 'error';
      }

      if (isNaN(sPrice) || sPrice < 0) {
        row.errors.push(`Dòng ${row.rowNumber}: Giá khuyến mãi (${row.discountPrice}) không hợp lệ.`);
        row.status = 'error';
      } else if ((onSale || sPrice > 0) && sPrice >= rPrice) {
        row.errors.push(`Dòng ${row.rowNumber}: Giá khuyến mãi (${sPrice.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá niêm yết (${rPrice.toLocaleString('vi-VN')}₫).`);
        row.status = 'error';
      }

      if (isNaN(pQuantity) || pQuantity < 0 || !Number.isInteger(pQuantity)) {
        row.errors.push(`Dòng ${row.rowNumber}: Số lượng tồn kho (${row.stock}) phải là số nguyên không âm.`);
        row.status = 'error';
      }

      if (groupRows.length > 1) {
        for (let i = 1; i < groupRows.length; i++) {
          groupRows[i].errors.push(`Dòng ${groupRows[i].rowNumber}: Trùng lặp titleUrl "${slugKey}" không có biến thể.`);
          groupRows[i].status = 'error';
        }
      }

      validatedProducts.push({
        titleUrl: slugKey,
        isUpdate,
        existingId: existingDoc?._id,
        mainImage: {
          url: mainImageUrl,
          name: title || 'product-image'
        },
        images,
        tags,
        visibility,
        variants: [],
        attributes: {
          classifications: [],
          colors: [],
          sizes: []
        },
        vi: {
          title,
          description,
          descriptionFull,
          productType,
          regularPrice: rPrice,
          salePrice: sPrice > 0 ? sPrice : rPrice,
          onSale,
          quantity: pQuantity,
          stock,
          hasClassification: false,
          classifications: [],
          hasColors: false,
          colors: [],
          hasSizes: false,
          sizes: [],
          categoryLevel1: category1,
          categoryLevel2: category2,
          visibility
        }
      });
    }
  }

  // Update row status
  let totalErrors = 0;
  for (const r of previewRows) {
    if (r.errors.length > 0) {
      r.status = 'error';
      totalErrors++;
    } else {
      r.status = 'valid';
    }
  }

  return {
    success: true,
    summary: {
      totalRows: previewRows.length,
      validRows: previewRows.length - totalErrors,
      errorRows: totalErrors,
      totalProducts: productGroups.size,
      newProducts: newProductCount,
      updateProducts: updateProductCount
    },
    rows: previewRows,
    products: validatedProducts,
    canImport: totalErrors === 0
  };
}

// 2. POST /api/products/validate-csv — Parse & validate CSV before import
app.post('/api/products/validate-csv', async (req, res) => {
  try {
    const { csvContent } = req.body || {};
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ success: false, message: 'Dữ liệu CSV không hợp lệ hoặc rỗng.' });
    }

    const records = parseProductsCSV(csvContent);
    const result = await processCsvProducts(records);
    res.json(result);
  } catch (error) {
    console.error('Error validating CSV:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi kiểm tra dữ liệu CSV' });
  }
});

// 3. POST /api/products/import-csv — Execute safe product import into MongoDB Atlas
app.post('/api/products/import-csv', async (req, res) => {
  try {
    const { csvContent, products: passedProducts } = req.body || {};
    let productsToImport = passedProducts;

    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      if (!csvContent) {
        return res.status(400).json({ success: false, message: 'Không có dữ liệu sản phẩm để nhập.' });
      }
      const records = parseProductsCSV(csvContent);
      const validated = await processCsvProducts(records);
      if (!validated.canImport) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu CSV còn lỗi, không thể nhập vào MongoDB.',
          summary: validated.summary,
          rows: validated.rows
        });
      }
      productsToImport = validated.products;
    }

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const nowIso = new Date().toISOString();

    for (const p of productsToImport) {
      try {
        const query = { titleUrl: p.titleUrl };
        const existing = await db.collection('products').findOne(query);

        const docData = {
          titleUrl: p.titleUrl,
          mainImage: p.mainImage,
          images: p.images || [],
          tags: p.tags || [],
          updatedAt: nowIso,
          visibility: p.visibility !== false,
          variants: p.variants || [],
          attributes: p.attributes || { classifications: [], colors: [], sizes: [] },
          vi: {
            ...p.vi,
            stockDate: nowIso
          }
        };

        // Ensure no shipping fields are stored
        delete docData.vi.shipping;
        delete docData.vi.shippingCost;
        delete docData.vi.shippingBasic;
        delete docData.vi.shippingBasicCost;
        delete docData.vi.shippingExtended;
        delete docData.vi.shippingExtendedCost;

        if (existing) {
          // UPDATE
          await db.collection('products').updateOne(
            { _id: existing._id },
            { $set: docData }
          );
          updatedCount++;
        } else {
          // CREATE
          docData.dateAdded = nowIso;
          docData.en = { visibility: false };
          docData.sk = { visibility: false };
          docData.cs = { visibility: false };
          docData.__v = 0;

          await db.collection('products').insertOne(docData);
          createdCount++;
        }
      } catch (err) {
        console.error(`Failed to import product ${p.titleUrl}:`, err);
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Nhập sản phẩm thành công vào MongoDB! Đã thêm mới ${createdCount} sản phẩm, cập nhật ${updatedCount} sản phẩm.`,
      summary: {
        totalProducts: productsToImport.length,
        createdCount,
        updatedCount,
        failedCount
      }
    });
  } catch (error) {
    console.error('Error importing products CSV:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi nhập sản phẩm bằng CSV' });
  }
});

// Categories for products (placed before /api/products/:id)
app.get('/api/products/categories', async (req, res) => {
  try {
    const lang = req.query.lang || req.headers['lang'] || 'vi';
    const categoriesRaw = await db.collection('categories').find({}).toArray();
    const formatted = categoriesRaw.map(c => {
      const langObj = c[lang] || c.vi || c.en || {};
      const fallbackObj = c.vi || c.en || {};
      return {
        ...c,
        id: c._id ? c._id.toString() : c.id,
        _id: c._id ? c._id.toString() : c.id,
        titleUrl: c.titleUrl,
        title: langObj.title || fallbackObj.title || c.title || c.titleUrl,
        description: langObj.description || fallbackObj.description || c.description || '',
        visibility: langObj.visibility !== undefined ? langObj.visibility : (c.visibility !== false),
        subCategories: Array.isArray(c.subCategories) ? c.subCategories : [],
        mainImage: c.mainImage || { url: '', name: '' }
      };
    });
    res.json(formatted);
  } catch (err) {
    res.json([]);
  }
});

// Search product titles (placed before /api/products/:id)
app.get('/api/products/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query) return res.json([]);
    const regex = new RegExp(query, 'i');
    const prods = await db.collection('products').find({
      $or: [
        { titleUrl: regex },
        { title: regex },
        { 'vi.title': regex },
        { 'en.title': regex }
      ]
    }).limit(20).toArray();
    res.json(prods.map(p => p.titleUrl || p.title));
  } catch (err) {
    res.json([]);
  }
});

// Product variants
app.get('/api/products/:id/variants', async (req, res) => {
  try {
    const id = req.params.id;
    let pDoc = null;
    let query = {};
    if (ObjectId.isValid(id) && id.length === 24) {
      query = { productId: new ObjectId(id) };
      pDoc = await db.collection('products').findOne({ _id: new ObjectId(id) });
    } else {
      pDoc = await db.collection('products').findOne({
        $or: [{ titleUrl: id }, { sku: id }, { 'vi.sku': id }]
      });
      if (pDoc) {
        query = { productId: pDoc._id };
      }
    }

    const variants = await db.collection('product_variants').find(query).toArray();
    if (variants && variants.length > 0) {
      return res.json({ success: true, data: variants });
    }

    if (pDoc && Array.isArray(pDoc.variants) && pDoc.variants.length > 0) {
      return res.json({ success: true, data: pDoc.variants });
    }

    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let query;
    if (ObjectId.isValid(id) && id.length === 24) {
      query = { $or: [{ _id: new ObjectId(id) }, { titleUrl: id }, { sku: id }] };
    } else {
      query = { $or: [{ titleUrl: id }, { sku: id }, { id: id }] };
    }
    const p = await db.collection('products').findOne(query);
    if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const lang = req.query.lang || req.headers['lang'] || 'vi';
    const formatted = formatProduct(p, lang);
    res.json({
      success: true,
      data: formatted,
      raw: p,
      ...formatted
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create product (POST /api/products)
app.post('/api/products', async (req, res) => {
  try {
    const body = req.body || {};
    const vi = body.vi || {};

    // Backend validation
    if (!vi.title || !vi.title.trim()) {
      return res.status(400).json({ success: false, message: 'Tên sản phẩm không được để trống' });
    }

    if (!vi.categoryLevel1 || !vi.categoryLevel1.trim()) {
      return res.status(400).json({ success: false, message: 'Danh mục cấp 1 (categoryLevel1) không được để trống' });
    }

    if (vi.hasClassification && (!vi.classifications || !Array.isArray(vi.classifications) || vi.classifications.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một phân loại khi bật hasClassification' });
    }

    if (vi.hasColors && (!vi.colors || !Array.isArray(vi.colors) || vi.colors.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một màu sắc khi bật hasColors' });
    }

    if (vi.hasSizes && (!vi.sizes || !Array.isArray(vi.sizes) || vi.sizes.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một kích cỡ khi bật hasSizes' });
    }

    const normalizedVariants = Array.isArray(body.variants)
      ? body.variants.map((v, idx) => ({
          classification: v.classification ? String(v.classification).trim() : '',
          color: v.color ? String(v.color).trim() : '',
          size: v.size ? String(v.size).trim() : '',
          sku: v.sku ? String(v.sku).trim().toUpperCase() : `SKU-${idx + 1}`,
          price: Number(v.price || 0),
          discountPrice: Number(v.discountPrice !== undefined ? v.discountPrice : (v.price || 0)),
          stock: Number(v.stock !== undefined ? v.stock : 0)
        }))
      : [];

    // Validation: Price rules
    if (normalizedVariants.length > 0) {
      for (let i = 0; i < normalizedVariants.length; i++) {
        const v = normalizedVariants[i];
        if (v.discountPrice > 0 && v.discountPrice >= v.price) {
          return res.status(400).json({
            success: false,
            message: `Biến thể #${i + 1} (${v.sku}): Giá khuyến mãi (${v.discountPrice.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá bán (${v.price.toLocaleString('vi-VN')}₫).`
          });
        }
      }
    } else {
      const rPrice = Number(vi.regularPrice || 0);
      const sPrice = Number(vi.salePrice || 0);
      if ((vi.onSale || sPrice > 0) && sPrice >= rPrice) {
        return res.status(400).json({
          success: false,
          message: `Giá khuyến mãi (${sPrice.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá niêm yết (${rPrice.toLocaleString('vi-VN')}₫).`
        });
      }
    }

    // Determine quantity, stock, regularPrice, salePrice, onSale based on whether variants exist
    let quantity = 0;
    let stock = 'onStock';
    let regularPrice = 0;
    let salePrice = 0;
    let onSale = false;

    if (normalizedVariants.length > 0) {
      quantity = normalizedVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      stock = quantity > 0 ? 'onStock' : 'outOfStock';
      const prices = normalizedVariants.map(v => Number(v.price) || 0);
      regularPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const discounted = normalizedVariants.filter(v => v.discountPrice > 0 && v.discountPrice < v.price);
      if (discounted.length > 0) {
        salePrice = Math.min(...discounted.map(v => Number(v.discountPrice)));
        onSale = true;
      } else {
        salePrice = regularPrice;
        onSale = false;
      }
    } else {
      quantity = Number(vi.quantity !== undefined ? vi.quantity : (body.quantity || 0));
      regularPrice = Number(vi.regularPrice !== undefined ? vi.regularPrice : (body.regularPrice || 0));
      salePrice = Number(vi.salePrice !== undefined && vi.salePrice !== '' ? vi.salePrice : regularPrice);
      onSale = !!vi.onSale;
      stock = vi.stock || (quantity > 0 ? 'onStock' : 'outOfStock');
    }

    const visibility = body.visibility !== undefined ? !!body.visibility : (vi.visibility !== undefined ? !!vi.visibility : true);

    const generatedSlug = body.titleUrl && body.titleUrl.trim()
      ? generateSlug(body.titleUrl)
      : generateSlug(vi.title);

    const mainImageUrl = body.mainImage?.url || body.image || '';
    const mainImageName = body.mainImage?.name || vi.title || 'product-image';

    const newProduct = {
      titleUrl: generatedSlug,
      mainImage: {
        url: mainImageUrl,
        name: mainImageName
      },
      images: Array.isArray(body.images) ? body.images : (mainImageUrl ? [mainImageUrl] : []),
      tags: Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()).filter(Boolean) : [],
      dateAdded: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visibility: visibility,
      variants: normalizedVariants,
      vi: {
        title: vi.title.trim(),
        description: vi.description || '',
        descriptionFull: Array.isArray(vi.descriptionFull) ? vi.descriptionFull : [],
        regularPrice: regularPrice,
        salePrice: salePrice,
        onSale: onSale,
        stock: stock,
        stockDate: new Date().toISOString(),
        productType: vi.productType || 'clothing',
        hasColors: !!vi.hasColors,
        colors: Array.isArray(vi.colors) ? vi.colors : [],
        hasSizes: !!vi.hasSizes,
        sizes: Array.isArray(vi.sizes) ? vi.sizes : [],
        hasClassification: !!vi.hasClassification,
        classifications: Array.isArray(vi.classifications) ? vi.classifications.map(c => String(c).trim()).filter(Boolean) : [],
        categoryLevel1: vi.categoryLevel1 || '',
        categoryLevel2: vi.categoryLevel2 || '',
        quantity: quantity,
        visibility: visibility
      },
      en: { visibility: false },
      sk: { visibility: false },
      cs: { visibility: false },
      __v: 0
    };

    const result = await db.collection('products').insertOne(newProduct);


    res.status(201).json({
      success: true,
      message: 'Thêm sản phẩm thành công',
      id: result.insertedId.toString(),
      data: {
        ...newProduct,
        id: result.insertedId.toString(),
        _id: result.insertedId.toString()
      }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi thêm sản phẩm' });
  }
});

// Update product (PUT /api/products/:id)
app.put('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const vi = body.vi || {};

    const existing = await db.collection('products').findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để cập nhật' });
    }

    if (!vi.title || !vi.title.trim()) {
      return res.status(400).json({ success: false, message: 'Tên sản phẩm không được để trống' });
    }

    if (!vi.categoryLevel1 || !vi.categoryLevel1.trim()) {
      return res.status(400).json({ success: false, message: 'Danh mục cấp 1 (categoryLevel1) không được để trống' });
    }

    if (vi.hasClassification && (!vi.classifications || !Array.isArray(vi.classifications) || vi.classifications.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một phân loại khi bật hasClassification' });
    }

    if (vi.hasColors && (!vi.colors || !Array.isArray(vi.colors) || vi.colors.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một màu sắc khi bật hasColors' });
    }

    if (vi.hasSizes && (!vi.sizes || !Array.isArray(vi.sizes) || vi.sizes.length === 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một kích cỡ khi bật hasSizes' });
    }

    const normalizedVariants = Array.isArray(body.variants)
      ? body.variants.map((v, idx) => ({
          classification: v.classification ? String(v.classification).trim() : '',
          color: v.color ? String(v.color).trim() : '',
          size: v.size ? String(v.size).trim() : '',
          sku: v.sku ? String(v.sku).trim().toUpperCase() : `SKU-${idx + 1}`,
          price: Number(v.price || 0),
          discountPrice: Number(v.discountPrice !== undefined ? v.discountPrice : (v.price || 0)),
          stock: Number(v.stock !== undefined ? v.stock : 0)
        }))
      : (existing.variants || []);

    // Validation: Price rules
    if (normalizedVariants.length > 0) {
      for (let i = 0; i < normalizedVariants.length; i++) {
        const v = normalizedVariants[i];
        if (v.discountPrice > 0 && v.discountPrice >= v.price) {
          return res.status(400).json({
            success: false,
            message: `Biến thể #${i + 1} (${v.sku}): Giá khuyến mãi (${v.discountPrice.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá bán (${v.price.toLocaleString('vi-VN')}₫).`
          });
        }
      }
    } else {
      const existVi = existing.vi || {};
      const rPrice = Number(vi.regularPrice !== undefined ? vi.regularPrice : (existVi.regularPrice || 0));
      const sPrice = Number(vi.salePrice !== undefined && vi.salePrice !== '' ? vi.salePrice : (existVi.salePrice || rPrice));
      if ((vi.onSale || sPrice > 0) && sPrice >= rPrice) {
        return res.status(400).json({
          success: false,
          message: `Giá khuyến mãi (${sPrice.toLocaleString('vi-VN')}₫) phải nhỏ hơn giá niêm yết (${rPrice.toLocaleString('vi-VN')}₫).`
        });
      }
    }

    const existVi = existing.vi || {};
    let regularPrice = 0;
    let salePrice = 0;
    let quantity = 0;
    let stock = 'onStock';
    let onSale = false;

    if (normalizedVariants.length > 0) {
      quantity = normalizedVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      stock = quantity > 0 ? 'onStock' : 'outOfStock';
      const prices = normalizedVariants.map(v => Number(v.price) || 0);
      regularPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const discounted = normalizedVariants.filter(v => v.discountPrice > 0 && v.discountPrice < v.price);
      if (discounted.length > 0) {
        salePrice = Math.min(...discounted.map(v => Number(v.discountPrice)));
        onSale = true;
      } else {
        salePrice = regularPrice;
        onSale = false;
      }
    } else {
      regularPrice = Number(vi.regularPrice !== undefined ? vi.regularPrice : (existVi.regularPrice || 0));
      salePrice = Number(vi.salePrice !== undefined && vi.salePrice !== '' ? vi.salePrice : (existVi.salePrice || regularPrice));
      quantity = Number(vi.quantity !== undefined ? vi.quantity : (existVi.quantity || 0));
      onSale = vi.onSale !== undefined ? !!vi.onSale : !!existVi.onSale;
      stock = vi.stock || (quantity > 0 ? 'onStock' : 'outOfStock');
    }

    const visibility = body.visibility !== undefined ? !!body.visibility : (existing.visibility !== false);

    const generatedSlug = body.titleUrl && body.titleUrl.trim()
      ? generateSlug(body.titleUrl)
      : (existing.titleUrl || generateSlug(vi.title));

    const mainImageUrl = body.mainImage?.url !== undefined ? body.mainImage.url : (existing.mainImage?.url || '');
    const mainImageName = body.mainImage?.name !== undefined ? body.mainImage.name : (existing.mainImage?.name || vi.title || '');

    const updateFields = {
      titleUrl: generatedSlug,
      'mainImage.url': mainImageUrl,
      'mainImage.name': mainImageName,
      images: Array.isArray(body.images) ? body.images : (existing.images || []),
      tags: Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()).filter(Boolean) : (existing.tags || []),
      visibility: visibility,
      variants: normalizedVariants,
      updatedAt: new Date().toISOString(),
      'vi.title': vi.title.trim(),
      'vi.description': vi.description !== undefined ? vi.description : (existVi.description || ''),
      'vi.descriptionFull': Array.isArray(vi.descriptionFull) ? vi.descriptionFull : (existVi.descriptionFull || []),
      'vi.regularPrice': regularPrice,
      'vi.salePrice': salePrice,
      'vi.onSale': onSale,
      'vi.stock': stock,
      'vi.stockDate': new Date().toISOString(),
      'vi.productType': vi.productType || existVi.productType || 'clothing',
      'vi.hasColors': vi.hasColors !== undefined ? !!vi.hasColors : !!existVi.hasColors,
      'vi.colors': Array.isArray(vi.colors) ? vi.colors : (existVi.colors || []),
      'vi.hasSizes': vi.hasSizes !== undefined ? !!vi.hasSizes : !!existVi.hasSizes,
      'vi.sizes': Array.isArray(vi.sizes) ? vi.sizes : (existVi.sizes || []),
      'vi.hasClassification': vi.hasClassification !== undefined ? !!vi.hasClassification : !!existVi.hasClassification,
      'vi.classifications': Array.isArray(vi.classifications)
        ? vi.classifications.map(c => String(c).trim()).filter(Boolean)
        : (existVi.classifications || []),
      'vi.categoryLevel1': vi.categoryLevel1 !== undefined ? vi.categoryLevel1 : (existVi.categoryLevel1 || ''),
      'vi.categoryLevel2': vi.categoryLevel2 !== undefined ? vi.categoryLevel2 : (existVi.categoryLevel2 || ''),
      'vi.quantity': quantity,
      'vi.visibility': vi.visibility !== undefined ? !!vi.visibility : visibility
    };

    await db.collection('products').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );


    const updated = await db.collection('products').findOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: 'Cập nhật sản phẩm thành công',
      data: formatProduct(updated),
      raw: updated
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật sản phẩm' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await db.collection('products').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để xóa' });
    }
    res.json({ success: true, message: 'Xóa sản phẩm thành công', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk delete products
app.post('/api/products/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    const objectIds = ids.map(id => new ObjectId(id));
    const result = await db.collection('products').deleteMany({ _id: { $in: objectIds } });
    res.json({ success: true, message: `Đã xóa ${result.deletedCount} sản phẩm thành công`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. CATEGORIES API
// ─────────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const categoriesRaw = await db.collection('categories').find({}).toArray();
    const data = await Promise.all(categoriesRaw.map(async (c) => {
      const name = c.vi?.title || c.title || c.titleUrl || 'Danh mục';
      // Đếm số sản phẩm thuộc danh mục này
      const productCount = await db.collection('products').countDocuments({
        $or: [
          { 'vi.categoryLevel1': { $regex: name, $options: 'i' } },
          { categoryLevel1: { $regex: name, $options: 'i' } },
          { titleUrl: { $regex: c.titleUrl || '', $options: 'i' } }
        ]
      });

      const isVisible = c.vi?.visibility !== false;
      return {
        id: c._id.toString(),
        _id: c._id.toString(),
        name,
        slug: c.titleUrl || '',
        productCount: productCount || 0,
        status: isVisible ? 'Hiển thị' : 'Ẩn',
        statusVariant: isVisible ? 'success' : 'neutral',
        image: c.mainImage?.url || ''
      };
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: 1,
        pageSize: data.length,
        total: data.length
      }
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single category
app.get('/api/categories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID danh mục không hợp lệ' });
    }
    const cat = await db.collection('categories').findOne({ _id: new ObjectId(id) });
    if (!cat) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }
    res.json({
      success: true,
      data: {
        id: cat._id.toString(),
        _id: cat._id.toString(),
        name: cat.vi?.title || cat.title || cat.titleUrl,
        slug: cat.titleUrl,
        parentId: cat.parentId ? cat.parentId.toString() : null,
        mainImage: cat.mainImage || { url: '', name: '' },
        subCategories: cat.subCategories || [],
        vi: cat.vi || {},
        raw: cat
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create category (POST /api/categories)
app.post('/api/categories', async (req, res) => {
  try {
    const body = req.body || {};
    const vi = body.vi || {};
    const title = (vi.title || body.name || '').trim();

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' });
    }

    const slug = (body.titleUrl || body.slug || generateSlug(title)).trim();

    // Check duplicate
    const existing = await db.collection('categories').findOne({
      $or: [
        { 'vi.title': { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { titleUrl: slug }
      ]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Tên danh mục hoặc mã slug đã tồn tại trong hệ thống' });
    }

    // Parent category check
    let parentIdObj = null;
    if (body.parentId && body.parentId.trim() && ObjectId.isValid(body.parentId.trim())) {
      const parent = await db.collection('categories').findOne({ _id: new ObjectId(body.parentId.trim()) });
      if (parent) {
        parentIdObj = parent._id;
      }
    }

    const mainImageUrl = body.mainImage?.url || body.image || '';
    const mainImageName = body.mainImage?.name || title || 'category-image';

    const newCategory = {
      titleUrl: slug,
      mainImage: {
        url: mainImageUrl,
        name: mainImageName
      },
      subCategories: [],
      parentId: parentIdObj,
      dateAdded: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vi: {
        title: title,
        description: (vi.description !== undefined ? vi.description : (body.description || '')).trim(),
        position: Number(vi.position !== undefined ? vi.position : (body.position || 0)),
        visibility: vi.visibility !== false && body.visibility !== false,
        menuHidden: !!vi.menuHidden
      },
      en: {
        title: title,
        description: (vi.description !== undefined ? vi.description : (body.description || '')).trim(),
        visibility: false
      },
      sk: { visibility: false },
      cs: { visibility: false },
      __v: 0
    };

    const result = await db.collection('categories').insertOne(newCategory);

    // If parent category exists, record subcategory
    if (parentIdObj) {
      await db.collection('categories').updateOne(
        { _id: parentIdObj },
        { $addToSet: { subCategories: result.insertedId.toString() } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Thêm danh mục thành công',
      id: result.insertedId.toString(),
      data: {
        ...newCategory,
        id: result.insertedId.toString(),
        _id: result.insertedId.toString(),
        name: title,
        slug: slug
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi thêm danh mục' });
  }
});

// Update category (PUT /api/categories/:id)
app.put('/api/categories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID danh mục không hợp lệ' });
    }
    const body = req.body || {};
    const vi = body.vi || {};
    const title = (vi.title || body.name || '').trim();

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' });
    }

    const slug = (body.titleUrl || body.slug || generateSlug(title)).trim();

    // Check duplicate with other category
    const existing = await db.collection('categories').findOne({
      _id: { $ne: new ObjectId(id) },
      $or: [
        { 'vi.title': { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { titleUrl: slug }
      ]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Tên danh mục hoặc mã slug đã tồn tại trong hệ thống' });
    }

    let parentIdObj = null;
    if (body.parentId && body.parentId.trim() && ObjectId.isValid(body.parentId.trim()) && body.parentId.trim() !== id) {
      const parent = await db.collection('categories').findOne({ _id: new ObjectId(body.parentId.trim()) });
      if (parent) {
        parentIdObj = parent._id;
      }
    }

    const mainImageUrl = body.mainImage?.url !== undefined ? body.mainImage.url : (body.image || '');
    const mainImageName = body.mainImage?.name || title;

    const updateFields = {
      titleUrl: slug,
      'mainImage.url': mainImageUrl,
      'mainImage.name': mainImageName,
      parentId: parentIdObj,
      updatedAt: new Date().toISOString(),
      'vi.title': title,
      'vi.description': (vi.description !== undefined ? vi.description : (body.description || '')).trim(),
      'vi.position': Number(vi.position !== undefined ? vi.position : (body.position || 0)),
      'vi.visibility': vi.visibility !== false && body.visibility !== false,
      'vi.menuHidden': !!vi.menuHidden
    };

    const oldCat = await db.collection('categories').findOne({ _id: new ObjectId(id) });
    const oldTitle = oldCat?.vi?.title || oldCat?.title;

    await db.collection('categories').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // Cascade update categoryLevel1 in products if renamed
    if (oldTitle && oldTitle !== title) {
      await db.collection('products').updateMany(
        { 'vi.categoryLevel1': oldTitle },
        { $set: { 'vi.categoryLevel1': title, updatedAt: new Date() } }
      );
    }

    res.json({
      success: true,
      message: 'Cập nhật danh mục thành công',
      data: {
        id,
        _id: id,
        name: title,
        slug
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }
    const categoryToDelete = await db.collection('categories').findOne({ _id: new ObjectId(id) });
    const catTitle = categoryToDelete?.vi?.title || categoryToDelete?.title;
    if (catTitle && req.query.force !== 'true') {
      const productCount = await db.collection('products').countDocuments({ 'vi.categoryLevel1': catTitle });
      if (productCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Không thể xóa danh mục '${catTitle}' vì đang có ${productCount} sản phẩm thuộc danh mục này.`,
          productCount
        });
      }
    }
    const result = await db.collection('categories').deleteOne({ _id: new ObjectId(id) });
    // Also remove from any parent's subCategories
    await db.collection('categories').updateMany(
      { subCategories: id },
      { $pull: { subCategories: id } }
    );
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk delete categories
app.post('/api/categories/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    const validIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const result = await db.collection('categories').deleteMany({ _id: { $in: validIds } });
    await db.collection('categories').updateMany(
      { subCategories: { $in: ids } },
      { $pull: { subCategories: { $in: ids } } }
    );
    res.json({ success: true, deletedCount: result.deletedCount, message: `Đã xóa thành công ${result.deletedCount} danh mục` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. ORDERS API
// ─────────────────────────────────────────────────────────────
const VALID_ORDER_TRANSITIONS = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // final state
  CANCELLED: []  // final state
};

const ORDER_STATUS_MAP = {
  PENDING: { label: 'Chờ xác nhận', variant: 'neutral' },
  PROCESSING: { label: 'Đang xử lý', variant: 'warning' },
  SHIPPING: { label: 'Đang giao', variant: 'primary' },
  DELIVERED: { label: 'Đã giao', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'danger' }
};

function formatOrder(o) {
  const address = o.addresses?.[0] || {};
  const customerName = address.name || 'Khách hàng';
  const statusHistory = o.statusHistory || [];
  const rawStatus = (statusHistory[0]?.status || o.status || 'PENDING').toUpperCase();
  const statusCode = ['PENDING', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED'].includes(rawStatus)
    ? rawStatus
    : 'PENDING';

  const statusMeta = ORDER_STATUS_MAP[statusCode] || { label: 'Chờ xác nhận', variant: 'neutral' };

  let payment = 'COD';
  if (o.outcome?.seller_message) {
    if (o.outcome.seller_message.includes('MOMO')) payment = 'MoMo';
    else if (o.outcome.seller_message.includes('BANK')) payment = 'Chuyển khoản';
    else payment = 'COD';
  }

  const itemsCount = o.cart?.totalQty || o.cart?.items?.reduce((acc, it) => acc + (it.qty || 1), 0) || 1;
  const totalPrice = o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0);

  return {
    id: o._id.toString(),
    _id: o._id.toString(),
    orderId: o.orderId || ('#DH' + o._id.toString().slice(-6).toUpperCase()),
    code: o.orderId || ('#DH' + o._id.toString().slice(-6).toUpperCase()),
    customer: customerName,
    customerEmail: o.customerEmail || address.email || '',
    phone: address.phone || '090***',
    total: totalPrice,
    amount: o.amount !== undefined ? o.amount : totalPrice,
    currency: o.currency || 'VND',
    type: o.type || 'standard',
    notes: o.notes || '',
    itemsCount,
    payment,
    statusCode,
    status: statusMeta.label,
    statusText: statusMeta.label,
    statusVariant: statusMeta.variant,
    dateAdded: o.dateAdded || o.createdAt || new Date().toISOString(),
    createdAt: (o.dateAdded || o.createdAt || new Date()).toString().slice(0, 10),
    cart: o.cart || { items: [], totalQty: 0, totalPrice: 0 },
    addresses: Array.isArray(o.addresses) ? o.addresses : [],
    outcome: o.outcome || {},
    statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : [],
    raw: o
  };
}

// 4.1 GET /api/orders (List all orders)
app.get('/api/orders', async (req, res) => {
  try {
    const ordersRaw = await db.collection('orders').find({}).sort({ _id: -1 }).toArray();
    const data = ordersRaw.map(formatOrder);
    res.json({
      success: true,
      data,
      pagination: {
        page: 1,
        pageSize: data.length || 20,
        total: data.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4.2 GET /api/orders/:id (Get single order by MongoDB _id)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ (ID phải là MongoDB ObjectId)' });
    }

    const order = await db.collection('orders').findOne({ _id: new ObjectId(id) });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    res.json({
      success: true,
      data: formatOrder(order)
    });
  } catch (error) {
    console.error('Error in GET /api/orders/:id:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4.3 PATCH & PUT /api/orders/:id/status (Update order status with business transition validation)
const handleUpdateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ' });
    }

    const { status, note } = req.body;
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trạng thái mới' });
    }

    const targetStatus = status.trim().toUpperCase();
    if (!ORDER_STATUS_MAP[targetStatus]) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Các trạng thái được chấp nhận: ${Object.keys(ORDER_STATUS_MAP).join(', ')}`
      });
    }

    const order = await db.collection('orders').findOne({ _id: new ObjectId(id) });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    const currentStatus = (order.status || order.statusHistory?.[0]?.status || 'PENDING').toUpperCase();

    // Check if already in this status
    if (currentStatus === targetStatus) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng hiện tại đã ở trạng thái "${ORDER_STATUS_MAP[currentStatus]?.label || currentStatus}".`
      });
    }

    // Check transition rules
    const allowedTransitions = VALID_ORDER_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      const allowedLabels = allowedTransitions.map(s => ORDER_STATUS_MAP[s]?.label || s).join(', ') || 'Không có';
      return res.status(400).json({
        success: false,
        message: `Trạng thái mới không hợp lệ với trạng thái hiện tại. Từ "${ORDER_STATUS_MAP[currentStatus]?.label || currentStatus}" chỉ có thể chuyển sang: ${allowedLabels}.`
      });
    }

    const nowIso = new Date().toISOString();
    const updateEntry = {
      status: targetStatus,
      updatedAt: nowIso,
      note: note || `Admin cập nhật trạng thái từ ${ORDER_STATUS_MAP[currentStatus]?.label || currentStatus} sang ${ORDER_STATUS_MAP[targetStatus]?.label || targetStatus}`
    };

    await db.collection('orders').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: targetStatus,
          updatedAt: nowIso
        },
        $push: {
          statusHistory: {
            $each: [updateEntry],
            $position: 0
          }
        }
      }
    );

    const updatedOrder = await db.collection('orders').findOne({ _id: new ObjectId(id) });
    res.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng thành "${ORDER_STATUS_MAP[targetStatus]?.label || targetStatus}"`,
      data: formatOrder(updatedOrder)
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/orders/:id/status', handleUpdateOrderStatus);
app.put('/api/orders/:id/status', handleUpdateOrderStatus);

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const result = await db.collection('orders').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk delete orders
app.post('/api/orders/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    const validIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const result = await db.collection('orders').deleteMany({ _id: { $in: validIds } });
    res.json({ success: true, deletedCount: result.deletedCount, message: `Đã xóa thành công ${result.deletedCount} đơn hàng` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. USERS API (Collection: users)
// ─────────────────────────────────────────────────────────────
function formatUserResponse(u) {
  const isAdmin = Array.isArray(u.roles)
    ? (u.roles.includes('admin') || u.roles.includes('superadmin'))
    : (u.roles === 'admin' || u.roles === 'superadmin');
  const isActive = u.status !== false;

  return {
    id: u._id.toString(),
    _id: u._id.toString(),
    email: u.email || '',
    name: u.name || '',
    fullName: u.fullName || u.name || '',
    phoneNumber: u.phoneNumber || u.phone || '',
    roles: Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : ['user']),
    roleText: isAdmin ? 'Admin' : 'Khách hàng',
    status: isActive,
    statusText: isActive ? 'Hoạt động' : 'Đã khóa',
    statusVariant: isActive ? 'success' : 'danger',
    rawStatus: isActive,
    gender: u.gender || '',
    dateOfBirth: u.dateOfBirth || '',
    address: u.address || '',
    avatar: u.avatar || '',
    description: u.description || '',
    cart: u.cart || { items: [] },
    images: Array.isArray(u.images) ? u.images : [],
    createdAt: (u.createdAt || u.dateAdded || u.updatedAt || new Date().toISOString()).toString().slice(0, 10),
    updatedAt: (u.updatedAt || u.createdAt || new Date().toISOString()).toString().slice(0, 19),
    dateAdded: (u.dateAdded || u.createdAt || new Date().toISOString()).toString().slice(0, 10)
  };
}

// 5.1 GET /api/users (List with search, filter, pagination)
app.get('/api/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || req.query.pageSize) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    // Search: email, name, fullName, phoneNumber
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const sRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { email: sRegex },
        { name: sRegex },
        { fullName: sRegex },
        { phoneNumber: sRegex },
        { phone: sRegex }
      ];
    }

    // Filter: role / roles
    if (req.query.role && req.query.role.trim() && req.query.role !== 'all') {
      const roleVal = req.query.role.trim().toLowerCase();
      if (roleVal === 'admin') {
        query.roles = { $in: ['admin', 'superadmin', 'Admin'] };
      } else if (roleVal === 'user' || roleVal === 'khách hàng' || roleVal === 'customer') {
        query.roles = { $in: ['user', 'customer', 'Khách hàng'] };
      } else {
        query.roles = roleVal;
      }
    }

    // Filter: status
    if (req.query.status !== undefined && req.query.status !== '' && req.query.status !== 'all') {
      const st = String(req.query.status).trim().toLowerCase();
      if (st === 'active' || st === 'true' || st === 'hoạt động') {
        query.status = { $ne: false };
      } else if (st === 'inactive' || st === 'locked' || st === 'false' || st === 'đã khóa') {
        query.status = false;
      }
    }

    const total = await db.collection('users').countDocuments(query);
    const usersRaw = await db.collection('users')
      .find(query, { projection: { password: 0, salt: 0 } })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const data = usersRaw.map(formatUserResponse);

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      pagination: {
        page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5.2 GET /api/users/:id (Detail without password/salt)
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, salt: 0 } }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }

    res.json({
      success: true,
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Error in GET /api/users/:id:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5.3 POST /api/users (Add new user)
app.post('/api/users', async (req, res) => {
  try {
    const {
      email,
      password,
      roles,
      status,
      fullName,
      name,
      phoneNumber,
      gender,
      dateOfBirth,
      address,
      avatar,
      description
    } = req.body;

    // Validate email
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email là bắt buộc' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ' });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu là bắt buộc và tối thiểu 6 ký tự' });
    }

    // Check duplicate email
    const existing = await db.collection('users').findOne({
      email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
    }

    // Hash password & generate salt
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Normalize roles
    let roleList = ['user'];
    if (Array.isArray(roles) && roles.length > 0) {
      roleList = roles.map(r => String(r).trim().toLowerCase()).filter(Boolean);
    } else if (typeof roles === 'string' && roles.trim()) {
      roleList = [roles.trim().toLowerCase()];
    }

    const nowIso = new Date().toISOString();
    const newUserDoc = {
      email: cleanEmail,
      password: hashedPassword,
      salt: salt,
      name: (name || fullName || cleanEmail.split('@')[0]).trim(),
      fullName: (fullName || '').trim(),
      phoneNumber: (phoneNumber || '').trim(),
      roles: roleList,
      status: status !== undefined ? Boolean(status) : true,
      gender: gender || '',
      dateOfBirth: dateOfBirth || '',
      address: address || '',
      avatar: avatar || '',
      description: description || '',
      cart: { items: [] },
      images: [],
      dateAdded: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const insertResult = await db.collection('users').insertOne(newUserDoc);

    const createdUser = formatUserResponse({
      ...newUserDoc,
      _id: insertResult.insertedId
    });

    res.status(201).json({
      success: true,
      message: 'Thêm tài khoản thành công',
      data: createdUser
    });
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5.4 PUT & PATCH /api/users/:id (Edit user)
const handleUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }
    const userObjectId = new ObjectId(id);

    const existingUser = await db.collection('users').findOne({ _id: userObjectId });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }

    const {
      email,
      roles,
      status,
      fullName,
      name,
      phoneNumber,
      gender,
      dateOfBirth,
      address,
      avatar,
      description
    } = req.body;

    const updateFields = {
      updatedAt: new Date().toISOString()
    };

    if (email !== undefined && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ' });
      }

      // Check if another user uses this email
      const dup = await db.collection('users').findOne({
        email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        _id: { $ne: userObjectId }
      });
      if (dup) {
        return res.status(400).json({ success: false, message: 'Email đã được sử dụng bởi tài khoản khác' });
      }
      updateFields.email = cleanEmail;
    }

    if (roles !== undefined) {
      if (Array.isArray(roles) && roles.length > 0) {
        updateFields.roles = roles.map(r => String(r).trim().toLowerCase()).filter(Boolean);
      } else if (typeof roles === 'string' && roles.trim()) {
        updateFields.roles = [roles.trim().toLowerCase()];
      }
    }

    if (status !== undefined) {
      updateFields.status = Boolean(status);
    }
    if (fullName !== undefined) updateFields.fullName = String(fullName).trim();
    if (name !== undefined) updateFields.name = String(name).trim();
    if (phoneNumber !== undefined) updateFields.phoneNumber = String(phoneNumber).trim();
    if (gender !== undefined) updateFields.gender = String(gender).trim();
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = String(dateOfBirth).trim();
    if (address !== undefined) updateFields.address = String(address).trim();
    if (avatar !== undefined) updateFields.avatar = String(avatar).trim();
    if (description !== undefined) updateFields.description = String(description).trim();

    await db.collection('users').updateOne(
      { _id: userObjectId },
      { $set: updateFields }
    );

    const updatedUser = await db.collection('users').findOne(
      { _id: userObjectId },
      { projection: { password: 0, salt: 0 } }
    );

    res.json({
      success: true,
      message: 'Cập nhật tài khoản thành công',
      data: formatUserResponse(updatedUser)
    });
  } catch (error) {
    console.error('Error in PUT/PATCH /api/users/:id:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.put('/api/users/:id', handleUpdateUser);
app.patch('/api/users/:id', handleUpdateUser);

// 5.5 PATCH /api/users/:id/status (Lock/Unlock account)
const handleStatusToggle = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }
    const userObjectId = new ObjectId(id);

    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    let newStatus;
    if (req.body && req.body.status !== undefined) {
      newStatus = Boolean(req.body.status);
    } else {
      newStatus = user.status === false ? true : false;
    }

    await db.collection('users').updateOne(
      { _id: userObjectId },
      { $set: { status: newStatus, updatedAt: new Date().toISOString() } }
    );

    res.json({
      success: true,
      status: newStatus,
      message: newStatus ? 'Mở khóa tài khoản thành công' : 'Khóa tài khoản thành công'
    });
  } catch (error) {
    console.error('Error in PATCH /api/users/:id/status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/users/:id/status', handleStatusToggle);
app.put('/api/users/:id/toggle-status', handleStatusToggle);

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk delete users
app.post('/api/users/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có ID hợp lệ nào để xóa' });
    }
    const result = await db.collection('users').deleteMany({ _id: { $in: objectIds } });
    res.json({ success: true, message: `Đã xóa ${result.deletedCount} người dùng thành công`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. PAYMENT METHODS API (Collection: payment_methods)
// ─────────────────────────────────────────────────────────────
function formatPaymentMethod(pm) {
  const isActive = typeof pm.isActive === 'boolean'
    ? pm.isActive
    : (pm.status === 'ACTIVE');

  return {
    id: pm._id.toString(),
    _id: pm._id.toString(),
    name: pm.name || '',
    code: (pm.code || '').toUpperCase(),
    type: pm.type || pm.paymentType || 'Online',
    isActive: isActive,
    status: isActive ? 'Đang hoạt động' : 'Tạm khóa',
    statusText: isActive ? 'Đang hoạt động' : 'Tạm khóa',
    statusVariant: isActive ? 'success' : 'neutral',
    description: pm.description || '',
    paymentInfo: pm.paymentInfo || '',
    createdAt: (pm.createdAt || pm.dateAdded || new Date().toISOString()).toString().slice(0, 10),
    updatedAt: (pm.updatedAt || new Date().toISOString()).toString().slice(0, 19),
    raw: pm
  };
}

// 6.1 GET /api/payment-methods (List with search and pagination)
app.get('/api/payment-methods', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || req.query.pageSize) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    // Search by name, code, type
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const sRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: sRegex },
        { code: sRegex },
        { type: sRegex },
        { paymentType: sRegex }
      ];
    }

    // Filter by status / isActive
    if (req.query.status !== undefined && req.query.status !== '' && req.query.status !== 'all') {
      const st = String(req.query.status).trim().toLowerCase();
      if (st === 'active' || st === 'true' || st === 'đang hoạt động' || st === 'bật') {
        query.$or = [{ isActive: true }, { status: 'ACTIVE' }];
      } else if (st === 'inactive' || st === 'false' || st === 'tạm khóa' || st === 'tắt') {
        query.$or = [{ isActive: false }, { status: 'INACTIVE' }];
      }
    }

    const total = await db.collection('payment_methods').countDocuments(query);
    const listRaw = await db.collection('payment_methods')
      .find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const data = listRaw.map(formatPaymentMethod);

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      pagination: {
        page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6.2 GET /api/payment-methods/:id (Get single payment method by _id)
app.get('/api/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID phương thức thanh toán không hợp lệ' });
    }
    const pm = await db.collection('payment_methods').findOne({ _id: new ObjectId(id) });
    if (!pm) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phương thức thanh toán' });
    }
    res.json({
      success: true,
      data: formatPaymentMethod(pm)
    });
  } catch (error) {
    console.error('Error getting payment method detail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6.3 POST /api/payment-methods (Create new payment method)
app.post('/api/payment-methods', async (req, res) => {
  try {
    const { name, code, type, isActive, description, paymentInfo } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Tên phương thức thanh toán là bắt buộc' });
    }
    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Mã phương thức thanh toán là bắt buộc' });
    }
    if (!type || !String(type).trim()) {
      return res.status(400).json({ success: false, message: 'Loại thanh toán là bắt buộc' });
    }

    // Normalize code: uppercase, trim, check no spaces
    const cleanCode = String(code).trim().toUpperCase();
    if (/\s/.test(cleanCode)) {
      return res.status(400).json({ success: false, message: 'Mã phương thức thanh toán không được chứa khoảng trắng' });
    }

    // Check duplicate code
    const existing = await db.collection('payment_methods').findOne({
      code: { $regex: new RegExp(`^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `Mã phương thức thanh toán "${cleanCode}" đã tồn tại trong hệ thống` });
    }

    const nowIso = new Date().toISOString();
    const activeBool = isActive !== undefined ? Boolean(isActive) : true;

    const newDoc = {
      name: String(name).trim(),
      code: cleanCode,
      type: String(type).trim(),
      paymentType: String(type).trim(), // backward compat
      isActive: activeBool,
      status: activeBool ? 'ACTIVE' : 'INACTIVE', // backward compat
      description: description ? String(description).trim() : '',
      paymentInfo: paymentInfo ? String(paymentInfo).trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const insertResult = await db.collection('payment_methods').insertOne(newDoc);
    const created = formatPaymentMethod({ ...newDoc, _id: insertResult.insertedId });

    res.status(201).json({
      success: true,
      message: 'Thêm phương thức thanh toán thành công',
      data: created
    });
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6.4 PUT & PATCH /api/payment-methods/:id (Update payment method)
const handleUpdatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID phương thức thanh toán không hợp lệ' });
    }
    const pmId = new ObjectId(id);

    const existing = await db.collection('payment_methods').findOne({ _id: pmId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phương thức thanh toán để cập nhật' });
    }

    const { name, code, type, isActive, description, paymentInfo } = req.body;

    const updateFields = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Tên phương thức thanh toán không được để trống' });
      }
      updateFields.name = String(name).trim();
    }

    if (code !== undefined) {
      const cleanCode = String(code).trim().toUpperCase();
      if (!cleanCode) {
        return res.status(400).json({ success: false, message: 'Mã phương thức thanh toán không được để trống' });
      }
      if (/\s/.test(cleanCode)) {
        return res.status(400).json({ success: false, message: 'Mã phương thức thanh toán không được chứa khoảng trắng' });
      }

      // Check unique code excluding this document
      const dup = await db.collection('payment_methods').findOne({
        code: { $regex: new RegExp(`^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        _id: { $ne: pmId }
      });
      if (dup) {
        return res.status(400).json({ success: false, message: `Mã phương thức "${cleanCode}" đã được sử dụng bởi phương thức khác` });
      }
      updateFields.code = cleanCode;
    }

    if (type !== undefined) {
      if (!String(type).trim()) {
        return res.status(400).json({ success: false, message: 'Loại thanh toán không được để trống' });
      }
      updateFields.type = String(type).trim();
      updateFields.paymentType = String(type).trim();
    }

    if (isActive !== undefined) {
      const activeBool = Boolean(isActive);
      updateFields.isActive = activeBool;
      updateFields.status = activeBool ? 'ACTIVE' : 'INACTIVE';
    }

    if (description !== undefined) {
      updateFields.description = String(description).trim();
    }

    if (paymentInfo !== undefined) {
      updateFields.paymentInfo = String(paymentInfo).trim();
    }

    await db.collection('payment_methods').updateOne(
      { _id: pmId },
      { $set: updateFields }
    );

    const updated = await db.collection('payment_methods').findOne({ _id: pmId });
    res.json({
      success: true,
      message: 'Cập nhật phương thức thanh toán thành công',
      data: formatPaymentMethod(updated)
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.put('/api/payment-methods/:id', handleUpdatePaymentMethod);
app.patch('/api/payment-methods/:id', handleUpdatePaymentMethod);

// 6.5 PATCH /api/payment-methods/:id/status (Toggle / set active status)
const handleTogglePaymentMethodStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID phương thức thanh toán không hợp lệ' });
    }
    const pmId = new ObjectId(id);

    const pm = await db.collection('payment_methods').findOne({ _id: pmId });
    if (!pm) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phương thức thanh toán' });
    }

    let newActive;
    if (req.body && req.body.isActive !== undefined) {
      newActive = Boolean(req.body.isActive);
    } else if (req.body && req.body.status !== undefined) {
      newActive = req.body.status === 'ACTIVE' || req.body.status === true;
    } else {
      const currentActive = typeof pm.isActive === 'boolean'
        ? pm.isActive
        : (pm.status === 'ACTIVE');
      newActive = !currentActive;
    }

    const nowIso = new Date().toISOString();
    await db.collection('payment_methods').updateOne(
      { _id: pmId },
      {
        $set: {
          isActive: newActive,
          status: newActive ? 'ACTIVE' : 'INACTIVE',
          updatedAt: nowIso
        }
      }
    );

    const updated = await db.collection('payment_methods').findOne({ _id: pmId });
    res.json({
      success: true,
      isActive: newActive,
      status: newActive ? 'ACTIVE' : 'INACTIVE',
      message: newActive ? 'Đã bật phương thức thanh toán thành công' : 'Đã tắt phương thức thanh toán thành công',
      data: formatPaymentMethod(updated)
    });
  } catch (error) {
    console.error('Error toggling payment method status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/payment-methods/:id/status', handleTogglePaymentMethodStatus);
app.put('/api/payment-methods/:id/toggle', handleTogglePaymentMethodStatus);

// 6.6 DELETE /api/payment-methods/:id (Delete payment method)
app.delete('/api/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID phương thức thanh toán không hợp lệ' });
    }
    const result = await db.collection('payment_methods').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phương thức thanh toán để xóa' });
    }
    res.json({
      success: true,
      message: 'Xóa phương thức thanh toán thành công',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. SHIPPING METHODS API (Collection: shippingmethods)
// ─────────────────────────────────────────────────────────────
function formatShippingMethod(sm) {
  const isActive = typeof sm.isActive === 'boolean'
    ? sm.isActive
    : (sm.status === 'ACTIVE' || sm.status === true);

  const baseCost = typeof sm.baseCost === 'number'
    ? sm.baseCost
    : (typeof sm.baseFee === 'number' ? sm.baseFee : 0);

  const freeShippingThreshold = typeof sm.freeShippingThreshold === 'number'
    ? sm.freeShippingThreshold
    : (sm.freeShippingCondition?.minimumOrderValue || 0);

  const coverageArea = sm.coverageArea || (sm.deliveryScope === 'NATIONWIDE' ? 'Toàn quốc' : (sm.deliveryAreas?.join(', ') || 'Toàn quốc'));
  const estimatedDays = sm.estimatedDays || sm.estimatedDeliveryTime || '2–5 ngày làm việc';

  const freeShippingThresholdText = freeShippingThreshold > 0
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(freeShippingThreshold)
    : 'Không áp dụng';

  return {
    id: sm._id.toString(),
    _id: sm._id.toString(),
    name: sm.name || '',
    code: (sm.code || '').toUpperCase(),
    baseCost: baseCost,
    baseFee: baseCost, // backward compatibility
    estimatedDays: estimatedDays,
    coverageArea: coverageArea,
    freeShippingThreshold: freeShippingThreshold,
    freeShippingThresholdText: freeShippingThresholdText,
    isActive: isActive,
    status: isActive ? 'Đang bật' : 'Đang tắt',
    statusText: isActive ? 'Đang bật' : 'Đang tắt',
    statusVariant: isActive ? 'success' : 'neutral',
    description: sm.description || '',
    createdAt: (sm.createdAt || new Date().toISOString()).toString().slice(0, 10),
    updatedAt: (sm.updatedAt || new Date().toISOString()).toString().slice(0, 19),
    raw: sm
  };
}

// 7.1 GET /api/shipping-methods (List with search, filter, pagination)
app.get('/api/shipping-methods', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || req.query.pageSize) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    // Search by name, code, coverageArea
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const sRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: sRegex },
        { code: sRegex },
        { coverageArea: sRegex }
      ];
    }

    // Filter by isActive / status
    if (req.query.isActive !== undefined && req.query.isActive !== '' && req.query.isActive !== 'all') {
      const act = String(req.query.isActive).trim().toLowerCase();
      if (act === 'true' || act === '1' || act === 'đang bật') {
        query.isActive = true;
      } else if (act === 'false' || act === '0' || act === 'đang tắt') {
        query.isActive = false;
      }
    } else if (req.query.status !== undefined && req.query.status !== '' && req.query.status !== 'all') {
      const st = String(req.query.status).trim().toLowerCase();
      if (st === 'active' || st === 'true' || st === 'đang hoạt động' || st === 'đang bật') {
        query.$or = [{ isActive: true }, { status: 'ACTIVE' }];
      } else if (st === 'inactive' || st === 'false' || st === 'tạm ngừng' || st === 'đang tắt') {
        query.$or = [{ isActive: false }, { status: 'INACTIVE' }];
      }
    }

    const total = await db.collection('shippingmethods').countDocuments(query);
    const listRaw = await db.collection('shippingmethods')
      .find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const data = listRaw.map(formatShippingMethod);

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      pagination: {
        page,
        pageSize: limit,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7.2 GET /api/shipping-methods/:id
app.get('/api/shipping-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const sm = await db.collection('shippingmethods').findOne(query);
    if (!sm) {
      return res.status(404).json({ success: false, message: 'Phương thức vận chuyển không tồn tại' });
    }

    res.json({
      success: true,
      data: formatShippingMethod(sm)
    });
  } catch (error) {
    console.error('Error fetching shipping method by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7.3 POST /api/shipping-methods
app.post('/api/shipping-methods', async (req, res) => {
  try {
    const { name, code, baseCost, estimatedDays, coverageArea, freeShippingThreshold, isActive, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên phương thức vận chuyển không được để trống' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Mã phương thức vận chuyển không được để trống' });
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '_');

    if (baseCost === undefined || baseCost === null || isNaN(Number(baseCost)) || Number(baseCost) < 0) {
      return res.status(400).json({ success: false, message: 'Phí vận chuyển cơ bản phải là số >= 0' });
    }

    if (!estimatedDays || !estimatedDays.trim()) {
      return res.status(400).json({ success: false, message: 'Thời gian giao hàng dự kiến không được để trống' });
    }

    const parsedThreshold = (freeShippingThreshold !== undefined && freeShippingThreshold !== null && freeShippingThreshold !== '')
      ? Number(freeShippingThreshold)
      : 0;

    if (isNaN(parsedThreshold) || parsedThreshold < 0) {
      return res.status(400).json({ success: false, message: 'Mức đơn hàng miễn phí vận chuyển phải là số >= 0' });
    }

    // Check code duplication
    const existing = await db.collection('shippingmethods').findOne({
      code: { $regex: new RegExp(`^${normalizedCode}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `Mã phương thức vận chuyển "${normalizedCode}" đã tồn tại` });
    }

    const now = new Date();
    const newDoc = {
      name: name.trim(),
      code: normalizedCode,
      baseCost: Number(baseCost),
      estimatedDays: estimatedDays.trim(),
      coverageArea: coverageArea && coverageArea.trim() ? coverageArea.trim() : 'Toàn quốc',
      freeShippingThreshold: parsedThreshold,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      description: description ? description.trim() : '',
      createdAt: now,
      updatedAt: now
    };

    const insertResult = await db.collection('shippingmethods').insertOne(newDoc);
    const createdDoc = { _id: insertResult.insertedId, ...newDoc };

    res.status(201).json({
      success: true,
      message: 'Thêm phương thức vận chuyển thành công',
      data: formatShippingMethod(createdDoc)
    });
  } catch (error) {
    console.error('Error creating shipping method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7.4 PUT/PATCH /api/shipping-methods/:id
const updateShippingMethodHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let smId;
    if (ObjectId.isValid(id)) {
      smId = new ObjectId(id);
    } else {
      smId = id;
    }

    const existing = await db.collection('shippingmethods').findOne({ _id: smId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Phương thức vận chuyển không tồn tại' });
    }

    const { name, code, baseCost, estimatedDays, coverageArea, freeShippingThreshold, isActive, description } = req.body;

    const updateFields = {
      updatedAt: new Date()
    };

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Tên phương thức vận chuyển không được để trống' });
      }
      updateFields.name = name.trim();
    }

    if (code !== undefined) {
      if (!code || !code.trim()) {
        return res.status(400).json({ success: false, message: 'Mã phương thức vận chuyển không được để trống' });
      }
      const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '_');
      const dup = await db.collection('shippingmethods').findOne({
        _id: { $ne: smId },
        code: { $regex: new RegExp(`^${normalizedCode}$`, 'i') }
      });
      if (dup) {
        return res.status(400).json({ success: false, message: `Mã phương thức vận chuyển "${normalizedCode}" đã tồn tại` });
      }
      updateFields.code = normalizedCode;
    }

    if (baseCost !== undefined) {
      if (isNaN(Number(baseCost)) || Number(baseCost) < 0) {
        return res.status(400).json({ success: false, message: 'Phí vận chuyển cơ bản phải là số >= 0' });
      }
      updateFields.baseCost = Number(baseCost);
    }

    if (estimatedDays !== undefined) {
      if (!estimatedDays || !estimatedDays.trim()) {
        return res.status(400).json({ success: false, message: 'Thời gian giao hàng dự kiến không được để trống' });
      }
      updateFields.estimatedDays = estimatedDays.trim();
    }

    if (coverageArea !== undefined) {
      updateFields.coverageArea = coverageArea && coverageArea.trim() ? coverageArea.trim() : 'Toàn quốc';
    }

    if (freeShippingThreshold !== undefined) {
      const parsedThreshold = Number(freeShippingThreshold);
      if (isNaN(parsedThreshold) || parsedThreshold < 0) {
        return res.status(400).json({ success: false, message: 'Mức đơn hàng miễn phí vận chuyển phải là số >= 0' });
      }
      updateFields.freeShippingThreshold = parsedThreshold;
    }

    if (isActive !== undefined) {
      updateFields.isActive = Boolean(isActive);
    }

    if (description !== undefined) {
      updateFields.description = description ? description.trim() : '';
    }

    await db.collection('shippingmethods').updateOne(
      { _id: smId },
      { $set: updateFields }
    );

    const updated = await db.collection('shippingmethods').findOne({ _id: smId });

    res.json({
      success: true,
      message: 'Cập nhật phương thức vận chuyển thành công',
      data: formatShippingMethod(updated)
    });
  } catch (error) {
    console.error('Error updating shipping method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.put('/api/shipping-methods/:id', updateShippingMethodHandler);
app.patch('/api/shipping-methods/:id', updateShippingMethodHandler);

// 7.5 PATCH /api/shipping-methods/:id/status (and PUT /api/shipping-methods/:id/toggle)
const toggleShippingMethodStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let smId;
    if (ObjectId.isValid(id)) {
      smId = new ObjectId(id);
    } else {
      smId = id;
    }

    const sm = await db.collection('shippingmethods').findOne({ _id: smId });
    if (!sm) {
      return res.status(404).json({ success: false, message: 'Phương thức vận chuyển không tồn tại' });
    }

    let newStatus;
    if (req.body && typeof req.body.isActive === 'boolean') {
      newStatus = req.body.isActive;
    } else if (req.body && typeof req.body.status === 'boolean') {
      newStatus = req.body.status;
    } else {
      const currentActive = typeof sm.isActive === 'boolean'
        ? sm.isActive
        : (sm.status === 'ACTIVE' || sm.status === true);
      newStatus = !currentActive;
    }

    await db.collection('shippingmethods').updateOne(
      { _id: smId },
      {
        $set: {
          isActive: newStatus,
          status: newStatus ? 'ACTIVE' : 'INACTIVE',
          updatedAt: new Date()
        }
      }
    );

    const updated = await db.collection('shippingmethods').findOne({ _id: smId });

    res.json({
      success: true,
      message: `Phương thức vận chuyển đã được ${newStatus ? 'bật' : 'tắt'}`,
      data: formatShippingMethod(updated)
    });
  } catch (error) {
    console.error('Error updating shipping method status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/shipping-methods/:id/status', toggleShippingMethodStatusHandler);
app.put('/api/shipping-methods/:id/toggle', toggleShippingMethodStatusHandler);

// 7.6 DELETE /api/shipping-methods/:id
app.delete('/api/shipping-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const result = await db.collection('shippingmethods').deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Phương thức vận chuyển không tồn tại hoặc đã bị xóa' });
    }

    res.json({
      success: true,
      message: 'Xóa phương thức vận chuyển thành công',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting shipping method:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ─────────────────────────────────────────────────────────────
// 8. INVENTORY API (Calculated from products)
// ─────────────────────────────────────────────────────────────
app.get('/api/inventory', async (req, res) => {
  try {
    const [productsRaw, activeOrders] = await Promise.all([
      db.collection('products').find({}).sort({ updatedAt: -1, _id: -1 }).toArray(),
      db.collection('orders').find({
        status: { $in: ['PENDING', 'PROCESSING', 'Chờ xác nhận', 'Đang xử lý'] }
      }).toArray()
    ]);

    const reservedMap = {};
    for (const order of activeOrders) {
      const items = order.cart?.items || [];
      for (const item of items) {
        const prodId = item.item?._id?.toString() || item.item?.id?.toString() || item.productId?.toString();
        if (prodId) {
          reservedMap[prodId] = (reservedMap[prodId] || 0) + (Number(item.qty) || 1);
        }
      }
    }

    const data = productsRaw.map(p => {
      const vi = p.vi || {};
      const name = vi.title || p.title || p.titleUrl?.replace(/-/g, ' ') || 'Sản phẩm';
      
      let stock = 0;
      if (vi.stock !== undefined && vi.stock !== null && vi.stock !== '') {
        stock = Number(vi.stock);
      } else if (vi.quantity !== undefined && vi.quantity !== null && vi.quantity !== '') {
        stock = Number(vi.quantity);
      } else if (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') {
        stock = Number(p.quantity);
      }
      if (isNaN(stock) || stock < 0) stock = 0;

      const quantity = stock;
      const reserved = Math.min(quantity, reservedMap[p._id.toString()] || 0);
      const available = Math.max(0, quantity - reserved);

      let status = 'Còn hàng';
      let statusVariant = 'success';
      if (available <= 0) {
        status = 'Hết hàng';
        statusVariant = 'danger';
      } else if (available < 5) {
        status = 'Sắp hết';
        statusVariant = 'warning';
      }

      return {
        id: p._id.toString(),
        _id: p._id.toString(),
        name,
        sku: p.sku || vi.sku || ('SP-' + p._id.toString().slice(-6).toUpperCase()),
        quantity,
        stock: quantity,
        reserved,
        available,
        status,
        statusVariant
      };
    });

    res.json({
      success: true,
      data,
      pagination: { page: 1, pageSize: data.length, total: data.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8.1 INVENTORY IMPORT (PATCH/POST /api/products/:id/inventory)
const handleInventoryImport = async (req, res) => {
  try {
    const { id } = req.params;
    let prodId;
    if (ObjectId.isValid(id)) {
      prodId = new ObjectId(id);
    } else {
      prodId = id;
    }

    const { quantity } = req.body;

    if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số lượng nhập kho' });
    }

    const numQty = Number(quantity);

    if (!Number.isInteger(numQty)) {
      return res.status(400).json({ success: false, message: 'Số lượng nhập phải là số nguyên' });
    }

    if (numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượng nhập phải lớn hơn 0' });
    }

    // Step 3: Find product
    const product = await db.collection('products').findOne({ _id: prodId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    // Step 4: Get current stock from vi.stock (or fallback to vi.quantity/product.quantity)
    const vi = product.vi || {};
    let currentStock = 0;
    if (vi.stock !== undefined && vi.stock !== null && vi.stock !== '') {
      currentStock = Number(vi.stock);
    } else if (vi.quantity !== undefined && vi.quantity !== null && vi.quantity !== '') {
      currentStock = Number(vi.quantity);
    } else if (product.quantity !== undefined && product.quantity !== null && product.quantity !== '') {
      currentStock = Number(product.quantity);
    }
    if (isNaN(currentStock) || currentStock < 0) currentStock = 0;

    // Step 5: Calculate new stock
    const newStock = currentStock + numQty;

    // Step 6-8: Update in products collection
    const updateSet = {
      'vi.stock': newStock,
      'vi.quantity': newStock,
      updatedAt: new Date()
    };

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const updatedVariants = product.variants.map((v, idx) => {
        if (req.body.variantId || req.body.sku) {
          if (v.id === req.body.variantId || v.sku === req.body.sku || v._id === req.body.variantId) {
            return { ...v, stock: (Number(v.stock) || 0) + numQty };
          }
          return v;
        }
        if (idx === 0) {
          return { ...v, stock: (Number(v.stock) || 0) + numQty };
        }
        return v;
      });
      updateSet.variants = updatedVariants;
    }

    await db.collection('products').updateOne(
      { _id: prodId },
      { $set: updateSet }
    );

    const updatedProduct = await db.collection('products').findOne({ _id: prodId });

    // Step 9: Return response
    res.json({
      success: true,
      message: `Nhập kho thành công. Đã nhập thêm ${numQty} sản phẩm. Tồn kho hiện tại: ${newStock}.`,
      productId: prodId.toString(),
      quantityImported: numQty,
      previousStock: currentStock,
      stock: newStock,
      product: formatProduct(updatedProduct)
    });
  } catch (error) {
    console.error('Error importing inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/products/:id/inventory', handleInventoryImport);
app.post('/api/products/:id/inventory', handleInventoryImport);


// ─────────────────────────────────────────────────────────────
// 9. PAGES API (QUẢN LÝ TRANG TĨNH)
// ─────────────────────────────────────────────────────────────
function formatPage(p) {
  const title = p.vi?.title || p.en?.title || p.title || p.titleUrl || 'Trang tĩnh';
  const rawSlug = (p.titleUrl || p.slug || '').replace(/^\/+/, '');
  const slug = '/' + rawSlug;
  const isPublished = p.status === 'published' || p.status === 'active' || (p.vi?.visibility !== false && p.visibility !== false && p.status !== 'draft');
  return {
    id: p._id.toString(),
    _id: p._id.toString(),
    title,
    slug,
    rawSlug,
    contentHTML: p.vi?.contentHTML || p.en?.contentHTML || p.contentHTML || '',
    status: isPublished ? 'Đã xuất bản' : 'Bản nháp',
    statusVariant: isPublished ? 'success' : 'neutral',
    isPublished: isPublished,
    statusCode: isPublished ? 'published' : 'draft',
    dateAdded: p.dateAdded || p.createdAt || '',
    updatedAt: (p.updatedAt || p.dateAdded || new Date().toISOString()).toString().slice(0, 10),
    metaDescription: p.vi?.metaDescription || p.metaDescription || '',
    raw: p
  };
}

// 9.1 GET /api/pages - List all pages
app.get('/api/pages', async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const status = req.query.status ? req.query.status.trim() : '';

    let queryConditions = [];
    if (search) {
      queryConditions.push({
        $or: [
          { 'vi.title': { $regex: search, $options: 'i' } },
          { 'en.title': { $regex: search, $options: 'i' } },
          { titleUrl: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (status) {
      if (status === 'Đã xuất bản' || status === 'published' || status === 'active') {
        queryConditions.push({
          $or: [
            { status: 'published' },
            { status: 'active' },
            { $and: [{ status: { $ne: 'draft' } }, { 'vi.visibility': { $ne: false } }] }
          ]
        });
      } else if (status === 'Bản nháp' || status === 'draft' || status === 'inactive') {
        queryConditions.push({
          $or: [
            { status: 'draft' },
            { status: 'inactive' },
            { 'vi.visibility': false }
          ]
        });
      }
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};
    const pagesRaw = await db.collection('pages').find(query).sort({ _id: -1 }).toArray();
    const data = pagesRaw.map(formatPage);

    res.json({
      success: true,
      data,
      pagination: { page: 1, pageSize: data.length, total: data.length }
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.2 GET /api/pages/:id - Get page detail
app.get('/api/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const page = await db.collection('pages').findOne(query);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
    }

    res.json({
      success: true,
      data: formatPage(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.3 POST /api/pages - Create new page
app.post('/api/pages', async (req, res) => {
  try {
    const body = req.body || {};
    const vi = body.vi || {};
    const title = (vi.title || body.title || '').trim();

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tiêu đề trang không được để trống' });
    }

    let slug = (body.titleUrl || body.slug || generateSlug(title)).trim().replace(/^\/+/, '');
    slug = generateSlug(slug);

    // Unique slug & title check
    const dup = await db.collection('pages').findOne({
      $or: [
        { titleUrl: slug },
        { 'vi.title': { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
      ]
    });

    if (dup) {
      return res.status(400).json({ success: false, message: 'Tiêu đề trang hoặc đường dẫn (slug) đã tồn tại' });
    }

    const isPublished = body.isPublished !== undefined
      ? !!body.isPublished
      : (body.status === 'published' || body.status === 'active' || body.status === 'Đã xuất bản' || vi.visibility !== false);

    const contentHTML = vi.contentHTML !== undefined
      ? vi.contentHTML
      : (body.contentHTML !== undefined ? body.contentHTML : (body.content || ''));

    const newPage = {
      titleUrl: slug,
      status: isPublished ? 'published' : 'draft',
      dateAdded: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vi: {
        title: title,
        contentHTML: contentHTML,
        visibility: isPublished,
        metaDescription: (body.metaDescription || vi.metaDescription || '').trim()
      },
      en: {
        title: title,
        contentHTML: contentHTML
      },
      __v: 0
    };

    const result = await db.collection('pages').insertOne(newPage);
    const created = await db.collection('pages').findOne({ _id: result.insertedId });

    res.status(201).json({
      success: true,
      message: 'Tạo trang mới thành công',
      id: result.insertedId.toString(),
      data: formatPage(created)
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi tạo trang' });
  }
});

// 9.4 PUT / PATCH /api/pages/:id - Update page
const updatePageHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const existing = await db.collection('pages').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang để chỉnh sửa' });
    }

    const body = req.body || {};
    const vi = body.vi || {};
    const title = (vi.title !== undefined ? vi.title : (body.title !== undefined ? body.title : existing.vi?.title || existing.en?.title || '')).trim();

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tiêu đề trang không được để trống' });
    }

    let slug = (body.titleUrl || body.slug || existing.titleUrl || generateSlug(title)).trim().replace(/^\/+/, '');
    slug = generateSlug(slug);

    // Unique check against other pages
    const dup = await db.collection('pages').findOne({
      _id: { $ne: existing._id },
      $or: [
        { titleUrl: slug },
        { 'vi.title': { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
      ]
    });

    if (dup) {
      return res.status(400).json({ success: false, message: 'Tiêu đề trang hoặc đường dẫn (slug) đã tồn tại' });
    }

    const isPublished = body.isPublished !== undefined
      ? !!body.isPublished
      : (body.status !== undefined
          ? (body.status === 'published' || body.status === 'active' || body.status === 'Đã xuất bản')
          : (existing.status === 'published' || existing.vi?.visibility !== false));

    const contentHTML = vi.contentHTML !== undefined
      ? vi.contentHTML
      : (body.contentHTML !== undefined ? body.contentHTML : (body.content !== undefined ? body.content : existing.vi?.contentHTML || existing.en?.contentHTML || ''));

    const updateFields = {
      titleUrl: slug,
      status: isPublished ? 'published' : 'draft',
      updatedAt: new Date().toISOString(),
      'vi.title': title,
      'vi.contentHTML': contentHTML,
      'vi.visibility': isPublished,
      'vi.metaDescription': (body.metaDescription !== undefined ? body.metaDescription : (vi.metaDescription || existing.vi?.metaDescription || '')).trim()
    };

    await db.collection('pages').updateOne(query, { $set: updateFields });
    const updated = await db.collection('pages').findOne(query);

    res.json({
      success: true,
      message: 'Cập nhật trang thành công',
      data: formatPage(updated)
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật trang' });
  }
};

app.put('/api/pages/:id', updatePageHandler);
app.patch('/api/pages/:id', updatePageHandler);

// 9.5 PATCH /api/pages/:id/status - Toggle / update status
const togglePageStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const existing = await db.collection('pages').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
    }

    const currentPublished = existing.status === 'published' || existing.status === 'active' || existing.vi?.visibility !== false;
    let newPublished;
    if (req.body && typeof req.body.status === 'string') {
      newPublished = req.body.status === 'published' || req.body.status === 'active' || req.body.status === 'Đã xuất bản';
    } else if (req.body && typeof req.body.isPublished === 'boolean') {
      newPublished = req.body.isPublished;
    } else {
      newPublished = !currentPublished;
    }

    const newStatus = newPublished ? 'published' : 'draft';

    await db.collection('pages').updateOne(query, {
      $set: {
        status: newStatus,
        'vi.visibility': newPublished,
        updatedAt: new Date().toISOString()
      }
    });

    const updated = await db.collection('pages').findOne(query);

    res.json({
      success: true,
      message: `Trang đã được chuyển sang trạng thái "${newPublished ? 'Đã xuất bản' : 'Bản nháp'}"`,
      data: formatPage(updated)
    });
  } catch (error) {
    console.error('Error toggling page status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/pages/:id/status', togglePageStatusHandler);
app.put('/api/pages/:id/toggle', togglePageStatusHandler);

// 9.6 DELETE /api/pages/:id - Delete page
app.delete('/api/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const result = await db.collection('pages').deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang hoặc đã bị xóa' });
    }

    res.json({
      success: true,
      message: 'Xóa trang thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 10. ACCOUNT API (THÔNG TIN TÀI KHOẢN ADMIN ĐANG ĐĂNG NHẬP)
// ─────────────────────────────────────────────────────────────
async function getLoggedInAdminUser(req) {
  let user = null;
  const authHeader = req.headers.authorization || '';
  const customUserId = req.headers['x-user-id'] || '';

  if (authHeader.startsWith('Bearer ')) {
    const tokenVal = authHeader.slice(7).trim();
    if (tokenVal) {
      try {
        const decoded = jwt.verify(tokenVal, process.env.JWT_SECRET || 'secretKey');
        if (decoded && decoded.email) {
          user = await db.collection('users').findOne({ email: decoded.email.toLowerCase(), status: true });
        }
      } catch (err) {
        // Token expired or invalid signature
      }
      if (!user && ObjectId.isValid(tokenVal)) {
        user = await db.collection('users').findOne({ _id: new ObjectId(tokenVal), status: true });
      }
    }
  }

  if (!user && customUserId && ObjectId.isValid(customUserId)) {
    user = await db.collection('users').findOne({ _id: new ObjectId(customUserId), status: true });
  }

  // Fallback to active admin in collection users if no specific user was found
  if (!user) {
    user = await db.collection('users').findOne(
      { roles: 'admin', status: true },
      { sort: { dateAdded: 1 } }
    );
  }

  return user;
}

function formatAccountResponse(u) {
  const roleLabel = Array.isArray(u.roles) && u.roles.includes('superadmin')
    ? 'Quản trị viên cấp cao'
    : (Array.isArray(u.roles) && u.roles.includes('admin') || u.role === 'admin' ? 'Quản trị viên' : 'Nhân viên');

  const statusLabel = u.status !== false ? 'Đang hoạt động' : 'Tạm khóa';

  return {
    id: u._id.toString(),
    _id: u._id.toString(),
    fullName: u.fullName || u.name || 'Admin',
    name: u.name || u.fullName || 'admin',
    username: u.name || u.username || (u.email ? u.email.split('@')[0] : 'admin'),
    email: u.email || '',
    phone: u.phoneNumber || u.phone || '',
    phoneNumber: u.phoneNumber || u.phone || '',
    avatar: u.avatar || '',
    role: roleLabel,
    rawRoles: u.roles || [u.role || 'admin'],
    status: statusLabel,
    isActive: u.status !== false,
    lastLogin: u.lastLogin || u.updatedAt || u.dateAdded || new Date().toISOString(),
    dateAdded: u.dateAdded || u.createdAt || new Date().toISOString(),
    updatedAt: u.updatedAt || new Date().toISOString()
  };
}

// 10.1 GET /api/account/me - Lấy thông tin hồ sơ Admin hiện tại
app.get('/api/account/me', async (req, res) => {
  try {
    const admin = await getLoggedInAdminUser(req);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản quản trị viên' });
    }

    res.json({
      success: true,
      data: formatAccountResponse(admin)
    });
  } catch (error) {
    console.error('Error fetching account me:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10.2 PATCH /api/account/me - Chỉnh sửa thông tin cá nhân
app.patch('/api/account/me', async (req, res) => {
  try {
    const admin = await getLoggedInAdminUser(req);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản quản trị viên' });
    }

    const body = req.body || {};
    const fullName = (body.fullName !== undefined ? body.fullName : (body.name !== undefined ? body.name : admin.fullName || admin.name || '')).trim();
    const email = (body.email !== undefined ? body.email : (admin.email || '')).trim().toLowerCase();
    const phoneNumber = (body.phoneNumber !== undefined ? body.phoneNumber : (body.phone !== undefined ? body.phone : admin.phoneNumber || '')).trim();

    // Validation
    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Họ và tên không được để trống' });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email không được để trống' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ' });
    }

    // Check duplicate email with another user
    const dup = await db.collection('users').findOne({
      _id: { $ne: admin._id },
      email: email
    });

    if (dup) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi một tài khoản khác' });
    }

    const updateFields = {
      fullName: fullName,
      name: fullName,
      email: email,
      phoneNumber: phoneNumber,
      updatedAt: new Date().toISOString()
    };

    if (body.avatar !== undefined) {
      updateFields.avatar = String(body.avatar).trim();
    }

    await db.collection('users').updateOne(
      { _id: admin._id },
      { $set: updateFields }
    );

    const updated = await db.collection('users').findOne({ _id: admin._id });

    res.json({
      success: true,
      message: 'Đã lưu thay đổi thành công.',
      data: formatAccountResponse(updated)
    });
  } catch (error) {
    console.error('Error updating account me:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật hồ sơ' });
  }
});

// 10.3 POST /api/account/me/avatar - Cập nhật ảnh đại diện
app.post('/api/account/me/avatar', async (req, res) => {
  try {
    const admin = await getLoggedInAdminUser(req);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản quản trị viên' });
    }

    const body = req.body || {};
    const avatar = (body.avatar || body.url || body.imageUrl || '').trim();

    if (!avatar) {
      return res.status(400).json({ success: false, message: 'Dữ liệu ảnh đại diện không hợp lệ' });
    }

    await db.collection('users').updateOne(
      { _id: admin._id },
      {
        $set: {
          avatar: avatar,
          updatedAt: new Date().toISOString()
        }
      }
    );

    const updated = await db.collection('users').findOne({ _id: admin._id });

    res.json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công',
      avatar: updated.avatar,
      data: formatAccountResponse(updated)
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi cập nhật ảnh đại diện' });
  }
});

// 10.4 PATCH /api/account/me/password - Đổi mật khẩu tài khoản
app.patch('/api/account/me/password', async (req, res) => {
  try {
    const admin = await getLoggedInAdminUser(req);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản quản trị viên' });
    }

    const body = req.body || {};
    const currentPassword = (body.currentPassword || body.oldPassword || '').trim();
    const newPassword = (body.newPassword || '').trim();
    const confirmPassword = (body.confirmPassword || body.confirmNewPassword || '').trim();

    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại' });
    }

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không trùng khớp' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ' });
    }

    // Verify current password with bcrypt
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.collection('users').updateOne(
      { _id: admin._id },
      {
        $set: {
          password: hashedPassword,
          salt: salt,
          updatedAt: new Date().toISOString()
        }
      }
    );

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công.'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi đổi mật khẩu' });
  }
});

// ─────────────────────────────────────────────────────────────
// 11. SETTINGS API (System-level Configuration)
// ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  site: {
    name: "Chéri Paris",
    logo: "",
    favicon: "",
    description: "Thương hiệu thời trang thiết kế cao cấp phong cách Pháp tinh tế và thanh lịch."
  },
  contact: {
    email: "contact@cheri.vn",
    phone: "0987654321",
    address: "123 Đồng Khởi, Bến Nghé, Quận 1, TP. Hồ Chí Minh"
  },
  store: {
    isOpen: true
  },
  checkout: {
    allowOrder: true
  },
  shipping: {
    enabled: true
  },
  maintenance: {
    enabled: false,
    message: "Website đang trong quá trình bảo trì nâng cấp định kỳ. Quý khách vui lòng quay lại sau ít phút."
  },
  system: {
    language: "vi",
    currency: "đ",
    timezone: "Asia/Ho_Chi_Minh"
  },
  updatedAt: new Date().toISOString()
};

// 11.1 GET /api/settings - Lấy cấu hình hệ thống
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await db.collection('settings').findOne({});
    if (!settings) {
      const result = await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
      settings = await db.collection('settings').findOne({ _id: result.insertedId });
    }
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi tải cài đặt' });
  }
});

// 11.2 PATCH /api/settings - Cập nhật cấu hình hệ thống
app.patch('/api/settings', async (req, res) => {
  try {
    const body = req.body || {};
    let settings = await db.collection('settings').findOne({});
    if (!settings) {
      const result = await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
      settings = await db.collection('settings').findOne({ _id: result.insertedId });
    }

    const updateFields = {
      updatedAt: new Date().toISOString()
    };

    // Site settings
    if (body.site && typeof body.site === 'object') {
      if (body.site.name !== undefined) updateFields['site.name'] = String(body.site.name).trim();
      if (body.site.logo !== undefined) updateFields['site.logo'] = String(body.site.logo).trim();
      if (body.site.favicon !== undefined) updateFields['site.favicon'] = String(body.site.favicon).trim();
      if (body.site.description !== undefined) updateFields['site.description'] = String(body.site.description).trim();
    }

    // Contact settings
    if (body.contact && typeof body.contact === 'object') {
      if (body.contact.email !== undefined) updateFields['contact.email'] = String(body.contact.email).trim();
      if (body.contact.phone !== undefined) updateFields['contact.phone'] = String(body.contact.phone).trim();
      if (body.contact.address !== undefined) updateFields['contact.address'] = String(body.contact.address).trim();
    }

    // Store settings (Website đang mở: boolean)
    if (body.store && typeof body.store === 'object') {
      if (body.store.isOpen !== undefined) updateFields['store.isOpen'] = Boolean(body.store.isOpen);
    }

    // Checkout settings (Cho phép đặt hàng: boolean)
    if (body.checkout && typeof body.checkout === 'object') {
      if (body.checkout.allowOrder !== undefined) updateFields['checkout.allowOrder'] = Boolean(body.checkout.allowOrder);
    }

    // Shipping settings (Cho phép vận chuyển: boolean)
    if (body.shipping && typeof body.shipping === 'object') {
      if (body.shipping.enabled !== undefined) updateFields['shipping.enabled'] = Boolean(body.shipping.enabled);
    }

    // Maintenance settings (Chế độ bảo trì: boolean, message: string)
    if (body.maintenance && typeof body.maintenance === 'object') {
      if (body.maintenance.enabled !== undefined) updateFields['maintenance.enabled'] = Boolean(body.maintenance.enabled);
      if (body.maintenance.message !== undefined) updateFields['maintenance.message'] = String(body.maintenance.message).trim();
    }

    // System settings (language, currency, timezone)
    if (body.system && typeof body.system === 'object') {
      if (body.system.language !== undefined) updateFields['system.language'] = String(body.system.language).trim();
      if (body.system.currency !== undefined) updateFields['system.currency'] = String(body.system.currency).trim();
      if (body.system.timezone !== undefined) updateFields['system.timezone'] = String(body.system.timezone).trim();
    }

    await db.collection('settings').updateOne(
      { _id: settings._id },
      { $set: updateFields }
    );

    const updated = await db.collection('settings').findOne({ _id: settings._id });

    res.json({
      success: true,
      message: 'Cập nhật cấu hình hệ thống thành công.',
      data: updated
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật cài đặt' });
  }
});

// ─────────────────────────────────────────────────────────────
// 12. CUSTOMER FRONTEND SHARED ENDPOINTS (Config, Translations, Auth)
// ─────────────────────────────────────────────────────────────
app.get('/api/cheri/config', async (req, res) => {
  try {
    const activeConfig = await db.collection('configs').findOne({ active: true });
    const theme = await db.collection('themes').findOne({ active: true });
    const configFromEnv = Object.keys(process.env)
      .filter((k) => k.startsWith('FE_'))
      .reduce((acc, curr) => ({ ...acc, [curr]: process.env[curr] }), {});
    const themeStyles = theme && theme.styles ? { styles: theme.styles } : {};
    const payload = { ...configFromEnv, ...themeStyles, ...(activeConfig ? { config: activeConfig } : {}) };
    res.json({
      config: Buffer.from(JSON.stringify(payload)).toString('base64')
    });
  } catch (err) {
    res.json({
      config: Buffer.from(JSON.stringify({})).toString('base64')
    });
  }
});

app.get('/api/translations', async (req, res) => {
  try {
    const doc = await db.collection('translations').findOne({ lang: 'vi' });
    res.json(doc || { lang: 'vi', keys: {} });
  } catch (err) {
    res.json({ lang: 'vi', keys: {} });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, fullName, phoneNumber, address } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(cleanEmail)) {
      return res.status(400).json({
        error: { message: 'Email phải đúng định dạng @gmail.com mới được đăng ký' }
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: { message: 'Mật khẩu phải tối thiểu 6 ký tự' }
      });
    }

    const existingUser = await db.collection('users').findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        error: { message: 'Email đã tồn tại trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác!' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const resolvedName = (fullName || name || cleanEmail.split('@')[0] || 'User').trim();

    const newUser = {
      email: cleanEmail,
      password: hashedPassword,
      salt,
      name: resolvedName,
      fullName: resolvedName,
      phoneNumber: (phoneNumber || '').trim(),
      address: (address || '').trim(),
      roles: ['user'],
      status: true,
      cart: { items: [] },
      images: [],
      description: 'Người dùng hệ thống',
      dateAdded: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    const payload = { email: cleanEmail, id: result.insertedId.toString(), roles: ['user'] };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789', {
      expiresIn: process.env.JWT_EXPIRATION || '7d'
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      accessToken,
      id: result.insertedId.toString(),
      email: cleanEmail,
      roles: ['user'],
      name: resolvedName
    });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({
      error: { message: error.message || 'Lỗi server khi đăng ký' }
    });
  }
});

app.post('/api/auth/signout', (req, res) => {
  res.clearCookie('jwt');
  res.clearCookie('token');
  res.clearCookie('accessToken');
  return res.json({ success: true, message: 'Đăng xuất thành công' });
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }
    const payload = { email: user.email, id: user._id.toString(), roles: user.roles || ['user'] };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789', {
      expiresIn: process.env.JWT_EXPIRATION || '7d'
    });
    res.json({
      accessToken,
      id: user._id.toString(),
      email: user.email,
      roles: user.roles || ['user'],
      name: user.name || user.fullName || user.email.split('@')[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi server khi đăng nhập' });
  }
});

app.get('/api/auth', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789');
    if (!decoded || !decoded.email) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await db.collection('users').findOne({ email: decoded.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({
      id: user._id.toString(),
      email: user.email,
      roles: user.roles || ['user'],
      name: user.name || user.fullName || user.email.split('@')[0]
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Start Server (Chỉ listen khi chạy trực tiếp file này bằng node server/admin-server.js)
if (require.main === module) {
  connectToMongo().then(() => {
    app.listen(PORT, () => {
      console.log(` Backend API server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = { app, connectToMongo };

