# CHERI MongoDB Schema

> **Database**: `cheri`  
> **Cập nhật**: 2026-10-21T07:43:36.418Z  
> **Tổng số collection**: 29  

## Danh sách Collections

| # | Collection | Docs | Fields | Mô tả |
|---|-----------|------|--------|-------|
| 1 | `users` | 31 | 40 | Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/admin. |
| 2 | `orders` | 50 | 378 | Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái. |
| 3 | `products` | 98 | 66 | Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục. |
| 4 | `categories` | 5 | 25 | Danh mục sản phẩm theo cây phân cấp (level1, level2). |
| 5 | `coupons` | 2 | 15 | Mã giảm giá: loại, giá trị, điều kiện, thời hạn sử dụng. |
| 6 | `shippingmethods` | 5 | 19 | Phương thức vận chuyển: tên, phí, trạng thái, vùng giao hàng. |
| 7 | `payment_methods` | 11 | 12 | Phương thức thanh toán: COD, Stripe, v.v. |
| 8 | `settings` | 1 | 24 | Cấu hình toàn site: thông tin cửa hàng, bảo trì, tiền tệ, liên hệ. |
| 9 | `session` | 40 | 3 | Session người dùng lưu giỏ hàng khách vãng lai và auth token. |
| 10 | `notification-popup` | 11 | 18 | Thông báo popup hiển thị cho người dùng. |
| 11 | `grapesjs_projects` | 2 | 86 | Dự án thiết kế trang GrapesJS (lưu JSON thiết kế). |
| 12 | `grapesjs_published` | 3 | 89 | Trang đã xuất bản từ GrapesJS editor. |
| 13 | `pages_home` | 2 | 160 | Nội dung trang chủ (hero, banner, sections). |
| 14 | `pages_about` | 1 | 98 | Nội dung trang giới thiệu. |
| 15 | `pages_policies` | 7 | 16 | Nội dung các trang chính sách (điều khoản, bảo mật, v.v.). |
| 16 | `pages` | 7 | 16 | Các trang tĩnh khác của website. |
| 17 | `translations` | 1 | 102 | Dữ liệu đa ngôn ngữ cho giao diện. |
| 18 | `product_reviews` | 3 | 13 | Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt). |
| 19 | `user_interactions` | 338 | 20 | Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System). |
| 20 | `ml_bootstrap_interactions` | 1446 | 15 | Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế. |
| 21 | `passwordresets` | 1 | 11 | Token đặt lại mật khẩu (email, token, hết hạn). |
| 22 | `configs` | 0 | 0 | Cấu hình hệ thống nội bộ (reserved). |
| 23 | `themes` | 0 | 0 | Theme giao diện website (reserved). |
| 24 | `product_variants` | 0 | 0 | Biến thể sản phẩm độc lập (deprecated/reserved). |
| 25 | `shipping_methods` | 0 | 0 | Phương thức vận chuyển (alias/deprecated, dùng shippingmethods). |
| 26 | `orders_backup_20261005` | 10 | 140 | Backup đơn hàng trước migration ngày 05/10/2026. |
| 27 | `orders_backup_fk_20261005` | 10 | 171 | Backup đơn hàng có foreign-key trước migration ngày 05/10/2026. |
| 28 | `guest_carts` | 6 | 14 | Giỏ hàng tạm thời của khách vãng lai (lưu theo guestId, items, thông tin sản phẩm và phân loại). |
| 29 | `payment_transactions` | 1 | 15 | Nhật ký giao dịch thanh toán trực tuyến / cổng thanh toán (mã giao dịch, trạng thái, số tiền, phương thức). |

---

## `users`

> Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/admin.

- **Documents**: 31  
- **Sampled**: 31  
- **Fields**: 40  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 20/31 |
| `_id` | `ObjectId` | 31/31 |
| `address` | `String` | 29/31 |
| `avatar` | `String` | 26/31 |
| `cart` | `Object` | 31/31 |
| `cart.items` | `Array` | 31/31 |
| `cart.items[]` | `Object` | 4/31 |
| `cart.items[].id` | `String` | 1/31 |
| `cart.items[].isSelected` | `Boolean` | 1/31 |
| `cart.items[].productId` | `ObjectId | String` | 4/31 |
| `cart.items[].qty` | `Number` | 1/31 |
| `cart.items[].quantity` | `Number` | 3/31 |
| `cart.items[].selectedClassification` | `String` | 4/31 |
| `cart.items[].selectedColor` | `String` | 4/31 |
| `cart.items[].selectedSize` | `String` | 4/31 |
| `cart.items[].variantId` | `String` | 4/31 |
| `cart.totalPrice` | `Number` | 1/31 |
| `createdAt` | `Date | String` | 28/31 |
| `dateAdded` | `Date | String` | 29/31 |
| `dateOfBirth` | `String` | 26/31 |
| `description` | `String` | 30/31 |
| `email` | `String` | 31/31 |
| `facebookId` | `String` | 1/31 |
| `fullName` | `String` | 30/31 |
| `gender` | `String` | 26/31 |
| `googleId` | `String` | 5/31 |
| `images` | `Array` | 30/31 |
| `images[]` | `String` | 6/31 |
| `name` | `String` | 31/31 |
| `password` | `String` | 28/31 |
| `phoneNumber` | `String` | 29/31 |
| `provider` | `String` | 2/31 |
| `role` | `Array` | 1/31 |
| `role[]` | `String` | 1/31 |
| `roles` | `Array` | 31/31 |
| `roles[]` | `String` | 31/31 |
| `salt` | `String` | 28/31 |
| `status` | `Boolean` | 31/31 |
| `tokenRevokedAt` | `String` | 1/31 |
| `updatedAt` | `Date | String` | 31/31 |

## `orders`

> Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái.

- **Documents**: 50  
- **Sampled**: 50  
- **Fields**: 378  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 24/50 |
| `_id` | `ObjectId` | 50/50 |
| `_user` | `ObjectId` | 50/50 |
| `actualCollectedAmount` | `Number` | 12/50 |
| `addresses` | `Array` | 29/50 |
| `addresses[]` | `Object` | 25/50 |
| `addresses[].address` | `String` | 19/50 |
| `addresses[].addressDetail` | `String` | 19/50 |
| `addresses[].city` | `String` | 6/50 |
| `addresses[].country` | `String` | 6/50 |
| `addresses[].district` | `String` | 19/50 |
| `addresses[].districtCode` | `String` | 19/50 |
| `addresses[].districtName` | `String` | 19/50 |
| `addresses[].fullAddress` | `String` | 19/50 |
| `addresses[].fullName` | `String` | 19/50 |
| `addresses[].line1` | `String` | 6/50 |
| `addresses[].line2` | `String` | 6/50 |
| `addresses[].name` | `String` | 6/50 |
| `addresses[].phone` | `String` | 24/50 |
| `addresses[].province` | `String` | 19/50 |
| `addresses[].provinceCode` | `String` | 19/50 |
| `addresses[].provinceName` | `String` | 19/50 |
| `addresses[].ward` | `String` | 19/50 |
| `addresses[].wardCode` | `String` | 19/50 |
| `addresses[].wardName` | `String` | 19/50 |
| `addresses[].zip` | `String` | 6/50 |
| `amount` | `Number` | 36/50 |
| `cancelledAt` | `Date` | 7/50 |
| `cancelledBy` | `ObjectId` | 7/50 |
| `cancelReason` | `String` | 7/50 |
| `cancelReasonDetail` | `String` | 5/50 |
| `cart` | `Object` | 25/50 |
| `cart.items` | `Array` | 6/50 |
| `cart.items[]` | `Object` | 6/50 |
| `cart.items[].id` | `String` | 6/50 |
| `cart.items[].item` | `Object` | 6/50 |
| `cart.items[].item._id` | `String` | 6/50 |
| `cart.items[].item._user` | `String` | 1/50 |
| `cart.items[].item.categoryLevel1` | `String` | 1/50 |
| `cart.items[].item.categoryLevel2` | `String` | 1/50 |
| `cart.items[].item.colors` | `Array` | 1/50 |
| `cart.items[].item.dateAdded` | `String` | 1/50 |
| `cart.items[].item.description` | `String` | 1/50 |
| `cart.items[].item.descriptionFull` | `Array` | 1/50 |
| `cart.items[].item.hasClassification` | `Boolean` | 1/50 |
| `cart.items[].item.hasColors` | `Boolean` | 1/50 |
| `cart.items[].item.hasSizes` | `Boolean` | 1/50 |
| `cart.items[].item.id` | `String` | 6/50 |
| `cart.items[].item.images` | `Array` | 6/50 |
| `cart.items[].item.images[]` | `String` | 6/50 |
| `cart.items[].item.mainImage` | `Object` | 6/50 |
| `cart.items[].item.mainImage.name` | `String` | 6/50 |
| `cart.items[].item.mainImage.url` | `String` | 6/50 |
| `cart.items[].item.onSale` | `Boolean` | 6/50 |
| `cart.items[].item.price` | `Number` | 5/50 |
| `cart.items[].item.productType` | `String` | 6/50 |
| `cart.items[].item.quantity` | `Number` | 1/50 |
| `cart.items[].item.rating` | `Number` | 1/50 |
| `cart.items[].item.regularPrice` | `Number` | 6/50 |
| `cart.items[].item.salePrice` | `Number` | 6/50 |
| `cart.items[].item.shipping` | `String` | 1/50 |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/50 |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/50 |
| `cart.items[].item.shippingCost` | `Number` | 1/50 |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/50 |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/50 |
| `cart.items[].item.sizes` | `Array` | 1/50 |
| `cart.items[].item.sizes[]` | `String` | 1/50 |
| `cart.items[].item.stock` | `String` | 1/50 |
| `cart.items[].item.stockDate` | `String` | 1/50 |
| `cart.items[].item.tags` | `Array` | 1/50 |
| `cart.items[].item.title` | `String` | 6/50 |
| `cart.items[].item.titleUrl` | `String` | 6/50 |
| `cart.items[].item.variant` | `Object` | 5/50 |
| `cart.items[].item.variant.classification` | `String` | 5/50 |
| `cart.items[].item.variant.color` | `String` | 5/50 |
| `cart.items[].item.variant.size` | `String` | 5/50 |
| `cart.items[].item.variants` | `Array` | 1/50 |
| `cart.items[].item.visibility` | `Boolean` | 1/50 |
| `cart.items[].price` | `Number` | 6/50 |
| `cart.items[].qty` | `Number` | 6/50 |
| `cart.items[].shipingCostType` | `String` | 6/50 |
| `cart.shippingCost` | `Number` | 6/50 |
| `cart.shippingLimit` | `Number` | 1/50 |
| `cart.shippingType` | `String` | 1/50 |
| `cart.totalPrice` | `Number` | 6/50 |
| `cart.totalQty` | `Number` | 6/50 |
| `couponCode` | `String` | 43/50 |
| `couponDiscount` | `Number` | 43/50 |
| `createdAt` | `Date` | 50/50 |
| `currency` | `String` | 43/50 |
| `customer` | `Object` | 42/50 |
| `customer.email` | `String` | 42/50 |
| `customer.name` | `String` | 42/50 |
| `customer.phone` | `String` | 42/50 |
| `customerEmail` | `String` | 50/50 |
| `customerPhone` | `String` | 49/50 |
| `dateAdded` | `Date` | 25/50 |
| `deliveredAt` | `String` | 25/50 |
| `discountAmount` | `Number` | 43/50 |
| `estimatedDeliveryDate` | `Date` | 25/50 |
| `isReviewed` | `Boolean` | 18/50 |
| `items` | `Array` | 50/50 |
| `items[]` | `Object` | 50/50 |
| `items[].image` | `Object | String` | 34/50 |
| `items[].image.name` | `String` | 7/50 |
| `items[].image.url` | `String` | 7/50 |
| `items[].name` | `String` | 34/50 |
| `items[].productId` | `ObjectId | String` | 50/50 |
| `items[].productSnapshot` | `Object` | 50/50 |
| `items[].productSnapshot.brand` | `String` | 10/50 |
| `items[].productSnapshot.category` | `String` | 10/50 |
| `items[].productSnapshot.image` | `Object | String` | 50/50 |
| `items[].productSnapshot.image.name` | `String` | 7/50 |
| `items[].productSnapshot.image.url` | `String` | 7/50 |
| `items[].productSnapshot.name` | `String` | 21/50 |
| `items[].productSnapshot.price` | `Number` | 21/50 |
| `items[].productSnapshot.sku` | `String` | 50/50 |
| `items[].productSnapshot.title` | `String` | 45/50 |
| `items[].productSnapshot.variant` | `Object` | 43/50 |
| `items[].productSnapshot.variant.classification` | `String` | 43/50 |
| `items[].productSnapshot.variant.color` | `String` | 43/50 |
| `items[].productSnapshot.variant.size` | `String` | 43/50 |
| `items[].quantity` | `Number` | 50/50 |
| `items[].sku` | `String` | 34/50 |
| `items[].subtotal` | `Number` | 50/50 |
| `items[].unitPrice` | `Number` | 50/50 |
| `items[].variant` | `Object` | 34/50 |
| `items[].variant.classification` | `String` | 24/50 |
| `items[].variant.color` | `String` | 30/50 |
| `items[].variant.size` | `String` | 30/50 |
| `items[].variantId` | `String` | 33/50 |
| `notes` | `String` | 43/50 |
| `orderId` | `String` | 50/50 |
| `outcome` | `Object` | 20/50 |
| `outcome.seller_message` | `String` | 1/50 |
| `paidAt` | `Date` | 33/50 |
| `payment` | `Object` | 49/50 |
| `payment.actualCollectedAmount` | `Number` | 20/50 |
| `payment.codCollected` | `Boolean` | 12/50 |
| `payment.codCollectedAt` | `String` | 5/50 |
| `payment.codReconciledAt` | `String` | 5/50 |
| `payment.codReconciliationStatus` | `String` | 12/50 |
| `payment.method` | `String` | 49/50 |
| `payment.paidAt` | `Date` | 49/50 |
| `payment.provider` | `String` | 49/50 |
| `payment.refundedAmount` | `Number` | 48/50 |
| `payment.refundedAt` | `Date` | 44/50 |
| `payment.status` | `String` | 49/50 |
| `payment.transactionId` | `String` | 49/50 |
| `paymentFee` | `Number` | 43/50 |
| `paymentMethodId` | `ObjectId` | 39/50 |
| `paymentMethodSnapshot` | `Object` | 39/50 |
| `paymentMethodSnapshot.code` | `String` | 38/50 |
| `paymentMethodSnapshot.name` | `String` | 38/50 |
| `paymentMethodSnapshot.paymentFee` | `Number` | 38/50 |
| `paymentMethodSnapshot.paymentType` | `String` | 38/50 |
| `paymentProvider` | `String` | 38/50 |
| `paymentStatus` | `String` | 43/50 |
| `refundedAmount` | `Number` | 39/50 |
| `refundedAt` | `Date` | 37/50 |
| `returnRequest` | `Object` | 18/50 |
| `returnRequest.approvedAt` | `Date` | 2/50 |
| `returnRequest.approveNote` | `String` | 1/50 |
| `returnRequest.description` | `String` | 12/50 |
| `returnRequest.history` | `Array` | 12/50 |
| `returnRequest.history[]` | `Object` | 12/50 |
| `returnRequest.history[].action` | `String` | 12/50 |
| `returnRequest.history[].fromStatus` | `String` | 12/50 |
| `returnRequest.history[].note` | `String` | 12/50 |
| `returnRequest.history[].toStatus` | `String` | 12/50 |
| `returnRequest.history[].updatedAt` | `Date` | 12/50 |
| `returnRequest.history[].updatedBy` | `ObjectId | String` | 7/50 |
| `returnRequest.images` | `Array` | 11/50 |
| `returnRequest.images[]` | `Object` | 6/50 |
| `returnRequest.images[].name` | `String` | 6/50 |
| `returnRequest.images[].url` | `String` | 6/50 |
| `returnRequest.inspection` | `Object` | 12/50 |
| `returnRequest.inspection.conditionNotes` | `String` | 12/50 |
| `returnRequest.inspection.inspectedAt` | `Date` | 12/50 |
| `returnRequest.inspection.inspectedBy` | `ObjectId | String` | 12/50 |
| `returnRequest.inspection.isEligible` | `Boolean` | 12/50 |
| `returnRequest.inspection.restocked` | `Boolean` | 12/50 |
| `returnRequest.items` | `Array` | 12/50 |
| `returnRequest.items[]` | `Object` | 12/50 |
| `returnRequest.items[].boughtQuantity` | `Number` | 11/50 |
| `returnRequest.items[].conditionNotes` | `String` | 10/50 |
| `returnRequest.items[].damagedQuantity` | `Number` | 10/50 |
| `returnRequest.items[].eligibleQuantity` | `Number` | 10/50 |
| `returnRequest.items[].inspectedQuantity` | `Number` | 10/50 |
| `returnRequest.items[].isEligible` | `Boolean` | 10/50 |
| `returnRequest.items[].productId` | `ObjectId | String` | 12/50 |
| `returnRequest.items[].productName` | `String` | 1/50 |
| `returnRequest.items[].productSnapshot` | `Object` | 11/50 |
| `returnRequest.items[].productSnapshot.brand` | `String` | 4/50 |
| `returnRequest.items[].productSnapshot.category` | `String` | 4/50 |
| `returnRequest.items[].productSnapshot.image` | `Object | String` | 11/50 |
| `returnRequest.items[].productSnapshot.image.name` | `String` | 6/50 |
| `returnRequest.items[].productSnapshot.image.url` | `String` | 6/50 |
| `returnRequest.items[].productSnapshot.name` | `String` | 11/50 |
| `returnRequest.items[].productSnapshot.price` | `Number` | 5/50 |
| `returnRequest.items[].productSnapshot.sku` | `String` | 11/50 |
| `returnRequest.items[].productSnapshot.title` | `String` | 11/50 |
| `returnRequest.items[].productSnapshot.variant` | `Object` | 5/50 |
| `returnRequest.items[].productSnapshot.variant.classification` | `String` | 5/50 |
| `returnRequest.items[].productSnapshot.variant.color` | `String` | 5/50 |
| `returnRequest.items[].productSnapshot.variant.size` | `String` | 5/50 |
| `returnRequest.items[].quantity` | `Number` | 12/50 |
| `returnRequest.items[].reason` | `String` | 12/50 |
| `returnRequest.items[].subtotal` | `Number` | 11/50 |
| `returnRequest.items[].unitPrice` | `Number` | 11/50 |
| `returnRequest.items[].variantId` | `String` | 11/50 |
| `returnRequest.orderId` | `String` | 1/50 |
| `returnRequest.reason` | `String` | 12/50 |
| `returnRequest.refund` | `Object` | 12/50 |
| `returnRequest.refund.accountHolder` | `String` | 12/50 |
| `returnRequest.refund.accountNumber` | `String` | 12/50 |
| `returnRequest.refund.approvedAmount` | `Number` | 12/50 |
| `returnRequest.refund.bankName` | `String` | 12/50 |
| `returnRequest.refund.failureReason` | `String` | 11/50 |
| `returnRequest.refund.notes` | `String` | 12/50 |
| `returnRequest.refund.refundedAmount` | `Number` | 12/50 |
| `returnRequest.refund.refundedAt` | `Date` | 12/50 |
| `returnRequest.refund.requestedAmount` | `Number` | 12/50 |
| `returnRequest.refund.status` | `String` | 12/50 |
| `returnRequest.refund.transactionId` | `String` | 12/50 |
| `returnRequest.refundMethod` | `String` | 12/50 |
| `returnRequest.rejectionReason` | `String` | 11/50 |
| `returnRequest.requestedAt` | `Date` | 12/50 |
| `returnRequest.requestId` | `String` | 12/50 |
| `returnRequest.returnShipping` | `Object` | 12/50 |
| `returnRequest.returnShipping.carrier` | `String` | 12/50 |
| `returnRequest.returnShipping.instructions` | `String` | 12/50 |
| `returnRequest.returnShipping.notes` | `String` | 1/50 |
| `returnRequest.returnShipping.receivedAt` | `Date` | 12/50 |
| `returnRequest.returnShipping.receivedNote` | `String` | 1/50 |
| `returnRequest.returnShipping.shippedAt` | `Date` | 12/50 |
| `returnRequest.returnShipping.trackingCode` | `String` | 12/50 |
| `returnRequest.status` | `String` | 12/50 |
| `returnRequests` | `Array` | 20/50 |
| `returnRequests[]` | `Object` | 12/50 |
| `returnRequests[].approvedAt` | `Date` | 2/50 |
| `returnRequests[].approveNote` | `String` | 1/50 |
| `returnRequests[].description` | `String` | 12/50 |
| `returnRequests[].history` | `Array` | 12/50 |
| `returnRequests[].history[]` | `Object` | 12/50 |
| `returnRequests[].history[].action` | `String` | 12/50 |
| `returnRequests[].history[].fromStatus` | `String` | 12/50 |
| `returnRequests[].history[].note` | `String` | 12/50 |
| `returnRequests[].history[].toStatus` | `String` | 12/50 |
| `returnRequests[].history[].updatedAt` | `Date` | 12/50 |
| `returnRequests[].history[].updatedBy` | `ObjectId | String` | 7/50 |
| `returnRequests[].images` | `Array` | 11/50 |
| `returnRequests[].images[]` | `Object` | 6/50 |
| `returnRequests[].images[].name` | `String` | 6/50 |
| `returnRequests[].images[].url` | `String` | 6/50 |
| `returnRequests[].inspection` | `Object` | 12/50 |
| `returnRequests[].inspection.conditionNotes` | `String` | 12/50 |
| `returnRequests[].inspection.inspectedAt` | `Date` | 12/50 |
| `returnRequests[].inspection.inspectedBy` | `ObjectId | String` | 12/50 |
| `returnRequests[].inspection.isEligible` | `Boolean` | 12/50 |
| `returnRequests[].inspection.restocked` | `Boolean` | 12/50 |
| `returnRequests[].items` | `Array` | 12/50 |
| `returnRequests[].items[]` | `Object` | 12/50 |
| `returnRequests[].items[].boughtQuantity` | `Number` | 11/50 |
| `returnRequests[].items[].conditionNotes` | `String` | 11/50 |
| `returnRequests[].items[].damagedQuantity` | `Number` | 11/50 |
| `returnRequests[].items[].eligibleQuantity` | `Number` | 11/50 |
| `returnRequests[].items[].inspectedQuantity` | `Number` | 11/50 |
| `returnRequests[].items[].isEligible` | `Boolean` | 11/50 |
| `returnRequests[].items[].productId` | `ObjectId | String` | 12/50 |
| `returnRequests[].items[].productName` | `String` | 1/50 |
| `returnRequests[].items[].productSnapshot` | `Object` | 11/50 |
| `returnRequests[].items[].productSnapshot.brand` | `String` | 5/50 |
| `returnRequests[].items[].productSnapshot.category` | `String` | 5/50 |
| `returnRequests[].items[].productSnapshot.image` | `Object | String` | 11/50 |
| `returnRequests[].items[].productSnapshot.image.name` | `String` | 6/50 |
| `returnRequests[].items[].productSnapshot.image.url` | `String` | 6/50 |
| `returnRequests[].items[].productSnapshot.name` | `String` | 11/50 |
| `returnRequests[].items[].productSnapshot.price` | `Number` | 5/50 |
| `returnRequests[].items[].productSnapshot.sku` | `String` | 11/50 |
| `returnRequests[].items[].productSnapshot.title` | `String` | 11/50 |
| `returnRequests[].items[].productSnapshot.variant` | `Object` | 5/50 |
| `returnRequests[].items[].productSnapshot.variant.classification` | `String` | 5/50 |
| `returnRequests[].items[].productSnapshot.variant.color` | `String` | 5/50 |
| `returnRequests[].items[].productSnapshot.variant.size` | `String` | 5/50 |
| `returnRequests[].items[].quantity` | `Number` | 12/50 |
| `returnRequests[].items[].reason` | `String` | 12/50 |
| `returnRequests[].items[].subtotal` | `Number` | 11/50 |
| `returnRequests[].items[].unitPrice` | `Number` | 11/50 |
| `returnRequests[].items[].variantId` | `String` | 11/50 |
| `returnRequests[].orderId` | `String` | 1/50 |
| `returnRequests[].reason` | `String` | 12/50 |
| `returnRequests[].refund` | `Object` | 12/50 |
| `returnRequests[].refund.accountHolder` | `String` | 12/50 |
| `returnRequests[].refund.accountNumber` | `String` | 12/50 |
| `returnRequests[].refund.approvedAmount` | `Number` | 12/50 |
| `returnRequests[].refund.bankName` | `String` | 12/50 |
| `returnRequests[].refund.failureReason` | `String` | 11/50 |
| `returnRequests[].refund.notes` | `String` | 12/50 |
| `returnRequests[].refund.refundedAmount` | `Number` | 12/50 |
| `returnRequests[].refund.refundedAt` | `Date` | 12/50 |
| `returnRequests[].refund.requestedAmount` | `Number` | 12/50 |
| `returnRequests[].refund.status` | `String` | 12/50 |
| `returnRequests[].refund.transactionId` | `String` | 12/50 |
| `returnRequests[].refundMethod` | `String` | 12/50 |
| `returnRequests[].rejectionReason` | `String` | 11/50 |
| `returnRequests[].requestedAt` | `Date` | 12/50 |
| `returnRequests[].requestId` | `String` | 12/50 |
| `returnRequests[].returnShipping` | `Object` | 12/50 |
| `returnRequests[].returnShipping.carrier` | `String` | 12/50 |
| `returnRequests[].returnShipping.instructions` | `String` | 12/50 |
| `returnRequests[].returnShipping.notes` | `String` | 1/50 |
| `returnRequests[].returnShipping.receivedAt` | `Date` | 12/50 |
| `returnRequests[].returnShipping.receivedNote` | `String` | 1/50 |
| `returnRequests[].returnShipping.shippedAt` | `Date` | 12/50 |
| `returnRequests[].returnShipping.trackingCode` | `String` | 12/50 |
| `returnRequests[].status` | `String` | 12/50 |
| `reviewedAt` | `Date` | 6/50 |
| `shippedAt` | `Date` | 25/50 |
| `shipping` | `Object` | 43/50 |
| `shipping.carrier` | `String` | 5/50 |
| `shipping.deliveredAt` | `Date` | 43/50 |
| `shipping.estimatedDeliveryDate` | `Date` | 38/50 |
| `shipping.fee` | `Number` | 5/50 |
| `shipping.method` | `String` | 43/50 |
| `shipping.provider` | `String` | 42/50 |
| `shipping.shippedAt` | `Date` | 38/50 |
| `shipping.trackingCode` | `String` | 5/50 |
| `shipping.trackingNumber` | `String` | 42/50 |
| `shippingAddress` | `Object` | 50/50 |
| `shippingAddress.address` | `String` | 50/50 |
| `shippingAddress.addressDetail` | `String` | 24/50 |
| `shippingAddress.city` | `String` | 30/50 |
| `shippingAddress.country` | `String` | 25/50 |
| `shippingAddress.district` | `String` | 50/50 |
| `shippingAddress.districtCode` | `String` | 24/50 |
| `shippingAddress.districtName` | `String` | 24/50 |
| `shippingAddress.fullName` | `String` | 50/50 |
| `shippingAddress.phone` | `String` | 50/50 |
| `shippingAddress.province` | `String` | 50/50 |
| `shippingAddress.provinceCode` | `String` | 24/50 |
| `shippingAddress.provinceName` | `String` | 24/50 |
| `shippingAddress.ward` | `String` | 50/50 |
| `shippingAddress.wardCode` | `String` | 24/50 |
| `shippingAddress.wardName` | `String` | 24/50 |
| `shippingAddress.zip` | `String` | 25/50 |
| `shippingFee` | `Number` | 50/50 |
| `shippingLogs` | `Array` | 28/50 |
| `shippingLogs[]` | `Object` | 2/50 |
| `shippingLogs[].description` | `String` | 2/50 |
| `shippingLogs[].location` | `String` | 2/50 |
| `shippingLogs[].status` | `String` | 2/50 |
| `shippingLogs[].timestamp` | `Date` | 2/50 |
| `shippingMethodId` | `ObjectId` | 39/50 |
| `shippingMethodSnapshot` | `Object` | 39/50 |
| `shippingMethodSnapshot.code` | `String` | 37/50 |
| `shippingMethodSnapshot.estimatedDeliveryTime` | `String` | 37/50 |
| `shippingMethodSnapshot.fee` | `Number` | 37/50 |
| `shippingMethodSnapshot.name` | `String` | 37/50 |
| `shippingProvider` | `String` | 42/50 |
| `status` | `String` | 50/50 |
| `statusHistory` | `Array` | 45/50 |
| `statusHistory[]` | `Object` | 45/50 |
| `statusHistory[].changedAt` | `Date` | 5/50 |
| `statusHistory[].note` | `String` | 45/50 |
| `statusHistory[].status` | `String` | 45/50 |
| `statusHistory[].updatedAt` | `Date | String` | 44/50 |
| `statusHistory[].updatedBy` | `ObjectId | String` | 40/50 |
| `subtotal` | `Number` | 50/50 |
| `taxAmount` | `Number` | 43/50 |
| `totalAmount` | `Number` | 50/50 |
| `trackingNumber` | `String` | 42/50 |
| `trackingUrl` | `String` | 28/50 |
| `transactionId` | `String` | 38/50 |
| `type` | `String` | 6/50 |
| `updatedAt` | `Date | String` | 50/50 |
| `userId` | `ObjectId` | 49/50 |

## `products`

> Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục.

- **Documents**: 98  
- **Sampled**: 98  
- **Fields**: 66  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 98/98 |
| `_id` | `ObjectId` | 98/98 |
| `attributes` | `Object` | 98/98 |
| `attributes.classifications` | `Array` | 98/98 |
| `attributes.classifications[]` | `String` | 97/98 |
| `attributes.colors` | `Array` | 98/98 |
| `attributes.colors[]` | `Object` | 97/98 |
| `attributes.colors[].hex` | `String` | 97/98 |
| `attributes.colors[].name` | `String` | 97/98 |
| `attributes.sizes` | `Array` | 98/98 |
| `attributes.sizes[]` | `String` | 97/98 |
| `cs` | `Object` | 98/98 |
| `cs.visibility` | `Boolean` | 98/98 |
| `dateAdded` | `String` | 98/98 |
| `en` | `Object` | 98/98 |
| `en.visibility` | `Boolean` | 98/98 |
| `images` | `Array` | 98/98 |
| `images[]` | `String` | 98/98 |
| `mainImage` | `Object` | 98/98 |
| `mainImage.name` | `String` | 98/98 |
| `mainImage.url` | `String` | 98/98 |
| `quantity` | `Number` | 10/98 |
| `rating` | `Number` | 3/98 |
| `sk` | `Object` | 98/98 |
| `sk.visibility` | `Boolean` | 98/98 |
| `stock` | `Number` | 4/98 |
| `tags` | `Array` | 98/98 |
| `tags[]` | `String` | 98/98 |
| `titleUrl` | `String` | 98/98 |
| `updatedAt` | `Date | String` | 98/98 |
| `variants` | `Array` | 98/98 |
| `variants[]` | `Object` | 97/98 |
| `variants[].classification` | `String` | 97/98 |
| `variants[].color` | `String` | 97/98 |
| `variants[].discountPrice` | `Number` | 97/98 |
| `variants[].price` | `Number` | 97/98 |
| `variants[].size` | `String` | 97/98 |
| `variants[].sku` | `String` | 97/98 |
| `variants[].stock` | `Number` | 97/98 |
| `vi` | `Object` | 98/98 |
| `vi.categoryLevel1` | `String` | 98/98 |
| `vi.categoryLevel2` | `String` | 98/98 |
| `vi.classifications` | `Array` | 98/98 |
| `vi.classifications[]` | `String` | 97/98 |
| `vi.colors` | `Array` | 98/98 |
| `vi.colors[]` | `Object` | 97/98 |
| `vi.colors[].hex` | `String` | 97/98 |
| `vi.colors[].name` | `String` | 97/98 |
| `vi.description` | `String` | 98/98 |
| `vi.descriptionFull` | `Array` | 98/98 |
| `vi.descriptionFull[]` | `String` | 98/98 |
| `vi.hasClassification` | `Boolean` | 98/98 |
| `vi.hasColors` | `Boolean` | 98/98 |
| `vi.hasSizes` | `Boolean` | 98/98 |
| `vi.onSale` | `Boolean` | 98/98 |
| `vi.productType` | `String` | 98/98 |
| `vi.quantity` | `Number` | 98/98 |
| `vi.regularPrice` | `Number` | 98/98 |
| `vi.salePrice` | `Number` | 98/98 |
| `vi.sizes` | `Array` | 98/98 |
| `vi.sizes[]` | `String` | 97/98 |
| `vi.stock` | `Number | String` | 98/98 |
| `vi.stockDate` | `String` | 98/98 |
| `vi.title` | `String` | 98/98 |
| `vi.visibility` | `Boolean` | 98/98 |
| `visibility` | `Boolean` | 98/98 |

## `categories`

> Danh mục sản phẩm theo cây phân cấp (level1, level2).

- **Documents**: 5  
- **Sampled**: 5  
- **Fields**: 25  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 5/5 |
| `_id` | `ObjectId` | 5/5 |
| `cs` | `Object` | 5/5 |
| `cs.visibility` | `Boolean` | 5/5 |
| `dateAdded` | `String` | 5/5 |
| `en` | `Object` | 5/5 |
| `en.description` | `String` | 5/5 |
| `en.title` | `String` | 5/5 |
| `en.visibility` | `Boolean` | 5/5 |
| `mainImage` | `Object` | 5/5 |
| `mainImage.name` | `String` | 5/5 |
| `mainImage.url` | `String` | 5/5 |
| `parentId` | `String` | 5/5 |
| `sk` | `Object` | 5/5 |
| `sk.visibility` | `Boolean` | 5/5 |
| `subCategories` | `Array` | 5/5 |
| `titleUrl` | `String` | 5/5 |
| `updatedAt` | `String` | 5/5 |
| `vi` | `Object` | 5/5 |
| `vi.description` | `String` | 5/5 |
| `vi.menuHidden` | `Boolean` | 5/5 |
| `vi.position` | `Number` | 5/5 |
| `vi.title` | `String` | 5/5 |
| `vi.visibility` | `Boolean` | 5/5 |
| `visibility` | `Boolean` | 2/5 |

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

- **Documents**: 40  
- **Sampled**: 40  
- **Fields**: 3  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `String` | 40/40 |
| `expires` | `Date` | 40/40 |
| `session` | `String` | 40/40 |

## `notification-popup`

> Thông báo popup hiển thị cho người dùng.

- **Documents**: 11  
- **Sampled**: 11  
- **Fields**: 18  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 11/11 |
| `count` | `Number` | 11/11 |
| `createdAt` | `Date` | 11/11 |
| `group` | `String` | 11/11 |
| `icon` | `String` | 11/11 |
| `id` | `String` | 11/11 |
| `isRead` | `Boolean` | 11/11 |
| `items` | `Array` | 11/11 |
| `items[]` | `String` | 1/11 |
| `level` | `String` | 11/11 |
| `message` | `String` | 11/11 |
| `readAt` | `Date` | 11/11 |
| `recipientId` | `String` | 11/11 |
| `targetUrl` | `String` | 11/11 |
| `time` | `Date` | 11/11 |
| `title` | `String` | 11/11 |
| `type` | `String` | 11/11 |
| `updatedAt` | `Date` | 11/11 |

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
| `projectId` | `ObjectId` | 3/3 |
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
| `publishedAt` | `Date` | 2/2 |
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
- **Fields**: 98  

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
| `sections[].media.mobile` | `String` | 1/1 |
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
| `keys.About_customer` | `String` | 1/1 |
| `keys.Add` | `String` | 1/1 |
| `keys.Add_page` | `String` | 1/1 |
| `keys.Added` | `String` | 1/1 |
| `keys.ADDED_TO_CART` | `String` | 1/1 |
| `keys.Address` | `String` | 1/1 |
| `keys.Again` | `String` | 1/1 |
| `keys.All` | `String` | 1/1 |
| `keys.Amount` | `String` | 1/1 |
| `keys.Available_in_few_weeks` | `String` | 1/1 |
| `keys.Back` | `String` | 1/1 |
| `keys.Cart` | `String` | 1/1 |
| `keys.Categories` | `String` | 1/1 |
| `keys.Category` | `String` | 1/1 |
| `keys.Checkout` | `String` | 1/1 |
| `keys.City` | `String` | 1/1 |
| `keys.Config` | `String` | 1/1 |
| `keys.Contact` | `String` | 1/1 |
| `keys.CONTACT` | `String` | 1/1 |
| `keys.Country` | `String` | 1/1 |
| `keys.Created` | `String` | 1/1 |
| `keys.Customer` | `String` | 1/1 |
| `keys.Dashboard` | `String` | 1/1 |
| `keys.Description` | `String` | 1/1 |
| `keys.Detail` | `String` | 1/1 |
| `keys.Edit` | `String` | 1/1 |
| `keys.Email` | `String` | 1/1 |
| `keys.ESHOP_DESCRIPTION` | `String` | 1/1 |
| `keys.Eshop_subtitle` | `String` | 1/1 |
| `keys.ESHOP_TITLE` | `String` | 1/1 |
| `keys.Filter` | `String` | 1/1 |
| `keys.Find` | `String` | 1/1 |
| `keys.Free_shipping_limit` | `String` | 1/1 |
| `keys.From_existing_pages` | `String` | 1/1 |
| `keys.Hidden` | `String` | 1/1 |
| `keys.Home` | `String` | 1/1 |
| `keys.Home_promo` | `String` | 1/1 |
| `keys.Images` | `String` | 1/1 |
| `keys.Language_for_page` | `String` | 1/1 |
| `keys.Language_for_product_detail` | `String` | 1/1 |
| `keys.LINKS` | `String` | 1/1 |
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
| `keys.Price_from` | `String` | 1/1 |
| `keys.Price_to` | `String` | 1/1 |
| `keys.Price-asc` | `String` | 1/1 |
| `keys.Price-decs` | `String` | 1/1 |
| `keys.PriceRange` | `String` | 1/1 |
| `keys.Product` | `String` | 1/1 |
| `keys.products` | `String` | 1/1 |
| `keys.Products` | `String` | 1/1 |
| `keys.Regular_price` | `String` | 1/1 |
| `keys.Remove` | `String` | 1/1 |
| `keys.Request_sended` | `String` | 1/1 |
| `keys.Sale_price` | `String` | 1/1 |
| `keys.Save` | `String` | 1/1 |
| `keys.Search` | `String` | 1/1 |
| `keys.Send` | `String` | 1/1 |
| `keys.Shipping` | `String` | 1/1 |
| `keys.Shipping_cost` | `String` | 1/1 |
| `keys.Short_description` | `String` | 1/1 |
| `keys.SignIn` | `String` | 1/1 |
| `keys.SIGNIN_SUCCESS` | `String` | 1/1 |
| `keys.SignUp` | `String` | 1/1 |
| `keys.SIGNUP_SUCCESS` | `String` | 1/1 |
| `keys.Sort_by` | `String` | 1/1 |
| `keys.Sorting` | `String` | 1/1 |
| `keys.Status` | `String` | 1/1 |
| `keys.Stock` | `String` | 1/1 |
| `keys.SuccessOrder` | `String` | 1/1 |
| `keys.Tags` | `String` | 1/1 |
| `keys.Theme` | `String` | 1/1 |
| `keys.Title` | `String` | 1/1 |
| `keys.to` | `String` | 1/1 |
| `keys.TO_CART` | `String` | 1/1 |
| `keys.Total_price` | `String` | 1/1 |
| `keys.Total_quantity` | `String` | 1/1 |
| `keys.Translations` | `String` | 1/1 |
| `keys.Type` | `String` | 1/1 |
| `keys.Unavailable` | `String` | 1/1 |
| `keys.Visibility` | `String` | 1/1 |
| `keys.Visible` | `String` | 1/1 |
| `keys.with` | `String` | 1/1 |
| `keys.Zip` | `String` | 1/1 |
| `lang` | `String` | 1/1 |

## `product_reviews`

> Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt).

- **Documents**: 3  
- **Sampled**: 3  
- **Fields**: 13  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 3/3 |
| `_id` | `ObjectId` | 3/3 |
| `comment` | `String` | 3/3 |
| `createdAt` | `Date` | 3/3 |
| `isVerifiedPurchase` | `Boolean` | 3/3 |
| `orderId` | `String` | 3/3 |
| `productId` | `ObjectId` | 3/3 |
| `rating` | `Number` | 3/3 |
| `status` | `String` | 3/3 |
| `updatedAt` | `Date` | 3/3 |
| `userAvatar` | `String` | 3/3 |
| `userId` | `ObjectId` | 3/3 |
| `userName` | `String` | 3/3 |

## `user_interactions`

> Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System).

- **Documents**: 338  
- **Sampled**: 338  
- **Fields**: 20  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 228/338 |
| `_id` | `ObjectId` | 338/338 |
| `datasetType` | `String` | 85/338 |
| `eventType` | `String` | 338/338 |
| `isSynthetic` | `Boolean` | 338/338 |
| `metadata` | `Object` | 338/338 |
| `metadata.generator` | `String` | 110/338 |
| `metadata.isSynthetic` | `Boolean` | 338/338 |
| `metadata.price` | `Number` | 9/338 |
| `metadata.quantity` | `Number` | 9/338 |
| `metadata.seed` | `Number` | 110/338 |
| `metadata.simulatedAt` | `String` | 110/338 |
| `metadata.source` | `String` | 228/338 |
| `metadata.userAgent` | `String` | 219/338 |
| `orderId` | `String` | 85/338 |
| `productId` | `ObjectId` | 338/338 |
| `sessionId` | `String` | 338/338 |
| `timestamp` | `Date` | 338/338 |
| `userId` | `ObjectId` | 338/338 |
| `variantId` | `String` | 228/338 |

## `ml_bootstrap_interactions`

> Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế.

- **Documents**: 1446  
- **Sampled**: 1446  
- **Fields**: 15  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 1446/1446 |
| `datasetType` | `String` | 1446/1446 |
| `eventType` | `String` | 1446/1446 |
| `isSynthetic` | `Boolean` | 1446/1446 |
| `metadata` | `Object` | 1446/1446 |
| `metadata.datasetType` | `String` | 1446/1446 |
| `metadata.isSynthetic` | `Boolean` | 1446/1446 |
| `metadata.persona` | `String` | 1446/1446 |
| `metadata.price` | `Number` | 121/1446 |
| `metadata.seed` | `Number` | 1446/1446 |
| `metadata.viewIndex` | `Number` | 1125/1446 |
| `productId` | `ObjectId` | 1446/1446 |
| `sessionId` | `String` | 1446/1446 |
| `timestamp` | `Date` | 1446/1446 |
| `userId` | `String` | 1446/1446 |

## `passwordresets`

> Token đặt lại mật khẩu (email, token, hết hạn).

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 11  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/1 |
| `_id` | `ObjectId` | 1/1 |
| `attempts` | `Number` | 1/1 |
| `createdAt` | `Date` | 1/1 |
| `email` | `String` | 1/1 |
| `expiresAt` | `Date` | 1/1 |
| `otpHash` | `String` | 1/1 |
| `resetTokenExpiresAt` | `String` | 1/1 |
| `resetTokenHash` | `String` | 1/1 |
| `updatedAt` | `Date` | 1/1 |
| `verified` | `Boolean` | 1/1 |

## `configs`

> Cấu hình hệ thống nội bộ (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection hiện chưa có document nào.*

## `themes`

> Theme giao diện website (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection hiện chưa có document nào.*

## `product_variants`

> Biến thể sản phẩm độc lập (deprecated/reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection hiện chưa có document nào.*

## `shipping_methods`

> Phương thức vận chuyển (alias/deprecated, dùng shippingmethods).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*Collection hiện chưa có document nào.*

## `orders_backup_20261005`

> Backup đơn hàng trước migration ngày 05/10/2026.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 140  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/10 |
| `_id` | `ObjectId` | 10/10 |
| `_user` | `ObjectId` | 9/10 |
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
| `deliveredAt` | `Date` | 9/10 |
| `discountAmount` | `Number` | 9/10 |
| `estimatedDeliveryDate` | `Date` | 9/10 |
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
| `items[].variantId` | `String` | 9/10 |
| `notes` | `String` | 10/10 |
| `orderId` | `String` | 10/10 |
| `outcome` | `Object` | 1/10 |
| `outcome.seller_message` | `String` | 1/10 |
| `paidAt` | `String` | 1/10 |
| `paymentFee` | `Number` | 1/10 |
| `paymentMethodId` | `String` | 1/10 |
| `paymentMethodSnapshot` | `String` | 1/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `refundedAt` | `String` | 1/10 |
| `shippedAt` | `Date` | 9/10 |
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
| `shippingMethodId` | `String` | 1/10 |
| `shippingMethodSnapshot` | `String` | 1/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `ObjectId` | 2/10 |
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
- **Fields**: 171  

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
| `couponCode` | `String` | 10/10 |
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
| `deliveredAt` | `Date` | 9/10 |
| `discountAmount` | `Number` | 10/10 |
| `estimatedDeliveryDate` | `Date` | 9/10 |
| `items` | `Array` | 10/10 |
| `items[]` | `Object` | 10/10 |
| `items[].image` | `String` | 10/10 |
| `items[].name` | `String` | 10/10 |
| `items[].productId` | `String` | 10/10 |
| `items[].productSnapshot` | `Object` | 10/10 |
| `items[].productSnapshot.brand` | `String` | 9/10 |
| `items[].productSnapshot.category` | `String` | 9/10 |
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
| `paidAt` | `String` | 1/10 |
| `payment` | `Object` | 10/10 |
| `payment.method` | `String` | 10/10 |
| `payment.paidAt` | `Date | String` | 10/10 |
| `payment.provider` | `String` | 10/10 |
| `payment.refundedAmount` | `Number` | 10/10 |
| `payment.refundedAt` | `String` | 10/10 |
| `payment.status` | `String` | 10/10 |
| `payment.transactionId` | `String` | 10/10 |
| `paymentFee` | `Number` | 10/10 |
| `paymentMethodId` | `String` | 1/10 |
| `paymentMethodSnapshot` | `String` | 1/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `refundedAt` | `String` | 1/10 |
| `shippedAt` | `Date` | 9/10 |
| `shipping` | `Object` | 10/10 |
| `shipping.deliveredAt` | `Date | String` | 10/10 |
| `shipping.estimatedDeliveryDate` | `String` | 10/10 |
| `shipping.method` | `String` | 10/10 |
| `shipping.provider` | `String` | 10/10 |
| `shipping.shippedAt` | `Date | String` | 10/10 |
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
| `shippingMethodId` | `String` | 1/10 |
| `shippingMethodSnapshot` | `String` | 1/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `ObjectId` | 2/10 |
| `subtotal` | `Number` | 10/10 |
| `taxAmount` | `Number` | 10/10 |
| `totalAmount` | `Number` | 10/10 |
| `trackingNumber` | `String` | 9/10 |
| `trackingUrl` | `String` | 8/10 |
| `transactionId` | `String` | 1/10 |
| `type` | `String` | 9/10 |
| `updatedAt` | `Date | String` | 10/10 |
| `userId` | `ObjectId` | 10/10 |

## `guest_carts`

> Giỏ hàng tạm thời của khách vãng lai (lưu theo guestId, items, thông tin sản phẩm và phân loại).

- **Documents**: 6  
- **Sampled**: 6  
- **Fields**: 14  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 6/6 |
| `createdAt` | `Date` | 6/6 |
| `guestCartId` | `String` | 6/6 |
| `items` | `Array` | 6/6 |
| `items[]` | `Object` | 5/6 |
| `items[].id` | `String` | 5/6 |
| `items[].isSelected` | `Boolean` | 5/6 |
| `items[].productId` | `String` | 5/6 |
| `items[].qty` | `Number` | 5/6 |
| `items[].selectedClassification` | `String` | 5/6 |
| `items[].selectedColor` | `String` | 5/6 |
| `items[].selectedSize` | `String` | 5/6 |
| `items[].variantId` | `String` | 5/6 |
| `updatedAt` | `Date` | 6/6 |

## `payment_transactions`

> Nhật ký giao dịch thanh toán trực tuyến / cổng thanh toán (mã giao dịch, trạng thái, số tiền, phương thức).

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 15  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/1 |
| `_id` | `ObjectId` | 1/1 |
| `amount` | `Number` | 1/1 |
| `createdAt` | `Date` | 1/1 |
| `currency` | `String` | 1/1 |
| `failureReason` | `String` | 1/1 |
| `method` | `String` | 1/1 |
| `orderCode` | `String` | 1/1 |
| `orderId` | `ObjectId` | 1/1 |
| `paidAt` | `String` | 1/1 |
| `paymentLink` | `String` | 1/1 |
| `provider` | `String` | 1/1 |
| `providerTransactionId` | `String` | 1/1 |
| `status` | `String` | 1/1 |
| `updatedAt` | `Date` | 1/1 |

