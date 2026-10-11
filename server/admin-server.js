require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.ADMIN_PORT || process.env.PORT_ADMIN || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";

// Uploads directory setup for static serving
const uploadsDir = path.join(__dirname, 'uploads', 'payment-proofs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const paymentImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

const uploadPaymentImage = multer({
  storage: paymentImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Chỉ chấp nhận tệp hình ảnh (PNG, JPG, JPEG, WEBP, SVG)'));
    }
    cb(null, true);
  }
});

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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Endpoint upload image for payment proofs & general admin uploads
app.post('/api/upload/image', (req, res) => {
  uploadPaymentImage.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Lỗi khi tải ảnh lên' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp hình ảnh để tải lên' });
    }
    const fileUrl = `/uploads/payment-proofs/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Tải ảnh lên máy chủ thành công',
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  });
});

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
  { code: 'DELIVERED', label: 'Đã giao', key: 'delivered', queryParam: 'Đã giao', variant: 'success' },
  { code: 'SHIPPING', label: 'Đang giao', key: 'shipping', queryParam: 'Đang giao', variant: 'primary' },
  { code: 'PROCESSING', label: 'Đang xử lý', key: 'processing', queryParam: 'Đang xử lý', variant: 'warning' },
  { code: 'PENDING', label: 'Chờ xác nhận', key: 'pending', queryParam: 'Chờ xác nhận', variant: 'neutral' },
  { code: 'CANCELLED', label: 'Đã hủy', key: 'cancelled', queryParam: 'Đã hủy', variant: 'danger' },
  { code: 'RETURNED', label: 'Đã hoàn trả', key: 'returned', queryParam: 'Đã hoàn trả', variant: 'neutral' },
];

function normalizeOrderStatus(st) {
  if (!st) return 'PENDING';
  const upper = String(st).trim().toUpperCase();
  if (upper === 'NEW') return 'PENDING';
  if (upper === 'CONFIRMED') return 'PROCESSING';
  if (upper === 'DELIVERY_FAILED') return 'RETURNED';
  if (upper === 'COMPLETED') return 'DELIVERED';
  if (upper === 'CANCELED') return 'CANCELLED';
  if (upper === 'RETURN') return 'RETURNED';
  return upper;
}
const normalizeStatus = normalizeOrderStatus;

function getOrderTime(o) {
  const d = o.createdAt || o.dateAdded;
  if (d) {
    const t = new Date(d).getTime();
    if (!isNaN(t)) return t;
  }
  if (o._id && typeof o._id.getTimestamp === 'function') {
    return o._id.getTimestamp().getTime();
  }
  return 0;
}

function getOrderAmount(o) {
  const amt = Number(o.totalAmount !== undefined && o.totalAmount !== null ? o.totalAmount : (o.cart?.totalPrice !== undefined ? o.cart.totalPrice : (o.amount || 0)));
  return isNaN(amt) ? 0 : amt;
}

function isOrderRevenueEligible(o) {
  const st = normalizeOrderStatus(o.status || o.statusHistory?.[0]?.status);
  if (st === 'CANCELLED' || st === 'RETURNED' || st === 'DELIVERY_FAILED') return false;
  const paySt = String(o.paymentStatus || o.payment?.status || '').toUpperCase();
  return paySt === 'PAID' || st === 'DELIVERED' || paySt === 'COMPLETED';
}

const dashboardHandler = async (req, res) => {
  try {
    const now = new Date();
    const timeRange = req.query.timeRange || '7d';
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;

    let periodStart;
    let periodEnd;
    let prevStart;
    let prevEnd;
    let days;

    if (startDateParam && endDateParam) {
      const s = new Date(startDateParam);
      const e = new Date(endDateParam);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
        periodStart = new Date(s);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(e);
        periodEnd.setHours(23, 59, 59, 999);
        days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
        prevEnd = new Date(periodStart.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
        prevStart.setHours(0, 0, 0, 0);
      }
    }

    if (!periodStart) {
      if (timeRange === 'this_month') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const elapsed = now.getDate();
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, elapsed, 23, 59, 59, 999);
        days = periodEnd.getDate();
      } else if (timeRange === 'last_month') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodStart = new Date(lm.getFullYear(), lm.getMonth(), 1, 0, 0, 0, 0);
        periodEnd = new Date(lm.getFullYear(), lm.getMonth() + 1, 0, 23, 59, 59, 999);
        const pm = new Date(lm.getFullYear(), lm.getMonth() - 1, 1);
        prevStart = new Date(pm.getFullYear(), pm.getMonth(), 1, 0, 0, 0, 0);
        prevEnd = new Date(pm.getFullYear(), pm.getMonth() + 1, 0, 23, 59, 59, 999);
        days = periodEnd.getDate();
      } else if (timeRange === '30d') {
        days = 30;
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
        periodStart.setHours(0, 0, 0, 0);
        prevEnd = new Date(periodStart.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
        prevStart.setHours(0, 0, 0, 0);
      } else if (timeRange === '15d') {
        days = 15;
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
        periodStart.setHours(0, 0, 0, 0);
        prevEnd = new Date(periodStart.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
        prevStart.setHours(0, 0, 0, 0);
      } else {
        // default 7d
        days = 7;
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        periodStart = new Date(periodEnd.getTime() - (days - 1) * 86400000);
        periodStart.setHours(0, 0, 0, 0);
        prevEnd = new Date(periodStart.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
        prevStart.setHours(0, 0, 0, 0);
      }
    }

    // Concurrent queries to MongoDB Atlas
    const [pingRes, orders, products, categories, users] = await Promise.all([
      db.command({ ping: 1 }).then(() => 'Connected').catch((err) => {
        console.error('db.command ping failed:', err);
        return 'Disconnected';
      }),
      db.collection('orders').find({}).sort({ createdAt: -1, dateAdded: -1, _id: -1 }).toArray(),
      db.collection('products').find({}).toArray(),
      db.collection('categories').find({}).toArray(),
      db.collection('users').find({}).toArray()
    ]);

    const mongoStatus = pingRes === 'Connected' ? 'Connected' : 'Disconnected';
    const mongoStatusText = pingRes === 'Connected' ? 'Đã kết nối thành công' : 'Mất kết nối MongoDB';

    // Build category map (id/titleUrl -> title)
    const categoryMap = new Map();
    for (const c of categories) {
      const title = c.vi?.title || c.title || c.titleUrl || 'Danh mục';
      categoryMap.set(String(c._id), title);
      if (c.titleUrl) categoryMap.set(c.titleUrl, title);
    }

    // Build user map for customer name lookup
    const userMap = new Map();
    for (const u of users) {
      userMap.set(String(u._id), u.fullName || u.name || u.email);
    }

    // Filter period orders and previous period orders
    const pStart = periodStart.getTime();
    const pEnd = periodEnd.getTime();
    const prevStartMs = prevStart.getTime();
    const prevEndMs = prevEnd.getTime();

    const periodOrders = orders.filter(o => {
      const t = getOrderTime(o);
      return t >= pStart && t <= pEnd;
    });

    const prevPeriodOrders = orders.filter(o => {
      const t = getOrderTime(o);
      return t >= prevStartMs && t <= prevEndMs;
    });

    const periodRevenue = periodOrders.filter(isOrderRevenueEligible).reduce((sum, o) => sum + getOrderAmount(o), 0);
    const prevPeriodRevenue = prevPeriodOrders.filter(isOrderRevenueEligible).reduce((sum, o) => sum + getOrderAmount(o), 0);
    const periodOrdersCount = periodOrders.length;
    const prevPeriodOrdersCount = prevPeriodOrders.length;

    // Timeline breakdown
    const revenueTimeline = [];
    const curDay = new Date(periodStart);
    while (curDay <= periodEnd) {
      const dStart = new Date(curDay.getFullYear(), curDay.getMonth(), curDay.getDate(), 0, 0, 0, 0).getTime();
      const dEnd = new Date(curDay.getFullYear(), curDay.getMonth(), curDay.getDate(), 23, 59, 59, 999).getTime();

      const dayOrders = orders.filter(o => {
        const t = getOrderTime(o);
        return t >= dStart && t <= dEnd;
      });

      const dayRevenue = dayOrders.filter(isOrderRevenueEligible).reduce((sum, o) => sum + getOrderAmount(o), 0);
      const label = `${String(curDay.getDate()).padStart(2, '0')}/${String(curDay.getMonth() + 1).padStart(2, '0')}`;
      const fullDate = `${label}/${curDay.getFullYear()}`;
      const dateStr = `${curDay.getFullYear()}-${String(curDay.getMonth() + 1).padStart(2, '0')}-${String(curDay.getDate()).padStart(2, '0')}`;

      revenueTimeline.push({
        label,
        date: dateStr,
        fullDate,
        revenue: dayRevenue,
        ordersCount: dayOrders.length
      });

      curDay.setDate(curDay.getDate() + 1);
    }

    // Orders By Status (for periodOrders, and also overall counts)
    const statusCounts = {};
    ORDER_STATUS_CONFIG.forEach(c => {
      statusCounts[c.key] = 0;
      statusCounts[c.code] = 0;
    });

    periodOrders.forEach(o => {
      const norm = normalizeOrderStatus(o.status || o.statusHistory?.[0]?.status);
      const cfg = ORDER_STATUS_CONFIG.find(c => c.code === norm);
      if (cfg) {
        statusCounts[cfg.key] = (statusCounts[cfg.key] || 0) + 1;
        statusCounts[cfg.code] = (statusCounts[cfg.code] || 0) + 1;
      }
    });

    const ordersByStatusList = ORDER_STATUS_CONFIG.map(c => ({
      code: c.code,
      key: c.key,
      label: c.label,
      queryParam: c.queryParam,
      count: statusCounts[c.key] || 0,
      variant: c.variant
    }));

    // Customer Users calculation (Exclude Admin & staff)
    const isCustomer = (u) => {
      if (u.isAdmin === true) return false;
      const roles = Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : (Array.isArray(u.role) ? u.role : (u.role ? [u.role] : [])));
      const hasAdmin = roles.some(r => typeof r === 'string' && (r.toLowerCase() === 'admin' || r.toLowerCase() === 'super-admin'));
      return !hasAdmin;
    };

    const customerUsers = users.filter(isCustomer);
    const usersCount = customerUsers.length;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    let new7Days = 0;
    let new30Days = 0;
    customerUsers.forEach(u => {
      const d = u.createdAt || u.dateAdded;
      if (d) {
        const ud = new Date(d);
        if (!isNaN(ud.getTime())) {
          if (ud >= sevenDaysAgo) new7Days++;
          if (ud >= thirtyDaysAgo) new30Days++;
        }
      }
    });

    // Inventory & Low Stock products
    let outOfStockCount = 0;
    let inStockCount = 0;
    let totalStock = 0;
    const lowStockProducts = [];

    products.forEach(p => {
      const vi = p.vi || {};
      let qty = 0;
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        qty = p.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
      } else if (typeof p.quantity === 'number') {
        qty = p.quantity;
      } else if (typeof vi.quantity === 'number') {
        qty = vi.quantity;
      } else if (typeof p.stock === 'number') {
        qty = p.stock;
      } else if (typeof vi.stock === 'number') {
        qty = vi.stock;
      }

      totalStock += qty;

      if (qty === 0 || vi.stock === 'outOfStock' || p.stock === 'outOfStock') {
        outOfStockCount++;
      } else {
        inStockCount++;
      }

      if (qty <= LOW_STOCK_THRESHOLD) {
        const rawCat = vi.categoryLevel1 || p.categoryLevel1;
        const catKey = Array.isArray(rawCat) ? rawCat[0] : rawCat;
        const catName = categoryMap.get(String(catKey)) || (typeof catKey === 'string' && catKey.trim() ? catKey.trim() : 'Thời trang nữ');

        lowStockProducts.push({
          id: String(p._id),
          name: vi.title || p.title || p.titleUrl || 'Sản phẩm',
          sku: p.variants?.[0]?.sku || vi.sku || p.sku || ('SP-' + String(p._id).slice(-6).toUpperCase()),
          stock: qty,
          price: vi.salePrice || vi.regularPrice || p.regularPrice || 0,
          image: p.mainImage?.url || (Array.isArray(p.images) ? p.images[0] : ''),
          category: catName
        });
      }
    });

    lowStockProducts.sort((a, b) => a.stock - b.stock);
    const topLowStock = lowStockProducts.slice(0, 5);

    // Top Selling Products (calculated from eligible orders)
    const productSalesMap = new Map();
    for (const o of orders) {
      if (!isOrderRevenueEligible(o)) continue;
      const items = (Array.isArray(o.items) && o.items.length > 0) ? o.items : (Array.isArray(o.cart?.items) ? o.cart.items : []);
      for (const it of items) {
        const pId = String(it.productId || it.productSnapshot?.sku || it.id || it.item?._id || it.item?.id || 'item');
        const name = it.name || it.productSnapshot?.name || it.productSnapshot?.title || it.item?.vi?.title || it.item?.title || 'Sản phẩm';
        const image = it.image || it.productSnapshot?.image || it.item?.mainImage?.url || (Array.isArray(it.item?.images) ? it.item.images[0] : '');
        const sku = it.sku || it.productSnapshot?.sku || it.item?.vi?.sku || it.item?.sku || '';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.unitPrice || it.price || it.item?.salePrice || 0);

        const existing = productSalesMap.get(pId) || {
          id: pId,
          name,
          title: name,
          sku,
          image,
          totalSold: 0,
          revenue: 0
        };
        existing.totalSold += qty;
        existing.revenue += qty * price;
        productSalesMap.set(pId, existing);
      }
    }

    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    // Recent Orders (5 latest orders)
    const recentOrders = orders.slice(0, 5).map(o => {
      let customerName = 'Khách hàng';
      if (o.customer?.name && o.customer.name.trim()) {
        customerName = o.customer.name.trim();
      } else if (o.shippingAddress?.fullName && o.shippingAddress.fullName.trim()) {
        customerName = o.shippingAddress.fullName.trim();
      } else if (typeof o.shippingAddress?.address === 'string' && o.shippingAddress.name) {
        customerName = o.shippingAddress.name.trim();
      } else if (Array.isArray(o.addresses) && o.addresses[0]?.name) {
        customerName = o.addresses[0].name.trim();
      } else if (o.userId && userMap.has(String(o.userId))) {
        customerName = userMap.get(String(o.userId));
      } else if (o._user && userMap.has(String(o._user))) {
        customerName = userMap.get(String(o._user));
      } else if (o.customerName && typeof o.customerName === 'string') {
        customerName = o.customerName;
      }

      const customerEmail = o.customerEmail || o.customer?.email || o.shippingAddress?.email || (Array.isArray(o.addresses) ? o.addresses[0]?.email : '') || '';
      const rawStatus = normalizeStatus(o.status || o.statusHistory?.[0]?.status);
      const statusCfg = ORDER_STATUS_CONFIG.find(c => c.code === rawStatus) || { label: rawStatus, variant: 'neutral' };
      const totalAmount = getOrderAmount(o);
      const createdAt = new Date(getOrderTime(o)).toISOString();

      return {
        _id: String(o._id),
        id: String(o._id),
        orderId: o.orderId || ('#DH' + String(o._id).slice(-6).toUpperCase()),
        code: o.orderId || ('#DH' + String(o._id).slice(-6).toUpperCase()),
        customerName,
        customer: customerName,
        customerEmail,
        totalAmount,
        total: totalAmount,
        status: statusCfg.label,
        statusLabel: statusCfg.label,
        statusCode: rawStatus,
        statusVariant: statusCfg.variant,
        createdAt,
        date: createdAt
      };
    });

    const inventory = {
      totalStock,
      inStockCount,
      outOfStockCount,
      lowStockCount: lowStockProducts.length
    };

    const system = {
      database: 'cheri',
      cluster: 'cluster0.cbvni8r.mongodb.net',
      mongodb: mongoStatus,
      mongodbStatusText: mongoStatusText,
      backend: 'Online',
      serverUrl: 'http://localhost:5000',
      productsInStock: inStockCount,
      activeCategories: categories.length,
      totalOrders: orders.length,
      totalUsers: users.length,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      stats: {
        totalRevenue: periodRevenue,
        prevPeriodRevenue,
        ordersCount: periodOrdersCount,
        prevPeriodOrdersCount,
        productsCount: products.length,
        categoriesCount: categories.length,
        usersCount,
        outOfStockCount,
        lowStockCount: lowStockProducts.length,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        revenueTimeline,
        timeRange,
        ordersByStatus: statusCounts,
        ordersByStatusList,
        topSellingProducts,
        lowStockProducts: topLowStock,
        recentOrders,
        inventory,
        customers: {
          total: usersCount,
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
  if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
    quantity = p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  } else if (langData.quantity !== undefined && langData.quantity !== null && langData.quantity !== '') {
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
    sku: p.sku || langData.sku || fallbackData.sku || '',
    description: langData.description || fallbackData.description || p.description || '',
    descriptionFull: langData.descriptionFull || fallbackData.descriptionFull || p.descriptionFull || [],
    rating: p.rating !== undefined ? p.rating : 5,
    colors: langData.colors || p.colors || fallbackData.colors || [],
    sizes: langData.sizes || p.sizes || fallbackData.sizes || [],
    hasColors: Boolean(langData.hasColors !== undefined ? langData.hasColors : (p.hasColors || false)),
    hasSizes: Boolean(langData.hasSizes !== undefined ? langData.hasSizes : (p.hasSizes || false)),
    hasClassification: Boolean(langData.hasClassification !== undefined ? langData.hasClassification : (p.hasClassification || false)),
    classifications: langData.classifications || p.classifications || fallbackData.classifications || [],
    variants: Array.isArray(p.variants) ? p.variants : [],
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
    const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : '';
    const status = req.query.status || '';
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const stockParam = req.query.stock || '';
    const sortParam = req.query.sort || 'newest';
    const lang = req.query.lang || req.headers['lang'] || 'vi';

    let categoryDoc = null;
    if (categoryId) {
      if (ObjectId.isValid(categoryId)) {
        categoryDoc = await db.collection('categories').findOne({ _id: new ObjectId(categoryId) });
      }
      if (!categoryDoc) {
        categoryDoc = await db.collection('categories').findOne({
          $or: [
            { titleUrl: categoryId },
            { 'vi.title': categoryId },
            { title: categoryId }
          ]
        });
      }
    } else if (category && category !== 'all') {
      categoryDoc = await db.collection('categories').findOne({
        $or: [
          { titleUrl: category },
          { 'vi.title': category },
          { title: category }
        ]
      });
    }

    const isCategoryNotFound = Boolean(categoryId && !categoryDoc);

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

    if (isCategoryNotFound) {
      queryConditions.push({ _id: null });
    } else if (categoryDoc) {
      const catName = categoryDoc.vi?.title || categoryDoc.title || categoryDoc.titleUrl || '';
      const catSlug = categoryDoc.titleUrl || '';
      const catConditions = [
        { 'vi.categoryLevel1': { $regex: catName, $options: 'i' } },
        { categoryLevel1: { $regex: catName, $options: 'i' } }
      ];
      if (catSlug) {
        catConditions.push({ titleUrl: { $regex: catSlug, $options: 'i' } });
      }
      queryConditions.push({ $or: catConditions });
    } else if (category && category !== 'all') {
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
      category: categoryDoc ? {
        id: categoryDoc._id.toString(),
        _id: categoryDoc._id.toString(),
        name: categoryDoc.vi?.title || categoryDoc.title || categoryDoc.titleUrl || '',
        slug: categoryDoc.titleUrl || ''
      } : null,
      categoryNotFound: isCategoryNotFound,
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
      for (const r of groupRows) {
        if (!r.errors.includes('Tên sản phẩm (vi.title) không được để trống.')) {
          r.errors.push('Tên sản phẩm (vi.title) không được để trống.');
        }
        r.status = 'error';
      }
    }
    if (!category1) {
      for (const r of groupRows) {
        if (!r.errors.includes('Danh mục cấp 1 (vi.categoryLevel1) không được để trống.')) {
          r.errors.push('Danh mục cấp 1 (vi.categoryLevel1) không được để trống.');
        }
        r.status = 'error';
      }
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
      const validVariants = [];
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

        if (row.errors.length > 0) {
          row.status = 'error';
        } else {
          row.status = 'valid';
          if (row.classification) classSet.add(row.classification);
          if (row.color) colorSet.add(row.color);
          if (row.size) sizeSet.add(row.size);

          validVariants.push({
            sku: vSku || `SKU-${i + 1}`,
            classification: row.classification || '',
            color: row.color || '',
            size: row.size || '',
            price: vPrice >= 0 ? vPrice : 0,
            discountPrice: vDiscount >= 0 ? vDiscount : 0,
            stock: vStock >= 0 ? vStock : 0
          });
        }
      }

      // Only import product if it has valid variants and title/category
      if (validVariants.length > 0 && title && category1) {
        // Quantity is strictly SUM of valid variant stocks
        const totalQuantity = validVariants.reduce((sum, v) => sum + v.stock, 0);
        const stockStatus = totalQuantity > 0 ? 'onStock' : 'outOfStock';
        const minPrice = validVariants.length > 0 ? Math.min(...validVariants.map(v => v.price)) : 0;
        const discountedVariants = validVariants.filter(v => v.discountPrice > 0 && v.discountPrice < v.price);
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
          variants: validVariants,
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
      }

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

      if (row.errors.length > 0) {
        row.status = 'error';
      } else {
        row.status = 'valid';
      }

      // Only import simple product if row is valid and has title & category
      if (row.status === 'valid' && title && category1) {
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
  }

  // Update row status and counts
  let totalErrors = 0;
  for (const r of previewRows) {
    if (r.errors.length > 0) {
      r.status = 'error';
      totalErrors++;
    } else {
      r.status = 'valid';
    }
  }

  const validRowsCount = previewRows.length - totalErrors;

  return {
    success: true,
    summary: {
      totalRows: previewRows.length,
      validRows: validRowsCount,
      errorRows: totalErrors,
      totalProducts: validatedProducts.length,
      newProducts: validatedProducts.filter(p => !p.isUpdate).length,
      updateProducts: validatedProducts.filter(p => p.isUpdate).length
    },
    rows: previewRows,
    products: validatedProducts,
    canImport: validRowsCount > 0
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
      if (!validated.canImport || validated.products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu CSV không có dòng hợp lệ nào để nhập vào MongoDB.',
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
    const categoriesRaw = await db.collection('categories').find({}).sort({ 'vi.position': 1, _id: 1 }).toArray();
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
        position: typeof langObj.position === 'number' ? langObj.position : (typeof c.vi?.position === 'number' ? c.vi.position : (typeof c.position === 'number' ? c.position : 0)),
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

// Helper function to reorder sibling categories based on parentId scope
async function reorderSiblingCategories(db, { categoryId, parentIdObj, newPosition, oldPosition = null, oldParentIdObj = null }) {
  const currentParentQuery = parentIdObj ? parentIdObj : null;
  const oldParentQuery = oldParentIdObj ? oldParentIdObj : null;

  const isParentChanged = categoryId && String(currentParentQuery) !== String(oldParentQuery);

  if (isParentChanged) {
    // 1. Shift up siblings in the OLD parent group (fill the gap)
    if (typeof oldPosition === 'number') {
      await db.collection('categories').updateMany(
        {
          parentId: oldParentQuery,
          _id: { $ne: new ObjectId(categoryId) },
          'vi.position': { $gt: oldPosition }
        },
        { $inc: { 'vi.position': -1 } }
      );
    }
    // 2. Shift down siblings in the NEW parent group (make room for newPosition)
    await db.collection('categories').updateMany(
      {
        parentId: currentParentQuery,
        _id: { $ne: new ObjectId(categoryId) },
        'vi.position': { $gte: newPosition }
      },
      { $inc: { 'vi.position': 1 } }
    );
    return;
  }

  // Same parent group (or newly created category)
  if (!categoryId) {
    // CREATE: shift down any sibling with position >= newPosition
    await db.collection('categories').updateMany(
      {
        parentId: currentParentQuery,
        'vi.position': { $gte: newPosition }
      },
      { $inc: { 'vi.position': 1 } }
    );
    return;
  }

  // UPDATE in same parent group:
  if (oldPosition === null || oldPosition === undefined) {
    await db.collection('categories').updateMany(
      {
        parentId: currentParentQuery,
        _id: { $ne: new ObjectId(categoryId) },
        'vi.position': { $gte: newPosition }
      },
      { $inc: { 'vi.position': 1 } }
    );
    return;
  }

  if (newPosition === oldPosition) {
    return;
  }

  if (newPosition > oldPosition) {
    // Dịch lên: các category có position > oldPosition và <= newPosition giảm 1
    // (ví dụ: A từ 3 -> 5; các category 4 -> 3, 5 -> 4; sau đó A thành 5)
    await db.collection('categories').updateMany(
      {
        parentId: currentParentQuery,
        _id: { $ne: new ObjectId(categoryId) },
        'vi.position': { $gt: oldPosition, $lte: newPosition }
      },
      { $inc: { 'vi.position': -1 } }
    );
  } else {
    // newPosition < oldPosition
    // Đẩy xuống: các category có position >= newPosition và < oldPosition tăng 1
    // (ví dụ: A từ 5 -> 2; các category 2 -> 3, 3 -> 4, 4 -> 5; sau đó A thành 2)
    await db.collection('categories').updateMany(
      {
        parentId: currentParentQuery,
        _id: { $ne: new ObjectId(categoryId) },
        'vi.position': { $gte: newPosition, $lt: oldPosition }
      },
      { $inc: { 'vi.position': 1 } }
    );
  }
}

app.get('/api/categories', async (req, res) => {
  try {
    const categoriesRaw = await db.collection('categories').find({}).sort({ 'vi.position': 1, _id: 1 }).toArray();
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
      const position = typeof c.vi?.position === 'number' ? c.vi.position : (typeof c.position === 'number' ? c.position : 0);
      return {
        id: c._id.toString(),
        _id: c._id.toString(),
        name,
        slug: c.titleUrl || '',
        productCount: productCount || 0,
        position,
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

    // Parse and validate position (integer >= 0)
    const rawPos = vi.position !== undefined ? vi.position : body.position;
    const parsedPos = parseInt(rawPos, 10);
    const position = Number.isInteger(parsedPos) && parsedPos >= 0 ? parsedPos : 0;

    // Reorder siblings in the same parent group to avoid duplicate position
    await reorderSiblingCategories(db, {
      categoryId: null,
      parentIdObj,
      newPosition: position
    });

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
        position: position,
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

    const oldCat = await db.collection('categories').findOne({ _id: new ObjectId(id) });
    if (!oldCat) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }
    const oldVi = oldCat.vi || {};
    const oldTitle = oldVi.title || oldCat.title;
    const oldPosition = typeof oldVi.position === 'number' ? oldVi.position : (typeof oldCat.position === 'number' ? oldCat.position : 0);
    const oldParentIdObj = oldCat.parentId || null;

    let parentIdObj = null;
    if (body.parentId && body.parentId.trim() && ObjectId.isValid(body.parentId.trim()) && body.parentId.trim() !== id) {
      const parent = await db.collection('categories').findOne({ _id: new ObjectId(body.parentId.trim()) });
      if (parent) {
        parentIdObj = parent._id;
      }
    }

    // Parse and validate position (integer >= 0)
    const rawPos = vi.position !== undefined ? vi.position : body.position;
    const parsedPos = parseInt(rawPos, 10);
    const position = Number.isInteger(parsedPos) && parsedPos >= 0 ? parsedPos : oldPosition;

    // Reorder siblings in the parent group to avoid duplicate positions
    await reorderSiblingCategories(db, {
      categoryId: id,
      parentIdObj,
      newPosition: position,
      oldPosition,
      oldParentIdObj
    });

    const mainImageUrl = body.mainImage?.url !== undefined ? body.mainImage.url : (body.image || oldCat.mainImage?.url || '');
    const mainImageName = body.mainImage?.name || title;

    // Preserve existing vi fields if not explicitly overridden
    const description = vi.description !== undefined ? String(vi.description).trim() : (body.description !== undefined ? String(body.description).trim() : (oldVi.description || ''));
    const visibility = vi.visibility !== undefined ? vi.visibility : (body.visibility !== undefined ? body.visibility : (oldVi.visibility !== false));
    const menuHidden = vi.menuHidden !== undefined ? !!vi.menuHidden : (oldVi.menuHidden !== undefined ? !!oldVi.menuHidden : false);

    const updateFields = {
      titleUrl: slug,
      'mainImage.url': mainImageUrl,
      'mainImage.name': mainImageName,
      parentId: parentIdObj,
      updatedAt: new Date().toISOString(),
      'vi.title': title,
      'vi.description': description,
      'vi.position': position,
      'vi.visibility': visibility,
      'vi.menuHidden': menuHidden
    };

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
        slug,
        position
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
      return res.status(400).json({ success: false, message: 'ID danh mục không hợp lệ' });
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

    // Shift up remaining siblings in same parent group
    if (typeof categoryToDelete?.vi?.position === 'number') {
      const parentQuery = categoryToDelete.parentId ? categoryToDelete.parentId : null;
      await db.collection('categories').updateMany(
        {
          parentId: parentQuery,
          _id: { $ne: new ObjectId(id) },
          'vi.position': { $gt: categoryToDelete.vi.position }
        },
        { $inc: { 'vi.position': -1 } }
      );
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
  CANCELLED: [], // final state
  RETURNED: []
};

const ORDER_STATUS_MAP = Object.fromEntries(
  ORDER_STATUS_CONFIG.map(({ code, label, variant }) => [code, { label, variant }])
);

function getFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUsableNormalizedItem(item) {
  if (!item || typeof item !== 'object' || !item.productSnapshot || typeof item.productSnapshot !== 'object') {
    return false;
  }

  return Boolean(
    getNonEmptyString(item.productSnapshot.title)
    || getNonEmptyString(item.productSnapshot.sku)
    || item.productId != null
  );
}

function normalizeOrderItem(item) {
  if (!item || typeof item !== 'object') return item;

  // Keep the original item shape intact. The additive aliases let the Admin
  // detail page consume normalized and legacy orders without losing snapshots.
  const legacyProduct = item.item && typeof item.item === 'object' ? item.item : {};
  const firstLegacyImage = Array.isArray(legacyProduct.images) ? legacyProduct.images[0] : null;
  const legacyImage = legacyProduct.mainImage?.url
    || (typeof firstLegacyImage === 'string' ? firstLegacyImage : firstLegacyImage?.url)
    || '';
  const quantity = getFiniteNumber(item.quantity) ?? getFiniteNumber(item.qty);
  const unitPrice = getFiniteNumber(item.unitPrice) ?? getFiniteNumber(item.price);
  const explicitSubtotal = getFiniteNumber(item.subtotal);
  const subtotal = explicitSubtotal ?? (
    quantity !== null && unitPrice !== null ? quantity * unitPrice : null
  );

  if (isUsableNormalizedItem(item)) {
    return {
      ...item,
      quantity,
      unitPrice,
      subtotal
    };
  }

  return {
    ...item,
    productId: item.productId ?? item.id ?? legacyProduct._id ?? null,
    variantId: item.variantId ?? null,
    productSnapshot: {
      title: legacyProduct.title || item.title || legacyProduct.name || legacyProduct.titleUrl?.replace(/-/g, ' ') || '',
      sku: legacyProduct.sku || item.sku || '',
      image: legacyImage,
      variant: {
        color: Array.isArray(legacyProduct.colors) ? legacyProduct.colors.join(', ') : (legacyProduct.color || ''),
        size: Array.isArray(legacyProduct.sizes) ? legacyProduct.sizes.join(', ') : (legacyProduct.size || ''),
        classification: legacyProduct.productType || legacyProduct.classification || ''
      }
    },
    quantity,
    unitPrice,
    subtotal
  };
}

function getLegacyPaymentCode(order) {
  const sellerMessage = typeof order.outcome?.seller_message === 'string'
    ? order.outcome.seller_message.trim().toUpperCase()
    : '';

  if (sellerMessage === 'MOMO') return 'MOMO';
  if (['BANK', 'TRANSFER', 'BANK_TRANSFER'].includes(sellerMessage)) return 'BANK_TRANSFER';
  if (['COD', 'CASH ON DELIVERY', 'CASH_ON_DELIVERY', 'PAYMENT_ON_DELIVERY'].includes(sellerMessage)) return 'COD';
  return null;
}

function getLegacyPaymentDisplay(order) {
  const paymentCode = getLegacyPaymentCode(order);
  if (paymentCode === 'MOMO') return 'MoMo';
  if (paymentCode === 'BANK_TRANSFER') return 'Chuyển khoản';
  if (paymentCode === 'COD') return 'COD';
  return null;
}

function formatOrder(o) {
  const mongoId = o._id?.toString?.() || '';
  const fallbackOrderCode = mongoId ? '#DH' + mongoId.slice(-6).toUpperCase() : '';
  const orderCode = o.orderId || fallbackOrderCode;

  const normalizedItems = Array.isArray(o.items) ? o.items.filter(isUsableNormalizedItem) : [];
  const legacyItems = Array.isArray(o.cart?.items)
    ? o.cart.items.filter(item => item && typeof item === 'object')
    : [];
  const usesNormalizedItems = normalizedItems.length > 0;
  const sourceItems = usesNormalizedItems ? normalizedItems : legacyItems;
  const items = sourceItems.map(normalizeOrderItem);
  const allItemQuantitiesKnown = items.every(item => getFiniteNumber(item?.quantity) !== null);
  const computedItemsCount = allItemQuantitiesKnown
    ? items.reduce((total, item) => total + item.quantity, 0)
    : null;
  const legacyTotalQty = getFiniteNumber(o.cart?.totalQty);
  const itemsCount = !usesNormalizedItems && legacyTotalQty !== null
    ? legacyTotalQty
    : computedItemsCount;

  const shippingAddress = o.shippingAddress && typeof o.shippingAddress === 'object'
    ? o.shippingAddress
    : null;
  const legacyAddress = Array.isArray(o.addresses) ? (o.addresses[0] || {}) : {};
  const customerName = getNonEmptyString(shippingAddress?.fullName)
    || getNonEmptyString(legacyAddress.fullName)
    || getNonEmptyString(legacyAddress.name);
  const customerEmail = getNonEmptyString(o.customerEmail)
    || getNonEmptyString(legacyAddress.email);
  const customerPhone = getNonEmptyString(o.customerPhone)
    || getNonEmptyString(shippingAddress?.phone)
    || getNonEmptyString(legacyAddress.phone);

  const statusHistory = Array.isArray(o.statusHistory) ? o.statusHistory : [];
  const rawStatusValue = getNonEmptyString(o.status)
    || getNonEmptyString(statusHistory[0]?.status)
    || '';
  const statusCode = rawStatusValue.toUpperCase();
  const statusMeta = ORDER_STATUS_MAP[statusCode];
  const statusText = statusMeta?.label || statusCode || '';

  const normalizedPayment = getNonEmptyString(o.paymentMethodSnapshot?.name)
    || getNonEmptyString(o.paymentMethodSnapshot?.code)
    || getNonEmptyString(o.paymentProvider);
  const payment = normalizedPayment || getLegacyPaymentDisplay(o);
  const explicitPaymentMethodCode = getNonEmptyString(o.paymentMethodSnapshot?.code)
    || getNonEmptyString(o.paymentMethodCode);
  const paymentMethodCode = explicitPaymentMethodCode
    ? explicitPaymentMethodCode.toUpperCase()
    : (o.paymentMethodId != null ? null : getLegacyPaymentCode(o));

  const totalPrice = getFiniteNumber(o.totalAmount)
    ?? getFiniteNumber(o.cart?.totalPrice)
    ?? getFiniteNumber(o.amount);
  const createdDate = o.createdAt ?? o.dateAdded ?? null;
  const shippingFee = getFiniteNumber(o.shippingFee)
    ?? getFiniteNumber(o.shippingMethodSnapshot?.fee)
    ?? getFiniteNumber(o.cart?.shippingCost);
  const paymentFee = getFiniteNumber(o.paymentFee)
    ?? getFiniteNumber(o.paymentMethodSnapshot?.paymentFee);
  const refundedAmount = getFiniteNumber(o.refundedAmount)
    ?? getFiniteNumber(o.amount_refunded);

  return {
    id: mongoId,
    _id: mongoId,
    userId: o.userId?.toString?.() || o._user?.toString?.() || null,
    orderId: orderCode,
    code: orderCode,
    customer: customerName,
    customerEmail,
    customerPhone,
    phone: customerPhone,
    total: totalPrice,
    amount: getFiniteNumber(o.amount) ?? totalPrice,
    currency: o.currency || null,
    type: o.type || null,
    notes: o.notes || '',
    items,
    itemsCount,
    payment,
    paymentMethodCode,
    paymentMethodId: o.paymentMethodId ?? null,
    paymentMethodSnapshot: o.paymentMethodSnapshot ?? null,
    paymentStatus: o.paymentStatus ?? null,
    transactionId: o.transactionId || null,
    paymentProvider: o.paymentProvider || null,
    paymentFee,
    paidAt: o.paidAt ?? null,
    refundedAmount,
    refundedAt: o.refundedAt ?? null,
    shippingAddress,
    shippingMethodId: o.shippingMethodId ?? null,
    shippingMethodSnapshot: o.shippingMethodSnapshot ?? null,
    shipping: o.shipping || null,
    shippingFee,
    shippingProvider: o.shippingProvider || o.shipping?.provider || null,
    trackingNumber: o.trackingNumber || null,
    estimatedDeliveryDate: o.estimatedDeliveryDate ?? null,
    shippedAt: o.shippedAt ?? null,
    deliveredAt: o.deliveredAt ?? null,
    subtotal: getFiniteNumber(o.subtotal),
    discountAmount: getFiniteNumber(o.discountAmount),
    taxAmount: getFiniteNumber(o.taxAmount),
    couponCode: o.couponCode || null,
    couponDiscount: getFiniteNumber(o.couponDiscount),
    totalAmount: totalPrice,
    statusCode,
    rawStatus: statusCode || null,
    status: statusText,
    statusText,
    statusVariant: statusMeta?.variant || 'neutral',
    dateAdded: createdDate,
    createdAt: createdDate,
    updatedAt: o.updatedAt ?? null,
    cart: o.cart || { items: [], totalQty: 0, totalPrice: null },
    addresses: Array.isArray(o.addresses) ? o.addresses : [],
    outcome: o.outcome || {},
    statusHistory,
    raw: o
  };
}

function normalizeOrderQueryValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : '';
}

function getFormattedOrderPaymentValues(order, paymentMethodCodeById = new Map()) {
  const values = new Set();
  const paymentCode = normalizeOrderQueryValue(order?.paymentMethodCode);
  if (paymentCode) values.add(paymentCode);

  const paymentMethodId = order?.paymentMethodId?.toString?.() || '';
  if (paymentMethodId) {
    values.add(normalizeOrderQueryValue(paymentMethodId));
    const mappedCode = paymentMethodCodeById.get(paymentMethodId);
    if (mappedCode) values.add(normalizeOrderQueryValue(mappedCode));
  }

  return values;
}

function getFormattedOrderStatusCode(order) {
  const value = normalizeOrderQueryValue(order?.statusCode);
  if (Object.hasOwn(ORDER_STATUS_MAP, value)) return value;

  return ORDER_STATUS_CONFIG.find(status =>
    normalizeOrderQueryValue(status.label) === value
    || normalizeOrderQueryValue(status.queryParam) === value
  )?.code || '';
}

function queryFormattedOrders(formattedOrders, query = {}, paymentMethodCodeById = new Map()) {
  const parsedPage = Number.parseInt(String(query.page ?? ''), 10);
  const parsedLimit = Number.parseInt(String(query.limit ?? ''), 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
  const requestedStatus = normalizeOrderQueryValue(query.status);
  const status = Object.hasOwn(ORDER_STATUS_MAP, requestedStatus) ? requestedStatus : '';
  const paymentMethod = normalizeOrderQueryValue(query.paymentMethod);

  let filtered = Array.isArray(formattedOrders) ? formattedOrders : [];

  if (search) {
    filtered = filtered.filter(order => [order?.code, order?.customer, order?.payment]
      .some(value => String(value ?? '').toLowerCase().includes(search)));
  }
  if (status) {
    filtered = filtered.filter(order => getFormattedOrderStatusCode(order) === status);
  }
  if (paymentMethod) {
    filtered = filtered.filter(order =>
      getFormattedOrderPaymentValues(order, paymentMethodCodeById).has(paymentMethod)
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    data: filtered.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages }
  };
}

// 4.0 POST /api/admin/orders (Create normalized guest order from Admin)
const ADMIN_ORDER_ID_MAX_ATTEMPTS = 5;

class AdminOrderValidationError extends Error {}

function requireAdminOrderString(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AdminOrderValidationError(message);
  }
  return value.trim();
}

function optionalAdminOrderString(value, message) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new AdminOrderValidationError(message);
  }
  return value.trim();
}

function isAdminPaymentMethodActive(method) {
  if (typeof method?.isActive === 'boolean') return method.isActive;
  return String(method?.status || '').trim().toUpperCase() === 'ACTIVE';
}

function getAdminOrderPaymentFee(method, subtotal) {
  const fee = method?.transactionFee;
  if (!fee?.enabled) return 0;

  const type = String(fee.type || '').trim().toUpperCase();
  if (!['FIXED', 'PERCENTAGE'].includes(type)) {
    throw new AdminOrderValidationError('Cấu hình phí thanh toán không hợp lệ');
  }
  const value = parseAdminOrderNumber(fee.value, 'Cấu hình phí thanh toán không hợp lệ');

  return type === 'PERCENTAGE'
    ? Math.round((subtotal * value) / 100)
    : value;
}

function getFirstAdminOrderString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function parseAdminOrderNumber(value, message) {
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      throw new AdminOrderValidationError(message);
    }
    number = Number(normalized);
  } else {
    throw new AdminOrderValidationError(message);
  }
  if (!Number.isFinite(number) || number < 0) {
    throw new AdminOrderValidationError(message);
  }
  return number;
}

function getAdminOrderNumber(candidates, message) {
  for (const candidate of candidates) {
    const value = candidate.value;
    if (value === undefined || value === null || value === '') continue;
    const number = parseAdminOrderNumber(value, message);
    return { value: number, path: candidate.path };
  }
  return null;
}

function resolveAdminOrderProduct(product) {
  const title = getFirstAdminOrderString(product?.vi?.title, product?.en?.title, product?.title);
  if (!title) {
    throw new AdminOrderValidationError('Tên sản phẩm không hợp lệ');
  }

  const salePrice = getAdminOrderNumber([
    { value: product?.vi?.salePrice, path: 'vi.salePrice' },
    { value: product?.en?.salePrice, path: 'en.salePrice' },
    { value: product?.salePrice, path: 'salePrice' }
  ], 'Giá sản phẩm không hợp lệ');
  const regularPrice = salePrice || getAdminOrderNumber([
    { value: product?.vi?.regularPrice, path: 'vi.regularPrice' },
    { value: product?.en?.regularPrice, path: 'en.regularPrice' },
    { value: product?.regularPrice, path: 'regularPrice' }
  ], 'Giá sản phẩm không hợp lệ');
  if (!regularPrice) {
    throw new AdminOrderValidationError('Không tìm thấy giá hợp lệ cho sản phẩm');
  }

  const stock = getAdminOrderNumber([
    { value: product?.vi?.quantity, path: 'vi.quantity' },
    { value: product?.en?.quantity, path: 'en.quantity' },
    { value: product?.quantity, path: 'quantity' }
  ], 'Tồn kho sản phẩm không hợp lệ');
  if (!stock) {
    throw new AdminOrderValidationError('Không tìm thấy tồn kho hợp lệ cho sản phẩm');
  }

  const productId = product?._id?.toString?.() || '';
  return {
    title,
    price: regularPrice.value,
    stock: stock.value,
    stockPath: stock.path,
    sku: getFirstAdminOrderString(product?.sku, product?.vi?.sku, product?.en?.sku)
      || (productId ? `SP-${productId.slice(-6).toUpperCase()}` : ''),
    image: getFirstAdminOrderString(product?.mainImage?.url, product?.images?.[0])
  };
}

function getAdminOrderVariantIdentifier(variant) {
  const id = variant?._id?.toHexString?.();
  if (id) return { field: '_id', value: id, rawValue: variant._id };
  const legacyId = getFirstAdminOrderString(variant?.id);
  if (legacyId) return { field: 'id', value: legacyId, rawValue: variant.id };
  const sku = getFirstAdminOrderString(variant?.sku);
  if (sku) return { field: 'sku', value: sku, rawValue: variant.sku };
  return null;
}

function resolveAdminOrderVariantPrice(variant, productPrice) {
  const discountPrice = getAdminOrderNumber([
    { value: variant?.discountPrice, path: 'discountPrice' }
  ], 'Giá khuyến mãi của biến thể không hợp lệ');
  if (discountPrice && discountPrice.value > 0) return discountPrice.value;

  const price = getAdminOrderNumber([
    { value: variant?.price, path: 'price' }
  ], 'Giá biến thể không hợp lệ');
  return price ? price.value : productPrice;
}

app.post('/api/admin/orders', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AdminOrderValidationError('Dữ liệu đơn hàng không hợp lệ');
    }

    const customerEmail = requireAdminOrderString(body.customerEmail, 'Email khách hàng là bắt buộc');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new AdminOrderValidationError('Email khách hàng không hợp lệ');
    }
    const customerPhone = optionalAdminOrderString(body.customerPhone, 'Số điện thoại khách hàng không hợp lệ');
    const notes = optionalAdminOrderString(body.notes, 'Ghi chú không hợp lệ');

    const addressInput = body.shippingAddress;
    if (!addressInput || typeof addressInput !== 'object' || Array.isArray(addressInput)) {
      throw new AdminOrderValidationError('Địa chỉ giao hàng không hợp lệ');
    }
    const shippingAddress = {
      fullName: requireAdminOrderString(addressInput.fullName, 'Họ tên người nhận là bắt buộc'),
      phone: requireAdminOrderString(addressInput.phone, 'Số điện thoại người nhận là bắt buộc'),
      address: requireAdminOrderString(addressInput.address, 'Địa chỉ giao hàng là bắt buộc'),
      ward: optionalAdminOrderString(addressInput.ward, 'Phường/xã không hợp lệ'),
      district: optionalAdminOrderString(addressInput.district, 'Quận/huyện không hợp lệ'),
      province: optionalAdminOrderString(addressInput.province, 'Tỉnh/thành phố không hợp lệ')
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new AdminOrderValidationError('Đơn hàng phải có ít nhất một sản phẩm');
    }

    const requestedItems = body.items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new AdminOrderValidationError(`Sản phẩm #${index + 1} không hợp lệ`);
      }
      if (!ObjectId.isValid(item.productId)) {
        throw new AdminOrderValidationError(`Mã sản phẩm #${index + 1} không hợp lệ`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new AdminOrderValidationError(`Số lượng sản phẩm #${index + 1} phải là số nguyên lớn hơn 0`);
      }
      if (item.variantId !== undefined && item.variantId !== null
        && (typeof item.variantId !== 'string' || !item.variantId.trim())) {
        throw new AdminOrderValidationError(`Mã biến thể sản phẩm #${index + 1} không hợp lệ`);
      }
      const productObjectId = new ObjectId(item.productId);
      return {
        productId: productObjectId.toHexString(),
        variantId: item.variantId === undefined || item.variantId === null ? null : item.variantId.trim(),
        quantity: item.quantity
      };
    });

    if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && !ObjectId.isValid(body.paymentMethodId)) {
      throw new AdminOrderValidationError('Mã phương thức thanh toán không hợp lệ');
    }

    const productCache = new Map();
    const variantsCache = new Map();
    const resolvedItems = [];
    const inventoryRequests = new Map();

    for (const requestedItem of requestedItems) {
      let product = productCache.get(requestedItem.productId);
      if (!product) {
        product = await db.collection('products').findOne({ _id: new ObjectId(requestedItem.productId) });
        if (!product) {
          throw new AdminOrderValidationError('Không tìm thấy sản phẩm đã chọn');
        }
        if (product.visibility === false || product.vi?.visibility === false) {
          throw new AdminOrderValidationError(`Sản phẩm "${product.title || product.vi?.title || 'Sản phẩm'}" hiện không thể bán`);
        }
        productCache.set(requestedItem.productId, product);
      }

      const productData = resolveAdminOrderProduct(product);

      let variantSource = variantsCache.get(requestedItem.productId);
      if (!variantSource) {
        const collectionVariants = await db.collection('product_variants')
          .find({ productId: new ObjectId(requestedItem.productId) })
          .toArray();
        variantSource = collectionVariants.length > 0
          ? { type: 'collection', variants: collectionVariants }
          : { type: 'embedded', variants: Array.isArray(product.variants) ? product.variants : [] };
        variantsCache.set(requestedItem.productId, variantSource);
      }
      const activeVariants = variantSource.variants.filter(variant => variant?.isActive !== false);
      const hasVariants = variantSource.variants.length > 0;

      let variant = null;
      let variantIdentifier = null;
      let requestedVariantId = requestedItem.variantId;
      if (hasVariants) {
        if (activeVariants.length === 0) {
          throw new AdminOrderValidationError('Sản phẩm không có biến thể đang hoạt động');
        }
        if (!requestedItem.variantId) {
          throw new AdminOrderValidationError('Vui lòng chọn biến thể cho sản phẩm');
        }
        if (variantSource.type === 'collection' && !ObjectId.isValid(requestedItem.variantId)) {
          throw new AdminOrderValidationError('Mã biến thể sản phẩm không hợp lệ');
        }
        if (variantSource.type === 'collection') {
          requestedVariantId = new ObjectId(requestedItem.variantId).toHexString();
        }
        const variantsWithIdentifiers = variantSource.variants.map(item => ({
          variant: item,
          identifier: getAdminOrderVariantIdentifier(item)
        }));
        if (variantsWithIdentifiers.some(item => !item.identifier)) {
          throw new AdminOrderValidationError('Dữ liệu biến thể sản phẩm không hợp lệ');
        }
        const uniqueVariantIdentifiers = new Set(variantsWithIdentifiers.map(item => item.identifier.value));
        if (uniqueVariantIdentifiers.size !== variantsWithIdentifiers.length) {
          throw new AdminOrderValidationError('Mã định danh biến thể sản phẩm bị trùng');
        }
        variant = variantsWithIdentifiers.find(item => item.identifier.value === requestedVariantId)?.variant || null;
        if (!variant) {
          throw new AdminOrderValidationError('Không tìm thấy biến thể đã chọn');
        }
        variantIdentifier = getAdminOrderVariantIdentifier(variant);
        if (variant.isActive === false) {
          throw new AdminOrderValidationError('Biến thể đã chọn hiện không hoạt động');
        }
        if (variantSource.type === 'collection'
          && variant.productId?.toHexString?.() !== requestedItem.productId) {
          throw new AdminOrderValidationError('Biến thể không thuộc sản phẩm đã chọn');
        }
      } else if (requestedItem.variantId) {
        throw new AdminOrderValidationError('Sản phẩm đã chọn không sử dụng biến thể này');
      }

      const unitPrice = variant
        ? resolveAdminOrderVariantPrice(variant, productData.price)
        : productData.price;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new AdminOrderValidationError('Giá sản phẩm không hợp lệ');
      }

      const variantStock = variant
        ? getAdminOrderNumber([{ value: variant.stock, path: 'stock' }], 'Tồn kho sản phẩm không hợp lệ')
        : null;
      if (variant && !variantStock) {
        throw new AdminOrderValidationError('Không tìm thấy tồn kho hợp lệ cho biến thể');
      }
      const availableStock = variant ? variantStock.value : productData.stock;

      const inventoryKey = variant
        ? `variant:${variantSource.type}:${requestedItem.productId}:${variantIdentifier.value}`
        : `product:${requestedItem.productId}:${productData.stockPath}`;
      const currentRequest = inventoryRequests.get(inventoryKey) || {
        type: variant ? variantSource.type : 'product',
        productId: requestedItem.productId,
        variantId: variantSource.type === 'collection' && variant ? requestedVariantId : null,
        variantIdentifier,
        stockPath: variant ? 'stock' : productData.stockPath,
        availableStock,
        quantity: 0
      };
      currentRequest.quantity += requestedItem.quantity;
      inventoryRequests.set(inventoryKey, currentRequest);

      const snapshot = {
        title: productData.title,
        sku: getFirstAdminOrderString(variant?.sku, productData.sku),
        image: productData.image
      };
      if (variant) {
        snapshot.variant = {
          color: variant.color || '',
          size: variant.size || '',
          classification: variant.classification || ''
        };
      }

      resolvedItems.push({
        productId: new ObjectId(requestedItem.productId),
        variantId: variantSource.type === 'collection' && variant ? new ObjectId(requestedVariantId) : null,
        productSnapshot: snapshot,
        quantity: requestedItem.quantity,
        unitPrice,
        subtotal: unitPrice * requestedItem.quantity
      });
    }

    for (const request of inventoryRequests.values()) {
      if (request.quantity > request.availableStock) {
        throw new AdminOrderValidationError('Số lượng yêu cầu vượt quá tồn kho hiện có');
      }
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      throw new AdminOrderValidationError('Tạm tính đơn hàng không hợp lệ');
    }

    let paymentMethodId = null;
    let paymentMethodSnapshot = null;
    let paymentFee = 0;
    if (body.paymentMethodId !== undefined && body.paymentMethodId !== null) {
      const paymentMethod = await db.collection('payment_methods')
        .findOne({ _id: new ObjectId(String(body.paymentMethodId)) });
      if (!paymentMethod) {
        throw new AdminOrderValidationError('Không tìm thấy phương thức thanh toán');
      }
      if (!isAdminPaymentMethodActive(paymentMethod)) {
        throw new AdminOrderValidationError('Phương thức thanh toán hiện không hoạt động');
      }
      const paymentName = requireAdminOrderString(paymentMethod.name, 'Tên phương thức thanh toán không hợp lệ');
      const paymentCode = requireAdminOrderString(paymentMethod.code, 'Mã phương thức thanh toán không hợp lệ').toUpperCase();
      const paymentType = requireAdminOrderString(
        paymentMethod.paymentType || paymentMethod.type,
        'Loại phương thức thanh toán không hợp lệ'
      );
      paymentFee = getAdminOrderPaymentFee(paymentMethod, subtotal);
      paymentMethodId = new ObjectId(String(body.paymentMethodId));
      paymentMethodSnapshot = {
        name: paymentName,
        code: paymentCode,
        paymentType,
        paymentFee
      };
    }

    const totalAmount = subtotal + paymentFee;
    const now = new Date();
    const baseOrder = {
      _user: null,
      customerEmail,
      customerPhone,
      status: 'PENDING',
      notes,
      items: resolvedItems,
      shippingAddress,
      shippingMethodId: null,
      shippingMethodSnapshot: null,
      shippingFee: 0,
      shippingProvider: '',
      trackingNumber: '',
      estimatedDeliveryDate: null,
      shippedAt: null,
      deliveredAt: null,
      paymentMethodId,
      paymentMethodSnapshot,
      paymentStatus: 'PENDING',
      transactionId: '',
      paymentProvider: '',
      paymentFee,
      paidAt: null,
      refundedAmount: 0,
      refundedAt: null,
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      couponCode: '',
      couponDiscount: 0,
      totalAmount,
      currency: 'VND',
      statusHistory: [{
        status: 'PENDING',
        updatedAt: now,
        updatedBy: null,
        note: 'Đơn hàng vừa được tạo'
      }],
      createdAt: now,
      updatedAt: now
    };

    let createdOrder = null;
    let insertedId = null;
    for (let attempt = 0; attempt < ADMIN_ORDER_ID_MAX_ATTEMPTS; attempt += 1) {
      const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const orderId = `CHE${Date.now()}${suffix}`;
      const collision = await db.collection('orders').findOne({ orderId });
      if (collision) continue;

      const candidate = { orderId, ...baseOrder };
      try {
        const insertResult = await db.collection('orders').insertOne(candidate);
        insertedId = insertResult.insertedId;
        createdOrder = candidate;
        break;
      } catch (error) {
        if (error?.code === 11000) continue;
        throw error;
      }
    }

    if (!createdOrder || !insertedId) {
      throw new Error('ADMIN_ORDER_ID_GENERATION_EXHAUSTED');
    }

    for (const request of inventoryRequests.values()) {
      let updateResult;
      if (request.type === 'collection') {
        updateResult = await db.collection('product_variants').updateOne(
          { _id: new ObjectId(request.variantId) },
          { $inc: { stock: -request.quantity } }
        );
      } else if (request.type === 'embedded') {
        const identifier = request.variantIdentifier;
        updateResult = await db.collection('products').updateOne(
          { _id: new ObjectId(request.productId) },
          { $inc: { 'variants.$[variant].stock': -request.quantity } },
          { arrayFilters: [{ [`variant.${identifier.field}`]: identifier.rawValue }] }
        );
      } else {
        updateResult = await db.collection('products').updateOne(
          { _id: new ObjectId(request.productId) },
          { $inc: { [request.stockPath]: -request.quantity } }
        );
      }
      if (!updateResult?.matchedCount || !updateResult?.modifiedCount) {
        throw new Error('ADMIN_ORDER_STOCK_UPDATE_FAILED');
      }
    }

    res.status(201).json({
      success: true,
      message: 'Thêm đơn hàng thành công',
      data: formatOrder({ _id: insertedId, ...createdOrder })
    });
  } catch (error) {
    if (error instanceof AdminOrderValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error creating admin order:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo đơn hàng. Vui lòng thử lại.'
    });
  }
});

// 4.1 GET /api/orders (List with composed search, filters and pagination)
app.get('/api/orders', async (req, res) => {
  try {
    const ordersFilter = {};
    if (req.query.userId) {
      const uId = String(req.query.userId).trim();
      if (ObjectId.isValid(uId)) {
        ordersFilter.$or = [
          { userId: new ObjectId(uId) },
          { userId: uId },
          { _user: new ObjectId(uId) },
          { _user: uId }
        ];
      } else {
        ordersFilter.$or = [
          { userId: uId },
          { _user: uId }
        ];
      }
    }
    const ordersRaw = await db.collection('orders').find(ordersFilter).sort({ _id: -1 }).toArray();
    const formattedOrders = ordersRaw.map(formatOrder);
    const paymentMethodCodeById = new Map();

    if (normalizeOrderQueryValue(req.query.paymentMethod)) {
      const paymentMethods = await db.collection('payment_methods')
        .find({}, { projection: { code: 1 } })
        .toArray();
      paymentMethods.forEach(method => {
        const id = method?._id?.toString?.();
        const code = normalizeOrderQueryValue(method?.code);
        if (id) paymentMethodCodeById.set(id, code || normalizeOrderQueryValue(id));
      });
    }

    const result = queryFormattedOrders(formattedOrders, {
      page: req.query.page,
      limit: req.query.limit ?? req.query.pageSize,
      search: req.query.search,
      status: req.query.status,
      paymentMethod: req.query.paymentMethod
    }, paymentMethodCodeById);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.'
    });
  }
});

// 4.1b Helper: Đồng bộ thông báo hệ thống vào collection 'notification-popup' trong MongoDB
async function syncAndFetchNotifications(database, recipientId = 'admin') {
  const notifCol = database.collection('notification-popup');
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [orders, products, users] = await Promise.all([
    database.collection('orders').find({
      $or: [
        { createdAt: { $gte: since } },
        { dateAdded: { $gte: since } }
      ]
    }).sort({ createdAt: -1 }).toArray(),
    database.collection('products').find({}, {
      projection: { title: 1, titleUrl: 1, stock: 1, dateAdded: 1, quantity: 1, updatedAt: 1 }
    }).toArray(),
    database.collection('users').find({
      $or: [
        { createdAt: { $gte: since } },
        { dateAdded: { $gte: since } }
      ]
    }, {
      projection: { email: 1, name: 1, fullName: 1, status: 1, createdAt: 1, dateAdded: 1 }
    }).sort({ createdAt: -1 }).toArray()
  ]);

  const activeEvents = [];

  // 1. Đơn hàng mới
  const newOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'NEW' || o.status === 'Pending');
  if (newOrders.length) {
    activeEvents.push({
      id: 'orders-new',
      type: 'order_new',
      group: 'orders',
      icon: 'new-order',
      title: 'Có đơn hàng mới',
      message: `${newOrders.length} đơn hàng mới chờ xử lý`,
      count: newOrders.length,
      level: 'info',
      time: newOrders[0]?.createdAt || newOrders[0]?.dateAdded || new Date(),
      targetUrl: '/admin/orders?status=PENDING',
    });
  }

  // 2. Đơn đã xác nhận cần xuất kho
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PROCESSING' || o.status === 'Confirmed' || o.status === 'Processing');
  if (confirmedOrders.length) {
    activeEvents.push({
      id: 'orders-confirmed',
      type: 'order_confirmed',
      group: 'orders',
      icon: 'confirmed',
      title: 'Đơn đã xác nhận cần xuất kho',
      message: `${confirmedOrders.length} đơn đã xác nhận và cần xuất kho`,
      count: confirmedOrders.length,
      level: 'info',
      time: confirmedOrders[0]?.createdAt || confirmedOrders[0]?.dateAdded || new Date(),
      targetUrl: '/admin/orders?status=CONFIRMED',
    });
  }

  // 3. Đơn hàng đã thanh toán
  const paidOrders = orders.filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'Paid' || o.status === 'PAID');
  if (paidOrders.length) {
    activeEvents.push({
      id: 'orders-paid',
      type: 'order_paid',
      group: 'orders',
      icon: 'paid',
      title: 'Đơn hàng được thanh toán',
      message: `${paidOrders.length} đơn đã thanh toán thành công`,
      count: paidOrders.length,
      level: 'success',
      time: paidOrders[0]?.createdAt || paidOrders[0]?.dateAdded || new Date(),
      targetUrl: '/admin/orders?status=CONFIRMED',
    });
  }

  // 4. Đơn hàng bị hủy
  const canceledOrders = orders.filter(o => o.status === 'CANCELLED' || o.status === 'CANCELED' || o.status === 'Cancelled');
  if (canceledOrders.length) {
    activeEvents.push({
      id: 'orders-canceled',
      type: 'order_canceled',
      group: 'orders',
      icon: 'cancel',
      title: 'Đơn hàng bị hủy',
      message: `${canceledOrders.length} đơn hàng đã bị hủy`,
      count: canceledOrders.length,
      level: 'error',
      time: canceledOrders[0]?.createdAt || canceledOrders[0]?.dateAdded || new Date(),
      targetUrl: '/admin/orders?status=CANCELLED',
    });
  }

  // 5. Đơn hàng yêu cầu đổi trả
  const returnOrders = orders.filter(o => o.status === 'RETURNED' || o.type === 'RETURN' || (o.notes && /đổi|trả|refund|return/i.test(o.notes)));
  if (returnOrders.length) {
    activeEvents.push({
      id: 'orders-return',
      type: 'order_return',
      group: 'orders',
      icon: 'return',
      title: 'Đơn hàng yêu cầu đổi/trả',
      message: `${returnOrders.length} đơn yêu cầu đổi/trả`,
      count: returnOrders.length,
      level: 'warning',
      time: returnOrders[0]?.createdAt || returnOrders[0]?.dateAdded || new Date(),
      targetUrl: '/admin/orders?status=RETURNED',
    });
  }

  // 6. Sản phẩm hết hàng
  const outOfStock = products.filter(p => p.stock === 'outOfStock' || p.stock === 'out' || p.quantity === 0);
  if (outOfStock.length) {
    activeEvents.push({
      id: 'stock-out',
      type: 'stock_out',
      group: 'products',
      icon: 'out-of-stock',
      title: 'Sản phẩm hết hàng',
      message: `${outOfStock.length} sản phẩm đã hết hàng`,
      count: outOfStock.length,
      level: 'error',
      items: outOfStock.slice(0, 3).map(p => p.title || p.titleUrl),
      targetUrl: '/admin/products?status=out',
      time: new Date(),
    });
  }

  // 7. Sản phẩm sắp hết hàng
  const lowStock = products.filter(p => p.stock === 'lowStock' || p.stock === 'low' || (typeof p.quantity === 'number' && p.quantity > 0 && p.quantity <= 5));
  if (lowStock.length) {
    activeEvents.push({
      id: 'stock-low',
      type: 'stock_low',
      group: 'products',
      icon: 'low-stock',
      title: 'Sản phẩm sắp hết hàng',
      message: `${lowStock.length} sản phẩm sắp hết hàng`,
      count: lowStock.length,
      level: 'warning',
      items: lowStock.slice(0, 3).map(p => p.title || p.titleUrl),
      targetUrl: '/admin/products?status=out',
      time: new Date(),
    });
  }

  // 8. Nhập kho thành công
  const recentlyRestocked = products.filter(p => {
    if (p.stock !== 'inStock' && p.stock !== 'in' && (!p.quantity || p.quantity <= 0)) return false;
    const d = p.dateAdded || p.updatedAt;
    return d && new Date(d) >= since;
  });
  if (recentlyRestocked.length) {
    activeEvents.push({
      id: 'stock-in',
      type: 'stock_in',
      group: 'products',
      icon: 'restock',
      title: 'Nhập kho thành công',
      message: `${recentlyRestocked.length} sản phẩm được cập nhật vào kho`,
      count: recentlyRestocked.length,
      level: 'success',
      targetUrl: '/admin/products',
      time: new Date(),
    });
  }

  // 9. Xuất kho thành công
  const recentlyShipped = orders.filter(o => o.status === 'SHIPPING' || o.status === 'DELIVERED');
  if (recentlyShipped.length) {
    activeEvents.push({
      id: 'stock-out-shipped',
      type: 'stock_shipped',
      group: 'products',
      icon: 'shipped',
      title: 'Xuất kho thành công',
      message: `${recentlyShipped.length} đơn hàng đã xuất kho`,
      count: recentlyShipped.length,
      level: 'info',
      targetUrl: '/admin/orders?status=SHIPPING',
      time: recentlyShipped[0]?.createdAt || recentlyShipped[0]?.dateAdded || new Date(),
    });
  }

  // 10. Người dùng mới đăng ký
  const newUsers = users.filter(u => {
    const d = u.createdAt || u.dateAdded;
    return d && new Date(d) >= since;
  });
  if (newUsers.length) {
    activeEvents.push({
      id: 'users-new',
      type: 'user_new',
      group: 'users',
      icon: 'new-user',
      title: 'Người dùng mới đăng ký',
      message: `${newUsers.length} tài khoản mới trong 30 ngày`,
      count: newUsers.length,
      level: 'info',
      time: newUsers[0]?.createdAt || newUsers[0]?.dateAdded || new Date(),
      targetUrl: '/admin/users',
    });
  }

  // 11. Người dùng bị khóa
  const lockedUsersCount = await database.collection('users').countDocuments({ status: false });
  if (lockedUsersCount > 0) {
    activeEvents.push({
      id: 'users-locked',
      type: 'user_locked',
      group: 'users',
      icon: 'locked-user',
      title: 'Người dùng bị khóa/kích hoạt',
      message: `${lockedUsersCount} tài khoản đang bị khóa`,
      count: lockedUsersCount,
      level: 'warning',
      targetUrl: '/admin/users',
      time: new Date(),
    });
  }

  // Đồng bộ vào collection 'notification-popup' trong MongoDB
  const existingDocs = await notifCol.find({ recipientId }).toArray();
  const existingMap = new Map(existingDocs.map(d => [d.id, d]));

  for (const event of activeEvents) {
    const existing = existingMap.get(event.id);
    if (existing) {
      // Chỉ reset về chưa đọc khi số lượng sự kiện thực sự tăng lên (có sự kiện mới phát sinh)
      const countIncreased = typeof event.count === 'number' && typeof existing.count === 'number'
        ? event.count > existing.count
        : (event.count !== existing.count && event.count > 0);

      const updateDoc = {
        title: event.title,
        message: event.message,
        count: event.count,
        level: event.level,
        icon: event.icon,
        group: event.group,
        type: event.type,
        targetUrl: event.targetUrl,
        items: event.items || [],
        updatedAt: new Date(),
      };

      if (countIncreased) {
        updateDoc.isRead = false;
        updateDoc.readAt = null;
        updateDoc.time = event.time || new Date();
      } else {
        updateDoc.time = existing.time || event.time || new Date();
      }

      await notifCol.updateOne({ _id: existing._id }, { $set: updateDoc });
    } else {
      // Tạo document mới
      await notifCol.insertOne({
        ...event,
        items: event.items || [],
        isRead: false,
        readAt: null,
        recipientId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  // Xóa các thông báo không còn tồn tại sự kiện
  const activeIds = activeEvents.map(e => e.id);
  if (activeIds.length > 0) {
    await notifCol.deleteMany({ recipientId, id: { $nin: activeIds } });
  } else {
    await notifCol.deleteMany({ recipientId });
  }

  // Lấy danh sách thông báo từ MongoDB
  return await notifCol.find({ recipientId }).sort({ createdAt: -1 }).toArray();
}

// 4.1b GET /api/orders/notifications (Lấy danh sách thông báo admin từ MongoDB notification-popup)
app.get('/api/orders/notifications', async (req, res) => {
  try {
    const recipientId = req.query.recipientId || 'admin';
    const notifications = await syncAndFetchNotifications(db, recipientId);
    res.json(notifications);
  } catch (error) {
    console.error('Error in GET /api/orders/notifications:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải thông báo' });
  }
});

// Alias GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const recipientId = req.query.recipientId || 'admin';
    const notifications = await syncAndFetchNotifications(db, recipientId);
    res.json(notifications);
  } catch (error) {
    console.error('Error in GET /api/notifications:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải thông báo' });
  }
});

// 4.1c GET /api/orders/notifications/unread-count (Đếm số thông báo chưa đọc từ MongoDB)
app.get('/api/orders/notifications/unread-count', async (req, res) => {
  try {
    const recipientId = req.query.recipientId || 'admin';
    const unreadCount = await db.collection('notification-popup').countDocuments({ recipientId, isRead: false });
    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error in GET /api/orders/notifications/unread-count:', error);
    res.status(500).json({ success: false, message: 'Lỗi đếm thông báo chưa đọc' });
  }
});

// 4.1d POST & PATCH /api/orders/notifications/read-all (Đánh dấu tất cả thông báo đã đọc trong MongoDB)
const handleReadAllNotifications = async (req, res) => {
  try {
    const recipientId = req.body?.recipientId || req.query?.recipientId || 'admin';
    const result = await db.collection('notification-popup').updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true, readAt: new Date(), updatedAt: new Date() } }
    );
    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in read-all notifications:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật tất cả thông báo' });
  }
};
app.post('/api/orders/notifications/read-all', handleReadAllNotifications);
app.patch('/api/orders/notifications/read-all', handleReadAllNotifications);

// 4.1e POST & PATCH /api/orders/notifications/:id/read (Đánh dấu 1 thông báo đã đọc trong MongoDB)
const handleMarkNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const recipientId = req.body?.recipientId || req.query?.recipientId || 'admin';

    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu ID thông báo' });
    }

    const filter = { recipientId };
    if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
      filter.$or = [{ _id: new ObjectId(id) }, { id: id }];
    } else {
      filter.id = id;
    }

    const updateResult = await db.collection('notification-popup').updateOne(
      filter,
      { $set: { isRead: true, readAt: new Date(), updatedAt: new Date() } }
    );

    const updatedDoc = await db.collection('notification-popup').findOne(filter);

    res.json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc',
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      notification: updatedDoc
    });
  } catch (error) {
    console.error('Error in mark notification read:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái thông báo' });
  }
};
app.patch('/api/orders/notifications/:id/read', handleMarkNotificationRead);
app.post('/api/orders/notifications/:id/read', handleMarkNotificationRead);

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
    res.status(500).json({
      success: false,
      message: 'Không thể tải thông tin đơn hàng. Vui lòng thử lại.'
    });
  }
});

// 4.2.1 PATCH /api/admin/orders/:id (Limited safe edit; no items, money, payment or status changes)
const ADMIN_ORDER_EDIT_ALLOWED_KEYS = new Set([
  'notes',
  'customerEmail',
  'customerPhone',
  'shippingAddress',
  'shippingProvider',
  'trackingNumber',
  'estimatedDeliveryDate'
]);
const ADMIN_ORDER_ADDRESS_ALLOWED_KEYS = new Set([
  'fullName', 'phone', 'address', 'ward', 'district', 'province'
]);
const ADMIN_ORDER_CUSTOMER_EDIT_KEYS = new Set([
  'customerEmail', 'customerPhone', 'shippingAddress'
]);
const ADMIN_ORDER_FULFILLMENT_EDIT_KEYS = new Set([
  'shippingProvider', 'trackingNumber', 'estimatedDeliveryDate'
]);
const ADMIN_ORDER_FULFILLMENT_EDIT_STATUSES = new Set([
  'PENDING', 'PROCESSING', 'SHIPPING'
]);

function getAdminOrderEditStatus(order) {
  const statusCode = normalizeOrderQueryValue(order?.status);
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_MAP, statusCode) ? statusCode : '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateAdminOrderString(body, key) {
  if (!hasOwn(body, key)) return null;
  if (typeof body[key] !== 'string') return `${key} must be a string.`;
  return null;
}

app.patch('/api/admin/orders/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Order ID is invalid.' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: 'Update payload must be an object.' });
    }
    const bodyKeys = Object.keys(body);
    if (bodyKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'Update payload cannot be empty.' });
    }
    const unsupportedKeys = bodyKeys.filter(key => !ADMIN_ORDER_EDIT_ALLOWED_KEYS.has(key));
    if (unsupportedKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported order fields: ${unsupportedKeys.join(', ')}`
      });
    }

    const orderObjectId = new ObjectId(req.params.id);
    const ordersCollection = db.collection('orders');
    const order = await ordersCollection.findOne({ _id: orderObjectId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const statusCode = getAdminOrderEditStatus(order);
    const forbiddenCustomerKeys = bodyKeys.filter(key => ADMIN_ORDER_CUSTOMER_EDIT_KEYS.has(key));
    if (statusCode !== 'PENDING' && forbiddenCustomerKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer and shipping address fields can only be edited for PENDING orders.'
      });
    }
    const forbiddenFulfillmentKeys = bodyKeys.filter(key => ADMIN_ORDER_FULFILLMENT_EDIT_KEYS.has(key));
    if (!ADMIN_ORDER_FULFILLMENT_EDIT_STATUSES.has(statusCode) && forbiddenFulfillmentKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Fulfillment fields cannot be edited in the current order status.'
      });
    }

    for (const key of ['notes', 'customerPhone', 'shippingProvider', 'trackingNumber']) {
      const validationError = validateAdminOrderString(body, key);
      if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
      }
    }
    if (hasOwn(body, 'customerEmail')) {
      if (typeof body.customerEmail !== 'string'
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail.trim())) {
        return res.status(400).json({ success: false, message: 'Customer email is invalid.' });
      }
    }

    if (hasOwn(body, 'shippingAddress')) {
      const address = body.shippingAddress;
      if (!address || typeof address !== 'object' || Array.isArray(address)) {
        return res.status(400).json({ success: false, message: 'Shipping address is invalid.' });
      }
      const unsupportedAddressKeys = Object.keys(address)
        .filter(key => !ADMIN_ORDER_ADDRESS_ALLOWED_KEYS.has(key));
      if (unsupportedAddressKeys.length > 0) {
        return res.status(400).json({ success: false, message: 'Shipping address contains unsupported fields.' });
      }
      if (typeof address.fullName !== 'string' || !address.fullName.trim()
        || typeof address.phone !== 'string' || !address.phone.trim()
        || typeof address.address !== 'string' || !address.address.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Shipping address requires fullName, phone and address.'
        });
      }
      for (const key of ['ward', 'district', 'province']) {
        if (hasOwn(address, key) && typeof address[key] !== 'string') {
          return res.status(400).json({ success: false, message: `shippingAddress.${key} must be a string.` });
        }
      }
    }

    let parsedEstimatedDeliveryDate;
    if (hasOwn(body, 'estimatedDeliveryDate')) {
      if (body.estimatedDeliveryDate === null || body.estimatedDeliveryDate === '') {
        parsedEstimatedDeliveryDate = null;
      } else if (typeof body.estimatedDeliveryDate === 'string') {
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.estimatedDeliveryDate);
        if (!dateMatch) {
          return res.status(400).json({ success: false, message: 'Estimated delivery date is invalid.' });
        }
        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        parsedEstimatedDeliveryDate = new Date(Date.UTC(year, month - 1, day));
        if (parsedEstimatedDeliveryDate.getUTCFullYear() !== year
          || parsedEstimatedDeliveryDate.getUTCMonth() !== month - 1
          || parsedEstimatedDeliveryDate.getUTCDate() !== day) {
          return res.status(400).json({ success: false, message: 'Estimated delivery date is invalid.' });
        }
      } else {
        return res.status(400).json({ success: false, message: 'Estimated delivery date is invalid.' });
      }
    }

    const updateFields = { updatedAt: new Date() };
    for (const key of ['notes', 'customerEmail', 'customerPhone', 'shippingProvider', 'trackingNumber']) {
      if (hasOwn(body, key)) updateFields[key] = body[key].trim();
    }
    if (hasOwn(body, 'shippingAddress')) {
      updateFields.shippingAddress = Object.fromEntries(
        Object.entries(body.shippingAddress).map(([key, value]) => [key, value.trim()])
      );
    }
    if (hasOwn(body, 'estimatedDeliveryDate')) {
      updateFields.estimatedDeliveryDate = parsedEstimatedDeliveryDate;
    }

    await ordersCollection.updateOne({ _id: orderObjectId }, { $set: updateFields });
    const updatedOrder = await ordersCollection.findOne({ _id: orderObjectId });
    return res.json({
      success: true,
      message: 'Order updated successfully.',
      data: formatOrder(updatedOrder)
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/orders/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update order. Please try again.'
    });
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
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật trạng thái đơn hàng. Vui lòng thử lại.'
    });
  }
};

app.patch('/api/orders/:id/status', handleUpdateOrderStatus);
app.put('/api/orders/:id/status', handleUpdateOrderStatus);

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID đơn hàng không hợp lệ' });
    }

    const result = await db.collection('orders').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng để xóa' });
    }

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: 'Xóa đơn hàng thành công'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa đơn hàng. Vui lòng thử lại.' });
  }
});

// Bulk delete orders
app.post('/api/orders/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    if (!ids.every(id => ObjectId.isValid(id))) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }
    const objectIds = ids.map(id => new ObjectId(id));
    const result = await db.collection('orders').deleteMany({ _id: { $in: objectIds } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng để xóa' });
    }
    res.json({ success: true, deletedCount: result.deletedCount, message: `Đã xóa thành công ${result.deletedCount} đơn hàng` });
  } catch (error) {
    console.error('Error bulk deleting orders:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa các đơn hàng đã chọn. Vui lòng thử lại.' });
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

  let avatarUrl = '';
  if (typeof u.avatar === 'string' && u.avatar.trim()) {
    avatarUrl = u.avatar.trim();
  } else if (Array.isArray(u.images) && u.images.length > 0) {
    const first = u.images[0];
    if (typeof first === 'string' && first.trim()) {
      avatarUrl = first.trim();
    } else if (first && typeof first.url === 'string' && first.url.trim()) {
      avatarUrl = first.url.trim();
    }
  } else if (typeof u.image === 'string' && u.image.trim()) {
    avatarUrl = u.image.trim();
  } else if (u.image && typeof u.image.url === 'string' && u.image.url.trim()) {
    avatarUrl = u.image.url.trim();
  }

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
    avatar: avatarUrl,
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
      .sort({ createdAt: -1, dateAdded: -1, updatedAt: -1, _id: -1 })
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

    // Enrich cart items with Product & ProductVariant info (presentation only, not altering DB)
    if (user.cart && Array.isArray(user.cart.items) && user.cart.items.length > 0) {
      const productIds = [];
      const variantIds = [];
      for (const item of user.cart.items) {
        if (item.productId && ObjectId.isValid(item.productId)) {
          productIds.push(new ObjectId(item.productId));
        }
        if (item.variantId && ObjectId.isValid(item.variantId)) {
          variantIds.push(new ObjectId(item.variantId));
        }
      }

      const [products, variants] = await Promise.all([
        productIds.length > 0
          ? db.collection('products').find({ _id: { $in: productIds } }).toArray()
          : [],
        variantIds.length > 0
          ? db.collection('product_variants').find({ _id: { $in: variantIds } }).toArray()
          : [],
      ]);

      const prodMap = new Map(products.map(p => [p._id.toString(), p]));
      const varMap = new Map(variants.map(v => [v._id.toString(), v]));

      user.cart.items = user.cart.items.map(item => {
        const pIdStr = item.productId ? item.productId.toString() : '';
        const vIdStr = item.variantId ? item.variantId.toString() : '';
        const product = prodMap.get(pIdStr);

        let variant = varMap.get(vIdStr);
        if (!variant && product && Array.isArray(product.variants) && product.variants.length > 0) {
          if (vIdStr) {
            variant = product.variants.find(v =>
              (v._id && v._id.toString() === vIdStr) ||
              v.id === vIdStr ||
              v.sku === vIdStr
            );
          }
          if (!variant && (item.selectedClassification || item.selectedColor || item.selectedSize)) {
            variant = product.variants.find(v => {
              const mClass = !item.selectedClassification || v.classification === item.selectedClassification;
              const mColor = !item.selectedColor || v.color === item.selectedColor;
              const mSize = !item.selectedSize || v.size === item.selectedSize;
              return mClass && mColor && mSize;
            });
          }
        }

        const variantParts = [
          variant?.classification || item.selectedClassification,
          variant?.color || item.selectedColor,
          variant?.size || item.selectedSize,
        ].filter(Boolean);
        const variantText = variantParts.length > 0 ? variantParts.join(' - ') : (variant?.sku || '');

        const regularPrice = Number(variant?.price || product?.salePrice || product?.regularPrice || product?.vi?.salePrice || product?.vi?.regularPrice || 0);
        const discountPrice = Number(variant?.discountPrice || product?.salePrice || product?.vi?.salePrice || 0);
        const finalPrice = discountPrice > 0 ? discountPrice : regularPrice;

        return {
          productId: pIdStr,
          variantId: vIdStr || null,
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
          title: product ? (product.title || product.vi?.title || product.mainImage?.name || 'Sản phẩm') : 'Sản phẩm không còn tồn tại',
          image: product ? (product.mainImage?.url || (Array.isArray(product.images) && product.images[0]) || '') : '',
          sku: variant?.sku || product?.sku || '',
          variantText: variantText,
          price: finalPrice,
          regularPrice: regularPrice,
          productExists: !!product,
          variantExists: !vIdStr || !!variant,
        };
      });
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

// 5.2.1 GET /api/users/:id/orders (Get orders of a specific user)
app.get('/api/users/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const userObjectId = new ObjectId(id);

    // Verify user exists in collection users
    const user = await db.collection('users').findOne({ _id: userObjectId }, { projection: { _id: 1 } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
    }

    // Query orders belonging to user (supporting both ObjectId and string representations of userId and _user)
    const ordersRaw = await db.collection('orders')
      .find({
        $or: [
          { userId: userObjectId },
          { userId: id },
          { _user: userObjectId },
          { _user: id }
        ]
      })
      .sort({ createdAt: -1, dateAdded: -1, _id: -1 })
      .toArray();

    const formattedOrders = ordersRaw.map(formatOrder);

    res.json({
      success: true,
      data: formattedOrders,
      total: formattedOrders.length
    });
  } catch (error) {
    console.error('Error in GET /api/users/:id/orders:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.'
    });
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
    paymentProofImage: pm.paymentProofImage || pm.proofImage || '',
    logo: pm.logo || '',
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
    const { name, code, type, isActive, description, paymentInfo, paymentProofImage } = req.body;

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
      paymentProofImage: paymentProofImage ? String(paymentProofImage).trim() : '',
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

    const { name, code, type, isActive, description, paymentInfo, paymentProofImage } = req.body;

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

    if (paymentProofImage !== undefined) {
      updateFields.paymentProofImage = String(paymentProofImage).trim();
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
// 7.7 COUPONS API (Admin coupon management & checkout validation)
// ─────────────────────────────────────────────────────────────

function formatCoupon(c) {
  if (!c) return null;
  const id = c._id ? c._id.toString() : c.id;
  const usageLimit = Number(c.usageLimit) || 0;
  const usedCount = Number(c.usedCount) || 0;
  const remainingUsage = Math.max(0, usageLimit - usedCount);

  return {
    id,
    _id: id,
    code: c.code ? String(c.code).trim().toUpperCase() : '',
    description: c.description || '',
    discountType: c.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
    discountValue: Number(c.discountValue) || 0,
    maxDiscount: Number(c.maxDiscount) || 0,
    minOrderValue: Number(c.minOrderValue) || 0,
    startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
    endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
    usageLimit,
    usedCount,
    remainingUsage,
    isActive: c.isActive !== false,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

// 7.7.1 GET /api/coupons (List with search, filter, pagination)
app.get('/api/coupons', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || req.query.pageSize) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search && String(req.query.search).trim()) {
      const q = String(req.query.search).trim();
      const sRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { code: sRegex },
        { description: sRegex }
      ];
    }

    if (req.query.discountType && req.query.discountType !== 'all') {
      query.discountType = req.query.discountType;
    }

    if (req.query.isActive !== undefined && req.query.isActive !== '' && req.query.isActive !== 'all') {
      query.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    } else if (req.query.status !== undefined && req.query.status !== '' && req.query.status !== 'all') {
      query.isActive = req.query.status === 'true' || req.query.status === 'active' || req.query.status === true;
    }

    const [total, coupons] = await Promise.all([
      db.collection('coupons').countDocuments(query),
      db.collection('coupons').find(query).sort({ _id: -1 }).skip(skip).limit(limit).toArray()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      data: coupons.map(formatCoupon),
      pagination: {
        page,
        limit,
        pageSize: limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách mã giảm giá' });
  }
});

// 7.7.2 GET /api/coupons/:id (Get single coupon)
app.get('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    } else {
      query = { _id: id };
    }

    const coupon = await db.collection('coupons').findOne(query);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá' });
    }

    res.json({
      success: true,
      data: formatCoupon(coupon)
    });
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải thông tin mã giảm giá' });
  }
});

// 7.7.3 POST /api/coupons (Create coupon)
app.post('/api/coupons', async (req, res) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá là bắt buộc' });
    }

    // Uniqueness check
    const existing = await db.collection('coupons').findOne({ code });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã tồn tại trong hệ thống' });
    }

    const discountType = body.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const discountValue = Number(body.discountValue);
    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Giá trị giảm phải lớn hơn 0' });
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return res.status(400).json({ success: false, message: 'Phần trăm giảm giá không được vượt quá 100%' });
    }

    const maxDiscount = discountType === 'PERCENTAGE' ? (Number(body.maxDiscount) || 0) : 0;
    const minOrderValue = Number(body.minOrderValue) >= 0 ? Number(body.minOrderValue) : 0;

    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const endDate = body.endDate ? new Date(body.endDate) : null;
    if (!endDate || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày hết hạn là bắt buộc và phải hợp lệ' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải trước ngày hết hạn' });
    }

    const usageLimit = Number(body.usageLimit);
    if (!usageLimit || usageLimit <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượt sử dụng tối đa phải lớn hơn 0' });
    }

    const now = new Date();
    const newDoc = {
      code,
      description: String(body.description || '').trim(),
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      startDate,
      endDate,
      usageLimit,
      usedCount: 0, // Backend guarantees 0 on creation
      isActive: body.isActive !== false,
      createdAt: now,
      updatedAt: now
    };

    const insertResult = await db.collection('coupons').insertOne(newDoc);
    const created = await db.collection('coupons').findOne({ _id: insertResult.insertedId });

    res.status(201).json({
      success: true,
      message: 'Tạo mã giảm giá thành công',
      data: formatCoupon(created)
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi tạo mã giảm giá' });
  }
});

// 7.7.4 PUT /api/coupons/:id (Update coupon)
app.put('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    } else {
      query = { _id: id };
    }

    const existing = await db.collection('coupons').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá cần cập nhật' });
    }

    const body = req.body || {};
    const code = String(body.code || existing.code).trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá không được để trống' });
    }

    if (code !== existing.code) {
      const codeTaken = await db.collection('coupons').findOne({
        code,
        _id: { $ne: existing._id }
      });
      if (codeTaken) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã được sử dụng bởi mã khác' });
      }
    }

    const discountType = body.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const discountValue = Number(body.discountValue !== undefined ? body.discountValue : existing.discountValue);
    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Giá trị giảm phải lớn hơn 0' });
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return res.status(400).json({ success: false, message: 'Phần trăm giảm giá không được vượt quá 100%' });
    }

    const maxDiscount = discountType === 'PERCENTAGE' ? (Number(body.maxDiscount !== undefined ? body.maxDiscount : existing.maxDiscount) || 0) : 0;
    const minOrderValue = Number(body.minOrderValue !== undefined ? body.minOrderValue : existing.minOrderValue) >= 0
      ? Number(body.minOrderValue !== undefined ? body.minOrderValue : existing.minOrderValue)
      : 0;

    const startDate = body.startDate ? new Date(body.startDate) : new Date(existing.startDate);
    const endDate = body.endDate ? new Date(body.endDate) : new Date(existing.endDate);
    if (!endDate || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày hết hạn không hợp lệ' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải trước ngày hết hạn' });
    }

    const usageLimit = Number(body.usageLimit !== undefined ? body.usageLimit : existing.usageLimit);
    if (!usageLimit || usageLimit <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượt sử dụng tối đa phải lớn hơn 0' });
    }

    const updateDoc = {
      $set: {
        code,
        description: body.description !== undefined ? String(body.description).trim() : existing.description,
        discountType,
        discountValue,
        maxDiscount,
        minOrderValue,
        startDate,
        endDate,
        usageLimit,
        isActive: body.isActive !== undefined ? (body.isActive === true || body.isActive === 'true') : existing.isActive,
        updatedAt: new Date()
      }
      // usedCount is NOT touched by Admin edit
    };

    await db.collection('coupons').updateOne({ _id: existing._id }, updateDoc);
    const updated = await db.collection('coupons').findOne({ _id: existing._id });

    res.json({
      success: true,
      message: 'Cập nhật mã giảm giá thành công',
      data: formatCoupon(updated)
    });
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi cập nhật mã giảm giá' });
  }
});

// 7.7.5 PATCH /api/coupons/:id/status (Toggle isActive status)
const handleToggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    } else {
      query = { _id: id };
    }

    const existing = await db.collection('coupons').findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá' });
    }

    let nextActive;
    if (req.body && req.body.isActive !== undefined) {
      nextActive = req.body.isActive === true || req.body.isActive === 'true';
    } else {
      nextActive = existing.isActive === false;
    }

    await db.collection('coupons').updateOne(
      { _id: existing._id },
      { $set: { isActive: nextActive, updatedAt: new Date() } }
    );

    const updated = await db.collection('coupons').findOne({ _id: existing._id });
    res.json({
      success: true,
      message: `Đã ${nextActive ? 'bật' : 'tắt'} mã giảm giá ${existing.code}`,
      data: formatCoupon(updated)
    });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi cập nhật trạng thái mã giảm giá' });
  }
};

app.patch('/api/coupons/:id/status', handleToggleCouponStatus);
app.put('/api/coupons/:id/toggle', handleToggleCouponStatus);

// 7.7.6 DELETE /api/coupons/:id (Delete single coupon)
app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    } else {
      query = { _id: id };
    }

    const result = await db.collection('coupons').deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại hoặc đã bị xóa' });
    }

    res.json({
      success: true,
      message: 'Xóa mã giảm giá thành công'
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi xóa mã giảm giá' });
  }
});

// 7.7.7 POST /api/coupons/bulk-delete (Bulk delete coupons)
app.post('/api/coupons/bulk-delete', async (req, res) => {
  try {
    const ids = req.body?.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
    }

    const objectIds = ids.filter(ObjectId.isValid).map(id => new ObjectId(id));
    const stringIds = ids.filter(id => !ObjectId.isValid(id));

    const result = await db.collection('coupons').deleteMany({
      $or: [
        { _id: { $in: objectIds } },
        { _id: { $in: stringIds } }
      ]
    });

    res.json({
      success: true,
      message: `Đã xóa thành công ${result.deletedCount} mã giảm giá`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting coupons:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi xóa nhiều mã giảm giá' });
  }
});

// 7.7.8 POST /api/orders/coupon/validate (Checkout coupon validation endpoint on Admin Server)
app.post(['/api/orders/coupon/validate', '/api/coupons/validate'], async (req, res) => {
  try {
    const { code, subtotal } = req.body || {};
    if (!code || !String(code).trim()) {
      return res.json({ valid: false, message: 'Vui lòng nhập mã giảm giá' });
    }
    const cleanCode = String(code).trim().toUpperCase();
    const orderSubtotal = Number(subtotal) || 0;

    const coupon = await db.collection('coupons').findOne({
      code: cleanCode,
      isActive: true
    });

    if (!coupon) {
      return res.json({ valid: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.json({ valid: false, message: 'Chương trình ưu đãi chưa bắt đầu' });
    }
    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return res.json({ valid: false, message: 'Mã giảm giá đã hết hạn sử dụng' });
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.json({ valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
    }
    if (coupon.minOrderValue > 0 && orderSubtotal < coupon.minOrderValue) {
      const minFormatted = Number(coupon.minOrderValue).toLocaleString('vi-VN');
      return res.json({
        valid: false,
        message: `Mã ${cleanCode} chỉ áp dụng cho đơn hàng từ ${minFormatted} ₫ trở lên`
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = Math.round((orderSubtotal * Number(coupon.discountValue)) / 100);
      if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    if (discountAmount > orderSubtotal) {
      discountAmount = orderSubtotal;
    }

    return res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      message: 'Áp dụng mã giảm giá thành công!'
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ valid: false, message: 'Lỗi kiểm tra mã giảm giá' });
  }
});


// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 8. INVENTORY API (Calculated from products and active orders)
// ─────────────────────────────────────────────────────────────
app.get('/api/inventory', async (req, res) => {
  try {
    const [productsRaw, activeOrders] = await Promise.all([
      db.collection('products').find({}).sort({ updatedAt: -1, _id: -1 }).toArray(),
      db.collection('orders').find({
        status: { $nin: ['DELIVERED', 'CANCELLED', 'RETURNED', 'Đã giao', 'Đã hủy', 'Đã hoàn trả'] }
      }).toArray()
    ]);

    // Build reservation maps for variant and product
    const variantReservedMap = new Map();
    const prodReservedMap = new Map();

    for (const order of activeOrders) {
      const items = order.cart?.items || order.items || [];
      for (const item of items) {
        const itemObj = item.item || {};
        const prodId = (itemObj._id || itemObj.id || item.productId || item.id)?.toString();
        if (!prodId) continue;

        const qty = Number(item.qty || item.quantity) || 1;
        prodReservedMap.set(prodId, (prodReservedMap.get(prodId) || 0) + qty);

        const vSku = itemObj.variant?.sku || itemObj.variantSku || item.variantSku || item.sku || itemObj.sku;
        const vColor = (itemObj.variant?.color || '').toLowerCase().trim();
        const vSize = (itemObj.variant?.size || '').toLowerCase().trim();

        if (vSku) {
          const key = `${prodId}__sku__${vSku.toLowerCase().trim()}`;
          variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + qty);
        }
        if (vColor || vSize) {
          const key = `${prodId}__attrs__${vColor}__${vSize}`;
          variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + qty);
        }
      }
    }

    const data = productsRaw.map(p => {
      const vi = p.vi || {};
      const name = vi.title || p.title || p.titleUrl?.replace(/-/g, ' ') || 'Sản phẩm';
      const prodIdStr = p._id.toString();
      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

      let stock = 0;
      let reserved = 0;
      let available = 0;
      let sku = '';
      let calculatedVariants = [];

      if (hasVariants) {
        calculatedVariants = p.variants.map((v, idx) => {
          const vStock = Math.max(0, Number(v.stock) || 0);
          const vColor = (v.color || '').toLowerCase().trim();
          const vSize = (v.size || '').toLowerCase().trim();
          const vSku = (v.sku || '').trim();

          let vReserved = 0;
          if (vSku && variantReservedMap.has(`${prodIdStr}__sku__${vSku.toLowerCase()}`)) {
            vReserved = variantReservedMap.get(`${prodIdStr}__sku__${vSku.toLowerCase()}`);
          } else if (variantReservedMap.has(`${prodIdStr}__attrs__${vColor}__${vSize}`)) {
            vReserved = variantReservedMap.get(`${prodIdStr}__attrs__${vColor}__${vSize}`);
          }

          const vAvailable = Math.max(0, vStock - vReserved);

          let vStatus = 'Còn hàng';
          let vStatusVariant = 'success';
          if (vAvailable <= 0) {
            vStatus = 'Hết hàng';
            vStatusVariant = 'danger';
          } else if (vAvailable <= LOW_STOCK_THRESHOLD) {
            vStatus = 'Sắp hết';
            vStatusVariant = 'warning';
          }

          return {
            ...v,
            id: v.id || v._id || vSku || String(idx),
            sku: vSku,
            stock: vStock,
            reserved: vReserved,
            available: vAvailable,
            status: vStatus,
            statusVariant: vStatusVariant
          };
        });

        stock = calculatedVariants.reduce((sum, v) => sum + v.stock, 0);
        reserved = calculatedVariants.reduce((sum, v) => sum + v.reserved, 0);
        available = calculatedVariants.reduce((sum, v) => sum + v.available, 0);

        const variantSkus = calculatedVariants.map(v => v.sku).filter(Boolean);
        sku = variantSkus.length > 0 ? variantSkus.join(', ') : '';
      } else {
        // Single product without variants: SKU from product.sku or vi.sku
        let s = 0;
        if (p.stock !== undefined && p.stock !== null && !isNaN(Number(p.stock))) {
          s = Number(p.stock);
        } else if (vi.stock !== undefined && vi.stock !== null && !isNaN(Number(vi.stock))) {
          s = Number(vi.stock);
        } else if (vi.quantity !== undefined && vi.quantity !== null && !isNaN(Number(vi.quantity))) {
          s = Number(vi.quantity);
        } else if (p.quantity !== undefined && p.quantity !== null && !isNaN(Number(p.quantity))) {
          s = Number(p.quantity);
        }
        stock = Math.max(0, s);
        reserved = prodReservedMap.get(prodIdStr) || 0;
        available = Math.max(0, stock - reserved);
        sku = (p.sku || vi.sku || '').trim();
      }

      let status = 'Còn hàng';
      let statusVariant = 'success';
      if (available <= 0) {
        status = 'Hết hàng';
        statusVariant = 'danger';
      } else if (available <= LOW_STOCK_THRESHOLD) {
        status = 'Sắp hết';
        statusVariant = 'warning';
      }

      return {
        id: prodIdStr,
        _id: prodIdStr,
        name,
        image: p.mainImage?.url || (Array.isArray(p.images) && p.images[0]) || '',
        sku,
        hasVariants,
        quantity: stock,
        stock,
        reserved,
        available,
        status,
        statusVariant,
        variants: calculatedVariants,
        raw: p
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

// GET /api/inventory/:id - Lấy chi tiết tồn kho theo ID sản phẩm
app.get('/api/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id }] };
    }

    const [product, activeOrders] = await Promise.all([
      db.collection('products').findOne(query),
      db.collection('orders').find({
        status: { $nin: ['DELIVERED', 'CANCELLED', 'RETURNED', 'Đã giao', 'Đã hủy', 'Đã hoàn trả'] }
      }).toArray()
    ]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin sản phẩm trong kho.' });
    }

    const variantReservedMap = new Map();
    let prodReserved = 0;
    const prodIdStr = product._id.toString();

    for (const order of activeOrders) {
      const items = order.cart?.items || order.items || [];
      for (const item of items) {
        const itemObj = item.item || {};
        const itemId = (itemObj._id || itemObj.id || item.productId || item.id)?.toString();
        if (!itemId || itemId !== prodIdStr) continue;

        const qty = Number(item.qty || item.quantity) || 1;
        prodReserved += qty;

        const vSku = itemObj.variant?.sku || itemObj.variantSku || item.variantSku || item.sku || itemObj.sku;
        const vColor = (itemObj.variant?.color || '').toLowerCase().trim();
        const vSize = (itemObj.variant?.size || '').toLowerCase().trim();

        if (vSku) {
          const key = `${prodIdStr}__sku__${vSku.toLowerCase().trim()}`;
          variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + qty);
        }
        if (vColor || vSize) {
          const key = `${prodIdStr}__attrs__${vColor}__${vSize}`;
          variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + qty);
        }
      }
    }

    const LOW_STOCK_THRESHOLD = 5;
    const vi = product.vi || {};
    const name = vi.title || product.title || product.titleUrl?.replace(/-/g, ' ') || 'Sản phẩm';
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

    let stock = 0;
    let reserved = 0;
    let available = 0;
    let sku = '';
    let calculatedVariants = [];

    if (hasVariants) {
      calculatedVariants = product.variants.map((v, idx) => {
        const vStock = Math.max(0, Number(v.stock) || 0);
        const vColor = (v.color || '').toLowerCase().trim();
        const vSize = (v.size || '').toLowerCase().trim();
        const vSku = (v.sku || '').trim();

        let vReserved = 0;
        if (vSku && variantReservedMap.has(`${prodIdStr}__sku__${vSku.toLowerCase()}`)) {
          vReserved = variantReservedMap.get(`${prodIdStr}__sku__${vSku.toLowerCase()}`);
        } else if (variantReservedMap.has(`${prodIdStr}__attrs__${vColor}__${vSize}`)) {
          vReserved = variantReservedMap.get(`${prodIdStr}__attrs__${vColor}__${vSize}`);
        }

        const vAvailable = Math.max(0, vStock - vReserved);

        let vStatus = 'Còn hàng';
        let vStatusVariant = 'success';
        if (vAvailable <= 0) {
          vStatus = 'Hết hàng';
          vStatusVariant = 'danger';
        } else if (vAvailable <= LOW_STOCK_THRESHOLD) {
          vStatus = 'Sắp hết';
          vStatusVariant = 'warning';
        }

        return {
          ...v,
          id: v.id || v._id || vSku || String(idx),
          sku: vSku,
          color: v.color || '',
          size: v.size || '',
          classification: v.classification || '',
          price: v.price !== undefined ? v.price : (product.price || 0),
          stock: vStock,
          reserved: vReserved,
          available: vAvailable,
          status: vStatus,
          statusVariant: vStatusVariant
        };
      });

      stock = calculatedVariants.reduce((sum, v) => sum + v.stock, 0);
      reserved = calculatedVariants.reduce((sum, v) => sum + v.reserved, 0);
      available = calculatedVariants.reduce((sum, v) => sum + v.available, 0);

      const variantSkus = calculatedVariants.map(v => v.sku).filter(Boolean);
      sku = variantSkus.length > 0 ? variantSkus.join(', ') : '';
    } else {
      let s = 0;
      if (product.stock !== undefined && product.stock !== null && !isNaN(Number(product.stock))) {
        s = Number(product.stock);
      } else if (vi.stock !== undefined && vi.stock !== null && !isNaN(Number(vi.stock))) {
        s = Number(vi.stock);
      } else if (vi.quantity !== undefined && vi.quantity !== null && !isNaN(Number(vi.quantity))) {
        s = Number(vi.quantity);
      } else if (product.quantity !== undefined && product.quantity !== null && !isNaN(Number(product.quantity))) {
        s = Number(product.quantity);
      }
      stock = Math.max(0, s);
      reserved = prodReserved;
      available = Math.max(0, stock - reserved);
      sku = (product.sku || vi.sku || '').trim();
    }

    let status = 'Còn hàng';
    let statusVariant = 'success';
    if (available <= 0) {
      status = 'Hết hàng';
      statusVariant = 'danger';
    } else if (available <= LOW_STOCK_THRESHOLD) {
      status = 'Sắp hết';
      statusVariant = 'warning';
    }

    res.json({
      success: true,
      data: {
        id: prodIdStr,
        _id: prodIdStr,
        productId: prodIdStr,
        name,
        image: product.mainImage?.url || (Array.isArray(product.images) && product.images[0]) || '',
        sku,
        hasVariants,
        quantity: stock,
        stock,
        reserved,
        available,
        status,
        statusVariant,
        variants: calculatedVariants,
        category: product.category || vi.category || vi.categoryLevel1 || vi.categoryLevel2 || '',
        price: product.price || vi.regularPrice || vi.salePrice || 0,
        originalPrice: product.originalPrice || vi.regularPrice || 0,
        unit: product.unit || vi.unit || 'Cái',
        updatedAt: product.updatedAt,
        createdAt: product.createdAt,
        raw: product
      }
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

    const { quantity, variantId, variantSku, sku, note, isEdit } = req.body;

    if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
      return res.status(400).json({ success: false, message: isEdit ? 'Vui lòng nhập số lượng tồn kho' : 'Vui lòng nhập số lượng nhập kho' });
    }

    const numQty = Number(quantity);

    if (!Number.isInteger(numQty)) {
      return res.status(400).json({ success: false, message: 'Số lượng phải là số nguyên' });
    }

    if (isEdit) {
      if (numQty < 0) {
        return res.status(400).json({ success: false, message: 'Số lượng tồn kho không được âm' });
      }
    } else {
      if (numQty <= 0) {
        return res.status(400).json({ success: false, message: 'Số lượng nhập phải lớn hơn 0' });
      }
    }

    // Step 3: Find product
    const product = await db.collection('products').findOne({ _id: prodId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

    let updateSet = {
      updatedAt: new Date()
    };
    let updatedVariant = null;
    let previousStock = 0;
    let newStock = 0;

    if (hasVariants) {
      const targetIdentifier = (variantId || variantSku || sku || '').toString().trim();
      if (!targetIdentifier) {
        return res.status(400).json({
          success: false,
          message: isEdit
            ? 'Sản phẩm có biến thể, vui lòng chọn một biến thể cụ thể để sửa tồn kho'
            : 'Sản phẩm có biến thể, vui lòng chọn một biến thể cụ thể để nhập kho'
        });
      }

      let matchedIndex = -1;
      for (let i = 0; i < product.variants.length; i++) {
        const v = product.variants[i];
        if (
          (v.sku && v.sku.trim() === targetIdentifier) ||
          (v.id && v.id.toString() === targetIdentifier) ||
          (v._id && v._id.toString() === targetIdentifier) ||
          String(i) === targetIdentifier
        ) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy biến thể "${targetIdentifier}" của sản phẩm`
        });
      }

      const updatedVariants = product.variants.map((v, i) => {
        if (i === matchedIndex) {
          previousStock = Math.max(0, Number(v.stock) || 0);
          const updatedStock = isEdit ? numQty : (previousStock + numQty);
          updatedVariant = {
            ...v,
            stock: updatedStock
          };
          return updatedVariant;
        }
        return v;
      });

      const totalStock = updatedVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      newStock = updatedVariant.stock;

      updateSet.variants = updatedVariants;
      updateSet['vi.stock'] = totalStock;
      updateSet['vi.quantity'] = totalStock;
      updateSet.stock = totalStock;
      updateSet.quantity = totalStock;
    } else {
      // Single product without variants
      const vi = product.vi || {};
      if (product.stock !== undefined && product.stock !== null && !isNaN(Number(product.stock))) {
        previousStock = Number(product.stock);
      } else if (vi.stock !== undefined && vi.stock !== null && !isNaN(Number(vi.stock))) {
        previousStock = Number(vi.stock);
      } else if (vi.quantity !== undefined && vi.quantity !== null && !isNaN(Number(vi.quantity))) {
        previousStock = Number(vi.quantity);
      } else if (product.quantity !== undefined && product.quantity !== null && !isNaN(Number(product.quantity))) {
        previousStock = Number(product.quantity);
      }
      if (isNaN(previousStock) || previousStock < 0) previousStock = 0;

      newStock = isEdit ? numQty : (previousStock + numQty);
      updateSet['vi.stock'] = newStock;
      updateSet['vi.quantity'] = newStock;
      updateSet.stock = newStock;
      updateSet.quantity = newStock;
    }

    await db.collection('products').updateOne(
      { _id: prodId },
      { $set: updateSet }
    );

    const updatedProduct = await db.collection('products').findOne({ _id: prodId });

    // Step 9: Return response
    let successMessage = '';
    if (isEdit) {
      successMessage = hasVariants
        ? `Cập nhật tồn kho biến thể ${updatedVariant?.sku || ''} thành công. Tồn kho mới: ${newStock}.`
        : `Cập nhật tồn kho sản phẩm thành công. Tồn kho mới: ${newStock}.`;
    } else {
      successMessage = hasVariants
        ? `Nhập kho biến thể ${updatedVariant?.sku || ''} thành công. Đã nhập thêm ${numQty} sản phẩm. Tồn kho biến thể hiện tại: ${newStock}.`
        : `Nhập kho thành công. Đã nhập thêm ${numQty} sản phẩm. Tồn kho hiện tại: ${newStock}.`;
    }

    res.json({
      success: true,
      message: successMessage,
      productId: prodId.toString(),
      hasVariants,
      variant: updatedVariant,
      quantityImported: isEdit ? 0 : numQty,
      previousStock,
      stock: newStock,
      product: formatProduct(updatedProduct)
    });
  } catch (error) {
    console.error('Error importing/updating inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/products/:id/inventory', handleInventoryImport);
app.post('/api/products/:id/inventory', handleInventoryImport);


// ─────────────────────────────────────────────────────────────
// 9. POLICIES / PAGES API (QUẢN LÝ CHÍNH SÁCH - COLLECTION: pages_policies)
// Đồng bộ 100% với MongoDB collection 'pages_policies' & mirror 'pages'
// ─────────────────────────────────────────────────────────────
function formatPage(p) {
  if (!p) return null;
  const vi = p.vi || {};
  const en = p.en || {};
  const viTitle = (vi.title || p.title || '').trim();
  const enTitle = (en.title || '').trim();
  const title = viTitle || enTitle || p.titleUrl || 'Chính sách';

  const rawSlug = (p.titleUrl || p.slug || '').toString().trim().replace(/^\/+/, '');
  const slug = '/' + rawSlug;

  const isPublished = p.status === 'published' || p.status === 'active' || p.status === 'Đã xuất bản'
    || (p.status !== 'draft' && p.status !== 'inactive' && p.status !== 'Bản nháp' && vi.visibility !== false && p.isPublished !== false);

  const viContent = vi.contentHTML !== undefined ? vi.contentHTML : (p.contentHTML || '');
  const enContent = en.contentHTML !== undefined ? en.contentHTML : '';
  const contentHTML = viContent || enContent;

  const viMeta = vi.metaDescription !== undefined ? vi.metaDescription : (p.metaDescription || '');
  const enMeta = en.metaDescription !== undefined ? en.metaDescription : '';
  const metaDescription = viMeta || enMeta;

  const docId = p._id ? p._id.toString() : (p.id ? p.id.toString() : '');

  return {
    id: docId,
    _id: docId,
    titleUrl: rawSlug,
    slug,
    rawSlug,
    title,
    contentHTML,
    metaDescription,
    status: isPublished ? 'Đã xuất bản' : 'Bản nháp',
    statusVariant: isPublished ? 'success' : 'neutral',
    isPublished: isPublished,
    statusCode: isPublished ? 'published' : 'draft',
    dateAdded: p.dateAdded || p.createdAt || '',
    updatedAt: p.updatedAt || p.dateAdded || '',
    vi: {
      title: viTitle || title,
      contentHTML: viContent,
      visibility: vi.visibility !== undefined ? !!vi.visibility : isPublished,
      metaDescription: viMeta
    },
    en: {
      title: enTitle || viTitle || title,
      contentHTML: enContent || viContent,
      visibility: en.visibility !== undefined ? !!en.visibility : isPublished,
      metaDescription: enMeta || viMeta
    },
    __v: typeof p.__v === 'number' ? p.__v : 0,
    raw: p
  };
}

function buildPageIdQuery(id) {
  if (!id) return { _id: null };
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

// 9.1 GET /api/pages - Danh sách tất cả chính sách
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
            { status: 'Đã xuất bản' },
            { $and: [{ status: { $ne: 'draft' } }, { status: { $ne: 'inactive' } }, { 'vi.visibility': { $ne: false } }] }
          ]
        });
      } else if (status === 'Bản nháp' || status === 'draft' || status === 'inactive') {
        queryConditions.push({
          $or: [
            { status: 'draft' },
            { status: 'inactive' },
            { status: 'Bản nháp' },
            { 'vi.visibility': false }
          ]
        });
      }
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};
    let pagesRaw = await db.collection('pages_policies').find(query).sort({ _id: -1 }).toArray();

    // Fallback sang pages collection nếu pages_policies đang rỗng
    if (!pagesRaw || pagesRaw.length === 0) {
      pagesRaw = await db.collection('pages').find(query).sort({ _id: -1 }).toArray();
    }

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

// 9.2 GET /api/pages/:id - Chi tiết chính sách
app.get('/api/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildPageIdQuery(id);

    const page = await db.collection('pages_policies').findOne(query)
      || await db.collection('pages').findOne(query);

    if (!page) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chính sách' });
    }

    res.json({
      success: true,
      data: formatPage(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.3 POST /api/pages - Thêm chính sách mới vào MongoDB (pages_policies)
app.post('/api/pages', async (req, res) => {
  try {
    const body = req.body || {};
    const vi = body.vi || {};
    const en = body.en || {};

    const viTitle = (vi.title || body.title || '').trim();
    const enTitle = (en.title || '').trim();
    const title = viTitle || enTitle;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tiêu đề chính sách không được để trống' });
    }

    let slug = (body.titleUrl || body.slug || generateSlug(title)).trim().replace(/^\/+/, '');
    slug = generateSlug(slug);

    if (!slug) {
      slug = generateSlug(title);
    }

    // Kiểm tra trùng lặp titleUrl hoặc tiêu đề tiếng Việt trong pages_policies
    const dup = await db.collection('pages_policies').findOne({
      $or: [
        { titleUrl: slug },
        { 'vi.title': { $regex: `^${viTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
      ]
    });

    if (dup) {
      return res.status(400).json({ success: false, message: 'Tiêu đề chính sách hoặc đường dẫn (slug) đã tồn tại' });
    }

    const isPublished = body.isPublished !== undefined
      ? !!body.isPublished
      : (body.status === 'published' || body.status === 'active' || body.status === 'Đã xuất bản' || vi.visibility !== false);

    const viVisibility = vi.visibility !== undefined ? !!vi.visibility : isPublished;
    const enVisibility = en.visibility !== undefined ? !!en.visibility : isPublished;

    const viContent = vi.contentHTML !== undefined
      ? vi.contentHTML
      : (body.contentHTML !== undefined ? body.contentHTML : (body.content || ''));
    const enContent = en.contentHTML !== undefined
      ? en.contentHTML
      : (enTitle ? viContent : '');

    const viMeta = (vi.metaDescription !== undefined ? vi.metaDescription : (body.metaDescription || '')).trim();
    const enMeta = (en.metaDescription !== undefined ? en.metaDescription : '').trim();

    const now = new Date();

    const newPage = {
      titleUrl: slug,
      status: isPublished ? 'published' : 'draft',
      dateAdded: now,
      updatedAt: now,
      vi: {
        title: viTitle,
        contentHTML: viContent,
        visibility: viVisibility,
        metaDescription: viMeta
      },
      en: {
        title: enTitle || viTitle,
        contentHTML: enContent || viContent,
        visibility: enVisibility,
        metaDescription: enMeta || viMeta
      },
      __v: 0
    };

    // 1. Lưu chính thức vào collection 'pages_policies'
    const result = await db.collection('pages_policies').insertOne(newPage);
    const newDocId = result.insertedId;

    // 2. Đồng bộ song song sang collection 'pages' để đảm bảo toàn vẹn dữ liệu
    try {
      await db.collection('pages').updateOne(
        { _id: newDocId },
        { $set: newPage },
        { upsert: true }
      );
    } catch (mirrorErr) {
      console.warn('Warning mirroring to pages collection:', mirrorErr);
    }

    const created = await db.collection('pages_policies').findOne({ _id: newDocId });

    res.status(201).json({
      success: true,
      message: 'Tạo chính sách mới thành công',
      id: newDocId.toString(),
      data: formatPage(created)
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi tạo chính sách' });
  }
});

// 9.4 PUT / PATCH /api/pages/:id - Cập nhật chính sách trong MongoDB
const updatePageHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildPageIdQuery(id);

    const existing = await db.collection('pages_policies').findOne(query)
      || await db.collection('pages').findOne(query);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chính sách để chỉnh sửa' });
    }

    const body = req.body || {};
    const vi = body.vi || {};
    const en = body.en || {};

    const viTitle = (vi.title !== undefined ? vi.title : (body.title !== undefined ? body.title : existing.vi?.title || '')).trim();
    const enTitle = (en.title !== undefined ? en.title : (existing.en?.title || '')).trim();
    const title = viTitle || enTitle || existing.vi?.title || existing.en?.title || '';

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tiêu đề chính sách không được để trống' });
    }

    // Luôn giữ nguyên titleUrl hiện có từ cơ sở dữ liệu MongoDB, bỏ qua mọi thay đổi slug từ client
    const slug = existing.titleUrl || (existing.slug ? existing.slug.replace(/^\/+/, '') : '') || generateSlug(title);

    // Kiểm tra trùng lặp tiêu đề với các chính sách khác
    const dup = await db.collection('pages_policies').findOne({
      _id: { $ne: existing._id },
      'vi.title': { $regex: `^${viTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });

    if (dup) {
      return res.status(400).json({ success: false, message: 'Tiêu đề chính sách đã tồn tại' });
    }

    const isPublished = body.isPublished !== undefined
      ? !!body.isPublished
      : (body.status !== undefined
          ? (body.status === 'published' || body.status === 'active' || body.status === 'Đã xuất bản')
          : (existing.status === 'published' || existing.vi?.visibility !== false));

    const viVisibility = vi.visibility !== undefined ? !!vi.visibility : isPublished;
    const enVisibility = existing.en?.visibility !== undefined
      ? existing.en.visibility
      : (en.visibility !== undefined ? !!en.visibility : isPublished);

    const viContent = vi.contentHTML !== undefined
      ? vi.contentHTML
      : (body.contentHTML !== undefined ? body.contentHTML : (existing.vi?.contentHTML || ''));
    const enContent = existing.en?.contentHTML !== undefined
      ? existing.en.contentHTML
      : (en.contentHTML !== undefined ? en.contentHTML : '');

    const viMeta = (vi.metaDescription !== undefined ? vi.metaDescription : (body.metaDescription !== undefined ? body.metaDescription : (existing.vi?.metaDescription || ''))).trim();
    const enMeta = existing.en?.metaDescription !== undefined
      ? existing.en.metaDescription
      : (en.metaDescription !== undefined ? en.metaDescription : '').trim();

    const now = new Date();

    const updateFields = {
      titleUrl: slug,
      status: isPublished ? 'published' : 'draft',
      updatedAt: now,
      'vi.title': viTitle,
      'vi.contentHTML': viContent,
      'vi.visibility': viVisibility,
      'vi.metaDescription': viMeta,
      'en.title': existing.en?.title || enTitle || viTitle,
      'en.contentHTML': enContent || viContent,
      'en.visibility': enVisibility,
      'en.metaDescription': enMeta || viMeta
    };

    // 1. Cập nhật trong 'pages_policies'
    await db.collection('pages_policies').updateOne({ _id: existing._id }, { $set: updateFields });

    // 2. Đồng bộ sang 'pages'
    try {
      await db.collection('pages').updateOne({ _id: existing._id }, { $set: updateFields });
    } catch (mirrorErr) {
      console.warn('Warning mirroring update to pages collection:', mirrorErr);
    }

    const updated = await db.collection('pages_policies').findOne({ _id: existing._id });

    res.json({
      success: true,
      message: 'Cập nhật chính sách thành công',
      data: formatPage(updated)
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật chính sách' });
  }
};

app.put('/api/pages/:id', updatePageHandler);
app.patch('/api/pages/:id', updatePageHandler);

// 9.5 PATCH /api/pages/:id/status - Đổi trạng thái hiển thị
const togglePageStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildPageIdQuery(id);

    const existing = await db.collection('pages_policies').findOne(query)
      || await db.collection('pages').findOne(query);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chính sách' });
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
    const now = new Date();

    const updateFields = {
      status: newStatus,
      'vi.visibility': newPublished,
      'en.visibility': newPublished,
      updatedAt: now
    };

    // 1. Cập nhật trong 'pages_policies'
    await db.collection('pages_policies').updateOne({ _id: existing._id }, { $set: updateFields });

    // 2. Đồng bộ sang 'pages'
    try {
      await db.collection('pages').updateOne({ _id: existing._id }, { $set: updateFields });
    } catch (mirrorErr) {
      console.warn('Warning mirroring status toggle to pages:', mirrorErr);
    }

    const updated = await db.collection('pages_policies').findOne({ _id: existing._id });

    res.json({
      success: true,
      message: `Chính sách đã chuyển sang trạng thái "${newPublished ? 'Đã xuất bản' : 'Bản nháp'}"`,
      data: formatPage(updated)
    });
  } catch (error) {
    console.error('Error toggling page status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.patch('/api/pages/:id/status', togglePageStatusHandler);
app.put('/api/pages/:id/toggle', togglePageStatusHandler);

// 9.6 DELETE /api/pages/:id - Xóa chính sách khỏi MongoDB
app.delete('/api/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildPageIdQuery(id);

    const existing = await db.collection('pages_policies').findOne(query)
      || await db.collection('pages').findOne(query);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chính sách hoặc đã bị xóa' });
    }

    // 1. Xóa trong 'pages_policies'
    const result = await db.collection('pages_policies').deleteOne({ _id: existing._id });

    // 2. Xóa trong 'pages'
    try {
      await db.collection('pages').deleteOne({ _id: existing._id });
    } catch (mirrorErr) {
      console.warn('Warning mirroring delete to pages:', mirrorErr);
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chính sách hoặc đã bị xóa' });
    }

    res.json({
      success: true,
      message: 'Xóa chính sách thành công'
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.7 STOREFRONT COMPATIBILITY ENDPOINTS (Dành cho trang người dùng Chéri trên Vercel / Express)
app.get('/api/cheri/page/all', async (req, res) => {
  try {
    const lang = req.headers.lang || req.query.lang || 'vi';
    const titles = req.query.titles === 'true' || req.query.titles === true;
    const selectQuery = titles ? { titleUrl: 1, [`${lang}.title`]: 1, status: 1, isPublished: 1 } : {};
    let pages = await db.collection('pages_policies').find({}, { projection: selectQuery }).toArray();
    if (!pages || pages.length === 0) {
      pages = await db.collection('pages').find({}, { projection: selectQuery }).toArray();
    }
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cheri/page/:titleUrl', async (req, res) => {
  try {
    const { titleUrl } = req.params;
    const lang = req.headers.lang || req.query.lang || 'vi';
    let page = await db.collection('pages_policies').findOne(
      { titleUrl },
      { projection: { titleUrl: 1, [lang]: 1, status: 1, isPublished: 1 } }
    );
    if (!page) {
      page = await db.collection('pages').findOne(
        { titleUrl },
        { projection: { titleUrl: 1, [lang]: 1, status: 1, isPublished: 1 } }
      );
    }
    if (!page) {
      return res.status(404).json({ statusCode: 404, message: `Page with title ${titleUrl} not found` });
    }
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cheri/page', async (req, res) => {
  try {
    const body = req.body || {};
    const { titleUrl } = body;
    if (!titleUrl) {
      return res.status(400).json({ statusCode: 400, message: 'titleUrl is required' });
    }
    const existing = await db.collection('pages_policies').findOne({ titleUrl });
    const now = new Date();
    if (!existing) {
      const newDoc = { ...body, dateAdded: now, updatedAt: now };
      const r = await db.collection('pages_policies').insertOne(newDoc);
      await db.collection('pages').updateOne({ _id: r.insertedId }, { $set: newDoc }, { upsert: true });
      return res.json(newDoc);
    } else {
      const updateDoc = { ...body, updatedAt: now };
      await db.collection('pages_policies').updateOne({ _id: existing._id }, { $set: updateDoc });
      await db.collection('pages').updateOne({ _id: existing._id }, { $set: updateDoc });
      const updated = await db.collection('pages_policies').findOne({ _id: existing._id });
      return res.json(updated);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cheri/page/:titleUrl', async (req, res) => {
  try {
    const { titleUrl } = req.params;
    const result = await db.collection('pages_policies').deleteOne({ titleUrl });
    await db.collection('pages').deleteOne({ titleUrl });
    if (result.deletedCount === 0) {
      return res.status(404).json({ statusCode: 404, message: `Page with title ${titleUrl} not found` });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// 11.1b GET /api/settings/maintenance - Lấy riêng trạng thái bảo trì hệ thống (Public)
app.get('/api/settings/maintenance', async (req, res) => {
  try {
    let settings = await db.collection('settings').findOne({});
    if (!settings) {
      const result = await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
      settings = await db.collection('settings').findOne({ _id: result.insertedId });
    }
    const maintenance = settings?.maintenance || { enabled: false, message: 'Hệ thống đang bảo trì' };
    res.json({
      success: true,
      data: maintenance
    });
  } catch (error) {
    console.error('Error fetching maintenance settings:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi tải thông tin bảo trì' });
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

// ─────────────────────────────────────────────────────────────
// CHÉRI CMS HOME PAGE CONFIGURATION (COLLECTION: pages_home)
// Cấu hình duy nhất, không draft, không versioning
// ─────────────────────────────────────────────────────────────

// Middleware xác thực quyền Admin cho các endpoint CMS Home
async function requireHomeAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Thiếu access token xác thực' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789');
    if (!decoded || !decoded.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Token không hợp lệ' });
    }
    const user = await db.collection('users').findOne({ email: decoded.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Người dùng không tồn tại' });
    }
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    const isAdmin = userRoles.some(r => typeof r === 'string' && ['admin', 'superadmin', 'super-admin'].includes(r.toLowerCase())) || user.isAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Bạn không có quyền quản trị viên' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Token không hợp lệ hoặc đã hết hạn: ' + (err.message || '') });
  }
}

// 1. Public API: Lấy cấu hình trang chủ đã xuất bản duy nhất
app.get('/api/cheri/home', async (req, res) => {
  try {
    const homeDoc = await db.collection('pages_home').findOne({ key: 'home_page', status: 'published' });
    if (!homeDoc || !Array.isArray(homeDoc.sections)) {
      return res.json({ success: true, data: null, sections: [] });
    }
    const activeSections = homeDoc.sections
      .filter(sec => sec && sec.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return res.json({
      success: true,
      data: { ...homeDoc, sections: activeSections },
      sections: activeSections
    });
  } catch (err) {
    console.error('Error fetching published home configuration:', err);
    return res.json({ success: true, data: null, sections: [] });
  }
});

// 2. Admin API: Lấy cấu hình xuất bản hiện hành cho Admin CMS (Yêu cầu quyền Admin)
app.get('/api/cheri/home/admin', requireHomeAdminAuth, async (req, res) => {
  try {
    const homeDoc = await db.collection('pages_home').findOne({ key: 'home_page', status: 'published' });
    if (!homeDoc || !Array.isArray(homeDoc.sections)) {
      return res.json({ success: true, data: null, sections: [] });
    }
    const sortedSections = [...homeDoc.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return res.json({
      success: true,
      data: { ...homeDoc, sections: sortedSections },
      sections: sortedSections
    });
  } catch (err) {
    console.error('Error fetching admin home configuration:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tải cấu hình Home' });
  }
});

// 3. Admin API: Xuất bản cấu hình duy nhất lên database (Yêu cầu quyền Admin)
app.post('/api/cheri/home/publish', requireHomeAdminAuth, async (req, res) => {
  try {
    const sectionsToPublish = req.body?.sections;
    if (!sectionsToPublish || !Array.isArray(sectionsToPublish) || sectionsToPublish.length === 0) {
      return res.status(400).json({ success: false, message: 'Dữ liệu phân đoạn (sections) không hợp lệ hoặc rỗng' });
    }

    const editorEmail = req.adminUser?.email || req.body?.updatedBy || 'admin';
    const now = new Date();

    const publishedResult = await db.collection('pages_home').findOneAndUpdate(
      { key: 'home_page', status: 'published' },
      {
        $set: {
          key: 'home_page',
          status: 'published',
          sections: sectionsToPublish,
          publishedAt: now,
          updatedBy: editorEmail,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.json({
      success: true,
      message: 'Xuất bản cấu hình trang chủ thành công',
      data: publishedResult?.value || publishedResult
    });
  } catch (err) {
    console.error('Error publishing home configuration:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server khi xuất bản' });
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

