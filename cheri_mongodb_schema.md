# DANH SÁCH BẢNG (COLLECTIONS) & TRƯỜNG DỮ LIỆU (FIELDS) MONGODB TRONG DỰ ÁN CHÉRI

> Tài liệu trích xuất toàn bộ cấu trúc cơ sở dữ liệu MongoDB được định nghĩa và sử dụng trong toàn bộ mã nguồn dự án **Chéri** (NestJS + Mongoose).

---

## 📌 TỔNG QUAN HỆ THỐNG COLLECTIONS

| STT | Tên Collection (MongoDB) | Model / Schema | Module NestJS | Mô tả mục đích |
|:---:|:---|:---|:---|:---|
| 1 | `users` | `User` / `UserSchema` | `AuthModule` | Lưu trữ thông tin tài khoản người dùng, giỏ hàng phụ, phân quyền admin/user. |
| 2 | `products` | `Product` / `ProductSchema` | `ProductsModule` | Thông tin sản phẩm chính, danh mục, hình ảnh, đa ngôn ngữ, SEO url. |
| 3 | `product_variants` | `ProductVariant` / `ProductVariantSchema` | `ProductsModule` | Biến thể sản phẩm (SKU, màu sắc, kích thước, phân loại, giá, tồn kho). |
| 4 | `categories` | `Category` / `CategorySchema` | `ProductsModule` | Danh mục sản phẩm, cấu trúc cây phân cấp, đa ngôn ngữ, menu ẩn hiện. |
| 5 | `orders` | `Order` / `OrderSchema` | `OrdersModule` | Quản lý đơn hàng, snapshot chi tiết, trạng thái, thanh toán, vận chuyển, lịch sử tracking. |
| 6 | `shippingmethods` *(seed: `shipping_methods`)* | `ShippingMethod` / `ShippingMethodSchema` | `OrdersModule` | Cấu hình phương thức giao hàng, phí cơ bản, ngưỡng freeship, phạm vi giao. |
| 7 | `payment_methods` | `PaymentMethod` / `PaymentMethodSchema` | `OrdersModule` | Phương thức thanh toán (COD, Stripe, Bank Transfer, MoMo), phí giao dịch. |
| 8 | `coupons` | `Coupon` / `CouponSchema` | `OrdersModule` | Mã giảm giá, loại giảm giá (tiền mặt / phần trăm), hạn sử dụng, giới hạn lượt dùng. |
| 9 | `translations` | `Translation` / `TranslationSchema` | `TranslationsModule` | Bản dịch i18n đa ngôn ngữ cho giao diện (vi, ...). |
| 10 | `themes` | `Theme` / `ThemeSchema` | `CheriModule` | Cấu hình theme/giao diện, kiểu dáng hiển thị của website. |
| 11 | `pages` | `Page` / `PageSchema` | `CheriModule` | Các trang tĩnh (Static Pages), nội dung HTML theo ngôn ngữ, URL thân thiện. |
| 12 | `configs` | `Config` / `ConfigSchema` | `CheriModule` | Cấu hình hệ thống (chi phí vận chuyển động theo ngôn ngữ/quốc gia). |
| 13 | `session` | `connect-mongo` Store | `setAppDB.ts` | Lưu trữ phiên làm việc (Express Session, Passport Authentication, giỏ hàng session). |

---

## 📋 CHI TIẾT CÁC BẢNG (COLLECTIONS) VÀ FIELDS

### 1. Collection: `users`
- **Model:** `User`
- **File:** `server/src/auth/schemas/user.schema.ts`
- **Collection Name trong MongoDB:** `users` (mặc định số nhiều của Model User)
- **Timestamps:** `true` (`createdAt`, `updatedAt`)

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key, Auto-generated | Khóa chính bản ghi người dùng |
| `googleId` | String | Tùy chọn | ID định danh khi đăng nhập bằng Google OAuth |
| `email` | String | required, unique, trim, lowercase | Email tài khoản người dùng |
| `password` | String | required | Mật khẩu tài khoản (đã được băm kèm salt) |
| `name` | String | required, trim | Tên người dùng hiển thị |
| `salt` | String | required | Chuỗi salt dùng để băm mật khẩu |
| `fullName` | String | default: `''` | Họ và tên đầy đủ |
| `phoneNumber` | String | default: `''` | Số điện thoại liên hệ |
| `gender` | String | default: `''` | Giới tính |
| `dateOfBirth` | String | default: `''` | Ngày sinh |
| `address` | String | default: `''` | Địa chỉ mặc định |
| `avatar` | String | default: `''` | Đường dẫn ảnh đại diện |
| `images` | [String] | Array | Danh sách link hình ảnh người dùng |
| `description` | String | default: `''` | Tiểu sử / ghi chú cá nhân |
| `roles` | [String] | required, default: `['user']` | Phân quyền (ví dụ: `['user']`, `['admin']`) |
| `status` | Boolean | required, default: `true` | Trạng thái hoạt động tài khoản (active/blocked) |
| `cart` | Sub-document | default: `{ items: [] }`, strict: false | Giỏ hàng lưu trong tài khoản người dùng |
| `cart.items` | [Sub-document] | Mảng CartItemSchema | Danh sách sản phẩm trong giỏ |
| `cart.items[].productId` | ObjectId | ref: `'Product'` | Tham chiếu ID sản phẩm |
| `cart.items[].variantId` | ObjectId | ref: `'ProductVariant'` | Tham chiếu ID biến thể sản phẩm |
| `cart.items[].quantity` | Number | default: `1` | Số lượng sản phẩm |
| `dateAdded` | Date | default: `Date.now` | Ngày tạo bản ghi (legacy) |
| `createdAt` | Date | Auto Mongoose timestamps | Thời gian tạo tài khoản |
| `updatedAt` | Date | Auto Mongoose timestamps | Thời gian cập nhật tài khoản gần nhất |

---

### 2. Collection: `products`
- **Model:** `Product`
- **File:** `server/src/products/schemas/product.schema.ts`
- **Collection Name trong MongoDB:** `products`
- **Plugins:** `pagination`
- **Options:** `strict: false`, `timestamps: true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính sản phẩm |
| `id` | String | Tùy chọn | ID chuỗi tùy biến |
| `sku` | String | unique, sparse, trim, index | Mã SKU đại diện cho sản phẩm |
| `title` | String | trim | Tên sản phẩm chính |
| `titleUrl` | String | required, unique, trim, index | Đường dẫn slug sản phẩm (SEO friendly) |
| `description` | String | default: `''` | Mô tả ngắn sản phẩm |
| `descriptionFull` | Array | default: `[]` | Khối nội dung mô tả chi tiết sản phẩm |
| `tags` | [String] | Array | Danh sách từ khóa/thẻ tag |
| `categoryLevel1` | [String] | Array | Danh sách định danh danh mục cấp 1 |
| `images` | [String] | Array | Danh sách URL ảnh sản phẩm |
| `mainImage` | Object | Sub-document | Ảnh đại diện chính của sản phẩm |
| `mainImage.url` | String | required, trim | Đường dẫn ảnh |
| `mainImage.name` | String | trim | Tên tệp ảnh |
| `hasColors` | Boolean | default: `false` | Cờ đánh dấu sản phẩm có biến thể màu sắc |
| `hasSizes` | Boolean | default: `false` | Cờ đánh dấu sản phẩm có biến thể kích cỡ |
| `hasClassification` | Boolean | default: `false` | Cờ đánh dấu có phân loại khác |
| `colors` | Array | Mảng màu sắc |
| `sizes` | [String] | Mảng kích thước (size S, M, L...) |
| `regularPrice` | Number | default: `0` | Giá niêm yết ban đầu |
| `salePrice` | Number | default: `0` | Giá khuyến mãi |
| `quantity` | Number | default: `0` | Tổng số lượng tồn kho |
| `visibility` | Boolean | default: `true` | Trạng thái hiển thị sản phẩm trên web |
| `_user` | ObjectId | ref: `'User'` | ID người tạo / quản lý sản phẩm |
| `rating` | Number | default: `5` | Đánh giá sao của sản phẩm |
| `dateAdded` | Date | default: `Date.now` | Ngày tạo sản phẩm (legacy) |
| **`vi`** *(hoặc các mã ngôn ngữ `[lang]`)* | Sub-document | Theo `languages` config (`vi`) | Nhóm trường đa ngôn ngữ nội địa hóa: |
| `vi.title` | String | | Tên sản phẩm theo tiếng Việt |
| `vi.description` | String | | Mô tả ngắn theo tiếng Việt |
| `vi.descriptionFull` | Array | | Mô tả chi tiết tiếng Việt |
| `vi.regularPrice` | Number | | Giá niêm yết bản tiếng Việt |
| `vi.salePrice` | Number | | Giá bán bản tiếng Việt |
| `vi.onSale` | Boolean | | Đang bật giảm giá hay không |
| `vi.stock` | String | | Trạng thái tồn kho dạng text |
| `vi.stockDate` | String | | Ngày cập nhật kho |
| `vi.visibility` | Boolean | | Hiển thị trong phiên bản ngôn ngữ |
| `vi.shipping` | String | | Thông tin giao hàng |
| `vi.shippingCost` | Number | | Phí ship riêng |
| `vi.productType` | String | | Phân loại loại sản phẩm |
| `vi.hasColors` | Boolean | | Có màu sắc |
| `vi.colors` | Array | | Danh sách màu |
| `vi.hasSizes` | Boolean | | Có kích thước |
| `vi.sizes` | Array | | Danh sách kích thước |
| `vi.hasClassification` | Boolean | | Có phân loại |
| `vi.categoryLevel1` | Mixed | | Danh mục cấp 1 |
| `vi.categoryLevel2` | String | | Danh mục cấp 2 |
| `vi.quantity` | Number | | Số lượng tồn kho bản ngữ |
| `createdAt` | Date | Auto Mongoose timestamps | Thời gian tạo |
| `updatedAt` | Date | Auto Mongoose timestamps | Thời gian cập nhật |

---

### 3. Collection: `product_variants`
- **Model:** `ProductVariant`
- **File:** `server/src/products/schemas/product-variant.schema.ts`
- **Collection Name trong MongoDB:** `product_variants` (chỉ định rõ trong Schema và Module)
- **Timestamps:** `true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính biến thể |
| `productId` | ObjectId | required, ref: `'Product'`, index | ID sản phẩm cha |
| `sku` | String | required, unique, trim, index | Mã SKU biến thể cụ thể |
| `color` | String | default: `''` | Màu sắc của biến thể |
| `size` | String | default: `''` | Kích cỡ biến thể |
| `classification` | String | default: `''` | Phân loại tùy biến khác |
| `price` | Number | required, min: 0, default: `0` | Giá bán của biến thể |
| `discountPrice` | Number | min: 0, default: `0` | Giá sau giảm giá của biến thể |
| `stock` | Number | required, min: 0, default: `0` | Số lượng tồn kho của riêng biến thể này |
| `isActive` | Boolean | required, default: `true` | Trạng thái kích hoạt biến thể |
| `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo |
| `updatedAt` | Date | Auto Mongoose timestamps | Ngày cập nhật |

---

### 4. Collection: `categories`
- **Model:** `Category`
- **File:** `server/src/products/schemas/category.schema.ts`
- **Collection Name trong MongoDB:** `categories` (mặc định số nhiều của Category)
- **Options:** `strict: false`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính danh mục |
| `titleUrl` | String | | Slug SEO đường dẫn danh mục |
| `mainImage` | Object | Sub-document | Ảnh biểu tượng / đại diện danh mục |
| `mainImage.url` | String | trim | URL ảnh |
| `mainImage.name` | String | trim | Tên ảnh |
| `mainImage.type` | Boolean | | Loại hiển thị ảnh |
| `subCategories` | Array | | Danh sách các danh mục con |
| `_user` | ObjectId | ref: `'user'` | Người khởi tạo danh mục |
| `dateAdded` | Date | | Ngày tạo danh mục |
| **`vi`** *(hoặc mã ngôn ngữ `[lang]`)* | Sub-document | Theo cấu hình ngôn ngữ | Thông tin đa ngôn ngữ: |
| `vi.title` | String | | Tên danh mục |
| `vi.description` | String | | Mô tả danh mục |
| `vi.position` | Number | | Thứ tự sắp xếp hiển thị |
| `vi.visibility` | Boolean | | Cho phép hiển thị hay không |
| `vi.menuHidden` | Boolean | | Ẩn khỏi thanh điều hướng/menu |

---

### 5. Collection: `orders`
- **Model:** `Order`
- **File:** `server/src/orders/schemas/order.schema.ts`
- **Collection Name trong MongoDB:** `orders` (chỉ định rõ ràng)
- **Timestamps:** `true`

| Nhóm Field | Tên Field | Kiểu dữ liệu | Ràng buộc / Enum | Mô tả |
|:---|:---|:---|:---|:---|
| **Cơ bản** | `_id` | ObjectId | Primary Key | Khóa chính đơn hàng |
| | `orderId` | String | required, unique, index | Mã đơn hàng (ví dụ: `ORD-2024-XXXX`) |
| | `userId` | ObjectId | ref: `'User'`, index, default: null | ID tài khoản đặt hàng (null nếu khách vãng lai) |
| | `_user` | ObjectId | ref: `'User'`, default: null | Tương thích ngược ID người dùng |
| | `customer` | Object | Sub-document | Thông tin nhanh người đặt hàng |
| | `customer.name` | String | default: `''` | Tên người đặt |
| | `customer.email` | String | default: `''` | Email người đặt |
| | `customer.phone` | String | default: `''` | Số điện thoại người đặt |
| | `customerEmail` | String | required | Email nhận thông báo đơn hàng |
| | `customerPhone` | String | default: `''` | Số điện thoại khách hàng |
| | `status` | String | required, default: `'PENDING'` | Trạng thái: `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPING`, `DELIVERED`, `CANCELLED`, `RETURNED` |
| | `notes` | String | default: `''` | Ghi chú đơn hàng của khách |
| **Sản phẩm** | `items` | [Sub-document] | required, default: `[]` | Danh sách sản phẩm mua |
| | `items[].productId` | ObjectId | required, ref: `'Product'` | ID sản phẩm gốc |
| | `items[].variantId` | ObjectId | ref: `'ProductVariant'`, default: null | ID biến thể sản phẩm |
| | `items[].productSnapshot` | Sub-document | required | Snapshot cố định lúc mua (tránh bị lệch khi sửa sản phẩm) |
| | `items[].productSnapshot.title` | String | required | Tên sản phẩm tại thời điểm mua |
| | `items[].productSnapshot.sku` | String | required | SKU tại thời điểm mua |
| | `items[].productSnapshot.image` | String | default: `''` | Ảnh sản phẩm lúc mua |
| | `items[].productSnapshot.variant` | Object | | Chi tiết biến thể lúc mua |
| | `items[].productSnapshot.variant.color` | String | default: `''` | Màu sắc biến thể |
| | `items[].productSnapshot.variant.size` | String | default: `''` | Kích thước biến thể |
| | `items[].productSnapshot.variant.classification` | String | default: `''` | Phân loại biến thể |
| | `items[].quantity` | Number | required, min: 1 | Số lượng mua |
| | `items[].unitPrice` | Number | required, min: 0 | Đơn giá lúc mua |
| | `items[].subtotal` | Number | required, min: 0 | Thành tiền sản phẩm (`quantity * unitPrice`) |
| **Địa chỉ giao** | `shippingAddress` | Sub-document | required | Thông tin địa chỉ giao hàng snapshot |
| | `shippingAddress.fullName` | String | required | Người nhận hàng |
| | `shippingAddress.phone` | String | required | Số điện thoại người nhận |
| | `shippingAddress.address` | String | required | Địa chỉ đầy đủ |
| | `shippingAddress.ward` | String | default: `''` | Phường / Xã |
| | `shippingAddress.district` | String | default: `''` | Quận / Huyện |
| | `shippingAddress.province` | String | default: `''` | Tỉnh / Thành phố |
| | `shippingAddress.provinceCode` | String | default: `''` | Mã định danh Tỉnh/TP |
| | `shippingAddress.provinceName` | String | default: `''` | Tên Tỉnh/TP |
| | `shippingAddress.districtCode` | String | default: `''` | Mã Quận/Huyện |
| | `shippingAddress.districtName` | String | default: `''` | Tên Quận/Huyện |
| | `shippingAddress.wardCode` | String | default: `''` | Mã Phường/Xã |
| | `shippingAddress.wardName` | String | default: `''` | Tên Phường/Xã |
| | `shippingAddress.addressDetail` | String | default: `''` | Chi tiết số nhà, tên đường |
| **Vận chuyển** | `shipping` | Object | Sub-document | Thông tin vận chuyển tổng hợp |
| | `shipping.method` | String | default: `'STANDARD'` | Mã phương thức giao |
| | `shipping.provider` | String | default: `''` | Đơn vị vận chuyển (GHN, GHTK, ViettelPost...) |
| | `shipping.trackingNumber` | String | default: `''` | Mã vận đơn |
| | `shipping.estimatedDeliveryDate` | Date | default: null | Dự kiến ngày giao |
| | `shipping.shippedAt` | Date | default: null | Thời gian bắt đầu giao |
| | `shipping.deliveredAt` | Date | default: null | Thời gian giao thành công |
| | `shippingMethodId` | ObjectId | ref: `'ShippingMethod'`, default: null | ID cấu hình phương thức giao hàng |
| | `shippingMethodSnapshot` | Sub-document | default: null | Snapshot phương thức giao hàng |
| | `shippingMethodSnapshot.name` | String | required | Tên phương thức |
| | `shippingMethodSnapshot.code` | String | required | Mã phương thức |
| | `shippingMethodSnapshot.fee` | Number | required, min: 0 | Cước phí áp dụng |
| | `shippingMethodSnapshot.estimatedDeliveryTime` | String | default: `''` | Thời gian ước lượng |
| | `shippingFee` | Number | default: 0, min: 0 | Cước phí vận chuyển thực tính |
| | `shippingProvider` | String | default: `''` | Tên đối tác giao hàng |
| | `trackingNumber` | String | default: `''` | Mã vận đơn |
| | `trackingUrl` | String | default: `''` | Đường dẫn tra cứu vận đơn |
| | `estimatedDeliveryDate` | Date | default: null | Ngày dự kiến giao |
| | `shippedAt` | Date | default: null | Thời điểm xuất kho giao |
| | `deliveredAt` | Date | default: null | Thời điểm nhận hàng |
| **Thanh toán** | `payment` | Object | Sub-document | Thông tin thanh toán tổng hợp |
| | `payment.method` | String | default: `'COD'` | Phương thức thanh toán |
| | `payment.status` | String | default: `'PENDING'` | Trạng thái thanh toán |
| | `payment.provider` | String | default: null | Nhà cung cấp cổng thanh toán |
| | `payment.transactionId` | String | default: null | Mã giao dịch cổng thanh toán |
| | `payment.paidAt` | Date | default: null | Thời điểm thanh toán |
| | `payment.refundedAmount` | Number | default: 0, min: 0 | Số tiền đã hoàn |
| | `payment.refundedAt` | Date | default: null | Thời điểm hoàn tiền |
| | `paymentMethodId` | ObjectId | ref: `'PaymentMethod'`, default: null | ID phương thức thanh toán |
| | `paymentMethodSnapshot` | Sub-document | default: null | Snapshot phương thức thanh toán |
| | `paymentMethodSnapshot.name` | String | required | Tên phương thức |
| | `paymentMethodSnapshot.code` | String | required | Mã code (`COD`, `STRIPE`,...) |
| | `paymentMethodSnapshot.paymentType` | String | required | Loại thanh toán |
| | `paymentMethodSnapshot.paymentFee` | Number | required, min: 0, default: 0 | Phí thanh toán |
| | `paymentStatus` | String | required, default: `'PENDING'` | Enum: `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| | `transactionId` | String | default: `''` | Mã giao dịch cổng thanh toán |
| | `paymentProvider` | String | default: `''` | Đơn vị thanh toán (MoMo, Stripe, Bank,...) |
| | `paymentFee` | Number | default: 0, min: 0 | Phí thanh toán áp dụng |
| | `paidAt` | Date | default: null | Thời điểm thanh toán thành công |
| | `refundedAmount` | Number | default: 0, min: 0 | Số tiền hoàn lại |
| | `refundedAt` | Date | default: null | Thời điểm hoàn tiền |
| **Số tiền & Khuyến mãi** | `subtotal` | Number | required, min: 0, default: 0 | Tổng tiền hàng trước giảm giá & ship |
| | `discountAmount` | Number | default: 0, min: 0 | Tổng tiền được chiết khấu |
| | `taxAmount` | Number | default: 0, min: 0 | Tiền thuế |
| | `couponCode` | String | default: `''` | Mã giảm giá đã áp dụng |
| | `couponDiscount` | Number | default: 0, min: 0 | Số tiền giảm từ mã voucher |
| | `totalAmount` | Number | required, min: 0, default: 0 | Tổng tiền cuối cùng phải thanh toán |
| | `currency` | String | default: `'VND'` | Đơn vị tiền tệ |
| **Lịch sử & Vận trình** | `statusHistory` | [Sub-document] | default: `[]` | Lịch sử đổi trạng thái đơn của hệ thống |
| | `statusHistory[].status` | String | required, enum: OrderStatus | Trạng thái đơn tại thời điểm cập nhật |
| | `statusHistory[].updatedAt` | Date | default: `Date.now` | Thời điểm cập nhật |
| | `statusHistory[].updatedBy` | ObjectId | ref: `'User'`, default: null | ID người cập nhật (admin hoặc user) |
| | `statusHistory[].note` | String | default: `''` | Ghi chú lý do cập nhật trạng thái |
| | `shippingLogs` | [Sub-document] | default: `[]` | Lịch sử vận trình thực tế từ hãng vận chuyển |
| | `shippingLogs[].status` | String | required | Trạng thái carrier (`PICKED_UP`, `IN_TRANSIT`...) |
| | `shippingLogs[].location` | String | default: `''` | Vị trí / bưu cục hiện tại |
| | `shippingLogs[].description` | String | default: `''` | Diễn giải vận trình |
| | `shippingLogs[].timestamp` | Date | default: `Date.now` | Thời điểm ghi nhận vận trình |
| **Legacy Fields** | `amount` | Number | default: null | Trường cũ lưu tổng tiền |
| | `cart` | Mixed | default: null | Giỏ hàng nguyên bản cũ |
| | `addresses` | [Mixed] | default: `[]` | Mảng địa chỉ cũ |
| | `outcome` | Mixed | default: null | Dữ liệu kết quả thanh toán Stripe cũ |
| | `dateAdded` | Date | default: null | Ngày tạo cũ |
| **Timestamps** | `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo đơn |
| | `updatedAt` | Date | Auto Mongoose timestamps | Ngày cập nhật đơn gần nhất |

---

### 6. Collection: `shippingmethods` *(Seed script: `shipping_methods`)*
- **Model:** `ShippingMethod`
- **File:** `server/src/orders/schemas/shipping-method.schema.ts`
- **Collection Name trong MongoDB:** `shippingmethods` (Lưu ý: trong script seed `server/src/scripts/seed-orders-config.ts` gọi trực tiếp `shipping_methods`)
- **Timestamps:** `true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính phương thức giao hàng |
| `name` | String | required, trim | Tên phương thức (ví dụ: *Giao hàng tiêu chuẩn*) |
| `code` | String | required, unique, trim, index | Mã định danh duy nhất (ví dụ: `STANDARD`, `EXPRESS`, `PICKUP`) |
| `baseFee` | Number | min: 0, default: `0` | Cước phí cơ bản |
| `baseCost` | Number | min: 0, default: `0` | Chi phí gốc (tương thích) |
| `estimatedDeliveryTime`| String | default: `''` | Mô tả thời gian ước lượng (ví dụ: `'3-5 ngày làm việc'`) |
| `estimatedDays` | String | default: `''` | Số ngày ước lượng |
| `deliveryScope` | String | enum: `['NATIONWIDE', 'SPECIFIC_AREAS']`, default: `NATIONWIDE` | Phạm vi hỗ trợ giao hàng |
| `coverageArea` | String | default: `'national'` | Khu vực bao phủ |
| `deliveryAreas` | [String] | default: `[]` | Danh sách tỉnh/khu vực áp dụng nếu phạm vi giới hạn |
| `freeShippingThreshold`| Number | default: `0` | Ngưỡng giá trị đơn được freeship |
| `freeShippingCondition`| Object | Sub-document | Điều kiện miễn phí giao hàng chi tiết |
| `freeShippingCondition.enabled` | Boolean | default: `false` | Bật/tắt chính sách freeship |
| `freeShippingCondition.minimumOrderValue` | Number | min: 0, default: `0` | Giá trị đơn tối thiểu để được freeship |
| `freeShippingCondition.description` | String | default: `''` | Diễn giải quy tắc freeship |
| `status` | String | enum: `['ACTIVE', 'INACTIVE']`, default: `'ACTIVE'` | Trạng thái áp dụng |
| `isActive` | Boolean | default: `true` | Cờ kích hoạt (tương thích giao diện) |
| `description` | String | default: `''` | Mô tả chi tiết phương thức vận chuyển |
| `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo cấu hình |
| `updatedAt` | Date | Auto Mongoose timestamps | Ngày sửa đổi |

---

### 7. Collection: `payment_methods`
- **Model:** `PaymentMethod`
- **File:** `server/src/orders/schemas/payment-method.schema.ts`
- **Collection Name trong MongoDB:** `payment_methods` (chỉ định rõ)
- **Timestamps:** `true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính phương thức thanh toán |
| `name` | String | required, trim | Tên phương thức (ví dụ: *Thanh toán khi nhận hàng (COD)*) |
| `code` | String | required, unique, trim, index | Mã phương thức duy nhất (ví dụ: `COD`, `STRIPE`, `BANK_TRANSFER`, `MOMO`) |
| `paymentType` | String | required, enum: `['CASH', 'E_WALLET', 'PAYMENT_GATEWAY', 'BANK_TRANSFER']`, default: `'CASH'` | Loại hình thanh toán |
| `description` | String | default: `''` | Hướng dẫn / mô tả thanh toán |
| `transactionFee` | Object | Sub-document | Cấu hình phụ phí giao dịch |
| `transactionFee.enabled` | Boolean | default: `false` | Có tính phí giao dịch hay không |
| `transactionFee.type` | String | enum: `['FIXED', 'PERCENTAGE']`, default: `'FIXED'` | Phí cố định theo tiền hay tính theo % đơn |
| `transactionFee.value` | Number | min: 0, default: `0` | Giá trị phụ phí |
| `logo` | String | default: `''` | URL logo thương hiệu cổng thanh toán |
| `paymentProofImage` | String | default: `''` | Ảnh minh chứng thanh toán (chuyển khoản) |
| `status` | String | required, enum: `['ACTIVE', 'INACTIVE']`, default: `'ACTIVE'` | Trạng thái hoạt động |
| `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo |
| `updatedAt` | Date | Auto Mongoose timestamps | Ngày cập nhật |

---

### 8. Collection: `coupons`
- **Model:** `Coupon`
- **File:** `server/src/orders/schemas/coupon.schema.ts`
- **Collection Name trong MongoDB:** `coupons` (mặc định số nhiều của Coupon)
- **Timestamps:** `true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính mã giảm giá |
| `code` | String | required, unique, uppercase, trim | Mã khuyến mãi (ví dụ: `WELCOME10`, `SALE50K`) |
| `description` | String | default: `''` | Mô tả chương trình ưu đãi |
| `discountType` | String | required, enum: `['PERCENTAGE', 'FIXED']`, default: `'PERCENTAGE'` | Loại chiết khấu: theo `%` hoặc tiền mặt cố định |
| `discountValue` | Number | required, min: 0 | Giá trị chiết khấu (ví dụ: `10` cho 10%, `50000` cho 50.000đ) |
| `maxDiscount` | Number | default: `0` | Số tiền giảm tối đa (với loại PERCENTAGE; `0` là không giới hạn trần) |
| `minOrderValue`| Number | default: `0` | Giá trị đơn hàng tối thiểu để được áp dụng mã |
| `startDate` | Date | default: `Date.now` | Ngày bắt đầu áp dụng mã |
| `endDate` | Date | default: null | Ngày hết hạn mã giảm giá |
| `usageLimit` | Number | default: `0` | Giới hạn tổng số lượt sử dụng toàn hệ thống (`0` là không giới hạn) |
| `usedCount` | Number | default: `0` | Số lượt mã đã được khách hàng sử dụng |
| `isActive` | Boolean | default: `true` | Trạng thái kích hoạt mã voucher |
| `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo |
| `updatedAt` | Date | Auto Mongoose timestamps | Ngày sửa |

---

### 9. Collection: `translations`
- **Model:** `Translation`
- **File:** `server/src/translations/schemas/translation.schema.ts`
- **Collection Name trong MongoDB:** `translations` (chỉ định rõ)
- **Timestamps:** `true`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính |
| `lang` | String | required, unique, enum: `['vi']`, default: `'vi'`, trim | Mã ngôn ngữ |
| `keys` | Mixed | default: `{}` | Cặp khóa - giá trị json các chuỗi dịch giao diện frontend/backend |
| `createdAt` | Date | Auto Mongoose timestamps | Ngày tạo |
| `updatedAt` | Date | Auto Mongoose timestamps | Ngày sửa |

---

### 10. Collection: `themes`
- **Model:** `Theme`
- **File:** `server/src/cheri/schemas/theme.schema.ts`
- **Collection Name trong MongoDB:** `themes` (mặc định số nhiều)

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính theme |
| `titleUrl` | String | | Slug định danh theme |
| `dateAdded` | Date | | Ngày tạo |
| `active` | Boolean | | Đang kích hoạt làm giao diện chính hay không |
| `styles` | Object / Mixed | | Các biến màu sắc, CSS styles, cấu hình giao diện tùy biến |

---

### 11. Collection: `pages`
- **Model:** `Page`
- **File:** `server/src/cheri/schemas/page.schema.ts`
- **Collection Name trong MongoDB:** `pages` (mặc định số nhiều)
- **Options:** `strict: false`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính trang |
| `titleUrl` | String | | Slug đường dẫn trang tĩnh (ví dụ: `gioi-thieu`, `chinh-sach-doi-tra`) |
| `dateAdded` | Date | | Ngày tạo trang |
| **`vi`** *(hoặc mã ngôn ngữ `[lang]`)* | Sub-document | Đa ngôn ngữ theo config | Nội dung chi tiết trang theo ngôn ngữ: |
| `vi.title` | String | | Tiêu đề trang |
| `vi.contentHTML` | String | | Nội dung bài viết định dạng mã HTML |

---

### 12. Collection: `configs`
- **Model:** `Config`
- **File:** `server/src/cheri/schemas/config.schema.ts`
- **Collection Name trong MongoDB:** `configs` (mặc định số nhiều)
- **Options:** `strict: false`

| Tên Field | Kiểu dữ liệu | Thuộc tính / Ràng buộc | Mô tả |
|:---|:---|:---|:---|
| `_id` | ObjectId | Primary Key | Khóa chính cấu hình |
| `titleUrl` | String | | Tên định danh cấu hình |
| `dateAdded` | Date | | Ngày tạo cấu hình |
| `active` | Boolean | | Trạng thái hoạt động |
| **`vi`** *(hoặc mã ngôn ngữ `[lang]`)* | Sub-document | Đa ngôn ngữ | Cấu hình vận chuyển: |
| `vi.shippingCost` | Object | Sub-document | Cước vận chuyển chia theo gói |
| `vi.shippingCost.basic` | Object | `{ cost: Number, limit: Number }` | Gói cơ bản: chi phí và hạn mức freeship |
| `vi.shippingCost.extended`| Object | `{ cost: Number, limit: Number }` | Gói mở rộng: chi phí và hạn mức |

---

### 13. Collection: `session`
- **Nguồn:** Thư viện `connect-mongo` qua Express Session
- **File cấu hình:** `server/src/setAppDB.ts`
- **Collection Name:** `session`

| Tên Field | Kiểu dữ liệu | Mô tả |
|:---|:---|:---|
| `_id` | String | Mã định danh session ID sinh ra từ cookie `connect.sid` |
| `session` | String / Object JSON | Dữ liệu phiên lưu trữ máy chủ: tài khoản đăng nhập Passport, giỏ hàng tạm thời khách vãng lai |
| `expires` | Date | Thời điểm hết hạn của phiên (đặt `maxAge: 30 ngày`) |

---

## 💡 GHI CHÚ VỀ CẤU HÌNH VÀ QUAN HỆ CƠ SỞ DỮ LIỆU
1. **URI kết nối:** Cấu hình qua biến môi trường `MONGO_URI` (mặc định kết nối MongoDB Atlas cluster database: `cheri`).
2. **Cơ chế Snapshot trong đơn hàng (`orders`):** Đơn hàng lưu toàn bộ snapshot của sản phẩm (`productSnapshot`), địa chỉ (`shippingAddress`), phương thức giao hàng (`shippingMethodSnapshot`), và phương thức thanh toán (`paymentMethodSnapshot`) để đảm bảo tính bất biến của hóa đơn lịch sử kể cả khi giá hoặc tên sản phẩm thay đổi trong tương lai.
3. **Cơ chế Đa ngôn ngữ:** Một số collection (`products`, `categories`, `pages`, `configs`) nhúng các trường ngôn ngữ động (mặc định `vi`) bằng hàm helper reduce mảng `languages` từ `server/src/shared/constans.ts`.
4. **Biến thể sản phẩm:** Biến thể được tách riêng thành collection `product_variants` và liên kết với `products` thông qua trường `productId`.
