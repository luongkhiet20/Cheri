# DANH SÁCH BẢNG (COLLECTIONS) & TRƯỜNG DỮ LIỆU (FIELDS) MONGODB TRONG DỰ ÁN CHÉRI

> **Cơ sở dữ liệu:** `cheri` (MongoDB Atlas)
> **Thời gian cập nhật tự động:** 19:10:59 10/10/2026
> **Tổng số collections:** 20 bảng

---

## 📌 TỔNG QUAN HỆ THỐNG COLLECTIONS TRÊN DATABASE THỰC TẾ

| STT | Tên Collection (MongoDB) | Số tài liệu (Docs) | Model / Schema | Module NestJS | Mô tả mục đích |
|:---:|:---|:---:|:---|:---|:---|
| 1 | `users` | **102** | `User` | `AuthModule` | Lưu trữ thông tin tài khoản người dùng, giỏ hàng, thông tin cá nhân và phân quyền user/admin. |
| 2 | `products` | **99** | `Product` | `ProductsModule` | Thông tin sản phẩm chính, đa ngôn ngữ (vi, en), danh mục, SEO URL, đánh giá và danh sách biến thể. |
| 3 | `product_variants` | **0** | `ProductVariant` | `ProductsModule` | Bảng biến thể sản phẩm riêng biệt (SKU, màu sắc, kích cỡ, phân loại, giá, tồn kho). |
| 4 | `categories` | **4** | `Category` | `ProductsModule` | Danh mục sản phẩm, cấu trúc cây phân cấp (cha/con), đa ngôn ngữ và menu hiển thị. |
| 5 | `orders` | **39** | `Order` | `OrdersModule` | Quản lý đơn hàng, thông tin khách hàng, snapshot chi tiết sản phẩm, trạng thái thanh toán và vận chuyển. |
| 6 | `shippingmethods` | **5** | `ShippingMethod` | `OrdersModule` | Cấu hình phương thức giao hàng (tiêu chuẩn, hỏa tốc...), phí cơ bản, ngưỡng miễn phí vận chuyển. |
| 7 | `shipping_methods` | **0** | `ShippingMethod (legacy / seed)` | `OrdersModule` | Bảng dự phòng / seed ban đầu cho phương thức giao hàng. |
| 8 | `payment_methods` | **11** | `PaymentMethod` | `OrdersModule` | Phương thức thanh toán hỗ trợ (COD, Chuyển khoản, Stripe, MoMo...), phụ phí và trạng thái kích hoạt. |
| 9 | `coupons` | **2** | `Coupon` | `OrdersModule` | Mã giảm giá, loại chiết khấu (phần trăm / tiền mặt), điều kiện đơn hàng tối thiểu và thời hạn. |
| 10 | `settings` | **1** | `Settings (System)` | `OrdersModule / Universal / Client Settings` | Cài đặt toàn hệ thống website: thông tin thương hiệu, liên hệ (hotline, email, địa chỉ), trạng thái bảo trì, checkout. |
| 11 | `pages_home` | **2** | `PageHome` | `CheriModule` | Cấu hình CMS giao diện Trang chủ: danh sách sections linh hoạt (hero, carousel, banner, typography, colors...). |
| 12 | `pages_about` | **1** | `PageAbout` | `CheriModule` | Cấu hình CMS giao diện Trang Giới thiệu: sections, storytelling, team, timeline, typography, màu sắc. |
| 13 | `pages_policies` | **7** | `Page (Policy)` | `CheriModule` | Nội dung các trang chính sách tĩnh (Chính sách đổi trả, bảo mật, vận chuyển...) theo định dạng HTML đa ngôn ngữ. |
| 14 | `pages` | **7** | `Page (Static Pages)` | `CheriModule` | Tập hợp các trang thông tin tĩnh độc lập của hệ thống. |
| 15 | `translations` | **1** | `Translation` | `TranslationsModule` | Từ điển i18n đa ngôn ngữ cho toàn bộ nhãn giao diện người dùng frontend. |
| 16 | `themes` | **0** | `Theme` | `CheriModule` | Bộ giao diện / theme website. |
| 17 | `configs` | **0** | `Config` | `CheriModule` | Cấu hình chi phí vận chuyển động theo quốc gia và ngôn ngữ. |
| 18 | `session` | **16** | `Session (connect-mongo)` | `Express / Passport` | Lưu trữ session phiên đăng nhập người dùng và quản trị viên (connect.sid). |
| 19 | `orders_backup_20261005` | **10** | `OrderBackup` | `System Backup` | Bản sao lưu dữ liệu đơn hàng phục vụ bảo trì hệ thống. |
| 20 | `orders_backup_fk_20261005` | **10** | `OrderBackupFK` | `System Backup` | Bản sao lưu đơn hàng kèm liên kết khóa ngoại tương thích. |

---

## 📋 CHI TIẾT CÁC BẢNG (COLLECTIONS) VÀ CẤU TRÚC FIELDS THỰC TẾ

### 1. Collection: `users`

- **Model / Entity:** `User`
- **Định nghĩa Schema:** `server/src/auth/schemas/user.schema.ts`
- **Module:** `AuthModule`
- **Số lượng bản ghi thực tế:** `102` documents
- **Timestamps:** `true`
- **Mô tả:** Lưu trữ thông tin tài khoản người dùng, giỏ hàng, thông tin cá nhân và phân quyền user/admin.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 50/50 | Khóa chính (Primary Key) |
| `email` | `String` | 50/50 |  |
| `password` | `String` | 50/50 |  |
| `cart` | `Object` | 50/50 |  |
| `cart.items` | `Array | [Object]` | 50/50 |  |
| `images` | `Array` | 50/50 |  |
| `roles` | `[String]` | 50/50 |  |
| `salt` | `String` | 50/50 |  |
| `__v` | `Number` | 44/50 |  |
| `description` | `String` | 50/50 |  |
| `name` | `String` | 50/50 |  |
| `status` | `Boolean` | 50/50 |  |
| `updatedAt` | `String | Date` | 50/50 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `dateAdded` | `Date | String` | 49/50 |  |
| `address` | `String` | 49/50 |  |
| `avatar` | `String` | 48/50 |  |
| `dateOfBirth` | `String` | 48/50 |  |
| `fullName` | `String` | 49/50 |  |
| `gender` | `String` | 48/50 |  |
| `phoneNumber` | `String` | 49/50 |  |
| `cart.items[].productId` | `ObjectId` | 2/50 | Phần tử trong mảng đối tượng |
| `cart.items[].variantId` | `String` | 2/50 | Phần tử trong mảng đối tượng |
| `cart.items[].quantity` | `Number` | 2/50 | Phần tử trong mảng đối tượng |
| `cart.items[].selectedClassification` | `String` | 2/50 | Phần tử trong mảng đối tượng |
| `cart.items[].selectedColor` | `String` | 2/50 | Phần tử trong mảng đối tượng |
| `cart.items[].selectedSize` | `String` | 2/50 | Phần tử trong mảng đối tượng |
| `role` | `[String]` | 1/50 |  |
| `createdAt` | `Date | String` | 48/50 | Thời gian tạo bản ghi (Auto Timestamp) |

### 2. Collection: `products`

- **Model / Entity:** `Product`
- **Định nghĩa Schema:** `server/src/products/schemas/product.schema.ts`
- **Module:** `ProductsModule`
- **Số lượng bản ghi thực tế:** `99` documents
- **Timestamps:** `true`
- **Mô tả:** Thông tin sản phẩm chính, đa ngôn ngữ (vi, en), danh mục, SEO URL, đánh giá và danh sách biến thể.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 50/50 | Khóa chính (Primary Key) |
| `titleUrl` | `String` | 50/50 |  |
| `mainImage` | `Object` | 50/50 |  |
| `mainImage.url` | `String` | 50/50 |  |
| `mainImage.name` | `String` | 50/50 |  |
| `images` | `[String]` | 50/50 |  |
| `tags` | `[String]` | 50/50 |  |
| `updatedAt` | `Date | String` | 50/50 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `visibility` | `Boolean` | 50/50 |  |
| `variants` | `[Object]` | 50/50 |  |
| `variants[].sku` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].classification` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].color` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].size` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].price` | `Number` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].discountPrice` | `Number` | 50/50 | Phần tử trong mảng đối tượng |
| `variants[].stock` | `Number` | 50/50 | Phần tử trong mảng đối tượng |
| `attributes` | `Object` | 50/50 |  |
| `attributes.classifications` | `[String]` | 50/50 |  |
| `attributes.colors` | `[Object]` | 50/50 |  |
| `attributes.colors[].name` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `attributes.colors[].hex` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `attributes.sizes` | `[String]` | 50/50 |  |
| `vi` | `Object` | 50/50 |  |
| `vi.title` | `String` | 50/50 |  |
| `vi.description` | `String` | 50/50 |  |
| `vi.descriptionFull` | `[String]` | 50/50 |  |
| `vi.productType` | `String` | 50/50 |  |
| `vi.regularPrice` | `Number` | 50/50 |  |
| `vi.salePrice` | `Number` | 50/50 |  |
| `vi.onSale` | `Boolean` | 50/50 |  |
| `vi.quantity` | `Number` | 50/50 |  |
| `vi.stock` | `Number | String` | 50/50 |  |
| `vi.hasClassification` | `Boolean` | 50/50 |  |
| `vi.classifications` | `[String]` | 50/50 |  |
| `vi.hasColors` | `Boolean` | 50/50 |  |
| `vi.colors` | `[Object]` | 50/50 |  |
| `vi.colors[].name` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `vi.colors[].hex` | `String` | 50/50 | Phần tử trong mảng đối tượng |
| `vi.hasSizes` | `Boolean` | 50/50 |  |
| `vi.sizes` | `[String]` | 50/50 |  |
| `vi.categoryLevel1` | `String` | 50/50 |  |
| `vi.categoryLevel2` | `String` | 50/50 |  |
| `vi.visibility` | `Boolean` | 50/50 |  |
| `vi.stockDate` | `String` | 50/50 |  |
| `dateAdded` | `String` | 50/50 |  |
| `en` | `Object` | 50/50 |  |
| `en.visibility` | `Boolean` | 50/50 |  |
| `sk` | `Object` | 50/50 |  |
| `sk.visibility` | `Boolean` | 50/50 |  |
| `cs` | `Object` | 50/50 |  |
| `cs.visibility` | `Boolean` | 50/50 |  |
| `__v` | `Number` | 50/50 |  |
| `quantity` | `Number` | 1/50 |  |
| `stock` | `Number` | 1/50 |  |

### 3. Collection: `product_variants`

- **Model / Entity:** `ProductVariant`
- **Định nghĩa Schema:** `server/src/products/schemas/productVariant.schema.ts`
- **Module:** `ProductsModule`
- **Số lượng bản ghi thực tế:** `0` documents
- **Timestamps:** `true`
- **Mô tả:** Bảng biến thể sản phẩm riêng biệt (SKU, màu sắc, kích cỡ, phân loại, giá, tồn kho).

*Bảng hiện tại đang rỗng hoặc chưa chứa tài liệu mẫu nào.*

### 4. Collection: `categories`

- **Model / Entity:** `Category`
- **Định nghĩa Schema:** `server/src/products/schemas/category.schema.ts`
- **Module:** `ProductsModule`
- **Số lượng bản ghi thực tế:** `4` documents
- **Timestamps:** `true`
- **Mô tả:** Danh mục sản phẩm, cấu trúc cây phân cấp (cha/con), đa ngôn ngữ và menu hiển thị.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 4/4 | Khóa chính (Primary Key) |
| `titleUrl` | `String` | 4/4 |  |
| `mainImage` | `Object` | 4/4 |  |
| `mainImage.url` | `String` | 4/4 |  |
| `mainImage.name` | `String` | 4/4 |  |
| `subCategories` | `Array` | 4/4 |  |
| `parentId` | `Mixed` | 4/4 |  |
| `dateAdded` | `String` | 4/4 |  |
| `updatedAt` | `String` | 4/4 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `vi` | `Object` | 4/4 |  |
| `vi.title` | `String` | 4/4 |  |
| `vi.description` | `String` | 4/4 |  |
| `vi.position` | `Number` | 4/4 |  |
| `vi.visibility` | `Boolean` | 4/4 |  |
| `vi.menuHidden` | `Boolean` | 4/4 |  |
| `en` | `Object` | 4/4 |  |
| `en.title` | `String` | 4/4 |  |
| `en.description` | `String` | 4/4 |  |
| `en.visibility` | `Boolean` | 4/4 |  |
| `sk` | `Object` | 4/4 |  |
| `sk.visibility` | `Boolean` | 4/4 |  |
| `cs` | `Object` | 4/4 |  |
| `cs.visibility` | `Boolean` | 4/4 |  |
| `__v` | `Number` | 4/4 |  |

### 5. Collection: `orders`

- **Model / Entity:** `Order`
- **Định nghĩa Schema:** `server/src/orders/schemas/order.schema.ts`
- **Module:** `OrdersModule`
- **Số lượng bản ghi thực tế:** `39` documents
- **Timestamps:** `true`
- **Mô tả:** Quản lý đơn hàng, thông tin khách hàng, snapshot chi tiết sản phẩm, trạng thái thanh toán và vận chuyển.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 39/39 | Khóa chính (Primary Key) |
| `orderId` | `String` | 39/39 |  |
| `amount` | `Number` | 17/39 |  |
| `currency` | `String` | 39/39 |  |
| `status` | `String` | 39/39 |  |
| `notes` | `String` | 39/39 |  |
| `type` | `String` | 8/39 |  |
| `customerEmail` | `String` | 39/39 |  |
| `cart` | `Object` | 17/39 |  |
| `cart.items` | `[Object]` | 8/39 |  |
| `cart.items[].item` | `Object` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item._id` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.id` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.titleUrl` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage` | `Object` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.url` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.name` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.images` | `[String]` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.tags` | `Array` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.rating` | `Number` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item._user` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.dateAdded` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variants` | `Array` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.title` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.description` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.descriptionFull` | `Array` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.regularPrice` | `Number` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.salePrice` | `Number` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.onSale` | `Boolean` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stock` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stockDate` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.visibility` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shipping` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingCost` | `Number` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.productType` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasColors` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.colors` | `Array` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasSizes` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.sizes` | `Array` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasClassification` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel1` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel2` | `String` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.quantity` | `Number` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/39 | Phần tử trong mảng đối tượng |
| `cart.items[].id` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].qty` | `Number` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].price` | `Number` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.items[].shipingCostType` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `cart.shippingCost` | `Number` | 8/39 |  |
| `cart.shippingLimit` | `Number` | 1/39 |  |
| `cart.shippingType` | `String` | 1/39 |  |
| `cart.totalPrice` | `Number` | 8/39 |  |
| `cart.totalQty` | `Number` | 8/39 |  |
| `outcome` | `Object` | 10/39 |  |
| `outcome.seller_message` | `String` | 1/39 |  |
| `addresses` | `[Object]` | 17/39 |  |
| `addresses[].name` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `addresses[].city` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `addresses[].country` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `addresses[].line1` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `addresses[].line2` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `addresses[].zip` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `dateAdded` | `Date` | 17/39 |  |
| `__v` | `Number` | 10/39 |  |
| `statusHistory` | `[Object]` | 39/39 |  |
| `statusHistory[].status` | `String` | 39/39 | Phần tử trong mảng đối tượng |
| `statusHistory[].updatedAt` | `String | Date` | 39/39 | Phần tử trong mảng đối tượng |
| `statusHistory[].note` | `String` | 39/39 | Phần tử trong mảng đối tượng |
| `updatedAt` | `String | Date` | 39/39 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `_user` | `ObjectId` | 39/39 |  |
| `couponCode` | `String` | 39/39 |  |
| `couponDiscount` | `Number` | 39/39 |  |
| `createdAt` | `Date` | 39/39 | Thời gian tạo bản ghi (Auto Timestamp) |
| `customer` | `Object` | 39/39 |  |
| `customer.name` | `String` | 39/39 |  |
| `customer.email` | `String` | 39/39 |  |
| `customer.phone` | `String` | 39/39 |  |
| `discountAmount` | `Number` | 39/39 |  |
| `items` | `[Object]` | 39/39 |  |
| `items[].productId` | `String | ObjectId` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].sku` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].name` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].image` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].variant` | `Object` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].variant.color` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].variant.size` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].quantity` | `Number` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].unitPrice` | `Number` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].subtotal` | `Number` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot` | `Object` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.name` | `String` | 8/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.sku` | `String` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.image` | `String` | 39/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.price` | `Number` | 8/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.category` | `Mixed` | 8/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.brand` | `Mixed` | 8/39 | Phần tử trong mảng đối tượng |
| `payment` | `Object` | 39/39 |  |
| `payment.method` | `String` | 39/39 |  |
| `payment.status` | `String` | 39/39 |  |
| `payment.provider` | `String` | 39/39 |  |
| `payment.transactionId` | `String` | 39/39 |  |
| `payment.paidAt` | `Date | String` | 39/39 |  |
| `payment.refundedAmount` | `Number` | 39/39 |  |
| `payment.refundedAt` | `Date` | 39/39 |  |
| `paymentFee` | `Number` | 39/39 |  |
| `shipping` | `Object` | 39/39 |  |
| `shipping.method` | `String` | 39/39 |  |
| `shipping.provider` | `String` | 39/39 |  |
| `shipping.trackingNumber` | `String` | 39/39 |  |
| `shipping.estimatedDeliveryDate` | `Date` | 39/39 |  |
| `shipping.shippedAt` | `Date | String` | 39/39 |  |
| `shipping.deliveredAt` | `Date | String` | 39/39 |  |
| `shippingAddress` | `Object` | 39/39 |  |
| `shippingAddress.fullName` | `String` | 39/39 |  |
| `shippingAddress.phone` | `String` | 39/39 |  |
| `shippingAddress.address` | `String` | 39/39 |  |
| `shippingAddress.ward` | `String` | 39/39 |  |
| `shippingAddress.district` | `String` | 39/39 |  |
| `shippingAddress.province` | `String` | 39/39 |  |
| `shippingAddress.city` | `String` | 30/39 |  |
| `shippingAddress.country` | `String` | 30/39 |  |
| `shippingAddress.zip` | `String` | 30/39 |  |
| `shippingFee` | `Number` | 39/39 |  |
| `subtotal` | `Number` | 39/39 |  |
| `taxAmount` | `Number` | 39/39 |  |
| `totalAmount` | `Number` | 39/39 |  |
| `userId` | `ObjectId` | 39/39 |  |
| `paymentMethodId` | `ObjectId` | 39/39 |  |
| `paymentMethodSnapshot` | `Object` | 39/39 |  |
| `paymentMethodSnapshot.name` | `String` | 39/39 |  |
| `paymentMethodSnapshot.code` | `String` | 39/39 |  |
| `paymentMethodSnapshot.paymentType` | `String` | 39/39 |  |
| `paymentMethodSnapshot.paymentFee` | `Number` | 39/39 |  |
| `shippingMethodId` | `ObjectId` | 39/39 |  |
| `shippingMethodSnapshot` | `Object` | 39/39 |  |
| `shippingMethodSnapshot.name` | `String` | 37/39 |  |
| `shippingMethodSnapshot.code` | `String` | 37/39 |  |
| `shippingMethodSnapshot.fee` | `Number` | 37/39 |  |
| `shippingMethodSnapshot.estimatedDeliveryTime` | `String` | 37/39 |  |
| `customerPhone` | `String` | 38/39 |  |
| `cart.items[].item.price` | `Number` | 7/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant` | `Object` | 7/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.color` | `String` | 7/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.size` | `String` | 7/39 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.classification` | `String` | 7/39 | Phần tử trong mảng đối tượng |
| `addresses[].phone` | `String` | 16/39 | Phần tử trong mảng đối tượng |
| `shippingProvider` | `String` | 38/39 |  |
| `trackingNumber` | `String` | 38/39 |  |
| `trackingUrl` | `String` | 16/39 |  |
| `estimatedDeliveryDate` | `Date` | 17/39 |  |
| `shippedAt` | `Date` | 17/39 |  |
| `deliveredAt` | `Date` | 17/39 |  |
| `paymentStatus` | `String` | 38/39 |  |
| `shippingLogs` | `Array | [Object]` | 16/39 |  |
| `shippingLogs[].status` | `String` | 4/39 | Phần tử trong mảng đối tượng |
| `shippingLogs[].location` | `String` | 4/39 | Phần tử trong mảng đối tượng |
| `shippingLogs[].description` | `String` | 4/39 | Phần tử trong mảng đối tượng |
| `shippingLogs[].timestamp` | `Date` | 4/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.title` | `String` | 31/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant` | `Object` | 31/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.color` | `String` | 31/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.size` | `String` | 31/39 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.classification` | `String` | 31/39 | Phần tử trong mảng đối tượng |
| `transactionId` | `String` | 31/39 |  |
| `paymentProvider` | `String` | 31/39 |  |
| `paidAt` | `Date` | 31/39 |  |
| `refundedAmount` | `Number` | 31/39 |  |
| `refundedAt` | `Date` | 31/39 |  |
| `items[].variantId` | `String` | 30/39 | Phần tử trong mảng đối tượng |
| `items[].variant.classification` | `String` | 21/39 | Phần tử trong mảng đối tượng |
| `statusHistory[].updatedBy` | `Mixed` | 29/39 | Phần tử trong mảng đối tượng |
| `shippingAddress.provinceCode` | `String` | 9/39 |  |
| `shippingAddress.provinceName` | `String` | 9/39 |  |
| `shippingAddress.districtCode` | `String` | 9/39 |  |
| `shippingAddress.districtName` | `String` | 9/39 |  |
| `shippingAddress.wardCode` | `String` | 9/39 |  |
| `shippingAddress.wardName` | `String` | 9/39 |  |
| `shippingAddress.addressDetail` | `String` | 9/39 |  |
| `addresses[].fullName` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].address` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].addressDetail` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].fullAddress` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].provinceCode` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].provinceName` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].province` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].districtCode` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].districtName` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].district` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].wardCode` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].wardName` | `String` | 9/39 | Phần tử trong mảng đối tượng |
| `addresses[].ward` | `String` | 9/39 | Phần tử trong mảng đối tượng |

### 6. Collection: `shippingmethods`

- **Model / Entity:** `ShippingMethod`
- **Định nghĩa Schema:** `server/src/orders/schemas/shipping-method.schema.ts`
- **Module:** `OrdersModule`
- **Số lượng bản ghi thực tế:** `5` documents
- **Timestamps:** `true`
- **Mô tả:** Cấu hình phương thức giao hàng (tiêu chuẩn, hỏa tốc...), phí cơ bản, ngưỡng miễn phí vận chuyển.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 5/5 | Khóa chính (Primary Key) |
| `name` | `String` | 5/5 |  |
| `code` | `String` | 5/5 |  |
| `baseCost` | `Number` | 5/5 |  |
| `estimatedDays` | `String` | 5/5 |  |
| `coverageArea` | `String` | 5/5 |  |
| `freeShippingThreshold` | `Number` | 5/5 |  |
| `isActive` | `Boolean` | 5/5 |  |
| `description` | `String` | 5/5 |  |
| `__v` | `Number` | 4/5 |  |
| `createdAt` | `Date` | 5/5 | Thời gian tạo bản ghi (Auto Timestamp) |
| `updatedAt` | `Date` | 5/5 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `baseFee` | `Number` | 5/5 |  |
| `estimatedDeliveryTime` | `String` | 5/5 |  |
| `freeShippingCondition` | `Object` | 5/5 |  |
| `freeShippingCondition.enabled` | `Boolean` | 5/5 |  |
| `freeShippingCondition.minimumOrderValue` | `Number` | 5/5 |  |
| `freeShippingCondition.description` | `String` | 5/5 |  |
| `status` | `String` | 5/5 |  |

### 7. Collection: `shipping_methods`

- **Model / Entity:** `ShippingMethod (legacy / seed)`
- **Định nghĩa Schema:** `server/src/orders/schemas/shipping-method.schema.ts`
- **Module:** `OrdersModule`
- **Số lượng bản ghi thực tế:** `0` documents
- **Timestamps:** `true`
- **Mô tả:** Bảng dự phòng / seed ban đầu cho phương thức giao hàng.

*Bảng hiện tại đang rỗng hoặc chưa chứa tài liệu mẫu nào.*

### 8. Collection: `payment_methods`

- **Model / Entity:** `PaymentMethod`
- **Định nghĩa Schema:** `server/src/orders/schemas/payment-method.schema.ts`
- **Module:** `OrdersModule`
- **Số lượng bản ghi thực tế:** `11` documents
- **Timestamps:** `true`
- **Mô tả:** Phương thức thanh toán hỗ trợ (COD, Chuyển khoản, Stripe, MoMo...), phụ phí và trạng thái kích hoạt.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 11/11 | Khóa chính (Primary Key) |
| `name` | `String` | 11/11 |  |
| `code` | `String` | 11/11 |  |
| `type` | `String` | 11/11 |  |
| `paymentType` | `String` | 11/11 |  |
| `isActive` | `Boolean` | 11/11 |  |
| `status` | `String` | 11/11 |  |
| `description` | `String` | 11/11 |  |
| `paymentInfo` | `String` | 11/11 |  |
| `paymentProofImage` | `String` | 11/11 |  |
| `createdAt` | `String` | 11/11 | Thời gian tạo bản ghi (Auto Timestamp) |
| `updatedAt` | `String` | 11/11 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |

### 9. Collection: `coupons`

- **Model / Entity:** `Coupon`
- **Định nghĩa Schema:** `server/src/orders/schemas/coupon.schema.ts`
- **Module:** `OrdersModule`
- **Số lượng bản ghi thực tế:** `2` documents
- **Timestamps:** `true`
- **Mô tả:** Mã giảm giá, loại chiết khấu (phần trăm / tiền mặt), điều kiện đơn hàng tối thiểu và thời hạn.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 2/2 | Khóa chính (Primary Key) |
| `code` | `String` | 2/2 |  |
| `description` | `String` | 2/2 |  |
| `discountType` | `String` | 2/2 |  |
| `discountValue` | `Number` | 2/2 |  |
| `maxDiscount` | `Number` | 2/2 |  |
| `minOrderValue` | `Number` | 2/2 |  |
| `endDate` | `Date` | 2/2 |  |
| `usageLimit` | `Number` | 2/2 |  |
| `usedCount` | `Number` | 2/2 |  |
| `isActive` | `Boolean` | 2/2 |  |
| `startDate` | `Date` | 2/2 |  |
| `__v` | `Number` | 2/2 |  |
| `createdAt` | `Date` | 2/2 | Thời gian tạo bản ghi (Auto Timestamp) |
| `updatedAt` | `Date` | 2/2 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |

### 10. Collection: `settings`

- **Model / Entity:** `Settings (System)`
- **Định nghĩa Schema:** `Nạp/lưu trực tiếp qua db.collection("settings")`
- **Module:** `OrdersModule / Universal / Client Settings`
- **Số lượng bản ghi thực tế:** `1` documents
- **Timestamps:** `false`
- **Mô tả:** Cài đặt toàn hệ thống website: thông tin thương hiệu, liên hệ (hotline, email, địa chỉ), trạng thái bảo trì, checkout.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 1/1 | Khóa chính (Primary Key) |
| `site` | `Object` | 1/1 |  |
| `site.name` | `String` | 1/1 |  |
| `site.logo` | `String` | 1/1 |  |
| `site.favicon` | `String` | 1/1 |  |
| `site.description` | `String` | 1/1 |  |
| `contact` | `Object` | 1/1 |  |
| `contact.email` | `String` | 1/1 |  |
| `contact.phone` | `String` | 1/1 |  |
| `contact.address` | `String` | 1/1 |  |
| `store` | `Object` | 1/1 |  |
| `store.isOpen` | `Boolean` | 1/1 |  |
| `checkout` | `Object` | 1/1 |  |
| `checkout.allowOrder` | `Boolean` | 1/1 |  |
| `shipping` | `Object` | 1/1 |  |
| `shipping.enabled` | `Boolean` | 1/1 |  |
| `maintenance` | `Object` | 1/1 |  |
| `maintenance.enabled` | `Boolean` | 1/1 |  |
| `maintenance.message` | `String` | 1/1 |  |
| `system` | `Object` | 1/1 |  |
| `system.language` | `String` | 1/1 |  |
| `system.currency` | `String` | 1/1 |  |
| `system.timezone` | `String` | 1/1 |  |
| `updatedAt` | `String` | 1/1 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |

### 11. Collection: `pages_home`

- **Model / Entity:** `PageHome`
- **Định nghĩa Schema:** `server/src/cheri/schemas/page-home.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `2` documents
- **Timestamps:** `true`
- **Mô tả:** Cấu hình CMS giao diện Trang chủ: danh sách sections linh hoạt (hero, carousel, banner, typography, colors...).

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 2/2 | Khóa chính (Primary Key) |
| `status` | `String` | 2/2 |  |
| `key` | `String` | 2/2 |  |
| `__v` | `Number` | 2/2 |  |
| `createdAt` | `Date` | 2/2 | Thời gian tạo bản ghi (Auto Timestamp) |
| `publishedAt` | `Date` | 2/2 |  |
| `sections` | `[Object]` | 2/2 |  |
| `sections[].id` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].name` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].type` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].category` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].enabled` | `Boolean` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].order` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].content` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].content.eyebrow` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].content.title` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].content.description` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].content.buttonText` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].content.buttonLink` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop.url` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop.alt` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.mobile` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.mobile.url` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.mobile.alt` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.overlayOpacity` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides` | `[Object]` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].id` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].url` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].mobileUrl` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].alt` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].title` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].description` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].linkUrl` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].enabled` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.title.letterSpacing` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.description` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.description.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.description.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.description.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides[].typography.description.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.variant` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.alignment` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.contentPosition` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.fullWidth` | `Boolean` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.minHeight` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig.autoplay` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig.autoplayInterval` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig.showDots` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig.showArrows` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].layout.carouselConfig.loop` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].motionPreset` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.preset` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.duration` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.delay` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.intensity` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.once` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.preset` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontFamily` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontSize` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontWeight` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.lineHeight` | `Number (Float)` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.letterSpacing` | `Number (Float)` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.letterSpacing` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.textTransform` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.body` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontFamily` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontSize` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontWeight` | `Number` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.letterSpacing` | `Number (Float)` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.textTransform` | `String` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1.letterSpacing` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline1.textTransform` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2.fontFamily` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2.fontSize` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2.fontWeight` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2.letterSpacing` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.tagline2.textTransform` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings` | `Object` | 2/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.overlay` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.bgColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.textColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors` | `Object` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.backgroundColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.titleColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.subtitleColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.bodyColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonTextColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonBackgroundColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonHoverTextColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonHoverBackgroundColor` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].isCustomAnimation` | `Boolean` | 1/2 | Phần tử trong mảng đối tượng |
| `updatedAt` | `Date` | 2/2 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `updatedBy` | `String` | 2/2 |  |
| `version` | `Number` | 2/2 |  |
| `sections[].content.viewAllText` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].content.viewAllLink` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].animation.trigger` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.textTransform` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.textAlign` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.lineHeight` | `Number (Float)` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.textAlign` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.source` | `String` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.limit` | `Number` | 1/2 | Phần tử trong mảng đối tượng |
| `sections[].settings.itemsPerView` | `Number` | 1/2 | Phần tử trong mảng đối tượng |

### 12. Collection: `pages_about`

- **Model / Entity:** `PageAbout`
- **Định nghĩa Schema:** `server/src/cheri/schemas/page-about.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `1` documents
- **Timestamps:** `true`
- **Mô tả:** Cấu hình CMS giao diện Trang Giới thiệu: sections, storytelling, team, timeline, typography, màu sắc.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 1/1 | Khóa chính (Primary Key) |
| `key` | `String` | 1/1 |  |
| `status` | `String` | 1/1 |  |
| `__v` | `Number` | 1/1 |  |
| `createdAt` | `Date` | 1/1 | Thời gian tạo bản ghi (Auto Timestamp) |
| `publishedAt` | `Date` | 1/1 |  |
| `sections` | `[Object]` | 1/1 |  |
| `sections[].id` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].name` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].type` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].category` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].enabled` | `Boolean` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].order` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.eyebrow` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.title` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.description` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.quote` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.tagline1` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.tagline2` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.buttonText` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.buttonLink` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].content.author` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop.url` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.desktop.alt` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.mobile` | `Mixed` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.overlayOpacity` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].media.carouselSlides` | `Array` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].layout` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].layout.variant` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].layout.imageWidth` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].layout.contentWidth` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].layout.alignment` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].motionPreset` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation.preset` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation.duration` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation.delay` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation.intensity` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].animation.once` | `Boolean` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.preset` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.letterSpacing` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.eyebrow.textTransform` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.lineHeight` | `Number (Float)` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.heading.letterSpacing` | `Number (Float)` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.subheading.lineHeight` | `Number (Float)` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.body` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.body.lineHeight` | `Number (Float)` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.letterSpacing` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.button.textTransform` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontFamily` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontSize` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.fontWeight` | `Number` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].typography.quote.lineHeight` | `Number (Float)` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].settings` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].settings.enableGlow` | `Boolean` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].settings.overlay` | `Boolean` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors` | `Object` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.backgroundColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.titleColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.subtitleColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.bodyColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.quoteColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonTextColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonBackgroundColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonHoverTextColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].colors.buttonHoverBackgroundColor` | `String` | 1/1 | Phần tử trong mảng đối tượng |
| `sections[].isCustomAnimation` | `Boolean` | 1/1 | Phần tử trong mảng đối tượng |
| `updatedAt` | `Date` | 1/1 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `updatedBy` | `String` | 1/1 |  |
| `version` | `Number` | 1/1 |  |

### 13. Collection: `pages_policies`

- **Model / Entity:** `Page (Policy)`
- **Định nghĩa Schema:** `server/src/cheri/schemas/page.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `7` documents
- **Timestamps:** `true`
- **Mô tả:** Nội dung các trang chính sách tĩnh (Chính sách đổi trả, bảo mật, vận chuyển...) theo định dạng HTML đa ngôn ngữ.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 7/7 | Khóa chính (Primary Key) |
| `titleUrl` | `String` | 7/7 |  |
| `status` | `String` | 7/7 |  |
| `dateAdded` | `Date` | 7/7 |  |
| `updatedAt` | `String | Date` | 7/7 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `vi` | `Object` | 7/7 |  |
| `vi.title` | `String` | 7/7 |  |
| `vi.contentHTML` | `String` | 7/7 |  |
| `vi.visibility` | `Boolean` | 7/7 |  |
| `vi.metaDescription` | `String` | 7/7 |  |
| `en` | `Object` | 7/7 |  |
| `en.title` | `String` | 7/7 |  |
| `en.contentHTML` | `String` | 7/7 |  |
| `__v` | `Number` | 7/7 |  |
| `en.visibility` | `Boolean` | 2/7 |  |
| `en.metaDescription` | `String` | 1/7 |  |

### 14. Collection: `pages`

- **Model / Entity:** `Page (Static Pages)`
- **Định nghĩa Schema:** `server/src/cheri/schemas/page.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `7` documents
- **Timestamps:** `false`
- **Mô tả:** Tập hợp các trang thông tin tĩnh độc lập của hệ thống.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 7/7 | Khóa chính (Primary Key) |
| `titleUrl` | `String` | 7/7 |  |
| `status` | `String` | 7/7 |  |
| `dateAdded` | `Date` | 7/7 |  |
| `updatedAt` | `String | Date` | 7/7 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `vi` | `Object` | 7/7 |  |
| `vi.title` | `String` | 7/7 |  |
| `vi.contentHTML` | `String` | 7/7 |  |
| `vi.visibility` | `Boolean` | 7/7 |  |
| `vi.metaDescription` | `String` | 7/7 |  |
| `en` | `Object` | 7/7 |  |
| `en.title` | `String` | 7/7 |  |
| `en.contentHTML` | `String` | 7/7 |  |
| `__v` | `Number` | 7/7 |  |
| `en.visibility` | `Boolean` | 2/7 |  |
| `en.metaDescription` | `String` | 1/7 |  |

### 15. Collection: `translations`

- **Model / Entity:** `Translation`
- **Định nghĩa Schema:** `server/src/translations/schemas/translation.schema.ts`
- **Module:** `TranslationsModule`
- **Số lượng bản ghi thực tế:** `1` documents
- **Timestamps:** `false`
- **Mô tả:** Từ điển i18n đa ngôn ngữ cho toàn bộ nhãn giao diện người dùng frontend.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 1/1 | Khóa chính (Primary Key) |
| `lang` | `String` | 1/1 |  |
| `keys` | `Object` | 1/1 |  |
| `keys.SignIn` | `String` | 1/1 |  |
| `keys.SignUp` | `String` | 1/1 |  |
| `keys.Login` | `String` | 1/1 |  |
| `keys.Logout` | `String` | 1/1 |  |
| `keys.Password` | `String` | 1/1 |  |
| `keys.Name` | `String` | 1/1 |  |
| `keys.Email` | `String` | 1/1 |  |
| `keys.SIGNIN_SUCCESS` | `String` | 1/1 |  |
| `keys.SIGNUP_SUCCESS` | `String` | 1/1 |  |
| `keys.with` | `String` | 1/1 |  |
| `keys.Home` | `String` | 1/1 |  |
| `keys.Dashboard` | `String` | 1/1 |  |
| `keys.Orders` | `String` | 1/1 |  |
| `keys.Order` | `String` | 1/1 |  |
| `keys.Cart` | `String` | 1/1 |  |
| `keys.Categories` | `String` | 1/1 |  |
| `keys.Category` | `String` | 1/1 |  |
| `keys.Products` | `String` | 1/1 |  |
| `keys.Product` | `String` | 1/1 |  |
| `keys.products` | `String` | 1/1 |  |
| `keys.All` | `String` | 1/1 |  |
| `keys.Detail` | `String` | 1/1 |  |
| `keys.Back` | `String` | 1/1 |  |
| `keys.More` | `String` | 1/1 |  |
| `keys.Search` | `String` | 1/1 |  |
| `keys.Find` | `String` | 1/1 |  |
| `keys.Filter` | `String` | 1/1 |  |
| `keys.Sorting` | `String` | 1/1 |  |
| `keys.PriceRange` | `String` | 1/1 |  |
| `keys.Price` | `String` | 1/1 |  |
| `keys.Price_from` | `String` | 1/1 |  |
| `keys.Price_to` | `String` | 1/1 |  |
| `keys.to` | `String` | 1/1 |  |
| `keys.Sort_by` | `String` | 1/1 |  |
| `keys.Newest` | `String` | 1/1 |  |
| `keys.Oldest` | `String` | 1/1 |  |
| `keys.Price-asc` | `String` | 1/1 |  |
| `keys.Price-decs` | `String` | 1/1 |  |
| `keys.Title` | `String` | 1/1 |  |
| `keys.Description` | `String` | 1/1 |  |
| `keys.Short_description` | `String` | 1/1 |  |
| `keys.Images` | `String` | 1/1 |  |
| `keys.Sale_price` | `String` | 1/1 |  |
| `keys.Regular_price` | `String` | 1/1 |  |
| `keys.Visibility` | `String` | 1/1 |  |
| `keys.Visible` | `String` | 1/1 |  |
| `keys.Hidden` | `String` | 1/1 |  |
| `keys.On_stock` | `String` | 1/1 |  |
| `keys.Available_in_few_weeks` | `String` | 1/1 |  |
| `keys.Unavailable` | `String` | 1/1 |  |
| `keys.On_sale` | `String` | 1/1 |  |
| `keys.Shipping` | `String` | 1/1 |  |
| `keys.Shipping_cost` | `String` | 1/1 |  |
| `keys.Tags` | `String` | 1/1 |  |
| `keys.Stock` | `String` | 1/1 |  |
| `keys.Added` | `String` | 1/1 |  |
| `keys.ADDED_TO_CART` | `String` | 1/1 |  |
| `keys.TO_CART` | `String` | 1/1 |  |
| `keys.Remove` | `String` | 1/1 |  |
| `keys.Edit` | `String` | 1/1 |  |
| `keys.Save` | `String` | 1/1 |  |
| `keys.Add` | `String` | 1/1 |  |
| `keys.Amount` | `String` | 1/1 |  |
| `keys.Type` | `String` | 1/1 |  |
| `keys.Customer` | `String` | 1/1 |  |
| `keys.Created` | `String` | 1/1 |  |
| `keys.Paid` | `String` | 1/1 |  |
| `keys.Total_price` | `String` | 1/1 |  |
| `keys.Total_quantity` | `String` | 1/1 |  |
| `keys.About_customer` | `String` | 1/1 |  |
| `keys.City` | `String` | 1/1 |  |
| `keys.Country` | `String` | 1/1 |  |
| `keys.Address` | `String` | 1/1 |  |
| `keys.Zip` | `String` | 1/1 |  |
| `keys.Status` | `String` | 1/1 |  |
| `keys.SuccessOrder` | `String` | 1/1 |  |
| `keys.Pay` | `String` | 1/1 |  |
| `keys.Checkout` | `String` | 1/1 |  |
| `keys.Home_promo` | `String` | 1/1 |  |
| `keys.Free_shipping_limit` | `String` | 1/1 |  |
| `keys.Eshop_subtitle` | `String` | 1/1 |  |
| `keys.ESHOP_TITLE` | `String` | 1/1 |  |
| `keys.ESHOP_DESCRIPTION` | `String` | 1/1 |  |
| `keys.LINKS` | `String` | 1/1 |  |
| `keys.CONTACT` | `String` | 1/1 |  |
| `keys.Contact` | `String` | 1/1 |  |
| `keys.Send` | `String` | 1/1 |  |
| `keys.Language_for_page` | `String` | 1/1 |  |
| `keys.Language_for_product_detail` | `String` | 1/1 |  |
| `keys.From_existing_pages` | `String` | 1/1 |  |
| `keys.Add_page` | `String` | 1/1 |  |
| `keys.Request_sended` | `String` | 1/1 |  |
| `keys.Again` | `String` | 1/1 |  |
| `keys.Theme` | `String` | 1/1 |  |
| `keys.Config` | `String` | 1/1 |  |
| `keys.Translations` | `String` | 1/1 |  |
| `keys.Pages` | `String` | 1/1 |  |
| `keys.Prev` | `String` | 1/1 |  |
| `keys.Next` | `String` | 1/1 |  |

### 16. Collection: `themes`

- **Model / Entity:** `Theme`
- **Định nghĩa Schema:** `server/src/cheri/schemas/theme.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `0` documents
- **Timestamps:** `false`
- **Mô tả:** Bộ giao diện / theme website.

*Bảng hiện tại đang rỗng hoặc chưa chứa tài liệu mẫu nào.*

### 17. Collection: `configs`

- **Model / Entity:** `Config`
- **Định nghĩa Schema:** `server/src/cheri/schemas/config.schema.ts`
- **Module:** `CheriModule`
- **Số lượng bản ghi thực tế:** `0` documents
- **Timestamps:** `false`
- **Mô tả:** Cấu hình chi phí vận chuyển động theo quốc gia và ngôn ngữ.

*Bảng hiện tại đang rỗng hoặc chưa chứa tài liệu mẫu nào.*

### 18. Collection: `session`

- **Model / Entity:** `Session (connect-mongo)`
- **Định nghĩa Schema:** `server/src/setAppDB.ts`
- **Module:** `Express / Passport`
- **Số lượng bản ghi thực tế:** `16` documents
- **Timestamps:** `false`
- **Mô tả:** Lưu trữ session phiên đăng nhập người dùng và quản trị viên (connect.sid).

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `String` | 16/16 | Khóa chính (Primary Key) |
| `expires` | `Date` | 16/16 |  |
| `session` | `String` | 16/16 |  |

### 19. Collection: `orders_backup_20261005`

- **Model / Entity:** `OrderBackup`
- **Định nghĩa Schema:** `Snapshot backup ngày 05/10/2026`
- **Module:** `System Backup`
- **Số lượng bản ghi thực tế:** `10` documents
- **Timestamps:** `true`
- **Mô tả:** Bản sao lưu dữ liệu đơn hàng phục vụ bảo trì hệ thống.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 10/10 | Khóa chính (Primary Key) |
| `orderId` | `String` | 10/10 |  |
| `amount` | `Number` | 9/10 |  |
| `currency` | `String` | 10/10 |  |
| `status` | `String` | 10/10 |  |
| `notes` | `String` | 10/10 |  |
| `type` | `String` | 9/10 |  |
| `customerEmail` | `String` | 10/10 |  |
| `cart` | `Object` | 9/10 |  |
| `cart.items` | `[Object]` | 9/10 |  |
| `cart.items[].item` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item._id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.titleUrl` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.url` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.name` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.images` | `[String]` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.tags` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.rating` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item._user` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.dateAdded` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variants` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.title` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.description` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.descriptionFull` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.regularPrice` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.salePrice` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.onSale` | `Boolean` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stock` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stockDate` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.visibility` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shipping` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.productType` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasColors` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.colors` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasSizes` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.sizes` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasClassification` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel1` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel2` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.quantity` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].qty` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].price` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].shipingCostType` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.shippingCost` | `Number` | 9/10 |  |
| `cart.shippingLimit` | `Number` | 1/10 |  |
| `cart.shippingType` | `String` | 1/10 |  |
| `cart.totalPrice` | `Number` | 9/10 |  |
| `cart.totalQty` | `Number` | 9/10 |  |
| `outcome` | `Object` | 1/10 |  |
| `outcome.seller_message` | `String` | 1/10 |  |
| `addresses` | `[Object]` | 9/10 |  |
| `addresses[].name` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].city` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].country` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].line1` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].line2` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].zip` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `dateAdded` | `Date` | 9/10 |  |
| `__v` | `Number` | 1/10 |  |
| `statusHistory` | `[Object]` | 10/10 |  |
| `statusHistory[].status` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `statusHistory[].updatedAt` | `String | Date` | 10/10 | Phần tử trong mảng đối tượng |
| `statusHistory[].note` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `updatedAt` | `String | Date` | 10/10 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `_user` | `ObjectId` | 9/10 |  |
| `userId` | `ObjectId` | 8/10 |  |
| `customerPhone` | `String` | 9/10 |  |
| `items` | `[Object]` | 9/10 |  |
| `items[].productId` | `ObjectId` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].variantId` | `Mixed` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.title` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.sku` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.image` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.color` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.size` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.classification` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].quantity` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].unitPrice` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].subtotal` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.price` | `Number` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant` | `Object` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.color` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.size` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.classification` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `shippingAddress` | `Object` | 9/10 |  |
| `shippingAddress.fullName` | `String` | 9/10 |  |
| `shippingAddress.phone` | `String` | 9/10 |  |
| `shippingAddress.address` | `String` | 9/10 |  |
| `shippingAddress.ward` | `String` | 9/10 |  |
| `shippingAddress.district` | `String` | 9/10 |  |
| `shippingAddress.province` | `String` | 9/10 |  |
| `addresses[].phone` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `shippingFee` | `Number` | 9/10 |  |
| `shippingProvider` | `String` | 9/10 |  |
| `trackingNumber` | `String` | 9/10 |  |
| `trackingUrl` | `String` | 8/10 |  |
| `estimatedDeliveryDate` | `Date` | 9/10 |  |
| `shippedAt` | `Date` | 9/10 |  |
| `deliveredAt` | `Date` | 9/10 |  |
| `paymentStatus` | `String` | 9/10 |  |
| `subtotal` | `Number` | 9/10 |  |
| `discountAmount` | `Number` | 9/10 |  |
| `taxAmount` | `Number` | 9/10 |  |
| `totalAmount` | `Number` | 9/10 |  |
| `shippingLogs` | `Array | [Object]` | 8/10 |  |
| `createdAt` | `Date` | 9/10 | Thời gian tạo bản ghi (Auto Timestamp) |
| `shippingLogs[].status` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].location` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].description` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].timestamp` | `Date` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingMethodId` | `Mixed` | 1/10 |  |
| `shippingMethodSnapshot` | `Mixed` | 1/10 |  |
| `paymentMethodId` | `Mixed` | 1/10 |  |
| `paymentMethodSnapshot` | `Mixed` | 1/10 |  |
| `transactionId` | `String` | 1/10 |  |
| `paymentProvider` | `String` | 1/10 |  |
| `paymentFee` | `Number` | 1/10 |  |
| `paidAt` | `Mixed` | 1/10 |  |
| `refundedAmount` | `Number` | 1/10 |  |
| `refundedAt` | `Mixed` | 1/10 |  |
| `couponCode` | `String` | 1/10 |  |
| `couponDiscount` | `Number` | 1/10 |  |

### 20. Collection: `orders_backup_fk_20261005`

- **Model / Entity:** `OrderBackupFK`
- **Định nghĩa Schema:** `Snapshot backup ngày 05/10/2026 (Foreign Keys)`
- **Module:** `System Backup`
- **Số lượng bản ghi thực tế:** `10` documents
- **Timestamps:** `true`
- **Mô tả:** Bản sao lưu đơn hàng kèm liên kết khóa ngoại tương thích.

| Tên Field (Path) | Kiểu dữ liệu thực tế | Tần suất xuất hiện (Sample) | Ghi chú / Mô tả |
|:---|:---|:---:|:---|
| `_id` | `ObjectId` | 10/10 | Khóa chính (Primary Key) |
| `orderId` | `String` | 10/10 |  |
| `amount` | `Number` | 9/10 |  |
| `currency` | `String` | 10/10 |  |
| `status` | `String` | 10/10 |  |
| `notes` | `String` | 10/10 |  |
| `type` | `String` | 9/10 |  |
| `customerEmail` | `String` | 10/10 |  |
| `cart` | `Object` | 9/10 |  |
| `cart.items` | `[Object]` | 9/10 |  |
| `cart.items[].item` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item._id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.titleUrl` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage` | `Object` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.url` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.mainImage.name` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.images` | `[String]` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.tags` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.rating` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item._user` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.dateAdded` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variants` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.title` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.description` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.descriptionFull` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.regularPrice` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.salePrice` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.onSale` | `Boolean` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stock` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.stockDate` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.visibility` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shipping` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.productType` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasColors` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.colors` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasSizes` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.sizes` | `Array` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.hasClassification` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel1` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.categoryLevel2` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.quantity` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/10 | Phần tử trong mảng đối tượng |
| `cart.items[].id` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].qty` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].price` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.items[].shipingCostType` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `cart.shippingCost` | `Number` | 9/10 |  |
| `cart.shippingLimit` | `Number` | 1/10 |  |
| `cart.shippingType` | `String` | 1/10 |  |
| `cart.totalPrice` | `Number` | 9/10 |  |
| `cart.totalQty` | `Number` | 9/10 |  |
| `outcome` | `Object` | 1/10 |  |
| `outcome.seller_message` | `String` | 1/10 |  |
| `addresses` | `[Object]` | 9/10 |  |
| `addresses[].name` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].city` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].country` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].line1` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].line2` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `addresses[].zip` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `dateAdded` | `Date` | 9/10 |  |
| `__v` | `Number` | 1/10 |  |
| `statusHistory` | `[Object]` | 10/10 |  |
| `statusHistory[].status` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `statusHistory[].updatedAt` | `String | Date` | 10/10 | Phần tử trong mảng đối tượng |
| `statusHistory[].note` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `updatedAt` | `String | Date` | 10/10 | Thời gian cập nhật bản ghi gần nhất (Auto Timestamp) |
| `_user` | `ObjectId` | 10/10 |  |
| `couponCode` | `String` | 10/10 |  |
| `couponDiscount` | `Number` | 10/10 |  |
| `createdAt` | `Date` | 10/10 | Thời gian tạo bản ghi (Auto Timestamp) |
| `customer` | `Object` | 10/10 |  |
| `customer.name` | `String` | 10/10 |  |
| `customer.email` | `String` | 10/10 |  |
| `customer.phone` | `String` | 10/10 |  |
| `discountAmount` | `Number` | 10/10 |  |
| `items` | `[Object]` | 10/10 |  |
| `items[].productId` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].sku` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].name` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].image` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].variant` | `Object` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].variant.color` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].variant.size` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].quantity` | `Number` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].unitPrice` | `Number` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].subtotal` | `Number` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot` | `Object` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.name` | `String` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.sku` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.image` | `String` | 10/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.price` | `Number` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.category` | `Mixed` | 9/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.brand` | `Mixed` | 9/10 | Phần tử trong mảng đối tượng |
| `payment` | `Object` | 10/10 |  |
| `payment.method` | `String` | 10/10 |  |
| `payment.status` | `String` | 10/10 |  |
| `payment.provider` | `String` | 10/10 |  |
| `payment.transactionId` | `Mixed` | 10/10 |  |
| `payment.paidAt` | `Date | String` | 10/10 |  |
| `payment.refundedAmount` | `Number` | 10/10 |  |
| `payment.refundedAt` | `Mixed` | 10/10 |  |
| `paymentFee` | `Number` | 10/10 |  |
| `shipping` | `Object` | 10/10 |  |
| `shipping.method` | `String` | 10/10 |  |
| `shipping.provider` | `String` | 10/10 |  |
| `shipping.trackingNumber` | `String` | 10/10 |  |
| `shipping.estimatedDeliveryDate` | `Mixed` | 10/10 |  |
| `shipping.shippedAt` | `Date | String` | 10/10 |  |
| `shipping.deliveredAt` | `Date | String` | 10/10 |  |
| `shippingAddress` | `Object` | 10/10 |  |
| `shippingAddress.fullName` | `String` | 10/10 |  |
| `shippingAddress.phone` | `String` | 10/10 |  |
| `shippingAddress.address` | `String` | 10/10 |  |
| `shippingAddress.ward` | `String` | 10/10 |  |
| `shippingAddress.district` | `String` | 10/10 |  |
| `shippingAddress.province` | `String` | 10/10 |  |
| `shippingAddress.city` | `String` | 10/10 |  |
| `shippingAddress.country` | `String` | 10/10 |  |
| `shippingAddress.zip` | `String` | 10/10 |  |
| `shippingFee` | `Number` | 10/10 |  |
| `subtotal` | `Number` | 10/10 |  |
| `taxAmount` | `Number` | 10/10 |  |
| `totalAmount` | `Number` | 10/10 |  |
| `userId` | `ObjectId` | 10/10 |  |
| `customerPhone` | `String` | 9/10 |  |
| `cart.items[].item.price` | `Number` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant` | `Object` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.color` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.size` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `cart.items[].item.variant.classification` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `addresses[].phone` | `String` | 8/10 | Phần tử trong mảng đối tượng |
| `shippingProvider` | `String` | 9/10 |  |
| `trackingNumber` | `String` | 9/10 |  |
| `trackingUrl` | `String` | 8/10 |  |
| `estimatedDeliveryDate` | `Date` | 9/10 |  |
| `shippedAt` | `Date` | 9/10 |  |
| `deliveredAt` | `Date` | 9/10 |  |
| `paymentStatus` | `String` | 9/10 |  |
| `shippingLogs` | `Array | [Object]` | 8/10 |  |
| `shippingLogs[].status` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].location` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].description` | `String` | 4/10 | Phần tử trong mảng đối tượng |
| `shippingLogs[].timestamp` | `Date` | 4/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.title` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant` | `Object` | 1/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.color` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.size` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `items[].productSnapshot.variant.classification` | `String` | 1/10 | Phần tử trong mảng đối tượng |
| `shippingMethodId` | `Mixed` | 1/10 |  |
| `shippingMethodSnapshot` | `Mixed` | 1/10 |  |
| `paymentMethodId` | `Mixed` | 1/10 |  |
| `paymentMethodSnapshot` | `Mixed` | 1/10 |  |
| `transactionId` | `String` | 1/10 |  |
| `paymentProvider` | `String` | 1/10 |  |
| `paidAt` | `Mixed` | 1/10 |  |
| `refundedAmount` | `Number` | 1/10 |  |
| `refundedAt` | `Mixed` | 1/10 |  |

