# CHERI MongoDB Schema

> **Database**: `cheri`  
> **Cập nhật**: 2026-10-16T11:44:45.296Z  
> **Tổng số collection**: 27  

## Danh sách Collections

| # | Collection | Docs | Fields | Mô tả |
|---|-----------|------|--------|-------|
| 1 | `users` | 28 | 35 | Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/admin. |
| 2 | `orders` | 48 | 229 | Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái. |
| 3 | `products` | 99 | 66 | Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục. |
| 4 | `categories` | 4 | 24 | Danh mục sản phẩm theo cây phân cấp (level1, level2). |
| 5 | `coupons` | 2 | 15 | Mã giảm giá: loại, giá trị, điều kiện, thời hạn sử dụng. |
| 6 | `shippingmethods` | 5 | 19 | Phương thức vận chuyển: tên, phí, trạng thái, vùng giao hàng. |
| 7 | `payment_methods` | 11 | 12 | Phương thức thanh toán: COD, Stripe, v.v. |
| 8 | `settings` | 1 | 24 | Cấu hình toàn site: thông tin cửa hàng, bảo trì, tiền tệ, liên hệ. |
| 9 | `session` | 25 | 3 | Session người dùng lưu giỏ hàng khách vãng lai và auth token. |
| 10 | `notification-popup` | 10 | 17 | Thông báo popup hiển thị cho người dùng. |
| 11 | `grapesjs_projects` | 2 | 86 | Dự án thiết kế trang GrapesJS (lưu JSON thiết kế). |
| 12 | `grapesjs_published` | 3 | 89 | Trang đã xuất bản từ GrapesJS editor. |
| 13 | `pages_home` | 2 | 160 | Nội dung trang chủ (hero, banner, sections). |
| 14 | `pages_about` | 1 | 97 | Nội dung trang giới thiệu. |
| 15 | `pages_policies` | 7 | 16 | Nội dung các trang chính sách (điều khoản, bảo mật, v.v.). |
| 16 | `pages` | 7 | 16 | Các trang tĩnh khác của website. |
| 17 | `translations` | 1 | 102 | Dữ liệu đa ngôn ngữ cho giao diện. |
| 18 | `product_reviews` | 1 | 13 | Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt). |
| 19 | `user_interactions` | 301 | 11 | Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System). |
| 20 | `ml_bootstrap_interactions` | 1446 | 14 | Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế. |
| 21 | `passwordresets` | 0 | 0 | Token đặt lại mật khẩu (email, token, hết hạn). |
| 22 | `configs` | 0 | 0 | Cấu hình hệ thống nội bộ (reserved). |
| 23 | `themes` | 0 | 0 | Theme giao diện website (reserved). |
| 24 | `product_variants` | 0 | 0 | Biến thể sản phẩm độc lập (deprecated/reserved). |
| 25 | `shipping_methods` | 0 | 0 | Phương thức vận chuyển (alias/deprecated, dùng shippingmethods). |
| 26 | `orders_backup_20261005` | 10 | 133 | Backup đơn hàng trước migration ngày 05/10/2026. |
| 27 | `orders_backup_fk_20261005` | 10 | 161 | Backup đơn hàng có foreign-key trước migration ngày 05/10/2026. |

---

## `users`

> Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/admin.

- **Documents**: 28  
- **Sampled**: 28  
- **Fields**: 35  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 20/28 |
| `_id` | `ObjectId` | 28/28 |
| `address` | `String` | 26/28 |
| `avatar` | `String` | 24/28 |
| `cart` | `Object` | 28/28 |
| `cart.items` | `Array` | 28/28 |
| `cart.items[]` | `Object` | 4/28 |
| `cart.items[].productId` | `ObjectId` | 4/28 |
| `cart.items[].quantity` | `Number` | 4/28 |
| `cart.items[].selectedClassification` | `String` | 4/28 |
| `cart.items[].selectedColor` | `String` | 4/28 |
| `cart.items[].selectedSize` | `String` | 4/28 |
| `cart.items[].variantId` | `String` | 4/28 |
| `cart.totalPrice` | `Number` | 1/28 |
| `createdAt` | `Date | String` | 25/28 |
| `dateAdded` | `Date | String` | 26/28 |
| `dateOfBirth` | `String` | 22/28 |
| `description` | `String` | 27/28 |
| `email` | `String` | 28/28 |
| `fullName` | `String` | 27/28 |
| `gender` | `String` | 24/28 |
| `googleId` | `String` | 6/28 |
| `images` | `Array` | 27/28 |
| `images[]` | `String` | 6/28 |
| `name` | `String` | 28/28 |
| `password` | `String` | 24/28 |
| `phoneNumber` | `String` | 26/28 |
| `provider` | `String` | 3/28 |
| `role` | `Array` | 1/28 |
| `role[]` | `String` | 1/28 |
| `roles` | `Array` | 28/28 |
| `roles[]` | `String` | 28/28 |
| `salt` | `String` | 24/28 |
| `status` | `Boolean` | 28/28 |
| `updatedAt` | `Date | String` | 28/28 |

## `orders`

> Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái.

- **Documents**: 48  
- **Sampled**: 48  
- **Fields**: 229  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 20/48 |
| `_id` | `ObjectId` | 48/48 |
| `_user` | `ObjectId` | 45/48 |
| `actualCollectedAmount` | `Number` | 1/48 |
| `addresses` | `Array` | 27/48 |
| `addresses[]` | `Object` | 26/48 |
| `addresses[].address` | `String` | 18/48 |
| `addresses[].addressDetail` | `String` | 18/48 |
| `addresses[].city` | `String` | 8/48 |
| `addresses[].country` | `String` | 8/48 |
| `addresses[].district` | `String` | 18/48 |
| `addresses[].districtCode` | `String` | 18/48 |
| `addresses[].districtName` | `String` | 18/48 |
| `addresses[].fullAddress` | `String` | 18/48 |
| `addresses[].fullName` | `String` | 18/48 |
| `addresses[].line1` | `String` | 8/48 |
| `addresses[].line2` | `String` | 8/48 |
| `addresses[].name` | `String` | 8/48 |
| `addresses[].phone` | `String` | 25/48 |
| `addresses[].province` | `String` | 18/48 |
| `addresses[].provinceCode` | `String` | 18/48 |
| `addresses[].provinceName` | `String` | 18/48 |
| `addresses[].ward` | `String` | 18/48 |
| `addresses[].wardCode` | `String` | 18/48 |
| `addresses[].wardName` | `String` | 18/48 |
| `addresses[].zip` | `String` | 8/48 |
| `amount` | `Number` | 8/48 |
| `cancelReason` | `String` | 1/48 |
| `cancelledAt` | `Date` | 1/48 |
| `cancelledBy` | `ObjectId` | 1/48 |
| `cart` | `Object` | 8/48 |
| `cart.items` | `Array` | 8/48 |
| `cart.items[]` | `Object` | 8/48 |
| `cart.items[].id` | `String` | 8/48 |
| `cart.items[].item` | `Object` | 8/48 |
| `cart.items[].item._id` | `String` | 8/48 |
| `cart.items[].item._user` | `String` | 1/48 |
| `cart.items[].item.categoryLevel1` | `String` | 1/48 |
| `cart.items[].item.categoryLevel2` | `String` | 1/48 |
| `cart.items[].item.colors` | `Array` | 1/48 |
| `cart.items[].item.dateAdded` | `String` | 1/48 |
| `cart.items[].item.description` | `String` | 1/48 |
| `cart.items[].item.descriptionFull` | `Array` | 1/48 |
| `cart.items[].item.hasClassification` | `Boolean` | 1/48 |
| `cart.items[].item.hasColors` | `Boolean` | 1/48 |
| `cart.items[].item.hasSizes` | `Boolean` | 1/48 |
| `cart.items[].item.id` | `String` | 8/48 |
| `cart.items[].item.images` | `Array` | 8/48 |
| `cart.items[].item.images[]` | `String` | 8/48 |
| `cart.items[].item.mainImage` | `Object` | 8/48 |
| `cart.items[].item.mainImage.name` | `String` | 8/48 |
| `cart.items[].item.mainImage.url` | `String` | 8/48 |
| `cart.items[].item.onSale` | `Boolean` | 8/48 |
| `cart.items[].item.price` | `Number` | 7/48 |
| `cart.items[].item.productType` | `String` | 8/48 |
| `cart.items[].item.quantity` | `Number` | 1/48 |
| `cart.items[].item.rating` | `Number` | 1/48 |
| `cart.items[].item.regularPrice` | `Number` | 8/48 |
| `cart.items[].item.salePrice` | `Number` | 8/48 |
| `cart.items[].item.shipping` | `String` | 1/48 |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/48 |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/48 |
| `cart.items[].item.shippingCost` | `Number` | 1/48 |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/48 |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/48 |
| `cart.items[].item.sizes` | `Array` | 1/48 |
| `cart.items[].item.sizes[]` | `String` | 1/48 |
| `cart.items[].item.stock` | `String` | 1/48 |
| `cart.items[].item.stockDate` | `String` | 1/48 |
| `cart.items[].item.tags` | `Array` | 1/48 |
| `cart.items[].item.title` | `String` | 8/48 |
| `cart.items[].item.titleUrl` | `String` | 8/48 |
| `cart.items[].item.variant` | `Object` | 7/48 |
| `cart.items[].item.variant.classification` | `String` | 7/48 |
| `cart.items[].item.variant.color` | `String` | 7/48 |
| `cart.items[].item.variant.size` | `String` | 7/48 |
| `cart.items[].item.variants` | `Array` | 1/48 |
| `cart.items[].item.visibility` | `Boolean` | 1/48 |
| `cart.items[].price` | `Number` | 8/48 |
| `cart.items[].qty` | `Number` | 8/48 |
| `cart.items[].shipingCostType` | `String` | 8/48 |
| `cart.shippingCost` | `Number` | 8/48 |
| `cart.shippingLimit` | `Number` | 1/48 |
| `cart.shippingType` | `String` | 1/48 |
| `cart.totalPrice` | `Number` | 8/48 |
| `cart.totalQty` | `Number` | 8/48 |
| `couponCode` | `String` | 40/48 |
| `couponDiscount` | `Number` | 48/48 |
| `createdAt` | `Date` | 48/48 |
| `currency` | `String` | 48/48 |
| `customer` | `Object` | 48/48 |
| `customer.email` | `String` | 48/48 |
| `customer.name` | `String` | 48/48 |
| `customer.phone` | `String` | 48/48 |
| `customerEmail` | `String` | 48/48 |
| `customerPhone` | `String` | 47/48 |
| `dateAdded` | `Date` | 8/48 |
| `deliveredAt` | `Date` | 1/48 |
| `discountAmount` | `Number` | 48/48 |
| `estimatedDeliveryDate` | `Date` | 5/48 |
| `items` | `Array` | 48/48 |
| `items[]` | `Object` | 48/48 |
| `items[].image` | `String` | 30/48 |
| `items[].name` | `String` | 30/48 |
| `items[].productId` | `ObjectId | String` | 48/48 |
| `items[].productSnapshot` | `Object` | 48/48 |
| `items[].productSnapshot.category` | `String` | 1/48 |
| `items[].productSnapshot.image` | `String` | 48/48 |
| `items[].productSnapshot.name` | `String` | 8/48 |
| `items[].productSnapshot.price` | `Number` | 8/48 |
| `items[].productSnapshot.sku` | `String` | 48/48 |
| `items[].productSnapshot.title` | `String` | 40/48 |
| `items[].productSnapshot.variant` | `Object` | 40/48 |
| `items[].productSnapshot.variant.classification` | `String` | 40/48 |
| `items[].productSnapshot.variant.color` | `String` | 40/48 |
| `items[].productSnapshot.variant.size` | `String` | 40/48 |
| `items[].quantity` | `Number` | 48/48 |
| `items[].sku` | `String` | 30/48 |
| `items[].subtotal` | `Number` | 48/48 |
| `items[].unitPrice` | `Number` | 48/48 |
| `items[].variant` | `Object` | 30/48 |
| `items[].variant.classification` | `String` | 21/48 |
| `items[].variant.color` | `String` | 30/48 |
| `items[].variant.size` | `String` | 30/48 |
| `items[].variantId` | `String` | 18/48 |
| `notes` | `String` | 48/48 |
| `orderId` | `String` | 48/48 |
| `outcome` | `Object` | 1/48 |
| `outcome.seller_message` | `String` | 1/48 |
| `paidAt` | `Date` | 17/48 |
| `payment` | `Object` | 48/48 |
| `payment.actualCollectedAmount` | `Number` | 1/48 |
| `payment.codCollected` | `Boolean` | 1/48 |
| `payment.codReconciliationStatus` | `String` | 1/48 |
| `payment.method` | `String` | 48/48 |
| `payment.paidAt` | `Date | String` | 19/48 |
| `payment.provider` | `String` | 48/48 |
| `payment.refundedAmount` | `Number` | 48/48 |
| `payment.refundedAt` | `Date` | 5/48 |
| `payment.status` | `String` | 48/48 |
| `payment.transactionId` | `String` | 18/48 |
| `paymentFee` | `Number` | 48/48 |
| `paymentMethodId` | `ObjectId` | 48/48 |
| `paymentMethodSnapshot` | `Object` | 48/48 |
| `paymentMethodSnapshot.code` | `String` | 48/48 |
| `paymentMethodSnapshot.name` | `String` | 48/48 |
| `paymentMethodSnapshot.paymentFee` | `Number` | 48/48 |
| `paymentMethodSnapshot.paymentType` | `String` | 48/48 |
| `paymentProvider` | `String` | 40/48 |
| `paymentStatus` | `String` | 47/48 |
| `refundedAmount` | `Number` | 40/48 |
| `refundedAt` | `Date` | 5/48 |
| `returnRequest` | `Object` | 1/48 |
| `returnRequest.description` | `String` | 1/48 |
| `returnRequest.items` | `Array` | 1/48 |
| `returnRequest.items[]` | `Object` | 1/48 |
| `returnRequest.items[].boughtQuantity` | `Number` | 1/48 |
| `returnRequest.items[].productId` | `ObjectId` | 1/48 |
| `returnRequest.items[].productSnapshot` | `Object` | 1/48 |
| `returnRequest.items[].productSnapshot.image` | `String` | 1/48 |
| `returnRequest.items[].productSnapshot.sku` | `String` | 1/48 |
| `returnRequest.items[].productSnapshot.title` | `String` | 1/48 |
| `returnRequest.items[].productSnapshot.variant` | `Object` | 1/48 |
| `returnRequest.items[].productSnapshot.variant.classification` | `String` | 1/48 |
| `returnRequest.items[].productSnapshot.variant.color` | `String` | 1/48 |
| `returnRequest.items[].productSnapshot.variant.size` | `String` | 1/48 |
| `returnRequest.items[].quantity` | `Number` | 1/48 |
| `returnRequest.items[].reason` | `String` | 1/48 |
| `returnRequest.items[].unitPrice` | `Number` | 1/48 |
| `returnRequest.reason` | `String` | 1/48 |
| `returnRequest.refundMethod` | `String` | 1/48 |
| `returnRequest.requestedAt` | `Date` | 1/48 |
| `returnRequest.status` | `String` | 1/48 |
| `returnRequests` | `Array` | 1/48 |
| `shippedAt` | `Date` | 4/48 |
| `shipping` | `Object` | 48/48 |
| `shipping.deliveredAt` | `Date | String` | 9/48 |
| `shipping.estimatedDeliveryDate` | `Date` | 21/48 |
| `shipping.method` | `String` | 48/48 |
| `shipping.provider` | `String` | 48/48 |
| `shipping.shippedAt` | `Date | String` | 13/48 |
| `shipping.trackingNumber` | `String` | 48/48 |
| `shippingAddress` | `Object` | 48/48 |
| `shippingAddress.address` | `String` | 48/48 |
| `shippingAddress.addressDetail` | `String` | 19/48 |
| `shippingAddress.city` | `String` | 30/48 |
| `shippingAddress.country` | `String` | 30/48 |
| `shippingAddress.district` | `String` | 48/48 |
| `shippingAddress.districtCode` | `String` | 19/48 |
| `shippingAddress.districtName` | `String` | 19/48 |
| `shippingAddress.fullName` | `String` | 48/48 |
| `shippingAddress.phone` | `String` | 48/48 |
| `shippingAddress.province` | `String` | 48/48 |
| `shippingAddress.provinceCode` | `String` | 19/48 |
| `shippingAddress.provinceName` | `String` | 19/48 |
| `shippingAddress.ward` | `String` | 48/48 |
| `shippingAddress.wardCode` | `String` | 19/48 |
| `shippingAddress.wardName` | `String` | 19/48 |
| `shippingAddress.zip` | `String` | 30/48 |
| `shippingFee` | `Number` | 48/48 |
| `shippingLogs` | `Array` | 26/48 |
| `shippingLogs[]` | `Object` | 4/48 |
| `shippingLogs[].description` | `String` | 4/48 |
| `shippingLogs[].location` | `String` | 4/48 |
| `shippingLogs[].status` | `String` | 4/48 |
| `shippingLogs[].timestamp` | `Date` | 4/48 |
| `shippingMethodId` | `ObjectId` | 46/48 |
| `shippingMethodSnapshot` | `Object` | 46/48 |
| `shippingMethodSnapshot.code` | `String` | 46/48 |
| `shippingMethodSnapshot.estimatedDeliveryTime` | `String` | 46/48 |
| `shippingMethodSnapshot.fee` | `Number` | 46/48 |
| `shippingMethodSnapshot.name` | `String` | 46/48 |
| `shippingProvider` | `String` | 47/48 |
| `status` | `String` | 48/48 |
| `statusHistory` | `Array` | 48/48 |
| `statusHistory[]` | `Object` | 48/48 |
| `statusHistory[].note` | `String` | 48/48 |
| `statusHistory[].status` | `String` | 48/48 |
| `statusHistory[].updatedAt` | `Date | String` | 48/48 |
| `statusHistory[].updatedBy` | `ObjectId` | 7/48 |
| `subtotal` | `Number` | 48/48 |
| `taxAmount` | `Number` | 48/48 |
| `totalAmount` | `Number` | 48/48 |
| `trackingNumber` | `String` | 47/48 |
| `trackingUrl` | `String` | 26/48 |
| `transactionId` | `String` | 40/48 |
| `type` | `String` | 8/48 |
| `updatedAt` | `Date | String` | 48/48 |
| `userId` | `ObjectId` | 33/48 |

## `products`

> Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục.

- **Documents**: 99  
- **Sampled**: 99  
- **Fields**: 66  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 99/99 |
| `_id` | `ObjectId` | 99/99 |
| `attributes` | `Object` | 99/99 |
| `attributes.classifications` | `Array` | 99/99 |
| `attributes.classifications[]` | `String` | 98/99 |
| `attributes.colors` | `Array` | 99/99 |
| `attributes.colors[]` | `Object` | 98/99 |
| `attributes.colors[].hex` | `String` | 98/99 |
| `attributes.colors[].name` | `String` | 98/99 |
| `attributes.sizes` | `Array` | 99/99 |
| `attributes.sizes[]` | `String` | 98/99 |
| `cs` | `Object` | 99/99 |
| `cs.visibility` | `Boolean` | 99/99 |
| `dateAdded` | `String` | 99/99 |
| `en` | `Object` | 99/99 |
| `en.visibility` | `Boolean` | 99/99 |
| `images` | `Array` | 99/99 |
| `images[]` | `String` | 99/99 |
| `mainImage` | `Object` | 99/99 |
| `mainImage.name` | `String` | 99/99 |
| `mainImage.url` | `String` | 99/99 |
| `quantity` | `Number` | 8/99 |
| `rating` | `Number` | 1/99 |
| `sk` | `Object` | 99/99 |
| `sk.visibility` | `Boolean` | 99/99 |
| `stock` | `Number` | 3/99 |
| `tags` | `Array` | 99/99 |
| `tags[]` | `String` | 99/99 |
| `titleUrl` | `String` | 99/99 |
| `updatedAt` | `Date | String` | 99/99 |
| `variants` | `Array` | 99/99 |
| `variants[]` | `Object` | 98/99 |
| `variants[].classification` | `String` | 98/99 |
| `variants[].color` | `String` | 98/99 |
| `variants[].discountPrice` | `Number` | 98/99 |
| `variants[].price` | `Number` | 98/99 |
| `variants[].size` | `String` | 98/99 |
| `variants[].sku` | `String` | 98/99 |
| `variants[].stock` | `Number` | 98/99 |
| `vi` | `Object` | 99/99 |
| `vi.categoryLevel1` | `String` | 99/99 |
| `vi.categoryLevel2` | `String` | 99/99 |
| `vi.classifications` | `Array` | 99/99 |
| `vi.classifications[]` | `String` | 98/99 |
| `vi.colors` | `Array` | 99/99 |
| `vi.colors[]` | `Object` | 98/99 |
| `vi.colors[].hex` | `String` | 98/99 |
| `vi.colors[].name` | `String` | 98/99 |
| `vi.description` | `String` | 99/99 |
| `vi.descriptionFull` | `Array` | 99/99 |
| `vi.descriptionFull[]` | `String` | 99/99 |
| `vi.hasClassification` | `Boolean` | 99/99 |
| `vi.hasColors` | `Boolean` | 99/99 |
| `vi.hasSizes` | `Boolean` | 99/99 |
| `vi.onSale` | `Boolean` | 99/99 |
| `vi.productType` | `String` | 99/99 |
| `vi.quantity` | `Number` | 99/99 |
| `vi.regularPrice` | `Number` | 99/99 |
| `vi.salePrice` | `Number` | 99/99 |
| `vi.sizes` | `Array` | 99/99 |
| `vi.sizes[]` | `String` | 98/99 |
| `vi.stock` | `Number | String` | 99/99 |
| `vi.stockDate` | `String` | 99/99 |
| `vi.title` | `String` | 99/99 |
| `vi.visibility` | `Boolean` | 99/99 |
| `visibility` | `Boolean` | 99/99 |

## `categories`

> Danh mục sản phẩm theo cây phân cấp (level1, level2).

- **Documents**: 4  
- **Sampled**: 4  
- **Fields**: 24  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 4/4 |
| `_id` | `ObjectId` | 4/4 |
| `cs` | `Object` | 4/4 |
| `cs.visibility` | `Boolean` | 4/4 |
| `dateAdded` | `String` | 4/4 |
| `en` | `Object` | 4/4 |
| `en.description` | `String` | 4/4 |
| `en.title` | `String` | 4/4 |
| `en.visibility` | `Boolean` | 4/4 |
| `mainImage` | `Object` | 4/4 |
| `mainImage.name` | `String` | 4/4 |
| `mainImage.url` | `String` | 4/4 |
| `sk` | `Object` | 4/4 |
| `sk.visibility` | `Boolean` | 4/4 |
| `subCategories` | `Array` | 4/4 |
| `titleUrl` | `String` | 4/4 |
| `updatedAt` | `String` | 4/4 |
| `vi` | `Object` | 4/4 |
| `vi.description` | `String` | 4/4 |
| `vi.menuHidden` | `Boolean` | 4/4 |
| `vi.position` | `Number` | 4/4 |
| `vi.title` | `String` | 4/4 |
| `vi.visibility` | `Boolean` | 4/4 |
| `visibility` | `Boolean` | 2/4 |

## `coupons`

> Mã giảm giá: loại, giá trị, điều kiện, thời hạn sử dụng.

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 15  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 2/2 |
| `_id` | `ObjectId` | 2/2 |
| `code` | `String` | 2/2 |
| `createdAt` | `Date` | 2/2 |
| `description` | `String` | 2/2 |
| `discountType` | `String` | 2/2 |
| `discountValue` | `Number` | 2/2 |
| `endDate` | `Date` | 2/2 |
| `isActive` | `Boolean` | 2/2 |
| `maxDiscount` | `Number` | 2/2 |
| `minOrderValue` | `Number` | 2/2 |
| `startDate` | `Date` | 2/2 |
| `updatedAt` | `Date` | 2/2 |
| `usageLimit` | `Number` | 2/2 |
| `usedCount` | `Number` | 2/2 |

## `shippingmethods`

> Phương thức vận chuyển: tên, phí, trạng thái, vùng giao hàng.

- **Documents**: 5  
- **Sampled**: 5  
- **Fields**: 19  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 4/5 |
| `_id` | `ObjectId` | 5/5 |
| `baseCost` | `Number` | 5/5 |
| `baseFee` | `Number` | 5/5 |
| `code` | `String` | 5/5 |
| `coverageArea` | `String` | 5/5 |
| `createdAt` | `Date` | 5/5 |
| `description` | `String` | 5/5 |
| `estimatedDays` | `String` | 5/5 |
| `estimatedDeliveryTime` | `String` | 5/5 |
| `freeShippingCondition` | `Object` | 5/5 |
| `freeShippingCondition.description` | `String` | 5/5 |
| `freeShippingCondition.enabled` | `Boolean` | 5/5 |
| `freeShippingCondition.minimumOrderValue` | `Number` | 5/5 |
| `freeShippingThreshold` | `Number` | 5/5 |
| `isActive` | `Boolean` | 5/5 |
| `name` | `String` | 5/5 |
| `status` | `String` | 5/5 |
| `updatedAt` | `Date` | 5/5 |

## `payment_methods`

> Phương thức thanh toán: COD, Stripe, v.v.

- **Documents**: 11  
- **Sampled**: 11  
- **Fields**: 12  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 11/11 |
| `code` | `String` | 11/11 |
| `createdAt` | `String` | 11/11 |
| `description` | `String` | 11/11 |
| `isActive` | `Boolean` | 11/11 |
| `name` | `String` | 11/11 |
| `paymentInfo` | `String` | 11/11 |
| `paymentProofImage` | `String` | 11/11 |
| `paymentType` | `String` | 11/11 |
| `status` | `String` | 11/11 |
| `type` | `String` | 11/11 |
| `updatedAt` | `String` | 11/11 |

## `settings`

> Cấu hình toàn site: thông tin cửa hàng, bảo trì, tiền tệ, liên hệ.

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 24  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 1/1 |
| `checkout` | `Object` | 1/1 |
| `checkout.allowOrder` | `Boolean` | 1/1 |
| `contact` | `Object` | 1/1 |
| `contact.address` | `String` | 1/1 |
| `contact.email` | `String` | 1/1 |
| `contact.phone` | `String` | 1/1 |
| `maintenance` | `Object` | 1/1 |
| `maintenance.enabled` | `Boolean` | 1/1 |
| `maintenance.message` | `String` | 1/1 |
| `shipping` | `Object` | 1/1 |
| `shipping.enabled` | `Boolean` | 1/1 |
| `site` | `Object` | 1/1 |
| `site.description` | `String` | 1/1 |
| `site.favicon` | `String` | 1/1 |
| `site.logo` | `String` | 1/1 |
| `site.name` | `String` | 1/1 |
| `store` | `Object` | 1/1 |
| `store.isOpen` | `Boolean` | 1/1 |
| `system` | `Object` | 1/1 |
| `system.currency` | `String` | 1/1 |
| `system.language` | `String` | 1/1 |
| `system.timezone` | `String` | 1/1 |
| `updatedAt` | `String` | 1/1 |

## `session`

> Session người dùng lưu giỏ hàng khách vãng lai và auth token.

- **Documents**: 25  
- **Sampled**: 25  
- **Fields**: 3  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `String` | 25/25 |
| `expires` | `Date` | 25/25 |
| `session` | `String` | 25/25 |

## `notification-popup`

> Thông báo popup hiển thị cho người dùng.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 17  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 10/10 |
| `count` | `Number` | 10/10 |
| `createdAt` | `Date` | 10/10 |
| `group` | `String` | 10/10 |
| `icon` | `String` | 10/10 |
| `id` | `String` | 10/10 |
| `isRead` | `Boolean` | 10/10 |
| `items` | `Array` | 10/10 |
| `level` | `String` | 10/10 |
| `message` | `String` | 10/10 |
| `readAt` | `Date` | 6/10 |
| `recipientId` | `String` | 10/10 |
| `targetUrl` | `String` | 10/10 |
| `time` | `Date` | 10/10 |
| `title` | `String` | 10/10 |
| `type` | `String` | 10/10 |
| `updatedAt` | `Date` | 10/10 |

## `grapesjs_projects`

> Dự án thiết kế trang GrapesJS (lưu JSON thiết kế).

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 86  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 2/2 |
| `_id` | `ObjectId` | 2/2 |
| `createdAt` | `Date` | 2/2 |
| `createdBy` | `String` | 2/2 |
| `description` | `String` | 2/2 |
| `name` | `String` | 2/2 |
| `projectData` | `Object` | 2/2 |
| `projectData.assets` | `Array` | 1/2 |
| `projectData.dataSources` | `Array` | 1/2 |
| `projectData.pages` | `Array` | 1/2 |
| `projectData.pages[]` | `Object` | 1/2 |
| `projectData.pages[].frames` | `Array` | 1/2 |
| `projectData.pages[].frames[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].attributes` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].attributes.id` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].classes` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].classes[]` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].attributes` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].attributes.id` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].attributes` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].attributes.id` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].attributes` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].attributes.href` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].classes` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].classes[]` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[]` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[].content` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[].type` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].content` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].type` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].tagName` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].components[].components[].type` | `String` | 1/2 |
| `projectData.pages[].frames[].component.components[].tagName` | `String` | 1/2 |
| `projectData.pages[].frames[].component.docEl` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.docEl.tagName` | `String` | 1/2 |
| `projectData.pages[].frames[].component.head` | `Object` | 1/2 |
| `projectData.pages[].frames[].component.head.type` | `String` | 1/2 |
| `projectData.pages[].frames[].component.stylable` | `Array` | 1/2 |
| `projectData.pages[].frames[].component.stylable[]` | `String` | 1/2 |
| `projectData.pages[].frames[].component.type` | `String` | 1/2 |
| `projectData.pages[].frames[].id` | `String` | 1/2 |
| `projectData.pages[].id` | `String` | 1/2 |
| `projectData.pages[].type` | `String` | 1/2 |
| `projectData.styles` | `Array` | 1/2 |
| `projectData.styles[]` | `Object` | 1/2 |
| `projectData.styles[].selectors` | `Array` | 1/2 |
| `projectData.styles[].selectors[]` | `String` | 1/2 |
| `projectData.styles[].style` | `Object` | 1/2 |
| `projectData.styles[].style.align-items` | `String` | 1/2 |
| `projectData.styles[].style.background` | `String` | 1/2 |
| `projectData.styles[].style.background-color` | `String` | 1/2 |
| `projectData.styles[].style.color` | `String` | 1/2 |
| `projectData.styles[].style.display` | `String` | 1/2 |
| `projectData.styles[].style.flex-wrap` | `String` | 1/2 |
| `projectData.styles[].style.font-family` | `String` | 1/2 |
| `projectData.styles[].style.font-size` | `String` | 1/2 |
| `projectData.styles[].style.font-style` | `String` | 1/2 |
| `projectData.styles[].style.font-weight` | `String` | 1/2 |
| `projectData.styles[].style.gap` | `String` | 1/2 |
| `projectData.styles[].style.justify-content` | `String` | 1/2 |
| `projectData.styles[].style.letter-spacing` | `String` | 1/2 |
| `projectData.styles[].style.line-height` | `String` | 1/2 |
| `projectData.styles[].style.margin` | `String` | 1/2 |
| `projectData.styles[].style.margin-bottom` | `String` | 1/2 |
| `projectData.styles[].style.max-width` | `String` | 1/2 |
| `projectData.styles[].style.min-height` | `String` | 1/2 |
| `projectData.styles[].style.padding` | `String` | 1/2 |
| `projectData.styles[].style.position` | `String` | 1/2 |
| `projectData.styles[].style.text-align` | `String` | 1/2 |
| `projectData.styles[].style.text-transform` | `String` | 1/2 |
| `projectData.symbols` | `Array` | 1/2 |
| `projectData.testMeta` | `String` | 1/2 |
| `slug` | `String` | 2/2 |
| `status` | `String` | 2/2 |
| `updatedAt` | `Date` | 2/2 |
| `updatedBy` | `String` | 2/2 |

## `grapesjs_published`

> Trang đã xuất bản từ GrapesJS editor.

- **Documents**: 3  
- **Sampled**: 3  
- **Fields**: 89  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 3/3 |
| `_id` | `ObjectId` | 3/3 |
| `createdAt` | `Date` | 3/3 |
| `css` | `String` | 3/3 |
| `html` | `String` | 3/3 |
| `page` | `String` | 3/3 |
| `projectData` | `Object` | 3/3 |
| `projectData.assets` | `Array` | 1/3 |
| `projectData.dataSources` | `Array` | 1/3 |
| `projectData.pages` | `Array` | 1/3 |
| `projectData.pages[]` | `Object` | 1/3 |
| `projectData.pages[].frames` | `Array` | 1/3 |
| `projectData.pages[].frames[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].attributes` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].attributes.id` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].classes` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].classes[]` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].attributes` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].attributes.id` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].attributes` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].attributes.id` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].attributes` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].attributes.href` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].classes` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].classes[]` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[]` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[].content` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].components[].type` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].content` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].components[].type` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].tagName` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].components[].components[].type` | `String` | 1/3 |
| `projectData.pages[].frames[].component.components[].tagName` | `String` | 1/3 |
| `projectData.pages[].frames[].component.docEl` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.docEl.tagName` | `String` | 1/3 |
| `projectData.pages[].frames[].component.head` | `Object` | 1/3 |
| `projectData.pages[].frames[].component.head.type` | `String` | 1/3 |
| `projectData.pages[].frames[].component.stylable` | `Array` | 1/3 |
| `projectData.pages[].frames[].component.stylable[]` | `String` | 1/3 |
| `projectData.pages[].frames[].component.type` | `String` | 1/3 |
| `projectData.pages[].frames[].id` | `String` | 1/3 |
| `projectData.pages[].id` | `String` | 1/3 |
| `projectData.pages[].type` | `String` | 1/3 |
| `projectData.styles` | `Array` | 1/3 |
| `projectData.styles[]` | `Object` | 1/3 |
| `projectData.styles[].selectors` | `Array` | 1/3 |
| `projectData.styles[].selectors[]` | `String` | 1/3 |
| `projectData.styles[].style` | `Object` | 1/3 |
| `projectData.styles[].style.align-items` | `String` | 1/3 |
| `projectData.styles[].style.background` | `String` | 1/3 |
| `projectData.styles[].style.background-color` | `String` | 1/3 |
| `projectData.styles[].style.color` | `String` | 1/3 |
| `projectData.styles[].style.display` | `String` | 1/3 |
| `projectData.styles[].style.flex-wrap` | `String` | 1/3 |
| `projectData.styles[].style.font-family` | `String` | 1/3 |
| `projectData.styles[].style.font-size` | `String` | 1/3 |
| `projectData.styles[].style.font-style` | `String` | 1/3 |
| `projectData.styles[].style.font-weight` | `String` | 1/3 |
| `projectData.styles[].style.gap` | `String` | 1/3 |
| `projectData.styles[].style.justify-content` | `String` | 1/3 |
| `projectData.styles[].style.letter-spacing` | `String` | 1/3 |
| `projectData.styles[].style.line-height` | `String` | 1/3 |
| `projectData.styles[].style.margin` | `String` | 1/3 |
| `projectData.styles[].style.margin-bottom` | `String` | 1/3 |
| `projectData.styles[].style.max-width` | `String` | 1/3 |
| `projectData.styles[].style.min-height` | `String` | 1/3 |
| `projectData.styles[].style.padding` | `String` | 1/3 |
| `projectData.styles[].style.position` | `String` | 1/3 |
| `projectData.styles[].style.text-align` | `String` | 1/3 |
| `projectData.styles[].style.text-transform` | `String` | 1/3 |
| `projectData.symbols` | `Array` | 1/3 |
| `projectData.type` | `String` | 2/3 |
| `projectId` | `ObjectId` | 1/3 |
| `projectName` | `String` | 3/3 |
| `publishedAt` | `Date` | 3/3 |
| `publishedBy` | `String` | 3/3 |
| `status` | `String` | 3/3 |
| `updatedAt` | `Date` | 3/3 |
| `version` | `Number` | 3/3 |

## `pages_home`

> Nội dung trang chủ (hero, banner, sections).

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 160  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 2/2 |
| `_id` | `ObjectId` | 2/2 |
| `createdAt` | `Date` | 2/2 |
| `key` | `String` | 2/2 |
| `publishedAt` | `Date` | 1/2 |
| `sections` | `Array` | 2/2 |
| `sections[]` | `Object` | 2/2 |
| `sections[].animation` | `Object` | 2/2 |
| `sections[].animation.delay` | `Number` | 2/2 |
| `sections[].animation.direction` | `String` | 1/2 |
| `sections[].animation.duration` | `Number` | 2/2 |
| `sections[].animation.intensity` | `String` | 2/2 |
| `sections[].animation.once` | `Boolean` | 2/2 |
| `sections[].animation.preset` | `String` | 2/2 |
| `sections[].animation.trigger` | `String` | 2/2 |
| `sections[].category` | `String` | 2/2 |
| `sections[].colors` | `Object` | 1/2 |
| `sections[].colors.backgroundColor` | `String` | 1/2 |
| `sections[].colors.bodyColor` | `String` | 1/2 |
| `sections[].colors.buttonBackgroundColor` | `String` | 1/2 |
| `sections[].colors.buttonHoverBackgroundColor` | `String` | 1/2 |
| `sections[].colors.buttonHoverTextColor` | `String` | 1/2 |
| `sections[].colors.buttonTextColor` | `String` | 1/2 |
| `sections[].colors.quoteColor` | `String` | 1/2 |
| `sections[].colors.subtitleColor` | `String` | 1/2 |
| `sections[].colors.titleColor` | `String` | 1/2 |
| `sections[].content` | `Object` | 2/2 |
| `sections[].content.buttonLink` | `String` | 2/2 |
| `sections[].content.buttonText` | `String` | 2/2 |
| `sections[].content.description` | `String` | 2/2 |
| `sections[].content.eyebrow` | `String` | 2/2 |
| `sections[].content.quote` | `String` | 2/2 |
| `sections[].content.tagline1` | `String` | 2/2 |
| `sections[].content.tagline2` | `String` | 2/2 |
| `sections[].content.title` | `String` | 2/2 |
| `sections[].content.viewAllLink` | `String` | 2/2 |
| `sections[].content.viewAllText` | `String` | 2/2 |
| `sections[].enabled` | `Boolean` | 2/2 |
| `sections[].id` | `String` | 2/2 |
| `sections[].isCustomAnimation` | `Boolean` | 1/2 |
| `sections[].layout` | `Object` | 2/2 |
| `sections[].layout.alignment` | `String` | 2/2 |
| `sections[].layout.carouselConfig` | `Object` | 2/2 |
| `sections[].layout.carouselConfig.autoplay` | `Boolean` | 2/2 |
| `sections[].layout.carouselConfig.autoplayInterval` | `Number` | 2/2 |
| `sections[].layout.carouselConfig.loop` | `Boolean` | 2/2 |
| `sections[].layout.carouselConfig.showArrows` | `Boolean` | 2/2 |
| `sections[].layout.carouselConfig.showDots` | `Boolean` | 2/2 |
| `sections[].layout.contentPosition` | `String` | 2/2 |
| `sections[].layout.contentWidth` | `Number` | 2/2 |
| `sections[].layout.fullWidth` | `Boolean` | 2/2 |
| `sections[].layout.imageWidth` | `Number` | 2/2 |
| `sections[].layout.minHeight` | `String` | 2/2 |
| `sections[].layout.variant` | `String` | 2/2 |
| `sections[].media` | `Object` | 2/2 |
| `sections[].media.carouselSlides` | `Array` | 2/2 |
| `sections[].media.carouselSlides[]` | `Object` | 2/2 |
| `sections[].media.carouselSlides[].alt` | `String` | 2/2 |
| `sections[].media.carouselSlides[].description` | `String` | 2/2 |
| `sections[].media.carouselSlides[].enabled` | `Boolean` | 2/2 |
| `sections[].media.carouselSlides[].id` | `String` | 2/2 |
| `sections[].media.carouselSlides[].linkUrl` | `String` | 2/2 |
| `sections[].media.carouselSlides[].mobileUrl` | `String` | 2/2 |
| `sections[].media.carouselSlides[].title` | `String` | 2/2 |
| `sections[].media.carouselSlides[].typography` | `Object` | 1/2 |
| `sections[].media.carouselSlides[].typography.description` | `Object` | 1/2 |
| `sections[].media.carouselSlides[].typography.description.fontFamily` | `String` | 1/2 |
| `sections[].media.carouselSlides[].typography.description.fontSize` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.description.fontWeight` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.description.lineHeight` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.title` | `Object` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.fontFamily` | `String` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.fontSize` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.fontWeight` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.letterSpacing` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.lineHeight` | `Number` | 1/2 |
| `sections[].media.carouselSlides[].typography.title.textAlign` | `String` | 1/2 |
| `sections[].media.carouselSlides[].url` | `String` | 2/2 |
| `sections[].media.desktop` | `Object` | 2/2 |
| `sections[].media.desktop.alt` | `String` | 2/2 |
| `sections[].media.desktop.url` | `String` | 2/2 |
| `sections[].media.mobile` | `Object` | 2/2 |
| `sections[].media.mobile.alt` | `String` | 2/2 |
| `sections[].media.mobile.url` | `String` | 2/2 |
| `sections[].media.overlayOpacity` | `Number` | 2/2 |
| `sections[].motionPreset` | `String` | 2/2 |
| `sections[].name` | `String` | 2/2 |
| `sections[].order` | `Number` | 2/2 |
| `sections[].settings` | `Object` | 2/2 |
| `sections[].settings.bgColor` | `String` | 2/2 |
| `sections[].settings.enableGlow` | `Boolean` | 2/2 |
| `sections[].settings.itemsPerView` | `Number` | 2/2 |
| `sections[].settings.limit` | `Number` | 2/2 |
| `sections[].settings.overlay` | `Boolean` | 2/2 |
| `sections[].settings.source` | `String` | 2/2 |
| `sections[].settings.textColor` | `String` | 2/2 |
| `sections[].type` | `String` | 2/2 |
| `sections[].typography` | `Object` | 2/2 |
| `sections[].typography.body` | `Object` | 2/2 |
| `sections[].typography.body.fontFamily` | `String` | 2/2 |
| `sections[].typography.body.fontSize` | `Number` | 2/2 |
| `sections[].typography.body.fontWeight` | `Number` | 2/2 |
| `sections[].typography.body.letterSpacing` | `Number` | 1/2 |
| `sections[].typography.body.lineHeight` | `Number` | 2/2 |
| `sections[].typography.body.textAlign` | `String` | 1/2 |
| `sections[].typography.body.textTransform` | `String` | 1/2 |
| `sections[].typography.button` | `Object` | 2/2 |
| `sections[].typography.button.fontFamily` | `String` | 2/2 |
| `sections[].typography.button.fontSize` | `Number` | 2/2 |
| `sections[].typography.button.fontWeight` | `Number` | 2/2 |
| `sections[].typography.button.letterSpacing` | `Number` | 2/2 |
| `sections[].typography.button.lineHeight` | `Number` | 1/2 |
| `sections[].typography.button.textAlign` | `String` | 1/2 |
| `sections[].typography.button.textTransform` | `String` | 2/2 |
| `sections[].typography.eyebrow` | `Object` | 2/2 |
| `sections[].typography.eyebrow.fontFamily` | `String` | 2/2 |
| `sections[].typography.eyebrow.fontSize` | `Number` | 2/2 |
| `sections[].typography.eyebrow.fontWeight` | `Number` | 2/2 |
| `sections[].typography.eyebrow.letterSpacing` | `Number` | 2/2 |
| `sections[].typography.eyebrow.lineHeight` | `Number` | 1/2 |
| `sections[].typography.eyebrow.textAlign` | `String` | 1/2 |
| `sections[].typography.eyebrow.textTransform` | `String` | 2/2 |
| `sections[].typography.heading` | `Object` | 2/2 |
| `sections[].typography.heading.fontFamily` | `String` | 2/2 |
| `sections[].typography.heading.fontSize` | `Number` | 2/2 |
| `sections[].typography.heading.fontWeight` | `Number` | 2/2 |
| `sections[].typography.heading.letterSpacing` | `Number` | 2/2 |
| `sections[].typography.heading.lineHeight` | `Number` | 2/2 |
| `sections[].typography.heading.textAlign` | `String` | 2/2 |
| `sections[].typography.heading.textTransform` | `String` | 2/2 |
| `sections[].typography.preset` | `String` | 2/2 |
| `sections[].typography.quote` | `Object` | 2/2 |
| `sections[].typography.quote.fontFamily` | `String` | 2/2 |
| `sections[].typography.quote.fontSize` | `Number` | 2/2 |
| `sections[].typography.quote.fontWeight` | `Number` | 2/2 |
| `sections[].typography.quote.letterSpacing` | `Number` | 1/2 |
| `sections[].typography.quote.lineHeight` | `Number` | 2/2 |
| `sections[].typography.quote.textAlign` | `String` | 2/2 |
| `sections[].typography.quote.textTransform` | `String` | 1/2 |
| `sections[].typography.subheading` | `Object` | 1/2 |
| `sections[].typography.subheading.fontFamily` | `String` | 1/2 |
| `sections[].typography.subheading.fontSize` | `Number` | 1/2 |
| `sections[].typography.subheading.fontWeight` | `Number` | 1/2 |
| `sections[].typography.subheading.lineHeight` | `Number` | 1/2 |
| `sections[].typography.tagline1` | `Object` | 1/2 |
| `sections[].typography.tagline1.fontFamily` | `String` | 1/2 |
| `sections[].typography.tagline1.fontSize` | `Number` | 1/2 |
| `sections[].typography.tagline1.fontWeight` | `Number` | 1/2 |
| `sections[].typography.tagline1.letterSpacing` | `Number` | 1/2 |
| `sections[].typography.tagline1.textTransform` | `String` | 1/2 |
| `sections[].typography.tagline2` | `Object` | 1/2 |
| `sections[].typography.tagline2.fontFamily` | `String` | 1/2 |
| `sections[].typography.tagline2.fontSize` | `Number` | 1/2 |
| `sections[].typography.tagline2.fontWeight` | `Number` | 1/2 |
| `sections[].typography.tagline2.letterSpacing` | `Number` | 1/2 |
| `sections[].typography.tagline2.textTransform` | `String` | 1/2 |
| `status` | `String` | 2/2 |
| `updatedAt` | `Date` | 2/2 |
| `updatedBy` | `String` | 2/2 |
| `version` | `Number` | 2/2 |

## `pages_about`

> Nội dung trang giới thiệu.

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 97  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/1 |
| `_id` | `ObjectId` | 1/1 |
| `createdAt` | `Date` | 1/1 |
| `key` | `String` | 1/1 |
| `publishedAt` | `Date` | 1/1 |
| `sections` | `Array` | 1/1 |
| `sections[]` | `Object` | 1/1 |
| `sections[].animation` | `Object` | 1/1 |
| `sections[].animation.delay` | `Number` | 1/1 |
| `sections[].animation.duration` | `Number` | 1/1 |
| `sections[].animation.intensity` | `String` | 1/1 |
| `sections[].animation.once` | `Boolean` | 1/1 |
| `sections[].animation.preset` | `String` | 1/1 |
| `sections[].category` | `String` | 1/1 |
| `sections[].colors` | `Object` | 1/1 |
| `sections[].colors.authorColor` | `String` | 1/1 |
| `sections[].colors.backgroundColor` | `String` | 1/1 |
| `sections[].colors.bodyColor` | `String` | 1/1 |
| `sections[].colors.buttonBackgroundColor` | `String` | 1/1 |
| `sections[].colors.buttonHoverBackgroundColor` | `String` | 1/1 |
| `sections[].colors.buttonHoverTextColor` | `String` | 1/1 |
| `sections[].colors.buttonTextColor` | `String` | 1/1 |
| `sections[].colors.quoteColor` | `String` | 1/1 |
| `sections[].colors.subtitleColor` | `String` | 1/1 |
| `sections[].colors.tagline1Color` | `String` | 1/1 |
| `sections[].colors.tagline2Color` | `String` | 1/1 |
| `sections[].colors.titleColor` | `String` | 1/1 |
| `sections[].content` | `Object` | 1/1 |
| `sections[].content.author` | `String` | 1/1 |
| `sections[].content.buttonLink` | `String` | 1/1 |
| `sections[].content.buttonText` | `String` | 1/1 |
| `sections[].content.description` | `String` | 1/1 |
| `sections[].content.eyebrow` | `String` | 1/1 |
| `sections[].content.quote` | `String` | 1/1 |
| `sections[].content.tagline1` | `String` | 1/1 |
| `sections[].content.tagline2` | `String` | 1/1 |
| `sections[].content.title` | `String` | 1/1 |
| `sections[].enabled` | `Boolean` | 1/1 |
| `sections[].id` | `String` | 1/1 |
| `sections[].isCustomAnimation` | `Boolean` | 1/1 |
| `sections[].layout` | `Object` | 1/1 |
| `sections[].layout.alignment` | `String` | 1/1 |
| `sections[].layout.contentWidth` | `Number` | 1/1 |
| `sections[].layout.imageWidth` | `Number` | 1/1 |
| `sections[].layout.variant` | `String` | 1/1 |
| `sections[].media` | `Object` | 1/1 |
| `sections[].media.carouselSlides` | `Array` | 1/1 |
| `sections[].media.desktop` | `Object` | 1/1 |
| `sections[].media.desktop.alt` | `String` | 1/1 |
| `sections[].media.desktop.url` | `String` | 1/1 |
| `sections[].media.overlayOpacity` | `Number` | 1/1 |
| `sections[].motionPreset` | `String` | 1/1 |
| `sections[].name` | `String` | 1/1 |
| `sections[].order` | `Number` | 1/1 |
| `sections[].settings` | `Object` | 1/1 |
| `sections[].settings.enableGlow` | `Boolean` | 1/1 |
| `sections[].settings.overlay` | `Boolean` | 1/1 |
| `sections[].type` | `String` | 1/1 |
| `sections[].typography` | `Object` | 1/1 |
| `sections[].typography.body` | `Object` | 1/1 |
| `sections[].typography.body.fontFamily` | `String` | 1/1 |
| `sections[].typography.body.fontSize` | `Number` | 1/1 |
| `sections[].typography.body.fontWeight` | `Number` | 1/1 |
| `sections[].typography.body.lineHeight` | `Number` | 1/1 |
| `sections[].typography.button` | `Object` | 1/1 |
| `sections[].typography.button.fontFamily` | `String` | 1/1 |
| `sections[].typography.button.fontSize` | `Number` | 1/1 |
| `sections[].typography.button.fontWeight` | `Number` | 1/1 |
| `sections[].typography.button.letterSpacing` | `Number` | 1/1 |
| `sections[].typography.button.textTransform` | `String` | 1/1 |
| `sections[].typography.eyebrow` | `Object` | 1/1 |
| `sections[].typography.eyebrow.fontFamily` | `String` | 1/1 |
| `sections[].typography.eyebrow.fontSize` | `Number` | 1/1 |
| `sections[].typography.eyebrow.fontWeight` | `Number` | 1/1 |
| `sections[].typography.eyebrow.letterSpacing` | `Number` | 1/1 |
| `sections[].typography.eyebrow.textTransform` | `String` | 1/1 |
| `sections[].typography.heading` | `Object` | 1/1 |
| `sections[].typography.heading.fontFamily` | `String` | 1/1 |
| `sections[].typography.heading.fontSize` | `Number` | 1/1 |
| `sections[].typography.heading.fontWeight` | `Number` | 1/1 |
| `sections[].typography.heading.letterSpacing` | `Number` | 1/1 |
| `sections[].typography.heading.lineHeight` | `Number` | 1/1 |
| `sections[].typography.preset` | `String` | 1/1 |
| `sections[].typography.quote` | `Object` | 1/1 |
| `sections[].typography.quote.fontFamily` | `String` | 1/1 |
| `sections[].typography.quote.fontSize` | `Number` | 1/1 |
| `sections[].typography.quote.fontWeight` | `Number` | 1/1 |
| `sections[].typography.quote.lineHeight` | `Number` | 1/1 |
| `sections[].typography.subheading` | `Object` | 1/1 |
| `sections[].typography.subheading.fontFamily` | `String` | 1/1 |
| `sections[].typography.subheading.fontSize` | `Number` | 1/1 |
| `sections[].typography.subheading.fontWeight` | `Number` | 1/1 |
| `sections[].typography.subheading.lineHeight` | `Number` | 1/1 |
| `status` | `String` | 1/1 |
| `updatedAt` | `Date` | 1/1 |
| `updatedBy` | `String` | 1/1 |
| `version` | `Number` | 1/1 |

## `pages_policies`

> Nội dung các trang chính sách (điều khoản, bảo mật, v.v.).

- **Documents**: 7  
- **Sampled**: 7  
- **Fields**: 16  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 7/7 |
| `_id` | `ObjectId` | 7/7 |
| `dateAdded` | `Date` | 7/7 |
| `en` | `Object` | 7/7 |
| `en.contentHTML` | `String` | 7/7 |
| `en.metaDescription` | `String` | 7/7 |
| `en.title` | `String` | 7/7 |
| `en.visibility` | `Boolean` | 7/7 |
| `status` | `String` | 7/7 |
| `titleUrl` | `String` | 7/7 |
| `updatedAt` | `Date` | 7/7 |
| `vi` | `Object` | 7/7 |
| `vi.contentHTML` | `String` | 7/7 |
| `vi.metaDescription` | `String` | 7/7 |
| `vi.title` | `String` | 7/7 |
| `vi.visibility` | `Boolean` | 7/7 |

## `pages`

> Các trang tĩnh khác của website.

- **Documents**: 7  
- **Sampled**: 7  
- **Fields**: 16  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 7/7 |
| `_id` | `ObjectId` | 7/7 |
| `dateAdded` | `Date` | 7/7 |
| `en` | `Object` | 7/7 |
| `en.contentHTML` | `String` | 7/7 |
| `en.metaDescription` | `String` | 7/7 |
| `en.title` | `String` | 7/7 |
| `en.visibility` | `Boolean` | 7/7 |
| `status` | `String` | 7/7 |
| `titleUrl` | `String` | 7/7 |
| `updatedAt` | `Date` | 7/7 |
| `vi` | `Object` | 7/7 |
| `vi.contentHTML` | `String` | 7/7 |
| `vi.metaDescription` | `String` | 7/7 |
| `vi.title` | `String` | 7/7 |
| `vi.visibility` | `Boolean` | 7/7 |

## `translations`

> Dữ liệu đa ngôn ngữ cho giao diện.

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 102  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 1/1 |
| `keys` | `Object` | 1/1 |
| `keys.ADDED_TO_CART` | `String` | 1/1 |
| `keys.About_customer` | `String` | 1/1 |
| `keys.Add` | `String` | 1/1 |
| `keys.Add_page` | `String` | 1/1 |
| `keys.Added` | `String` | 1/1 |
| `keys.Address` | `String` | 1/1 |
| `keys.Again` | `String` | 1/1 |
| `keys.All` | `String` | 1/1 |
| `keys.Amount` | `String` | 1/1 |
| `keys.Available_in_few_weeks` | `String` | 1/1 |
| `keys.Back` | `String` | 1/1 |
| `keys.CONTACT` | `String` | 1/1 |
| `keys.Cart` | `String` | 1/1 |
| `keys.Categories` | `String` | 1/1 |
| `keys.Category` | `String` | 1/1 |
| `keys.Checkout` | `String` | 1/1 |
| `keys.City` | `String` | 1/1 |
| `keys.Config` | `String` | 1/1 |
| `keys.Contact` | `String` | 1/1 |
| `keys.Country` | `String` | 1/1 |
| `keys.Created` | `String` | 1/1 |
| `keys.Customer` | `String` | 1/1 |
| `keys.Dashboard` | `String` | 1/1 |
| `keys.Description` | `String` | 1/1 |
| `keys.Detail` | `String` | 1/1 |
| `keys.ESHOP_DESCRIPTION` | `String` | 1/1 |
| `keys.ESHOP_TITLE` | `String` | 1/1 |
| `keys.Edit` | `String` | 1/1 |
| `keys.Email` | `String` | 1/1 |
| `keys.Eshop_subtitle` | `String` | 1/1 |
| `keys.Filter` | `String` | 1/1 |
| `keys.Find` | `String` | 1/1 |
| `keys.Free_shipping_limit` | `String` | 1/1 |
| `keys.From_existing_pages` | `String` | 1/1 |
| `keys.Hidden` | `String` | 1/1 |
| `keys.Home` | `String` | 1/1 |
| `keys.Home_promo` | `String` | 1/1 |
| `keys.Images` | `String` | 1/1 |
| `keys.LINKS` | `String` | 1/1 |
| `keys.Language_for_page` | `String` | 1/1 |
| `keys.Language_for_product_detail` | `String` | 1/1 |
| `keys.Login` | `String` | 1/1 |
| `keys.Logout` | `String` | 1/1 |
| `keys.More` | `String` | 1/1 |
| `keys.Name` | `String` | 1/1 |
| `keys.Newest` | `String` | 1/1 |
| `keys.Next` | `String` | 1/1 |
| `keys.Oldest` | `String` | 1/1 |
| `keys.On_sale` | `String` | 1/1 |
| `keys.On_stock` | `String` | 1/1 |
| `keys.Order` | `String` | 1/1 |
| `keys.Orders` | `String` | 1/1 |
| `keys.Pages` | `String` | 1/1 |
| `keys.Paid` | `String` | 1/1 |
| `keys.Password` | `String` | 1/1 |
| `keys.Pay` | `String` | 1/1 |
| `keys.Prev` | `String` | 1/1 |
| `keys.Price` | `String` | 1/1 |
| `keys.Price-asc` | `String` | 1/1 |
| `keys.Price-decs` | `String` | 1/1 |
| `keys.PriceRange` | `String` | 1/1 |
| `keys.Price_from` | `String` | 1/1 |
| `keys.Price_to` | `String` | 1/1 |
| `keys.Product` | `String` | 1/1 |
| `keys.Products` | `String` | 1/1 |
| `keys.Regular_price` | `String` | 1/1 |
| `keys.Remove` | `String` | 1/1 |
| `keys.Request_sended` | `String` | 1/1 |
| `keys.SIGNIN_SUCCESS` | `String` | 1/1 |
| `keys.SIGNUP_SUCCESS` | `String` | 1/1 |
| `keys.Sale_price` | `String` | 1/1 |
| `keys.Save` | `String` | 1/1 |
| `keys.Search` | `String` | 1/1 |
| `keys.Send` | `String` | 1/1 |
| `keys.Shipping` | `String` | 1/1 |
| `keys.Shipping_cost` | `String` | 1/1 |
| `keys.Short_description` | `String` | 1/1 |
| `keys.SignIn` | `String` | 1/1 |
| `keys.SignUp` | `String` | 1/1 |
| `keys.Sort_by` | `String` | 1/1 |
| `keys.Sorting` | `String` | 1/1 |
| `keys.Status` | `String` | 1/1 |
| `keys.Stock` | `String` | 1/1 |
| `keys.SuccessOrder` | `String` | 1/1 |
| `keys.TO_CART` | `String` | 1/1 |
| `keys.Tags` | `String` | 1/1 |
| `keys.Theme` | `String` | 1/1 |
| `keys.Title` | `String` | 1/1 |
| `keys.Total_price` | `String` | 1/1 |
| `keys.Total_quantity` | `String` | 1/1 |
| `keys.Translations` | `String` | 1/1 |
| `keys.Type` | `String` | 1/1 |
| `keys.Unavailable` | `String` | 1/1 |
| `keys.Visibility` | `String` | 1/1 |
| `keys.Visible` | `String` | 1/1 |
| `keys.Zip` | `String` | 1/1 |
| `keys.products` | `String` | 1/1 |
| `keys.to` | `String` | 1/1 |
| `keys.with` | `String` | 1/1 |
| `lang` | `String` | 1/1 |

## `product_reviews`

> Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt).

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 13  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/1 |
| `_id` | `ObjectId` | 1/1 |
| `comment` | `String` | 1/1 |
| `createdAt` | `Date` | 1/1 |
| `isVerifiedPurchase` | `Boolean` | 1/1 |
| `orderId` | `String` | 1/1 |
| `productId` | `ObjectId` | 1/1 |
| `rating` | `Number` | 1/1 |
| `status` | `String` | 1/1 |
| `updatedAt` | `Date` | 1/1 |
| `userAvatar` | `String` | 1/1 |
| `userId` | `ObjectId` | 1/1 |
| `userName` | `String` | 1/1 |

## `user_interactions`

> Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System).

- **Documents**: 301  
- **Sampled**: 100  
- **Fields**: 11  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 100/100 |
| `eventType` | `String` | 100/100 |
| `isSynthetic` | `Boolean` | 100/100 |
| `metadata` | `Object` | 100/100 |
| `metadata.generator` | `String` | 100/100 |
| `metadata.isSynthetic` | `Boolean` | 100/100 |
| `metadata.seed` | `Number` | 100/100 |
| `metadata.simulatedAt` | `String` | 100/100 |
| `productId` | `ObjectId` | 100/100 |
| `timestamp` | `Date` | 100/100 |
| `userId` | `ObjectId` | 100/100 |

## `ml_bootstrap_interactions`

> Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế.

- **Documents**: 1446  
- **Sampled**: 100  
- **Fields**: 14  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 100/100 |
| `datasetType` | `String` | 100/100 |
| `eventType` | `String` | 100/100 |
| `isSynthetic` | `Boolean` | 100/100 |
| `metadata` | `Object` | 100/100 |
| `metadata.datasetType` | `String` | 100/100 |
| `metadata.isSynthetic` | `Boolean` | 100/100 |
| `metadata.persona` | `String` | 100/100 |
| `metadata.seed` | `Number` | 100/100 |
| `metadata.viewIndex` | `Number` | 100/100 |
| `productId` | `ObjectId` | 100/100 |
| `sessionId` | `String` | 100/100 |
| `timestamp` | `Date` | 100/100 |
| `userId` | `String` | 100/100 |

## `passwordresets`

> Token đặt lại mật khẩu (email, token, hết hạn).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection trống hoặc không có documents để phân tích schema.*

## `configs`

> Cấu hình hệ thống nội bộ (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection trống hoặc không có documents để phân tích schema.*

## `themes`

> Theme giao diện website (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection trống hoặc không có documents để phân tích schema.*

## `product_variants`

> Biến thể sản phẩm độc lập (deprecated/reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection trống hoặc không có documents để phân tích schema.*

## `shipping_methods`

> Phương thức vận chuyển (alias/deprecated, dùng shippingmethods).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection trống hoặc không có documents để phân tích schema.*

## `orders_backup_20261005`

> Backup đơn hàng trước migration ngày 05/10/2026.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 133  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/10 |
| `_id` | `ObjectId` | 10/10 |
| `_user` | `ObjectId` | 8/10 |
| `addresses` | `Array` | 9/10 |
| `addresses[]` | `Object` | 9/10 |
| `addresses[].city` | `String` | 9/10 |
| `addresses[].country` | `String` | 9/10 |
| `addresses[].line1` | `String` | 9/10 |
| `addresses[].line2` | `String` | 9/10 |
| `addresses[].name` | `String` | 9/10 |
| `addresses[].phone` | `String` | 8/10 |
| `addresses[].zip` | `String` | 9/10 |
| `amount` | `Number` | 9/10 |
| `cart` | `Object` | 9/10 |
| `cart.items` | `Array` | 9/10 |
| `cart.items[]` | `Object` | 9/10 |
| `cart.items[].id` | `String` | 9/10 |
| `cart.items[].item` | `Object` | 9/10 |
| `cart.items[].item._id` | `String` | 9/10 |
| `cart.items[].item._user` | `String` | 1/10 |
| `cart.items[].item.categoryLevel1` | `String` | 1/10 |
| `cart.items[].item.categoryLevel2` | `String` | 1/10 |
| `cart.items[].item.colors` | `Array` | 1/10 |
| `cart.items[].item.dateAdded` | `String` | 1/10 |
| `cart.items[].item.description` | `String` | 1/10 |
| `cart.items[].item.descriptionFull` | `Array` | 1/10 |
| `cart.items[].item.hasClassification` | `Boolean` | 1/10 |
| `cart.items[].item.hasColors` | `Boolean` | 1/10 |
| `cart.items[].item.hasSizes` | `Boolean` | 1/10 |
| `cart.items[].item.id` | `String` | 9/10 |
| `cart.items[].item.images` | `Array` | 9/10 |
| `cart.items[].item.images[]` | `String` | 9/10 |
| `cart.items[].item.mainImage` | `Object` | 9/10 |
| `cart.items[].item.mainImage.name` | `String` | 9/10 |
| `cart.items[].item.mainImage.url` | `String` | 9/10 |
| `cart.items[].item.onSale` | `Boolean` | 9/10 |
| `cart.items[].item.price` | `Number` | 8/10 |
| `cart.items[].item.productType` | `String` | 9/10 |
| `cart.items[].item.quantity` | `Number` | 1/10 |
| `cart.items[].item.rating` | `Number` | 1/10 |
| `cart.items[].item.regularPrice` | `Number` | 9/10 |
| `cart.items[].item.salePrice` | `Number` | 9/10 |
| `cart.items[].item.shipping` | `String` | 1/10 |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/10 |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/10 |
| `cart.items[].item.shippingCost` | `Number` | 1/10 |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/10 |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/10 |
| `cart.items[].item.sizes` | `Array` | 1/10 |
| `cart.items[].item.sizes[]` | `String` | 1/10 |
| `cart.items[].item.stock` | `String` | 1/10 |
| `cart.items[].item.stockDate` | `String` | 1/10 |
| `cart.items[].item.tags` | `Array` | 1/10 |
| `cart.items[].item.title` | `String` | 9/10 |
| `cart.items[].item.titleUrl` | `String` | 9/10 |
| `cart.items[].item.variant` | `Object` | 8/10 |
| `cart.items[].item.variant.classification` | `String` | 8/10 |
| `cart.items[].item.variant.color` | `String` | 8/10 |
| `cart.items[].item.variant.size` | `String` | 8/10 |
| `cart.items[].item.variants` | `Array` | 1/10 |
| `cart.items[].item.visibility` | `Boolean` | 1/10 |
| `cart.items[].price` | `Number` | 9/10 |
| `cart.items[].qty` | `Number` | 9/10 |
| `cart.items[].shipingCostType` | `String` | 9/10 |
| `cart.shippingCost` | `Number` | 9/10 |
| `cart.shippingLimit` | `Number` | 1/10 |
| `cart.shippingType` | `String` | 1/10 |
| `cart.totalPrice` | `Number` | 9/10 |
| `cart.totalQty` | `Number` | 9/10 |
| `couponCode` | `String` | 1/10 |
| `couponDiscount` | `Number` | 1/10 |
| `createdAt` | `Date` | 9/10 |
| `currency` | `String` | 10/10 |
| `customerEmail` | `String` | 10/10 |
| `customerPhone` | `String` | 9/10 |
| `dateAdded` | `Date` | 9/10 |
| `deliveredAt` | `Date` | 1/10 |
| `discountAmount` | `Number` | 9/10 |
| `estimatedDeliveryDate` | `Date` | 5/10 |
| `items` | `Array` | 9/10 |
| `items[]` | `Object` | 9/10 |
| `items[].productId` | `ObjectId` | 9/10 |
| `items[].productSnapshot` | `Object` | 9/10 |
| `items[].productSnapshot.image` | `String` | 9/10 |
| `items[].productSnapshot.sku` | `String` | 9/10 |
| `items[].productSnapshot.title` | `String` | 9/10 |
| `items[].productSnapshot.variant` | `Object` | 9/10 |
| `items[].productSnapshot.variant.classification` | `String` | 9/10 |
| `items[].productSnapshot.variant.color` | `String` | 9/10 |
| `items[].productSnapshot.variant.size` | `String` | 9/10 |
| `items[].quantity` | `Number` | 9/10 |
| `items[].subtotal` | `Number` | 9/10 |
| `items[].unitPrice` | `Number` | 9/10 |
| `notes` | `String` | 10/10 |
| `orderId` | `String` | 10/10 |
| `outcome` | `Object` | 1/10 |
| `outcome.seller_message` | `String` | 1/10 |
| `paymentFee` | `Number` | 1/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `shippedAt` | `Date` | 4/10 |
| `shippingAddress` | `Object` | 9/10 |
| `shippingAddress.address` | `String` | 9/10 |
| `shippingAddress.district` | `String` | 9/10 |
| `shippingAddress.fullName` | `String` | 9/10 |
| `shippingAddress.phone` | `String` | 9/10 |
| `shippingAddress.province` | `String` | 9/10 |
| `shippingAddress.ward` | `String` | 9/10 |
| `shippingFee` | `Number` | 9/10 |
| `shippingLogs` | `Array` | 8/10 |
| `shippingLogs[]` | `Object` | 4/10 |
| `shippingLogs[].description` | `String` | 4/10 |
| `shippingLogs[].location` | `String` | 4/10 |
| `shippingLogs[].status` | `String` | 4/10 |
| `shippingLogs[].timestamp` | `Date` | 4/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `ObjectId` | 1/10 |
| `subtotal` | `Number` | 9/10 |
| `taxAmount` | `Number` | 9/10 |
| `totalAmount` | `Number` | 9/10 |
| `trackingNumber` | `String` | 9/10 |
| `trackingUrl` | `String` | 8/10 |
| `transactionId` | `String` | 1/10 |
| `type` | `String` | 9/10 |
| `updatedAt` | `Date | String` | 10/10 |
| `userId` | `ObjectId` | 8/10 |

## `orders_backup_fk_20261005`

> Backup đơn hàng có foreign-key trước migration ngày 05/10/2026.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 161  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/10 |
| `_id` | `ObjectId` | 10/10 |
| `_user` | `ObjectId` | 10/10 |
| `addresses` | `Array` | 9/10 |
| `addresses[]` | `Object` | 9/10 |
| `addresses[].city` | `String` | 9/10 |
| `addresses[].country` | `String` | 9/10 |
| `addresses[].line1` | `String` | 9/10 |
| `addresses[].line2` | `String` | 9/10 |
| `addresses[].name` | `String` | 9/10 |
| `addresses[].phone` | `String` | 8/10 |
| `addresses[].zip` | `String` | 9/10 |
| `amount` | `Number` | 9/10 |
| `cart` | `Object` | 9/10 |
| `cart.items` | `Array` | 9/10 |
| `cart.items[]` | `Object` | 9/10 |
| `cart.items[].id` | `String` | 9/10 |
| `cart.items[].item` | `Object` | 9/10 |
| `cart.items[].item._id` | `String` | 9/10 |
| `cart.items[].item._user` | `String` | 1/10 |
| `cart.items[].item.categoryLevel1` | `String` | 1/10 |
| `cart.items[].item.categoryLevel2` | `String` | 1/10 |
| `cart.items[].item.colors` | `Array` | 1/10 |
| `cart.items[].item.dateAdded` | `String` | 1/10 |
| `cart.items[].item.description` | `String` | 1/10 |
| `cart.items[].item.descriptionFull` | `Array` | 1/10 |
| `cart.items[].item.hasClassification` | `Boolean` | 1/10 |
| `cart.items[].item.hasColors` | `Boolean` | 1/10 |
| `cart.items[].item.hasSizes` | `Boolean` | 1/10 |
| `cart.items[].item.id` | `String` | 9/10 |
| `cart.items[].item.images` | `Array` | 9/10 |
| `cart.items[].item.images[]` | `String` | 9/10 |
| `cart.items[].item.mainImage` | `Object` | 9/10 |
| `cart.items[].item.mainImage.name` | `String` | 9/10 |
| `cart.items[].item.mainImage.url` | `String` | 9/10 |
| `cart.items[].item.onSale` | `Boolean` | 9/10 |
| `cart.items[].item.price` | `Number` | 8/10 |
| `cart.items[].item.productType` | `String` | 9/10 |
| `cart.items[].item.quantity` | `Number` | 1/10 |
| `cart.items[].item.rating` | `Number` | 1/10 |
| `cart.items[].item.regularPrice` | `Number` | 9/10 |
| `cart.items[].item.salePrice` | `Number` | 9/10 |
| `cart.items[].item.shipping` | `String` | 1/10 |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/10 |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/10 |
| `cart.items[].item.shippingCost` | `Number` | 1/10 |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/10 |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/10 |
| `cart.items[].item.sizes` | `Array` | 1/10 |
| `cart.items[].item.sizes[]` | `String` | 1/10 |
| `cart.items[].item.stock` | `String` | 1/10 |
| `cart.items[].item.stockDate` | `String` | 1/10 |
| `cart.items[].item.tags` | `Array` | 1/10 |
| `cart.items[].item.title` | `String` | 9/10 |
| `cart.items[].item.titleUrl` | `String` | 9/10 |
| `cart.items[].item.variant` | `Object` | 8/10 |
| `cart.items[].item.variant.classification` | `String` | 8/10 |
| `cart.items[].item.variant.color` | `String` | 8/10 |
| `cart.items[].item.variant.size` | `String` | 8/10 |
| `cart.items[].item.variants` | `Array` | 1/10 |
| `cart.items[].item.visibility` | `Boolean` | 1/10 |
| `cart.items[].price` | `Number` | 9/10 |
| `cart.items[].qty` | `Number` | 9/10 |
| `cart.items[].shipingCostType` | `String` | 9/10 |
| `cart.shippingCost` | `Number` | 9/10 |
| `cart.shippingLimit` | `Number` | 1/10 |
| `cart.shippingType` | `String` | 1/10 |
| `cart.totalPrice` | `Number` | 9/10 |
| `cart.totalQty` | `Number` | 9/10 |
| `couponCode` | `String` | 1/10 |
| `couponDiscount` | `Number` | 10/10 |
| `createdAt` | `Date` | 10/10 |
| `currency` | `String` | 10/10 |
| `customer` | `Object` | 10/10 |
| `customer.email` | `String` | 10/10 |
| `customer.name` | `String` | 10/10 |
| `customer.phone` | `String` | 10/10 |
| `customerEmail` | `String` | 10/10 |
| `customerPhone` | `String` | 9/10 |
| `dateAdded` | `Date` | 9/10 |
| `deliveredAt` | `Date` | 1/10 |
| `discountAmount` | `Number` | 10/10 |
| `estimatedDeliveryDate` | `Date` | 5/10 |
| `items` | `Array` | 10/10 |
| `items[]` | `Object` | 10/10 |
| `items[].image` | `String` | 10/10 |
| `items[].name` | `String` | 10/10 |
| `items[].productId` | `String` | 10/10 |
| `items[].productSnapshot` | `Object` | 10/10 |
| `items[].productSnapshot.category` | `String` | 1/10 |
| `items[].productSnapshot.image` | `String` | 10/10 |
| `items[].productSnapshot.name` | `String` | 9/10 |
| `items[].productSnapshot.price` | `Number` | 9/10 |
| `items[].productSnapshot.sku` | `String` | 10/10 |
| `items[].productSnapshot.title` | `String` | 1/10 |
| `items[].productSnapshot.variant` | `Object` | 1/10 |
| `items[].productSnapshot.variant.classification` | `String` | 1/10 |
| `items[].productSnapshot.variant.color` | `String` | 1/10 |
| `items[].productSnapshot.variant.size` | `String` | 1/10 |
| `items[].quantity` | `Number` | 10/10 |
| `items[].sku` | `String` | 10/10 |
| `items[].subtotal` | `Number` | 10/10 |
| `items[].unitPrice` | `Number` | 10/10 |
| `items[].variant` | `Object` | 10/10 |
| `items[].variant.color` | `String` | 10/10 |
| `items[].variant.size` | `String` | 10/10 |
| `notes` | `String` | 10/10 |
| `orderId` | `String` | 10/10 |
| `outcome` | `Object` | 1/10 |
| `outcome.seller_message` | `String` | 1/10 |
| `payment` | `Object` | 10/10 |
| `payment.method` | `String` | 10/10 |
| `payment.paidAt` | `Date | String` | 2/10 |
| `payment.provider` | `String` | 8/10 |
| `payment.refundedAmount` | `Number` | 10/10 |
| `payment.status` | `String` | 10/10 |
| `paymentFee` | `Number` | 10/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `shippedAt` | `Date` | 4/10 |
| `shipping` | `Object` | 10/10 |
| `shipping.deliveredAt` | `Date | String` | 2/10 |
| `shipping.method` | `String` | 10/10 |
| `shipping.provider` | `String` | 10/10 |
| `shipping.shippedAt` | `Date | String` | 2/10 |
| `shipping.trackingNumber` | `String` | 10/10 |
| `shippingAddress` | `Object` | 10/10 |
| `shippingAddress.address` | `String` | 10/10 |
| `shippingAddress.city` | `String` | 10/10 |
| `shippingAddress.country` | `String` | 10/10 |
| `shippingAddress.district` | `String` | 10/10 |
| `shippingAddress.fullName` | `String` | 10/10 |
| `shippingAddress.phone` | `String` | 10/10 |
| `shippingAddress.province` | `String` | 10/10 |
| `shippingAddress.ward` | `String` | 10/10 |
| `shippingAddress.zip` | `String` | 10/10 |
| `shippingFee` | `Number` | 10/10 |
| `shippingLogs` | `Array` | 8/10 |
| `shippingLogs[]` | `Object` | 4/10 |
| `shippingLogs[].description` | `String` | 4/10 |
| `shippingLogs[].location` | `String` | 4/10 |
| `shippingLogs[].status` | `String` | 4/10 |
| `shippingLogs[].timestamp` | `Date` | 4/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `ObjectId` | 1/10 |
| `subtotal` | `Number` | 10/10 |
| `taxAmount` | `Number` | 10/10 |
| `totalAmount` | `Number` | 10/10 |
| `trackingNumber` | `String` | 9/10 |
| `trackingUrl` | `String` | 8/10 |
| `transactionId` | `String` | 1/10 |
| `type` | `String` | 9/10 |
| `updatedAt` | `Date | String` | 10/10 |
| `userId` | `ObjectId` | 10/10 |

