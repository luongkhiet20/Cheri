const mongoose = require('c:/Users/ACER/Downloads/Cheri/node_modules/mongoose');

const uri = "mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority";

async function seed() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB Atlas!");
    const db = mongoose.connection.db;

    // 1. Find user ngguyen@gmail.com
    const user = await db.collection('users').findOne({ email: 'ngguyen@gmail.com' });
    if (!user) {
      throw new Error("User ngguyen@gmail.com not found!");
    }
    console.log(`Found target user: ${user.email} (ID: ${user._id})`);

    // 2. Fetch real products from DB
    const realProducts = await db.collection('products').find({}).limit(5).toArray();
    console.log(`Loaded ${realProducts.length} real products from database`);

    // Helper to format item snapshot
    function createOrderItem(product, variantIndex = 0, qty = 1) {
      const variant = (product.variants && product.variants[variantIndex]) || {
        sku: 'SKU-DEFAULT-01',
        classification: 'Tiêu chuẩn',
        color: 'Tiêu chuẩn',
        size: 'M',
        price: product.vi?.regularPrice || 850000,
        discountPrice: product.vi?.salePrice || 750000
      };

      const unitPrice = variant.discountPrice || variant.price || product.vi?.salePrice || product.vi?.regularPrice || 750000;
      const subtotal = unitPrice * qty;

      return {
        productId: product._id,
        variantId: null,
        productSnapshot: {
          title: product.vi?.title || product.titleUrl || "Sản phẩm thời trang Chéri",
          sku: variant.sku || "CHERI-SKU-01",
          image: product.mainImage?.url || (product.images && product.images[0]) || "",
          variant: {
            color: variant.color || "Tiêu chuẩn",
            size: variant.size || "M",
            classification: variant.classification || "Trang phục"
          }
        },
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: subtotal
      };
    }

    // Helper to format legacy cart item
    function createCartItem(product, variantIndex = 0, qty = 1) {
      const variant = (product.variants && product.variants[variantIndex]) || {
        sku: 'SKU-DEFAULT-01',
        classification: 'Tiêu chuẩn',
        color: 'Tiêu chuẩn',
        size: 'M',
        price: product.vi?.regularPrice || 850000,
        discountPrice: product.vi?.salePrice || 750000
      };

      const unitPrice = variant.discountPrice || variant.price || product.vi?.salePrice || product.vi?.regularPrice || 750000;

      return {
        item: {
          _id: product._id.toString(),
          id: product._id.toString(),
          title: product.vi?.title || product.titleUrl || "Sản phẩm thời trang Chéri",
          titleUrl: product.titleUrl || "",
          mainImage: {
            url: product.mainImage?.url || (product.images && product.images[0]) || "",
            name: product.vi?.title || "Sản phẩm Chéri"
          },
          images: product.images || [product.mainImage?.url || ""],
          regularPrice: variant.price || unitPrice,
          salePrice: unitPrice,
          price: unitPrice,
          onSale: !!variant.discountPrice,
          productType: "clothing",
          variant: {
            color: variant.color || "Tiêu chuẩn",
            size: variant.size || "M",
            classification: variant.classification || "Trang phục"
          }
        },
        id: product._id.toString(),
        qty: qty,
        price: unitPrice,
        shipingCostType: "basic"
      };
    }

    // Remove existing test orders with TEST-TRACKING prefix for clean idempotent seed
    const deleteResult = await db.collection('orders').deleteMany({
      orderId: { $regex: '^TEST-TRACKING-' },
      _user: user._id
    });
    console.log(`Cleaned up ${deleteResult.deletedCount} previous test orders.`);

    const now = new Date();
    const d1 = new Date(now.getTime() - 4 * 86400000);
    const d2 = new Date(now.getTime() - 3 * 86400000);
    const d3 = new Date(now.getTime() - 2 * 86400000);
    const d4 = new Date(now.getTime() - 1 * 86400000);

    const testOrders = [
      // ═══════════════════════════════════════════════════════════════════
      // 1. Case A — Đơn mới tạo (PENDING) - Chưa có mã vận đơn
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[0], 0, 1);
        const cart1 = createCartItem(realProducts[0], 0, 1);
        const subtotal = item1.subtotal;
        const shippingFee = 30000;
        return {
          orderId: "TEST-TRACKING-01",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0901234567",
          status: "PENDING",
          notes: "Giao hàng trong giờ hành chính giúp em",
          items: [item1],
          cart: {
            items: [cart1],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 1
          },
          shippingAddress: {
            fullName: "Nguyễn Văn An",
            phone: "0901234567",
            address: "Số 45 Lê Duẩn, Phường Bến Nghé",
            ward: "Phường Bến Nghé",
            district: "Quận 1",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Văn An",
            phone: "0901234567",
            line1: "Số 45 Lê Duẩn, Phường Bến Nghé",
            line2: "",
            city: "Quận 1, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "Giao Hàng Nhanh (GHN)",
          trackingNumber: "",
          trackingUrl: "",
          estimatedDeliveryDate: null,
          shippedAt: null,
          deliveredAt: null,
          paymentStatus: "PENDING",
          type: "PAYMENT_ON_DELIVERY",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee,
          amount: subtotal + shippingFee,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(now.getTime() - 25 * 60000),
              note: "Đơn hàng đã được tạo thành công trên hệ thống Chéri."
            }
          ],
          shippingLogs: [],
          dateAdded: new Date(now.getTime() - 25 * 60000),
          createdAt: new Date(now.getTime() - 25 * 60000),
          updatedAt: new Date(now.getTime() - 25 * 60000)
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 2. Case B — Đã xác nhận (CONFIRMED) - 2 sản phẩm
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[0], 1, 1);
        const item2 = createOrderItem(realProducts[1], 0, 1);
        const cart1 = createCartItem(realProducts[0], 1, 1);
        const cart2 = createCartItem(realProducts[1], 0, 1);
        const subtotal = item1.subtotal + item2.subtotal;
        const shippingFee = 35000;
        return {
          orderId: "TEST-TRACKING-02",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0912345678",
          status: "CONFIRMED",
          notes: "Gói cẩn thận làm quà tặng",
          items: [item1, item2],
          cart: {
            items: [cart1, cart2],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 2
          },
          shippingAddress: {
            fullName: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            address: "128 Phan Đăng Lưu, Phường 3",
            ward: "Phường 3",
            district: "Quận Phú Nhuận",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            line1: "128 Phan Đăng Lưu, Phường 3",
            line2: "",
            city: "Quận Phú Nhuận, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "Viettel Post",
          trackingNumber: "",
          trackingUrl: "",
          estimatedDeliveryDate: null,
          shippedAt: null,
          deliveredAt: null,
          paymentStatus: "PAID",
          type: "CARD",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee,
          amount: subtotal + shippingFee,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d4.getTime() - 6 * 3600000),
              note: "Đơn hàng đã được tạo thành công."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d4.getTime() - 4 * 3600000),
              note: "Bộ phận CSKH Chéri đã gọi điện xác nhận đơn hàng thành công."
            }
          ],
          shippingLogs: [],
          dateAdded: new Date(d4.getTime() - 6 * 3600000),
          createdAt: new Date(d4.getTime() - 6 * 3600000),
          updatedAt: new Date(d4.getTime() - 4 * 3600000)
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 3. Case B2 — Đang chuẩn bị hàng (PROCESSING) - Có mã vận đơn dự kiến
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[1], 2, 2);
        const cart1 = createCartItem(realProducts[1], 2, 2);
        const subtotal = item1.subtotal;
        const shippingFee = 25000;
        return {
          orderId: "TEST-TRACKING-03",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0987654321",
          status: "PROCESSING",
          notes: "Kiểm tra kỹ đường may trước khi đóng gói",
          items: [item1],
          cart: {
            items: [cart1],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 2
          },
          shippingAddress: {
            fullName: "Nguyễn Hoàng Nam",
            phone: "0987654321",
            address: "Toà nhà Bitexco, 2 Hải Triều",
            ward: "Phường Bến Nghé",
            district: "Quận 1",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Hoàng Nam",
            phone: "0987654321",
            line1: "Toà nhà Bitexco, 2 Hải Triều",
            line2: "",
            city: "Quận 1, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "Giao Hàng Tiết Kiệm (GHTK)",
          trackingNumber: "TEST-GHTK-000003",
          trackingUrl: "https://i.ghtk.vn/TEST-GHTK-000003",
          estimatedDeliveryDate: new Date(now.getTime() + 2 * 86400000),
          shippedAt: null,
          deliveredAt: null,
          paymentStatus: "PAID",
          type: "BANK_TRANSFER",
          subtotal: subtotal,
          discountAmount: 50000,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee - 50000,
          amount: subtotal + shippingFee - 50000,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d3.getTime()),
              note: "Đơn hàng đã được ghi nhận."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d3.getTime() + 2 * 3600000),
              note: "Xác nhận thanh toán chuyển khoản thành công."
            },
            {
              status: "PROCESSING",
              updatedAt: new Date(d4.getTime()),
              note: "Kho Chéri đang tiến hành lấy hàng và đóng gói sản phẩm."
            }
          ],
          shippingLogs: [],
          dateAdded: new Date(d3.getTime()),
          createdAt: new Date(d3.getTime()),
          updatedAt: new Date(d4.getTime())
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 4. Case C — Đang vận chuyển (SHIPPING) - Trọng tâm Timeline & Carrier Link
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[0], 0, 1);
        const item2 = createOrderItem(realProducts[1], 1, 1);
        const item3 = createOrderItem(realProducts[2], 0, 1);
        const cart1 = createCartItem(realProducts[0], 0, 1);
        const cart2 = createCartItem(realProducts[1], 1, 1);
        const cart3 = createCartItem(realProducts[2], 0, 1);
        const subtotal = item1.subtotal + item2.subtotal + item3.subtotal;
        const shippingFee = 0; // Miễn phí vận chuyển
        return {
          orderId: "TEST-TRACKING-04",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0901234567",
          status: "SHIPPING",
          notes: "",
          items: [item1, item2, item3],
          cart: {
            items: [cart1, cart2, cart3],
            shippingCost: 0,
            totalPrice: subtotal,
            totalQty: 3
          },
          shippingAddress: {
            fullName: "Nguyễn Văn An",
            phone: "0901234567",
            address: "245 Nguyễn Tri Phương, Phường 4",
            ward: "Phường 4",
            district: "Quận 10",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Văn An",
            phone: "0901234567",
            line1: "245 Nguyễn Tri Phương, Phường 4",
            line2: "",
            city: "Quận 10, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: 0,
          shippingProvider: "SPX Express",
          trackingNumber: "TEST-SPX-000004",
          trackingUrl: "https://spx.vn/track?bill=TEST-SPX-000004",
          estimatedDeliveryDate: new Date(now.getTime() + 1 * 86400000),
          shippedAt: new Date(d4.getTime() + 8 * 3600000),
          deliveredAt: null,
          paymentStatus: "PAID",
          type: "CARD",
          subtotal: subtotal,
          discountAmount: 100000,
          taxAmount: 0,
          totalAmount: subtotal - 100000,
          amount: subtotal - 100000,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d3.getTime() - 2 * 3600000),
              note: "Đơn hàng đã được đặt thành công."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d3.getTime()),
              note: "Đã xác nhận đơn hàng."
            },
            {
              status: "PROCESSING",
              updatedAt: new Date(d3.getTime() + 6 * 3600000),
              note: "Đã hoàn tất đóng gói và bàn giao bưu kiện."
            },
            {
              status: "SHIPPING",
              updatedAt: new Date(d4.getTime() + 8 * 3600000),
              note: "Đã bàn giao kiện hàng cho đối tác vận chuyển SPX Express."
            }
          ],
          shippingLogs: [
            {
              status: "Bưu tá đã lấy hàng",
              location: "Kho Chéri Tân Bình, TP. Hồ Chí Minh",
              description: "Bưu tá SPX Express đã lấy hàng thành công từ kho người gửi",
              timestamp: new Date(d4.getTime() + 9 * 3600000)
            },
            {
              status: "Đã đến trung tâm phân loại",
              location: "Kho phân loại Củ Chi SOC, TP. Hồ Chí Minh",
              description: "Kiện hàng đã nhập kho phân loại và hoàn tất quét mã",
              timestamp: new Date(d4.getTime() + 14 * 3600000)
            },
            {
              status: "Đang luân chuyển liên tỉnh",
              location: "Trung tâm trung chuyển Đà Nẵng SOC",
              description: "Kiện hàng đang được luân chuyển trên tuyến đường bộ liên tỉnh",
              timestamp: new Date(now.getTime() - 10 * 3600000)
            },
            {
              status: "Đã đến bưu cục phát",
              location: "Bưu cục phát Quận 10, TP. Hồ Chí Minh",
              description: "Kiện hàng đã đến bưu cục phát và đang phân bổ tuyến bưu tá giao hàng",
              timestamp: new Date(now.getTime() - 2 * 3600000)
            }
          ],
          dateAdded: new Date(d3.getTime() - 2 * 3600000),
          createdAt: new Date(d3.getTime() - 2 * 3600000),
          updatedAt: new Date(now.getTime() - 2 * 3600000)
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 5. Case D — Đang giao đến khách (SHIPPING - Chặng phát cuối)
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[2], 0, 1);
        const cart1 = createCartItem(realProducts[2], 0, 1);
        const subtotal = item1.subtotal;
        const shippingFee = 28000;
        return {
          orderId: "TEST-TRACKING-05",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0912345678",
          status: "SHIPPING",
          notes: "Gọi trước khi giao 15 phút",
          items: [item1],
          cart: {
            items: [cart1],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 1
          },
          shippingAddress: {
            fullName: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            address: "88 Nam Kỳ Khởi Nghĩa, Phường Bến Nghé",
            ward: "Phường Bến Nghé",
            district: "Quận 1",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            line1: "88 Nam Kỳ Khởi Nghĩa, Phường Bến Nghé",
            line2: "",
            city: "Quận 1, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "Giao Hàng Nhanh (GHN)",
          trackingNumber: "TEST-GHN-000005",
          trackingUrl: "https://donhang.ghn.vn/?order_code=TEST-GHN-000005",
          estimatedDeliveryDate: new Date(now.getTime() + 4 * 3600000), // Hôm nay
          shippedAt: new Date(d3.getTime() + 10 * 3600000),
          deliveredAt: null,
          paymentStatus: "PENDING",
          type: "PAYMENT_ON_DELIVERY",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee,
          amount: subtotal + shippingFee,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d4.getTime()),
              note: "Đơn hàng đã được tạo."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d4.getTime() + 2 * 3600000),
              note: "Đã xác nhận đơn hàng."
            },
            {
              status: "PROCESSING",
              updatedAt: new Date(d4.getTime() + 5 * 3600000),
              note: "Đang đóng gói."
            },
            {
              status: "SHIPPING",
              updatedAt: new Date(d3.getTime() + 10 * 3600000),
              note: "Đã bàn giao cho đơn vị vận chuyển GHN."
            }
          ],
          shippingLogs: [
            {
              status: "Lấy hàng thành công",
              location: "Kho Chéri Tân Bình, TP. Hồ Chí Minh",
              description: "Bưu tá GHN đã nhận hàng từ kho người gửi",
              timestamp: new Date(d3.getTime() + 11 * 3600000)
            },
            {
              status: "Nhập kho trung chuyển",
              location: "Kho trung chuyển GHN Tân Bình",
              description: "Đơn hàng đang được luân chuyển đến bưu cục phát",
              timestamp: new Date(d4.getTime() + 2 * 3600000)
            },
            {
              status: "Đang giao hàng",
              location: "Bưu cục GHN Quận 1, TP. Hồ Chí Minh",
              description: "Bưu tá Nguyễn Hùng (SĐT: 0938112233) đang trên đường giao hàng đến quý khách. Vui lòng giữ liên lạc.",
              timestamp: new Date(now.getTime() - 45 * 60000)
            }
          ],
          dateAdded: new Date(d4.getTime()),
          createdAt: new Date(d4.getTime()),
          updatedAt: new Date(now.getTime() - 45 * 60000)
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 6. Case E — Đã giao thành công (DELIVERED)
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[0], 0, 1);
        const item2 = createOrderItem(realProducts[2], 0, 2);
        const cart1 = createCartItem(realProducts[0], 0, 1);
        const cart2 = createCartItem(realProducts[2], 0, 2);
        const subtotal = item1.subtotal + item2.subtotal;
        const shippingFee = 0;
        const deliveredTime = new Date(d4.getTime() + 15 * 3600000);
        return {
          orderId: "TEST-TRACKING-06",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0901234567",
          status: "DELIVERED",
          notes: "",
          items: [item1, item2],
          cart: {
            items: [cart1, cart2],
            shippingCost: 0,
            totalPrice: subtotal,
            totalQty: 3
          },
          shippingAddress: {
            fullName: "Nguyễn Văn An",
            phone: "0901234567",
            address: "45 Lê Duẩn, Phường Bến Nghé",
            ward: "Phường Bến Nghé",
            district: "Quận 1",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Văn An",
            phone: "0901234567",
            line1: "45 Lê Duẩn, Phường Bến Nghé",
            line2: "",
            city: "Quận 1, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: 0,
          shippingProvider: "Viettel Post",
          trackingNumber: "TEST-VTPOST-000006",
          trackingUrl: "https://viettelpost.com.vn/tra-cuu-hanh-trinh-don-hang?id=TEST-VTPOST-000006",
          estimatedDeliveryDate: deliveredTime,
          shippedAt: new Date(d2.getTime() + 10 * 3600000),
          deliveredAt: deliveredTime,
          paymentStatus: "PAID",
          type: "PAYMENT_ON_DELIVERY",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal,
          amount: subtotal,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d1.getTime()),
              note: "Đơn hàng đã được tạo thành công."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d1.getTime() + 2 * 3600000),
              note: "Đã xác nhận đơn hàng."
            },
            {
              status: "PROCESSING",
              updatedAt: new Date(d2.getTime()),
              note: "Đóng gói hoàn tất."
            },
            {
              status: "SHIPPING",
              updatedAt: new Date(d2.getTime() + 10 * 3600000),
              note: "Bàn giao Viettel Post."
            },
            {
              status: "DELIVERED",
              updatedAt: deliveredTime,
              note: "Đơn hàng đã được giao thành công cho khách hàng."
            }
          ],
          shippingLogs: [
            {
              status: "Đã lấy hàng",
              location: "Kho Chéri Tân Bình, TP. Hồ Chí Minh",
              description: "Viettel Post đã nhận kiện hàng",
              timestamp: new Date(d2.getTime() + 11 * 3600000)
            },
            {
              status: "Đang vận chuyển",
              location: "Bưu cục Viettel Post Quận 1",
              description: "Kiện hàng đã đến kho phát",
              timestamp: new Date(d3.getTime() + 8 * 3600000)
            },
            {
              status: "Đang giao hàng",
              location: "Quận 1, TP. Hồ Chí Minh",
              description: "Bưu tá đang phát hàng đến người nhận",
              timestamp: new Date(d4.getTime() + 9 * 3600000)
            },
            {
              status: "Giao hàng thành công",
              location: "45 Lê Duẩn, Quận 1, TP. Hồ Chí Minh",
              description: "Người nhận đã ký nhận kiện hàng nguyên vẹn",
              timestamp: deliveredTime
            }
          ],
          dateAdded: new Date(d1.getTime()),
          createdAt: new Date(d1.getTime()),
          updatedAt: deliveredTime
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 7. Case F — Đã hủy (CANCELLED)
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[1], 0, 1);
        const cart1 = createCartItem(realProducts[1], 0, 1);
        const subtotal = item1.subtotal;
        const shippingFee = 30000;
        const cancelTime = new Date(d3.getTime() + 4 * 3600000);
        return {
          orderId: "TEST-TRACKING-07",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0987654321",
          status: "CANCELLED",
          notes: "",
          items: [item1],
          cart: {
            items: [cart1],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 1
          },
          shippingAddress: {
            fullName: "Nguyễn Hoàng Nam",
            phone: "0987654321",
            address: "Toà nhà Bitexco, 2 Hải Triều",
            ward: "Phường Bến Nghé",
            district: "Quận 1",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Hoàng Nam",
            phone: "0987654321",
            line1: "Toà nhà Bitexco, 2 Hải Triều",
            line2: "",
            city: "Quận 1, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "SPX Express",
          trackingNumber: "",
          trackingUrl: "",
          estimatedDeliveryDate: null,
          shippedAt: null,
          deliveredAt: null,
          paymentStatus: "REFUNDED",
          type: "CARD",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee,
          amount: subtotal + shippingFee,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d3.getTime()),
              note: "Đơn hàng đã được tạo thành công."
            },
            {
              status: "CANCELLED",
              updatedAt: cancelTime,
              note: "Khách hàng yêu cầu hủy đơn hàng do muốn đổi sang mẫu thiết kế khác."
            }
          ],
          shippingLogs: [],
          dateAdded: new Date(d3.getTime()),
          createdAt: new Date(d3.getTime()),
          updatedAt: cancelTime
        };
      })(),

      // ═══════════════════════════════════════════════════════════════════
      // 8. Case G — Hoàn hàng (RETURNED)
      // ═══════════════════════════════════════════════════════════════════
      (() => {
        const item1 = createOrderItem(realProducts[2], 0, 1);
        const cart1 = createCartItem(realProducts[2], 0, 1);
        const subtotal = item1.subtotal;
        const shippingFee = 30000;
        return {
          orderId: "TEST-TRACKING-08",
          _user: user._id,
          userId: user._id,
          customerEmail: "ngguyen@gmail.com",
          customerPhone: "0912345678",
          status: "RETURNED",
          notes: "",
          items: [item1],
          cart: {
            items: [cart1],
            shippingCost: shippingFee,
            totalPrice: subtotal + shippingFee,
            totalQty: 1
          },
          shippingAddress: {
            fullName: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            address: "128 Phan Đăng Lưu, Phường 3",
            ward: "Phường 3",
            district: "Quận Phú Nhuận",
            province: "TP. Hồ Chí Minh"
          },
          addresses: [{
            name: "Nguyễn Thị Ngọc",
            phone: "0912345678",
            line1: "128 Phan Đăng Lưu, Phường 3",
            line2: "",
            city: "Quận Phú Nhuận, TP. Hồ Chí Minh",
            country: "Việt Nam",
            zip: "700000"
          }],
          shippingFee: shippingFee,
          shippingProvider: "SPX Express",
          trackingNumber: "TEST-SPX-000008",
          trackingUrl: "https://spx.vn/track?bill=TEST-SPX-000008",
          estimatedDeliveryDate: new Date(d4.getTime()),
          shippedAt: new Date(d3.getTime()),
          deliveredAt: null,
          paymentStatus: "PENDING",
          type: "PAYMENT_ON_DELIVERY",
          subtotal: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal + shippingFee,
          amount: subtotal + shippingFee,
          currency: "VND",
          statusHistory: [
            {
              status: "PENDING",
              updatedAt: new Date(d2.getTime()),
              note: "Đơn hàng đã được tạo."
            },
            {
              status: "CONFIRMED",
              updatedAt: new Date(d2.getTime() + 2 * 3600000),
              note: "Đã xác nhận đơn hàng."
            },
            {
              status: "SHIPPING",
              updatedAt: new Date(d3.getTime()),
              note: "Bàn giao vận chuyển SPX Express."
            },
            {
              status: "RETURNED",
              updatedAt: new Date(d4.getTime() + 10 * 3600000),
              note: "Bưu tá phát 3 lần không liên lạc được với người nhận. Đơn hàng chuyển sang trạng thái hoàn hàng về người gửi."
            }
          ],
          shippingLogs: [
            {
              status: "Đã lấy hàng",
              location: "Kho Chéri Tân Bình, TP. Hồ Chí Minh",
              description: "Bưu tá SPX Express đã lấy hàng",
              timestamp: new Date(d3.getTime() + 2 * 3600000)
            },
            {
              status: "Giao không thành công",
              location: "Quận Phú Nhuận, TP. Hồ Chí Minh",
              description: "Không liên lạc được với người nhận lần 3",
              timestamp: new Date(d4.getTime() + 8 * 3600000)
            },
            {
              status: "Đang hoàn về kho",
              location: "Kho phân loại Củ Chi SOC, TP. Hồ Chí Minh",
              description: "Kiện hàng đang được hoàn trả về kho Chéri người gửi",
              timestamp: new Date(d4.getTime() + 10 * 3600000)
            }
          ],
          dateAdded: new Date(d2.getTime()),
          createdAt: new Date(d2.getTime()),
          updatedAt: new Date(d4.getTime() + 10 * 3600000)
        };
      })()
    ];

    // Insert orders
    const insertResult = await db.collection('orders').insertMany(testOrders);
    console.log(`\nSuccessfully inserted ${insertResult.insertedCount} test orders!`);

    // Verify by querying back
    const verifyOrders = await db.collection('orders').find({
      _user: user._id
    }).sort({ orderId: 1 }).toArray();

    console.log(`\nVerification query: Found ${verifyOrders.length} orders for user ${user.email}:`);
    verifyOrders.forEach((o, i) => {
      console.log(`[${i + 1}] Order: ${o.orderId} | Status: ${o.status.padEnd(10)} | Tracking: ${o.trackingNumber || 'N/A'} | Items: ${o.items.length} | Amount: ${o.totalAmount.toLocaleString('vi-VN')} VND`);
    });

  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
