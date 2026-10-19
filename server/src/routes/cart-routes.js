const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

/**
 * Register Customer Cart Routes for Chéri Storefront
 * Handles full guest cart & user authenticated cart flow on Serverless Vercel / Express
 */
module.exports = function registerCartRoutes(app, { getDb, db: staticDb, formatProduct, connectToMongo }) {
  async function resolveDb() {
    if (typeof getDb === 'function') {
      const d = getDb();
      if (d) return d;
    }
    if (staticDb) return staticDb;
    if (typeof connectToMongo === 'function') {
      return await connectToMongo();
    }
    const adminServer = require('../../admin-server');
    return await adminServer.connectToMongo();
  }

  // Helper: Trích xuất user từ JWT nếu có
  async function getAuthenticatedUser(req) {
    try {
      const db = await resolveDb();
      const authHeader = req.headers.authorization || '';
      let token = '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else if (req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:jwt|token|accessToken)=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }

      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789'
        );
        if (decoded && decoded.email) {
          return await db.collection('users').findOne({ email: decoded.email.toLowerCase() });
        }
        if (decoded && decoded.id && ObjectId.isValid(decoded.id)) {
          return await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
        }
      }
    } catch (_) {}
    return null;
  }

  // Helper: Lấy danh sách raw items từ database
  async function getRawCartItems(req, user) {
    const db = await resolveDb();
    if (user && user._id) {
      const freshUser = await db.collection('users').findOne({ _id: user._id });
      return (freshUser && freshUser.cart && Array.isArray(freshUser.cart.items))
        ? freshUser.cart.items
        : [];
    }

    const guestCartId = req.headers['x-guest-cart-id'] || req.query.guestCartId;
    if (guestCartId) {
      const guestCart = await db.collection('guest_carts').findOne({ guestCartId });
      return (guestCart && Array.isArray(guestCart.items)) ? guestCart.items : [];
    }
    return [];
  }

  // Helper: Lưu danh sách raw items vào database
  async function saveRawCartItems(req, user, items) {
    const db = await resolveDb();
    const cleanItems = items.map((i) => ({
      id: i.id,
      productId: i.productId ? i.productId.toString() : (i.id ? i.id.split('_')[0] : ''),
      variantId: i.variantId || null,
      qty: Math.max(1, Number(i.qty || i.quantity || 1)),
      isSelected: i.isSelected !== false,
      selectedClassification: i.selectedClassification || null,
      selectedColor: i.selectedColor || null,
      selectedSize: i.selectedSize || null,
    }));

    if (user && user._id) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { 'cart.items': cleanItems, updatedAt: new Date() } }
      );
      return cleanItems;
    }

    const guestCartId = req.headers['x-guest-cart-id'] || req.query.guestCartId;
    if (guestCartId) {
      await db.collection('guest_carts').updateOne(
        { guestCartId },
        {
          $set: { guestCartId, items: cleanItems, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
    }
    return cleanItems;
  }

  // Helper: Chuẩn hóa giỏ hàng và format từng item theo đúng Angular model
  async function buildCartResponse(rawItems, lang = 'vi') {
    const db = await resolveDb();
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return {
        totalQty: 0,
        totalPrice: 0,
        shippingCost: 0,
        shippingLimit: 0,
        shippingType: 'default',
        items: [],
      };
    }

    // Lấy danh sách productIds hợp lệ
    const productIds = [];
    for (const item of rawItems) {
      const rawPid = item.productId || (item.id ? item.id.split('_')[0] : '');
      if (rawPid && ObjectId.isValid(rawPid) && rawPid.length === 24) {
        productIds.push(new ObjectId(rawPid));
      }
    }

    const products = productIds.length > 0
      ? await db.collection('products').find({ _id: { $in: productIds } }).toArray()
      : [];
    const prodMap = new Map(products.map((p) => [p._id.toString(), p]));

    const formattedItems = [];
    let totalPrice = 0;
    let totalQty = 0;

    for (const raw of rawItems) {
      const prodId = raw.productId || (raw.id ? raw.id.split('_')[0] : '');
      const product = prodMap.get(prodId);
      if (!product) continue;

      const preparedItem = formatProduct(product, lang);
      const allVariants = Array.isArray(preparedItem.variants) ? preparedItem.variants : [];

      // Tìm variant tương ứng
      let variant = null;
      if (raw.variantId && allVariants.length > 0) {
        variant = allVariants.find(
          (v) =>
            (v._id && v._id.toString() === raw.variantId) ||
            v.id === raw.variantId ||
            v.sku === raw.variantId
        );
      }
      if (!variant && (raw.selectedClassification || raw.selectedColor || raw.selectedSize)) {
        variant = allVariants.find((v) => {
          const mClass = !raw.selectedClassification || v.classification === raw.selectedClassification;
          const mColor = !raw.selectedColor || v.color === raw.selectedColor;
          const mSize = !raw.selectedSize || v.size === raw.selectedSize;
          return mClass && mColor && mSize;
        });
      }
      if (!variant && allVariants.length > 0 && !raw.variantId) {
        variant = allVariants[0];
      }

      let price = Number(preparedItem.salePrice || preparedItem.price || 0);
      let regularPrice = Number(preparedItem.regularPrice || preparedItem.price || 0);
      let stock = Number(preparedItem.quantity || preparedItem.stock || 999);
      let sku = preparedItem.sku || '';

      if (variant) {
        const vReg = Number(variant.price) || regularPrice;
        const vDisc = Number(variant.discountPrice) || 0;
        if (vDisc > 0 && vDisc < vReg) {
          price = vDisc;
          regularPrice = vReg;
        } else {
          price = vReg;
          regularPrice = vReg;
        }
        stock = Math.max(0, Number(variant.stock) || 0);
        sku = variant.sku || sku;
      }

      const normalizedVarId = variant ? (variant._id?.toString() || variant.id || variant.sku) : (raw.variantId || null);
      const cartItemId = normalizedVarId ? `${prodId}_${normalizedVarId}` : prodId;
      const qty = Math.max(1, Number(raw.qty || raw.quantity || 1));
      const isSelected = raw.isSelected !== false;

      if (isSelected) {
        totalQty += qty;
        totalPrice += price * qty;
      }

      formattedItems.push({
        id: cartItemId,
        item: preparedItem,
        qty,
        price,
        regularPrice,
        stock,
        sku,
        isSelected,
        variantId: normalizedVarId,
        selectedClassification: variant?.classification || raw.selectedClassification || null,
        selectedColor: variant?.color || raw.selectedColor || null,
        selectedSize: variant?.size || raw.selectedSize || null,
        variant: variant || null,
      });
    }

    return {
      totalQty,
      totalPrice,
      shippingCost: 0,
      shippingLimit: 0,
      shippingType: 'default',
      items: formattedItems,
    };
  }

  // 1. GET /api/cart — Lấy giỏ hàng hiện tại
  app.get('/api/cart', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const rawItems = await getRawCartItems(req, user);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart:', err);
      return res.json({ totalQty: 0, totalPrice: 0, shippingCost: 0, shippingLimit: 0, items: [] });
    }
  });

  // 2. GET /api/cart/add — Thêm sản phẩm vào giỏ
  app.get('/api/cart/add', async (req, res) => {
    try {
      const db = await resolveDb();
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const { id, variantId, classification, color, size, qty } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Thiếu id sản phẩm' });
      }

      const productId = id.toString().split('_')[0];
      if (!ObjectId.isValid(productId) || productId.length !== 24) {
        return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
      }

      const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
      }

      const qtyToAdd = Math.max(1, Math.floor(Number(qty) || 1));
      const targetVarId = variantId ? String(variantId).trim() : null;
      const cartItemId = targetVarId ? `${productId}_${targetVarId}` : productId;

      let rawItems = await getRawCartItems(req, user);
      const existing = rawItems.find((i) => {
        const itemPid = i.productId || (i.id ? i.id.split('_')[0] : '');
        const itemVid = i.variantId ? String(i.variantId).trim() : null;
        return (i.id === cartItemId) || (itemPid === productId && itemVid === targetVarId);
      });

      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + qtyToAdd;
        existing.id = cartItemId;
        if (targetVarId) existing.variantId = targetVarId;
      } else {
        rawItems.push({
          id: cartItemId,
          productId,
          variantId: targetVarId,
          qty: qtyToAdd,
          isSelected: true,
          selectedClassification: classification || null,
          selectedColor: color || null,
          selectedSize: size || null,
        });
      }

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/add:', err);
      return res.status(500).json({ error: 'Lỗi khi thêm vào giỏ hàng' });
    }
  });

  // 3. GET /api/cart/remove — Giảm số lượng hoặc xóa khỏi giỏ
  app.get('/api/cart/remove', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const id = req.query.id;

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems
        .map((i) => {
          if (i.id === id) {
            const currentQty = Number(i.qty || 1);
            if (currentQty > 1) {
              return { ...i, qty: currentQty - 1 };
            }
            return null;
          }
          return i;
        })
        .filter(Boolean);

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/remove:', err);
      return res.status(500).json({ error: 'Lỗi khi giảm sản phẩm khỏi giỏ hàng' });
    }
  });

  // 4. GET /api/cart/update-quantity — Cập nhật trực tiếp số lượng
  app.get('/api/cart/update-quantity', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const { id, qty } = req.query;
      const targetQty = Math.max(1, Math.floor(Number(qty) || 1));

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems.map((i) => {
        if (i.id === id) {
          return { ...i, qty: targetQty };
        }
        return i;
      });

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/update-quantity:', err);
      return res.status(500).json({ error: 'Lỗi cập nhật số lượng' });
    }
  });

  // 5. GET /api/cart/delete-item — Xóa hoàn toàn 1 sản phẩm
  app.get('/api/cart/delete-item', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const id = req.query.id;

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems.filter((i) => i.id !== id);

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/delete-item:', err);
      return res.status(500).json({ error: 'Lỗi xóa sản phẩm' });
    }
  });

  // 6. GET /api/cart/delete-items — Xóa nhiều sản phẩm
  app.get('/api/cart/delete-items', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const idsParam = req.query.ids || '';
      const idsToDelete = new Set(idsParam.split(',').map((id) => decodeURIComponent(id.trim())));

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems.filter((i) => !idsToDelete.has(i.id));

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/delete-items:', err);
      return res.status(500).json({ error: 'Lỗi xóa nhiều sản phẩm' });
    }
  });

  // 7. GET /api/cart/update-variant — Đổi phân loại / biến thể trong giỏ
  app.get('/api/cart/update-variant', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const { id, variantId, classification, color, size } = req.query;

      let rawItems = await getRawCartItems(req, user);
      const targetItem = rawItems.find((i) => i.id === id);

      if (targetItem) {
        const prodId = targetItem.productId || (targetItem.id ? targetItem.id.split('_')[0] : '');
        const newVarId = variantId ? String(variantId).trim() : null;
        const newCartItemId = newVarId ? `${prodId}_${newVarId}` : prodId;

        // Nếu đã có item với variant này, gộp số lượng
        const duplicate = rawItems.find((i) => i.id !== id && (i.id === newCartItemId || (i.productId === prodId && i.variantId === newVarId)));
        if (duplicate) {
          duplicate.qty = (Number(duplicate.qty) || 0) + (Number(targetItem.qty) || 1);
          rawItems = rawItems.filter((i) => i.id !== id);
        } else {
          targetItem.id = newCartItemId;
          targetItem.variantId = newVarId;
          targetItem.selectedClassification = classification || targetItem.selectedClassification;
          targetItem.selectedColor = color || targetItem.selectedColor;
          targetItem.selectedSize = size || targetItem.selectedSize;
        }
      }

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json({ cart, capped: false, oldQty: targetItem?.qty || 1, newQty: targetItem?.qty || 1 });
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/update-variant:', err);
      return res.status(500).json({ error: 'Lỗi đổi phân loại sản phẩm' });
    }
  });

  // 8. GET /api/cart/toggle-select — Chọn / Bỏ chọn 1 sản phẩm để thanh toán
  app.get('/api/cart/toggle-select', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const { id, selected } = req.query;
      const isSelected = selected === 'true' || selected === true;

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems.map((i) => {
        if (i.id === id) {
          return { ...i, isSelected };
        }
        return i;
      });

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/toggle-select:', err);
      return res.status(500).json({ error: 'Lỗi cập nhật trạng thái chọn' });
    }
  });

  // 9. GET /api/cart/select-all — Chọn tất cả / Bỏ chọn tất cả
  app.get('/api/cart/select-all', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const { selected } = req.query;
      const isSelected = selected === 'true' || selected === true;

      let rawItems = await getRawCartItems(req, user);
      rawItems = rawItems.map((i) => ({ ...i, isSelected }));

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] GET /api/cart/select-all:', err);
      return res.status(500).json({ error: 'Lỗi chọn tất cả' });
    }
  });

  // 10. POST /api/cart/merge — Gộp giỏ hàng khách khi đăng nhập
  app.post('/api/cart/merge', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const lang = req.query.lang || req.headers.lang || 'vi';
      const guestItems = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!user) {
        const cart = await buildCartResponse(guestItems, lang);
        return res.json(cart);
      }

      let rawItems = await getRawCartItems(req, user);
      for (const gi of guestItems) {
        const gPid = gi.productId || (gi.id ? gi.id.split('_')[0] : '');
        const gVid = gi.variantId ? String(gi.variantId).trim() : null;
        const gCartId = gi.id || (gVid ? `${gPid}_${gVid}` : gPid);

        const existing = rawItems.find((i) => {
          const iPid = i.productId || (i.id ? i.id.split('_')[0] : '');
          const iVid = i.variantId ? String(i.variantId).trim() : null;
          return i.id === gCartId || (iPid === gPid && iVid === gVid);
        });

        if (existing) {
          existing.qty = (Number(existing.qty) || 0) + (Number(gi.qty) || 1);
        } else {
          rawItems.push({
            id: gCartId,
            productId: gPid,
            variantId: gVid,
            qty: Math.max(1, Number(gi.qty) || 1),
            isSelected: gi.isSelected !== false,
            selectedClassification: gi.selectedClassification || null,
            selectedColor: gi.selectedColor || null,
            selectedSize: gi.selectedSize || null,
          });
        }
      }

      await saveRawCartItems(req, user, rawItems);
      const cart = await buildCartResponse(rawItems, lang);
      return res.json(cart);
    } catch (err) {
      console.error('[Cart API Error] POST /api/cart/merge:', err);
      return res.status(500).json({ error: 'Lỗi gộp giỏ hàng' });
    }
  });
};
