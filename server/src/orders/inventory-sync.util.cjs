'use strict';

const { ObjectId } = require('mongodb');

// Danh sách các trạng thái đơn hàng giữ chỗ tồn kho
const RESERVED_ORDER_STATUSES = new Set([
  'CONFIRMED',
  'PROCESSING',
  'SHIPPING',
  'DELIVERED',
  'ĐÃ XÁC NHẬN',
  'ĐANG XỬ LÝ',
  'ĐANG GIAO',
  'ĐANG GIAO HÀNG',
  'ĐÃ GIAO',
  'ĐÃ GIAO HÀNG'
]);

// Danh sách các trạng thái không giữ chỗ hoặc đã giải phóng
const UNRESERVED_OR_RELEASED_STATUSES = new Set([
  'PENDING',
  'CANCELLED',
  'RETURNED',
  'CHỜ XÁC NHẬN',
  'ĐÃ HỦY',
  'ĐÃ TRẢ HÀNG',
  'ĐÃ HOÀN TRẢ',
  'NEW'
]);

const LOW_STOCK_THRESHOLD = 5;

/**
 * Kiểm tra xem một đơn hàng có đang giữ chỗ tồn kho hay không
 */
function isOrderHoldingReservation(order) {
  if (!order) return false;
  if (order.inventoryReleasedAt || order.inventoryRestoredAt) {
    return false;
  }
  const status = String(order.status || order.statusHistory?.[0]?.status || '').trim().toUpperCase();
  if (UNRESERVED_OR_RELEASED_STATUSES.has(status)) {
    return false;
  }
  return RESERVED_ORDER_STATUSES.has(status) || Boolean(order.inventoryReservedAt);
}

/**
 * Trích xuất danh sách sản phẩm chuẩn hóa từ đơn hàng (hỗ trợ cả items chuẩn và cart.items legacy)
 */
function extractNormalizedOrderItems(order) {
  if (!order) return [];
  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : (Array.isArray(order.cart?.items) ? order.cart.items : []);

  const result = [];
  for (const item of rawItems) {
    if (!item) continue;
    const itemObj = item.item || item;
    const rawProdId = (item.productId || itemObj._id || itemObj.id || item.id || '')?.toString();
    const cleanProdId = rawProdId.includes('_') ? rawProdId.split('_')[0] : rawProdId;

    const qty = Math.max(1, Number(item.quantity ?? item.qty ?? 1));

    const sku = (
      item.sku ||
      item.productSnapshot?.sku ||
      itemObj.sku ||
      item.variantSku ||
      itemObj.variant?.sku ||
      item.variant?.sku ||
      ''
    ).toString().trim();

    const variantId = (
      item.variantId ||
      itemObj.variant?._id ||
      itemObj.variant?.id ||
      item.variant?._id ||
      item.variant?.id ||
      (typeof item.id === 'string' && item.id.includes('_') ? item.id.split('_').slice(1).join('_') : '') ||
      ''
    ).toString().trim();

    const color = (
      item.variant?.color ||
      itemObj.variant?.color ||
      item.productSnapshot?.variant?.color ||
      ''
    ).toString().trim();

    const size = (
      item.variant?.size ||
      itemObj.variant?.size ||
      item.productSnapshot?.variant?.size ||
      ''
    ).toString().trim();

    const classification = (
      item.variant?.classification ||
      itemObj.variant?.classification ||
      item.productSnapshot?.variant?.classification ||
      ''
    ).toString().trim();

    const title = (
      item.productSnapshot?.title ||
      item.productSnapshot?.name ||
      item.name ||
      itemObj.title ||
      itemObj.vi?.title ||
      'Sản phẩm'
    ).toString().trim();

    result.push({
      productId: cleanProdId,
      sku,
      variantId,
      quantity: qty,
      color,
      size,
      classification,
      title
    });
  }
  return result;
}

/**
 * Gộp các sản phẩm cùng SKU/biến thể trong cùng một đơn hàng
 */
function groupOrderDemands(orderItems) {
  const map = new Map();
  for (const item of orderItems) {
    const pId = String(item.productId || '');
    const vSku = (item.sku || '').toLowerCase().trim();
    const vId = (item.variantId || '').toLowerCase().trim();
    const vColor = (item.color || '').toLowerCase().trim();
    const vSize = (item.size || '').toLowerCase().trim();

    const key = `${pId}__${vSku}__${vId}__${vColor}__${vSize}`;
    if (!map.has(key)) {
      map.set(key, { ...item });
    } else {
      const existing = map.get(key);
      existing.quantity += item.quantity;
    }
  }
  return Array.from(map.values());
}

/**
 * Tìm biến thể tương ứng trong sản phẩm
 */
function findProductVariant(product, itemDemand) {
  if (!product) return null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0) {
    return { hasVariants: false, matchedIndex: -1, variant: null };
  }

  const targetSku = (itemDemand.sku || '').toLowerCase().trim();
  const targetVarId = (itemDemand.variantId || '').toLowerCase().trim();
  const targetColor = (itemDemand.color || '').toLowerCase().trim();
  const targetSize = (itemDemand.size || '').toLowerCase().trim();
  const targetClass = (itemDemand.classification || '').toLowerCase().trim();

  // 1. Khớp chính xác theo SKU của biến thể
  if (targetSku) {
    const idx = variants.findIndex(v => (v.sku || '').toLowerCase().trim() === targetSku);
    if (idx !== -1) {
      return { hasVariants: true, matchedIndex: idx, variant: variants[idx] };
    }
  }

  // 2. Khớp chính xác theo ID của biến thể
  if (targetVarId) {
    const idx = variants.findIndex(v => {
      const vid = (v._id || v.id || '').toString().toLowerCase().trim();
      return vid && vid === targetVarId;
    });
    if (idx !== -1) {
      return { hasVariants: true, matchedIndex: idx, variant: variants[idx] };
    }
  }

  // 3. Khớp theo Màu sắc và Kích thước (và Phân loại nếu có)
  if (targetColor || targetSize) {
    const idx = variants.findIndex(v => {
      const vColor = (v.color || '').toLowerCase().trim();
      const vSize = (v.size || '').toLowerCase().trim();
      const vClass = (v.classification || '').toLowerCase().trim();
      const colorMatches = !targetColor || vColor === targetColor;
      const sizeMatches = !targetSize || vSize === targetSize;
      const classMatches = !targetClass || !vClass || vClass === targetClass;
      return colorMatches && sizeMatches && classMatches;
    });
    if (idx !== -1) {
      return { hasVariants: true, matchedIndex: idx, variant: variants[idx] };
    }
  }

  // 4. Nếu chỉ có duy nhất 1 biến thể thì mặc định là biến thể đó
  if (variants.length === 1) {
    return { hasVariants: true, matchedIndex: 0, variant: variants[0] };
  }

  return { hasVariants: true, matchedIndex: -1, variant: null };
}

/**
 * Tính bảng giữ chỗ tồn kho từ các đơn hàng đang có hiệu lực giữ chỗ trong cơ sở dữ liệu
 */
async function calculateActiveReservationMaps(db, options = {}) {
  const { session = null, excludeOrderId = null } = options;
  const query = {
    status: {
      $in: [
        'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED',
        'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Đang giao hàng', 'Đã giao', 'Đã giao hàng'
      ]
    },
    inventoryReleasedAt: { $in: [null, undefined] },
    inventoryRestoredAt: { $in: [null, undefined] }
  };

  if (excludeOrderId) {
    const trimmedExId = String(excludeOrderId).trim();
    if (ObjectId.isValid(trimmedExId)) {
      query._id = { $ne: new ObjectId(trimmedExId) };
    } else {
      query.orderId = { $ne: trimmedExId };
    }
  }

  const findOptions = session ? { session } : {};
  const activeOrders = await db.collection('orders').find(query, findOptions).toArray();

  const prodReservedMap = new Map();
  const variantReservedMap = new Map();

  for (const order of activeOrders) {
    const items = extractNormalizedOrderItems(order);
    for (const it of items) {
      if (!it.productId) continue;
      const prodIdStr = String(it.productId);
      prodReservedMap.set(prodIdStr, (prodReservedMap.get(prodIdStr) || 0) + it.quantity);

      if (it.sku) {
        const key = `${prodIdStr}__sku__${it.sku.toLowerCase()}`;
        variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + it.quantity);
      }
      if (it.variantId) {
        const key = `${prodIdStr}__varid__${it.variantId.toLowerCase()}`;
        variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + it.quantity);
      }
      if (it.color || it.size) {
        const key = `${prodIdStr}__attrs__${it.color.toLowerCase()}__${it.size.toLowerCase()}`;
        variantReservedMap.set(key, (variantReservedMap.get(key) || 0) + it.quantity);
      }
    }
  }

  return { prodReservedMap, variantReservedMap, activeOrders };
}

/**
 * Lấy số lượng đã đặt của một biến thể cụ thể từ map
 */
function getVariantReservedCount(variantReservedMap, prodIdStr, v) {
  if (!variantReservedMap || !prodIdStr || !v) return 0;
  const vSku = (v.sku || '').toLowerCase().trim();
  const vId = (v._id || v.id || '').toString().toLowerCase().trim();
  const vColor = (v.color || '').toLowerCase().trim();
  const vSize = (v.size || '').toLowerCase().trim();

  if (vSku && variantReservedMap.has(`${prodIdStr}__sku__${vSku}`)) {
    return variantReservedMap.get(`${prodIdStr}__sku__${vSku}`);
  }
  if (vId && variantReservedMap.has(`${prodIdStr}__varid__${vId}`)) {
    return variantReservedMap.get(`${prodIdStr}__varid__${vId}`);
  }
  if ((vColor || vSize) && variantReservedMap.has(`${prodIdStr}__attrs__${vColor}__${vSize}`)) {
    return variantReservedMap.get(`${prodIdStr}__attrs__${vColor}__${vSize}`);
  }
  return 0;
}

/**
 * Tìm sản phẩm theo id (hỗ trợ ObjectId và string)
 */
async function findProductById(db, productId, session = null) {
  if (!productId) return null;
  const idStr = String(productId).trim();
  const queries = [];
  if (ObjectId.isValid(idStr)) {
    queries.push({ _id: new ObjectId(idStr) });
  }
  queries.push({ _id: idStr }, { id: idStr });

  const findOptions = session ? { session } : {};
  return await db.collection('products').findOne({ $or: queries }, findOptions);
}

/**
 * Kiểm tra tính khả dụng của tồn kho trước khi xác nhận đơn hàng
 */
async function checkOrderStockAvailability(db, order, session = null) {
  const items = extractNormalizedOrderItems(order);
  if (items.length === 0) {
    return { success: true, demands: [] };
  }

  const demands = groupOrderDemands(items);
  const { prodReservedMap, variantReservedMap } = await calculateActiveReservationMaps(db, {
    session,
    excludeOrderId: order._id || order.orderId
  });

  for (const demand of demands) {
    const product = await findProductById(db, demand.productId, session);
    if (!product) {
      throw new Error(`Sản phẩm "${demand.title || demand.productId}" không tồn tại trong hệ thống.`);
    }

    const prodIdStr = product._id.toString();
    const vi = product.vi || {};
    const prodTitle = vi.title || product.title || demand.title || 'Sản phẩm';
    const match = findProductVariant(product, demand);

    let stock = 0;
    let reserved = 0;
    let available = 0;
    let itemLabel = prodTitle;

    if (match && match.hasVariants) {
      if (match.matchedIndex === -1 || !match.variant) {
        throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm "${prodTitle}" (SKU: ${demand.sku || 'N/A'}).`);
      }
      const v = match.variant;
      stock = Math.max(0, Number(v.stock) || 0);
      reserved = getVariantReservedCount(variantReservedMap, prodIdStr, v);
      available = Math.max(0, stock - reserved);
      itemLabel = `${prodTitle} - ${v.color || ''} ${v.size || ''} (SKU: ${v.sku || demand.sku || 'N/A'})`.trim();
    } else {
      // Sản phẩm đơn không có biến thể
      if (product.stock !== undefined && product.stock !== null && !isNaN(Number(product.stock))) {
        stock = Number(product.stock);
      } else if (vi.stock !== undefined && vi.stock !== null && !isNaN(Number(vi.stock))) {
        stock = Number(vi.stock);
      } else if (vi.quantity !== undefined && vi.quantity !== null && !isNaN(Number(vi.quantity))) {
        stock = Number(vi.quantity);
      } else if (product.quantity !== undefined && product.quantity !== null && !isNaN(Number(product.quantity))) {
        stock = Number(product.quantity);
      }
      stock = Math.max(0, stock);
      reserved = prodReservedMap.get(prodIdStr) || 0;
      available = Math.max(0, stock - reserved);
      itemLabel = `${prodTitle} (SKU: ${product.sku || vi.sku || demand.sku || 'N/A'})`.trim();
    }

    if (available < demand.quantity) {
      throw new Error(
        `Sản phẩm "${itemLabel}" không đủ số lượng có thể bán (yêu cầu: ${demand.quantity}, hiện có thể bán: ${available}).`
      );
    }
  }

  return { success: true, demands };
}

/**
 * Thực hiện giữ chỗ tồn kho khi chuyển đơn hàng sang ĐÃ XÁC NHẬN
 */
async function reserveOrderInventory(db, order, session = null) {
  // Idempotent: Nếu đơn hàng đã từng giữ chỗ thì không thực hiện lại
  if (order.inventoryReservedAt) {
    return { success: true, alreadyReserved: true };
  }

  // Kiểm tra khả dụng của toàn bộ sản phẩm trong đơn hàng
  const { demands } = await checkOrderStockAvailability(db, order, session);

  const now = new Date();
  const updateDoc = {
    inventoryReservedAt: now,
    inventoryReleasedAt: null,
    inventoryRestoredAt: null
  };

  const historyEntry = {
    action: 'RESERVE',
    timestamp: now,
    note: 'Giữ chỗ tồn kho khi xác nhận đơn hàng',
    demands
  };

  return {
    success: true,
    updateDoc,
    historyEntry,
    demands
  };
}

/**
 * Giải phóng lượng hàng giữ chỗ khi hủy đơn hàng đã xác nhận
 */
async function releaseOrderInventory(db, order, session = null) {
  const currentStatus = String(order.status || order.statusHistory?.[0]?.status || '').trim().toUpperCase();
  const wasReserved = Boolean(order.inventoryReservedAt) || RESERVED_ORDER_STATUSES.has(currentStatus);

  // Nếu đơn hàng chưa từng được giữ chỗ (ví dụ đang ở PENDING), không có gì cần giải phóng
  if (!wasReserved) {
    return { success: true, notReserved: true };
  }

  // Idempotent: Nếu đã giải phóng trước đó thì không giải phóng lại
  if (order.inventoryReleasedAt) {
    return { success: true, alreadyReleased: true };
  }

  const now = new Date();
  const updateDoc = {
    inventoryReleasedAt: now
  };

  const historyEntry = {
    action: 'RELEASE',
    timestamp: now,
    note: 'Giải phóng hàng giữ chỗ do hủy đơn hàng'
  };

  return {
    success: true,
    updateDoc,
    historyEntry
  };
}

/**
 * Hoàn trả lại tồn kho vào kho hàng khi đơn hàng chuyển sang ĐÃ TRẢ HÀNG
 */
async function restoreOrderInventory(db, order, session = null) {
  const currentStatus = String(order.status || order.statusHistory?.[0]?.status || '').trim().toUpperCase();
  const wasReserved = Boolean(order.inventoryReservedAt) || RESERVED_ORDER_STATUSES.has(currentStatus);

  // Không cộng kho nếu đơn hàng chưa từng bị trừ hoặc giữ chỗ (Case 5)
  if (!wasReserved && currentStatus === 'PENDING') {
    return { success: true, notEligible: true, message: 'Đơn hàng chưa từng giữ chỗ nên không cần hoàn kho.' };
  }

  // Idempotent: Không cộng kho nhiều lần khi cập nhật lại trạng thái Đã trả hàng (Case 5)
  if (order.inventoryRestoredAt) {
    return { success: true, alreadyRestored: true, message: 'Đơn hàng này đã được hoàn kho trước đó.' };
  }

  const items = extractNormalizedOrderItems(order);
  const demands = groupOrderDemands(items);
  const restoredItems = [];

  for (const demand of demands) {
    const product = await findProductById(db, demand.productId, session);
    if (!product) continue;

    const prodId = product._id;
    const match = findProductVariant(product, demand);
    const qty = demand.quantity;

    if (match && match.hasVariants && match.matchedIndex !== -1) {
      const idx = match.matchedIndex;
      const updatedVariants = product.variants.map((v, i) => {
        if (i === idx) {
          const prev = Math.max(0, Number(v.stock) || 0);
          return { ...v, stock: prev + qty };
        }
        return v;
      });

      const totalStock = updatedVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

      const updateSet = {
        variants: updatedVariants,
        'vi.stock': totalStock,
        'vi.quantity': totalStock,
        stock: totalStock,
        quantity: totalStock,
        updatedAt: new Date()
      };

      const updateOptions = session ? { session } : {};
      await db.collection('products').updateOne({ _id: prodId }, { $set: updateSet }, updateOptions);

      restoredItems.push({
        productId: prodId.toString(),
        variantSku: match.variant?.sku || demand.sku,
        quantity: qty,
        previousStock: match.variant?.stock,
        newStock: (Number(match.variant?.stock) || 0) + qty
      });
    } else {
      // Sản phẩm đơn
      const vi = product.vi || {};
      let prevStock = 0;
      if (product.stock !== undefined && product.stock !== null && !isNaN(Number(product.stock))) {
        prevStock = Number(product.stock);
      } else if (vi.stock !== undefined && vi.stock !== null && !isNaN(Number(vi.stock))) {
        prevStock = Number(vi.stock);
      } else if (vi.quantity !== undefined && vi.quantity !== null && !isNaN(Number(vi.quantity))) {
        prevStock = Number(vi.quantity);
      } else if (product.quantity !== undefined && product.quantity !== null && !isNaN(Number(product.quantity))) {
        prevStock = Number(product.quantity);
      }
      prevStock = Math.max(0, prevStock);
      const newStock = prevStock + qty;

      const updateSet = {
        'vi.stock': newStock,
        'vi.quantity': newStock,
        stock: newStock,
        quantity: newStock,
        updatedAt: new Date()
      };

      const updateOptions = session ? { session } : {};
      await db.collection('products').updateOne({ _id: prodId }, { $set: updateSet }, updateOptions);

      restoredItems.push({
        productId: prodId.toString(),
        quantity: qty,
        previousStock: prevStock,
        newStock
      });
    }
  }

  const now = new Date();
  const updateDoc = {
    inventoryRestoredAt: now,
    inventoryReleasedAt: now
  };

  const historyEntry = {
    action: 'RESTORE',
    timestamp: now,
    note: 'Hoàn trả tồn kho do khách trả hàng',
    restoredItems
  };

  return {
    success: true,
    updateDoc,
    historyEntry,
    restoredItems
  };
}

/**
 * Lấy toàn bộ danh sách tồn kho cho giao diện Quản lý tồn kho
 */
async function buildInventoryList(db, session = null) {
  const findOptions = session ? { session } : {};
  const [productsRaw, { prodReservedMap, variantReservedMap }] = await Promise.all([
    db.collection('products').find({}, findOptions).sort({ updatedAt: -1, _id: -1 }).toArray(),
    calculateActiveReservationMaps(db, { session })
  ]);

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
        const vSku = (v.sku || '').trim();
        const vReserved = getVariantReservedCount(variantReservedMap, prodIdStr, v);
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
      title: name,
      image: p.mainImage?.url || (Array.isArray(p.images) && p.images[0]) || '',
      hasVariants,
      sku: sku || '---',
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

  return { success: true, total: data.length, data };
}

/**
 * Lấy chi tiết tồn kho cho 1 sản phẩm cụ thể
 */
async function buildInventoryDetail(db, productId, session = null) {
  const product = await findProductById(db, productId, session);
  if (!product) {
    return { success: false, message: 'Không tìm thấy thông tin sản phẩm trong kho.' };
  }

  const { prodReservedMap, variantReservedMap } = await calculateActiveReservationMaps(db, { session });
  const prodIdStr = product._id.toString();
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
      const vSku = (v.sku || '').trim();
      const vReserved = getVariantReservedCount(variantReservedMap, prodIdStr, v);
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
        discountPrice: v.discountPrice !== undefined ? v.discountPrice : (product.discountPrice || 0),
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
    reserved = prodReservedMap.get(prodIdStr) || 0;
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

  return {
    success: true,
    data: {
      id: prodIdStr,
      _id: prodIdStr,
      name,
      title: name,
      mainImage: product.mainImage?.url || (Array.isArray(product.images) && product.images[0]) || '',
      images: Array.isArray(product.images) ? product.images : [],
      sku: sku || '---',
      hasVariants,
      stock,
      quantity: stock,
      reserved,
      available,
      status,
      statusVariant,
      variants: calculatedVariants,
      category: vi.categoryLevel1 || product.categoryLevel1 || 'Thời trang',
      raw: product
    }
  };
}

module.exports = {
  RESERVED_ORDER_STATUSES,
  UNRESERVED_OR_RELEASED_STATUSES,
  LOW_STOCK_THRESHOLD,
  isOrderHoldingReservation,
  extractNormalizedOrderItems,
  groupOrderDemands,
  findProductVariant,
  calculateActiveReservationMaps,
  getVariantReservedCount,
  findProductById,
  checkOrderStockAvailability,
  reserveOrderInventory,
  releaseOrderInventory,
  restoreOrderInventory,
  buildInventoryList,
  buildInventoryDetail
};

