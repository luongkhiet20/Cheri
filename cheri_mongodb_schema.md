# CHERI MongoDB Schema

> **Database**: `cheri`  
> **Cập nhật**: 2026-11-04T11:33:21.441Z  
> **Tổng số collection**: 37  

## Danh sách Collections

| # | Collection | Docs | Fields | Mô tả |
|---|-----------|------|--------|-------|
| 1 | `users` | 36 | 38 | Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/staff/admin, danh sách permissions module quản trị. |
| 2 | `orders` | 74 | 379 | Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái, yêu cầu trả hàng/hủy. |
| 3 | `products` | 99 | 68 | Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục. |
| 4 | `categories` | 4 | 25 | Danh mục sản phẩm theo cây phân cấp (level1, level2). |
| 5 | `coupons` | 2 | 15 | Mã giảm giá: loại, giá trị, điều kiện, thời hạn sử dụng. |
| 6 | `shippingmethods` | 5 | 19 | Phương thức vận chuyển: tên, phí, trạng thái, vùng giao hàng. |
| 7 | `payment_methods` | 2 | 11 | Phương thức thanh toán: COD, Stripe, v.v. |
| 8 | `settings` | 1 | 24 | Cấu hình toàn site: thông tin cửa hàng, bảo trì, tiền tệ, liên hệ. |
| 9 | `session` | 44 | 3 | Session người dùng lưu giỏ hàng khách vãng lai và auth token. |
| 10 | `notification-popup` | 10 | 18 | Thông báo popup hiển thị cho người dùng. |
| 11 | `grapesjs_projects` | 2 | 86 | Dự án thiết kế trang GrapesJS (lưu JSON thiết kế). |
| 12 | `grapesjs_published` | 3 | 89 | Trang đã xuất bản từ GrapesJS editor. |
| 13 | `pages_home` | 2 | 160 | Nội dung trang chủ (hero, banner, sections). |
| 14 | `pages_about` | 1 | 103 | Nội dung trang giới thiệu. |
| 15 | `pages_policies` | 7 | 16 | Nội dung các trang chính sách (điều khoản, bảo mật, v.v.). |
| 16 | `pages` | 7 | 16 | Các trang tĩnh khác của website. |
| 17 | `translations` | 1 | 102 | Dữ liệu đa ngôn ngữ cho giao diện. |
| 18 | `product_reviews` | 4 | 13 | Đánh giá và nhận xét sản phẩm từ khách hàng (điểm số rating 1-5 sao, bình luận, hình ảnh thực tế, trạng thái duyệt). |
| 19 | `user_interactions` | 794 | 20 | Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System). |
| 20 | `ml_bootstrap_interactions` | 3264 | 14 | Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế. |
| 21 | `passwordresets` | 2 | 14 | Token đặt lại mật khẩu (email, token, hết hạn). |
| 22 | `configs` | 0 | 0 | Cấu hình hệ thống nội bộ (reserved). |
| 23 | `themes` | 0 | 0 | Theme giao diện website (reserved). |
| 24 | `product_variants` | 0 | 0 | Biến thể sản phẩm độc lập (deprecated/reserved). |
| 25 | `shipping_methods` | 0 | 0 | Phương thức vận chuyển (alias/deprecated, dùng shippingmethods). |
| 26 | `orders_backup_20261005` | 10 | 140 | Backup đơn hàng trước migration ngày 05/10/2026. |
| 27 | `orders_backup_fk_20261005` | 10 | 171 | Backup đơn hàng có foreign-key trước migration ngày 05/10/2026. |
| 28 | `guest_carts` | 9 | 14 | Giỏ hàng tạm thời của khách vãng lai (lưu theo guestId, items, thông tin sản phẩm và phân loại). |
| 29 | `payment_transactions` | 24 | 15 | Nhật ký giao dịch thanh toán trực tuyến / cổng thanh toán (mã giao dịch, trạng thái, số tiền, phương thức, VNPay/Stripe). |
| 30 | `newsletter_subscribers` | 2 | 8 | Danh sách khách hàng và khách vãng lai đăng ký nhận bản tin ưu đãi (email, trạng thái SUBSCRIBED/UNSUBSCRIBED, nguồn đăng ký, thời gian). |
| 31 | `conversations` | 13 | 28 | Phiên hội thoại hỗ trợ khách hàng với nhân viên (trạng thái WAITING_ADMIN, IN_PROGRESS, CLOSED, thông tin khách, phân công admin, yêu cầu hủy 5s). |
| 32 | `conversation_messages` | 75 | 17 | Tin nhắn trong cuộc hội thoại hỗ trợ giữa khách hàng, nhân viên admin và hệ thống (CUSTOMER, ADMIN, SYSTEM, timestamp, systemEvent). |
| 33 | `chatbot_sessions` | 8 | 45 | Phiên trò chuyện của người dùng với AI Assistant / Chatbot Chéri (lịch sử tin nhắn, sessionId, guestId, ngữ cảnh tư vấn). |
| 34 | `chat_rate_limits` | 0 | 0 | Giới hạn tần suất gửi tin nhắn chat của người dùng / IP để chống spam và tấn công DoS. |
| 35 | `social_links` | 3 | 6 | Cấu hình liên kết mạng xã hội chính thức của Chéri (Facebook, Instagram, TikTok, YouTube, URL, thứ tự hiển thị, trạng thái hoạt động). |
| 36 | `recommendation_impressions` | 489 | 10 | Nhật ký lượt hiển thị sản phẩm gợi ý ML đến người dùng (sessionId, productId, algorithm, rank, timestamp) phục vụ đo lường CTR và tối ưu hóa mô hình gợi ý. |
| 37 | `counters` | 1 | 3 | Bộ đếm tự tăng (sequence / counter) phục vụ sinh mã số tự động trong hệ thống. |

---

## `users`

> Tài khoản người dùng, giỏ hàng, thông tin cá nhân, phân quyền user/staff/admin, danh sách permissions module quản trị.

- **Documents**: 36  
- **Sampled**: 36  
- **Fields**: 38  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 24/36 |
| `_id` | `ObjectId` | 36/36 |
| `address` | `String` | 33/36 |
| `avatar` | `String` | 31/36 |
| `cart` | `Array | Object` | 36/36 |
| `cart.items` | `Array` | 35/36 |
| `cart.items[]` | `Object` | 6/36 |
| `cart.items[].productId` | `ObjectId` | 6/36 |
| `cart.items[].quantity` | `Number` | 6/36 |
| `cart.items[].selectedClassification` | `Null | String` | 6/36 |
| `cart.items[].selectedColor` | `Null | String` | 6/36 |
| `cart.items[].selectedSize` | `Null | String` | 6/36 |
| `cart.items[].variantId` | `Null | String` | 6/36 |
| `cart.totalPrice` | `Number` | 1/36 |
| `createdAt` | `Date | String` | 33/36 |
| `dateAdded` | `Date | String` | 33/36 |
| `dateOfBirth` | `Null | String` | 30/36 |
| `description` | `String` | 34/36 |
| `email` | `String` | 36/36 |
| `facebookId` | `String` | 1/36 |
| `fullName` | `String` | 35/36 |
| `gender` | `String` | 30/36 |
| `googleId` | `Null | String` | 11/36 |
| `images` | `Array` | 35/36 |
| `images[]` | `String` | 10/36 |
| `name` | `String` | 36/36 |
| `password` | `String` | 32/36 |
| `permissions` | `Array` | 1/36 |
| `phoneNumber` | `String` | 33/36 |
| `provider` | `String` | 2/36 |
| `role` | `Array` | 1/36 |
| `role[]` | `String` | 1/36 |
| `roles` | `Array` | 36/36 |
| `roles[]` | `String` | 36/36 |
| `salt` | `String` | 32/36 |
| `status` | `Boolean` | 36/36 |
| `tokenRevokedAt` | `Date | Null` | 8/36 |
| `updatedAt` | `Date | String` | 36/36 |

## `orders`

> Đơn hàng (bao gồm khách vãng lai userId=null), cart, địa chỉ, thanh toán, coupon, trạng thái, yêu cầu trả hàng/hủy.

- **Documents**: 74  
- **Sampled**: 74  
- **Fields**: 379  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 48/74 |
| `_id` | `ObjectId` | 74/74 |
| `_user` | `Null | ObjectId` | 74/74 |
| `actualCollectedAmount` | `Number` | 36/74 |
| `addresses` | `Array` | 53/74 |
| `addresses[]` | `Object` | 49/74 |
| `addresses[].address` | `String` | 43/74 |
| `addresses[].addressDetail` | `String` | 43/74 |
| `addresses[].city` | `String` | 6/74 |
| `addresses[].country` | `String` | 6/74 |
| `addresses[].district` | `String` | 43/74 |
| `addresses[].districtCode` | `String` | 43/74 |
| `addresses[].districtName` | `String` | 43/74 |
| `addresses[].fullAddress` | `String` | 43/74 |
| `addresses[].fullName` | `String` | 43/74 |
| `addresses[].line1` | `String` | 6/74 |
| `addresses[].line2` | `String` | 6/74 |
| `addresses[].name` | `String` | 6/74 |
| `addresses[].phone` | `String` | 48/74 |
| `addresses[].province` | `String` | 43/74 |
| `addresses[].provinceCode` | `String` | 43/74 |
| `addresses[].provinceName` | `String` | 43/74 |
| `addresses[].ward` | `String` | 43/74 |
| `addresses[].wardCode` | `String` | 43/74 |
| `addresses[].wardName` | `String` | 43/74 |
| `addresses[].zip` | `String` | 6/74 |
| `amount` | `Null | Number` | 60/74 |
| `cancelReason` | `Null | String` | 31/74 |
| `cancelReasonDetail` | `Null` | 29/74 |
| `cancelledAt` | `Date | Null` | 31/74 |
| `cancelledBy` | `Null | ObjectId` | 31/74 |
| `cart` | `Null | Object` | 49/74 |
| `cart.items` | `Array` | 6/74 |
| `cart.items[]` | `Object` | 6/74 |
| `cart.items[].id` | `String` | 6/74 |
| `cart.items[].item` | `Object` | 6/74 |
| `cart.items[].item._id` | `String` | 6/74 |
| `cart.items[].item._user` | `String` | 1/74 |
| `cart.items[].item.categoryLevel1` | `String` | 1/74 |
| `cart.items[].item.categoryLevel2` | `String` | 1/74 |
| `cart.items[].item.colors` | `Array` | 1/74 |
| `cart.items[].item.dateAdded` | `String` | 1/74 |
| `cart.items[].item.description` | `String` | 1/74 |
| `cart.items[].item.descriptionFull` | `Array` | 1/74 |
| `cart.items[].item.hasClassification` | `Boolean` | 1/74 |
| `cart.items[].item.hasColors` | `Boolean` | 1/74 |
| `cart.items[].item.hasSizes` | `Boolean` | 1/74 |
| `cart.items[].item.id` | `String` | 6/74 |
| `cart.items[].item.images` | `Array` | 6/74 |
| `cart.items[].item.images[]` | `String` | 6/74 |
| `cart.items[].item.mainImage` | `Object` | 6/74 |
| `cart.items[].item.mainImage.name` | `String` | 6/74 |
| `cart.items[].item.mainImage.url` | `String` | 6/74 |
| `cart.items[].item.onSale` | `Boolean` | 6/74 |
| `cart.items[].item.price` | `Number` | 5/74 |
| `cart.items[].item.productType` | `String` | 6/74 |
| `cart.items[].item.quantity` | `Number` | 1/74 |
| `cart.items[].item.rating` | `Number` | 1/74 |
| `cart.items[].item.regularPrice` | `Number` | 6/74 |
| `cart.items[].item.salePrice` | `Number` | 6/74 |
| `cart.items[].item.shipping` | `String` | 1/74 |
| `cart.items[].item.shippingBasic` | `Boolean` | 1/74 |
| `cart.items[].item.shippingBasicCost` | `Number` | 1/74 |
| `cart.items[].item.shippingCost` | `Number` | 1/74 |
| `cart.items[].item.shippingExtended` | `Boolean` | 1/74 |
| `cart.items[].item.shippingExtendedCost` | `Number` | 1/74 |
| `cart.items[].item.sizes` | `Array` | 1/74 |
| `cart.items[].item.sizes[]` | `String` | 1/74 |
| `cart.items[].item.stock` | `String` | 1/74 |
| `cart.items[].item.stockDate` | `String` | 1/74 |
| `cart.items[].item.tags` | `Array` | 1/74 |
| `cart.items[].item.title` | `String` | 6/74 |
| `cart.items[].item.titleUrl` | `String` | 6/74 |
| `cart.items[].item.variant` | `Object` | 5/74 |
| `cart.items[].item.variant.classification` | `String` | 5/74 |
| `cart.items[].item.variant.color` | `String` | 5/74 |
| `cart.items[].item.variant.size` | `String` | 5/74 |
| `cart.items[].item.variants` | `Array` | 1/74 |
| `cart.items[].item.visibility` | `Boolean` | 1/74 |
| `cart.items[].price` | `Number` | 6/74 |
| `cart.items[].qty` | `Number` | 6/74 |
| `cart.items[].shipingCostType` | `String` | 6/74 |
| `cart.shippingCost` | `Number` | 6/74 |
| `cart.shippingLimit` | `Number` | 1/74 |
| `cart.shippingType` | `String` | 1/74 |
| `cart.totalPrice` | `Number` | 6/74 |
| `cart.totalQty` | `Number` | 6/74 |
| `couponCode` | `Null | String` | 67/74 |
| `couponDiscount` | `Number` | 67/74 |
| `createdAt` | `Date` | 74/74 |
| `currency` | `String` | 67/74 |
| `customer` | `Object` | 66/74 |
| `customer.email` | `String` | 66/74 |
| `customer.name` | `String` | 66/74 |
| `customer.phone` | `String` | 66/74 |
| `customerEmail` | `String` | 74/74 |
| `customerPhone` | `String` | 73/74 |
| `dateAdded` | `Date | Null` | 49/74 |
| `deliveredAt` | `Null` | 49/74 |
| `discountAmount` | `Number` | 67/74 |
| `estimatedDeliveryDate` | `Date | Null` | 49/74 |
| `isReviewed` | `Boolean` | 43/74 |
| `items` | `Array` | 74/74 |
| `items[]` | `Object` | 74/74 |
| `items[].image` | `Object | String` | 58/74 |
| `items[].image.name` | `String` | 7/74 |
| `items[].image.url` | `String` | 7/74 |
| `items[].name` | `String` | 58/74 |
| `items[].productId` | `ObjectId | String` | 74/74 |
| `items[].productSnapshot` | `Object` | 74/74 |
| `items[].productSnapshot.brand` | `Null` | 34/74 |
| `items[].productSnapshot.category` | `Null | String` | 34/74 |
| `items[].productSnapshot.image` | `Object | String` | 74/74 |
| `items[].productSnapshot.image.name` | `String` | 7/74 |
| `items[].productSnapshot.image.url` | `String` | 7/74 |
| `items[].productSnapshot.name` | `String` | 45/74 |
| `items[].productSnapshot.price` | `Number` | 45/74 |
| `items[].productSnapshot.sku` | `String` | 74/74 |
| `items[].productSnapshot.title` | `String` | 69/74 |
| `items[].productSnapshot.variant` | `Object` | 67/74 |
| `items[].productSnapshot.variant.classification` | `String` | 67/74 |
| `items[].productSnapshot.variant.color` | `String` | 67/74 |
| `items[].productSnapshot.variant.size` | `String` | 67/74 |
| `items[].quantity` | `Number` | 74/74 |
| `items[].sku` | `String` | 58/74 |
| `items[].subtotal` | `Number` | 74/74 |
| `items[].unitPrice` | `Number` | 74/74 |
| `items[].variant` | `Null | Object` | 58/74 |
| `items[].variant.classification` | `String` | 24/74 |
| `items[].variant.color` | `String` | 30/74 |
| `items[].variant.size` | `String` | 30/74 |
| `items[].variantId` | `Null | String` | 57/74 |
| `notes` | `String` | 67/74 |
| `orderId` | `String` | 74/74 |
| `outcome` | `Null | Object` | 44/74 |
| `outcome.seller_message` | `String` | 1/74 |
| `paidAt` | `Date | Null` | 57/74 |
| `payment` | `Object` | 73/74 |
| `payment.actualCollectedAmount` | `Number` | 44/74 |
| `payment.codCollected` | `Boolean` | 36/74 |
| `payment.codCollectedAt` | `Null` | 29/74 |
| `payment.codReconciledAt` | `Null` | 29/74 |
| `payment.codReconciliationStatus` | `String` | 36/74 |
| `payment.method` | `String` | 73/74 |
| `payment.paidAt` | `Date | Null` | 73/74 |
| `payment.provider` | `String` | 73/74 |
| `payment.refundedAmount` | `Number` | 72/74 |
| `payment.refundedAt` | `Date | Null` | 68/74 |
| `payment.status` | `String` | 73/74 |
| `payment.transactionId` | `Null | String` | 73/74 |
| `paymentFee` | `Number` | 67/74 |
| `paymentMethodId` | `Null | ObjectId` | 63/74 |
| `paymentMethodSnapshot` | `Null | Object` | 63/74 |
| `paymentMethodSnapshot.code` | `String` | 62/74 |
| `paymentMethodSnapshot.name` | `String` | 62/74 |
| `paymentMethodSnapshot.paymentFee` | `Number` | 62/74 |
| `paymentMethodSnapshot.paymentType` | `String` | 62/74 |
| `paymentProvider` | `String` | 62/74 |
| `paymentStatus` | `String` | 67/74 |
| `refundedAmount` | `Number` | 63/74 |
| `refundedAt` | `Date | Null` | 61/74 |
| `returnRequest` | `Null | Object` | 42/74 |
| `returnRequest.approveNote` | `String` | 1/74 |
| `returnRequest.approvedAt` | `Date` | 2/74 |
| `returnRequest.description` | `String` | 12/74 |
| `returnRequest.history` | `Array` | 12/74 |
| `returnRequest.history[]` | `Object` | 12/74 |
| `returnRequest.history[].action` | `String` | 12/74 |
| `returnRequest.history[].fromStatus` | `Null | String` | 12/74 |
| `returnRequest.history[].note` | `String` | 12/74 |
| `returnRequest.history[].toStatus` | `String` | 12/74 |
| `returnRequest.history[].updatedAt` | `Date` | 12/74 |
| `returnRequest.history[].updatedBy` | `Null | ObjectId | String` | 7/74 |
| `returnRequest.images` | `Array` | 11/74 |
| `returnRequest.images[]` | `Object` | 6/74 |
| `returnRequest.images[].name` | `String` | 6/74 |
| `returnRequest.images[].url` | `String` | 6/74 |
| `returnRequest.inspection` | `Object` | 12/74 |
| `returnRequest.inspection.conditionNotes` | `String` | 12/74 |
| `returnRequest.inspection.inspectedAt` | `Date | Null` | 12/74 |
| `returnRequest.inspection.inspectedBy` | `Null | ObjectId | String` | 12/74 |
| `returnRequest.inspection.isEligible` | `Boolean | Null` | 12/74 |
| `returnRequest.inspection.restocked` | `Boolean` | 12/74 |
| `returnRequest.items` | `Array` | 12/74 |
| `returnRequest.items[]` | `Object` | 12/74 |
| `returnRequest.items[].boughtQuantity` | `Number` | 11/74 |
| `returnRequest.items[].conditionNotes` | `String` | 10/74 |
| `returnRequest.items[].damagedQuantity` | `Number` | 10/74 |
| `returnRequest.items[].eligibleQuantity` | `Number` | 10/74 |
| `returnRequest.items[].inspectedQuantity` | `Number` | 10/74 |
| `returnRequest.items[].isEligible` | `Boolean | Null` | 10/74 |
| `returnRequest.items[].productId` | `ObjectId | String` | 12/74 |
| `returnRequest.items[].productName` | `Null` | 1/74 |
| `returnRequest.items[].productSnapshot` | `Object` | 11/74 |
| `returnRequest.items[].productSnapshot.brand` | `Null` | 4/74 |
| `returnRequest.items[].productSnapshot.category` | `Null` | 4/74 |
| `returnRequest.items[].productSnapshot.image` | `Object | String` | 11/74 |
| `returnRequest.items[].productSnapshot.image.name` | `String` | 6/74 |
| `returnRequest.items[].productSnapshot.image.url` | `String` | 6/74 |
| `returnRequest.items[].productSnapshot.name` | `String` | 11/74 |
| `returnRequest.items[].productSnapshot.price` | `Number` | 5/74 |
| `returnRequest.items[].productSnapshot.sku` | `String` | 11/74 |
| `returnRequest.items[].productSnapshot.title` | `String` | 11/74 |
| `returnRequest.items[].productSnapshot.variant` | `Object` | 5/74 |
| `returnRequest.items[].productSnapshot.variant.classification` | `String` | 5/74 |
| `returnRequest.items[].productSnapshot.variant.color` | `String` | 5/74 |
| `returnRequest.items[].productSnapshot.variant.size` | `String` | 5/74 |
| `returnRequest.items[].quantity` | `Number` | 12/74 |
| `returnRequest.items[].reason` | `String` | 12/74 |
| `returnRequest.items[].subtotal` | `Number` | 11/74 |
| `returnRequest.items[].unitPrice` | `Number` | 11/74 |
| `returnRequest.items[].variantId` | `Null` | 11/74 |
| `returnRequest.orderId` | `String` | 1/74 |
| `returnRequest.reason` | `String` | 12/74 |
| `returnRequest.refund` | `Object` | 12/74 |
| `returnRequest.refund.accountHolder` | `String` | 12/74 |
| `returnRequest.refund.accountNumber` | `String` | 12/74 |
| `returnRequest.refund.approvedAmount` | `Number` | 12/74 |
| `returnRequest.refund.bankName` | `String` | 12/74 |
| `returnRequest.refund.failureReason` | `String` | 11/74 |
| `returnRequest.refund.notes` | `String` | 12/74 |
| `returnRequest.refund.refundedAmount` | `Number` | 12/74 |
| `returnRequest.refund.refundedAt` | `Date | Null` | 12/74 |
| `returnRequest.refund.requestedAmount` | `Number` | 12/74 |
| `returnRequest.refund.status` | `String` | 12/74 |
| `returnRequest.refund.transactionId` | `String` | 12/74 |
| `returnRequest.refundMethod` | `String` | 12/74 |
| `returnRequest.rejectionReason` | `String` | 11/74 |
| `returnRequest.requestId` | `String` | 12/74 |
| `returnRequest.requestedAt` | `Date` | 12/74 |
| `returnRequest.returnShipping` | `Object` | 12/74 |
| `returnRequest.returnShipping.carrier` | `String` | 12/74 |
| `returnRequest.returnShipping.instructions` | `String` | 12/74 |
| `returnRequest.returnShipping.notes` | `String` | 1/74 |
| `returnRequest.returnShipping.receivedAt` | `Date | Null` | 12/74 |
| `returnRequest.returnShipping.receivedNote` | `String` | 1/74 |
| `returnRequest.returnShipping.shippedAt` | `Date | Null` | 12/74 |
| `returnRequest.returnShipping.trackingCode` | `String` | 12/74 |
| `returnRequest.status` | `String` | 12/74 |
| `returnRequests` | `Array` | 44/74 |
| `returnRequests[]` | `Object` | 12/74 |
| `returnRequests[].approveNote` | `String` | 1/74 |
| `returnRequests[].approvedAt` | `Date` | 2/74 |
| `returnRequests[].description` | `String` | 12/74 |
| `returnRequests[].history` | `Array` | 12/74 |
| `returnRequests[].history[]` | `Object` | 12/74 |
| `returnRequests[].history[].action` | `String` | 12/74 |
| `returnRequests[].history[].fromStatus` | `Null | String` | 12/74 |
| `returnRequests[].history[].note` | `String` | 12/74 |
| `returnRequests[].history[].toStatus` | `String` | 12/74 |
| `returnRequests[].history[].updatedAt` | `Date` | 12/74 |
| `returnRequests[].history[].updatedBy` | `Null | ObjectId | String` | 7/74 |
| `returnRequests[].images` | `Array` | 11/74 |
| `returnRequests[].images[]` | `Object` | 6/74 |
| `returnRequests[].images[].name` | `String` | 6/74 |
| `returnRequests[].images[].url` | `String` | 6/74 |
| `returnRequests[].inspection` | `Object` | 12/74 |
| `returnRequests[].inspection.conditionNotes` | `String` | 12/74 |
| `returnRequests[].inspection.inspectedAt` | `Date | Null` | 12/74 |
| `returnRequests[].inspection.inspectedBy` | `Null | ObjectId | String` | 12/74 |
| `returnRequests[].inspection.isEligible` | `Boolean | Null` | 12/74 |
| `returnRequests[].inspection.restocked` | `Boolean` | 12/74 |
| `returnRequests[].items` | `Array` | 12/74 |
| `returnRequests[].items[]` | `Object` | 12/74 |
| `returnRequests[].items[].boughtQuantity` | `Number` | 11/74 |
| `returnRequests[].items[].conditionNotes` | `String` | 11/74 |
| `returnRequests[].items[].damagedQuantity` | `Number` | 11/74 |
| `returnRequests[].items[].eligibleQuantity` | `Number` | 11/74 |
| `returnRequests[].items[].inspectedQuantity` | `Number` | 11/74 |
| `returnRequests[].items[].isEligible` | `Boolean | Null` | 11/74 |
| `returnRequests[].items[].productId` | `ObjectId | String` | 12/74 |
| `returnRequests[].items[].productName` | `Null` | 1/74 |
| `returnRequests[].items[].productSnapshot` | `Object` | 11/74 |
| `returnRequests[].items[].productSnapshot.brand` | `Null` | 5/74 |
| `returnRequests[].items[].productSnapshot.category` | `Null` | 5/74 |
| `returnRequests[].items[].productSnapshot.image` | `Object | String` | 11/74 |
| `returnRequests[].items[].productSnapshot.image.name` | `String` | 6/74 |
| `returnRequests[].items[].productSnapshot.image.url` | `String` | 6/74 |
| `returnRequests[].items[].productSnapshot.name` | `String` | 11/74 |
| `returnRequests[].items[].productSnapshot.price` | `Number` | 5/74 |
| `returnRequests[].items[].productSnapshot.sku` | `String` | 11/74 |
| `returnRequests[].items[].productSnapshot.title` | `String` | 11/74 |
| `returnRequests[].items[].productSnapshot.variant` | `Object` | 5/74 |
| `returnRequests[].items[].productSnapshot.variant.classification` | `String` | 5/74 |
| `returnRequests[].items[].productSnapshot.variant.color` | `String` | 5/74 |
| `returnRequests[].items[].productSnapshot.variant.size` | `String` | 5/74 |
| `returnRequests[].items[].quantity` | `Number` | 12/74 |
| `returnRequests[].items[].reason` | `String` | 12/74 |
| `returnRequests[].items[].subtotal` | `Number` | 11/74 |
| `returnRequests[].items[].unitPrice` | `Number` | 11/74 |
| `returnRequests[].items[].variantId` | `Null` | 11/74 |
| `returnRequests[].orderId` | `String` | 1/74 |
| `returnRequests[].reason` | `String` | 12/74 |
| `returnRequests[].refund` | `Object` | 12/74 |
| `returnRequests[].refund.accountHolder` | `String` | 12/74 |
| `returnRequests[].refund.accountNumber` | `String` | 12/74 |
| `returnRequests[].refund.approvedAmount` | `Number` | 12/74 |
| `returnRequests[].refund.bankName` | `String` | 12/74 |
| `returnRequests[].refund.failureReason` | `String` | 11/74 |
| `returnRequests[].refund.notes` | `String` | 12/74 |
| `returnRequests[].refund.refundedAmount` | `Number` | 12/74 |
| `returnRequests[].refund.refundedAt` | `Date | Null` | 12/74 |
| `returnRequests[].refund.requestedAmount` | `Number` | 12/74 |
| `returnRequests[].refund.status` | `String` | 12/74 |
| `returnRequests[].refund.transactionId` | `String` | 12/74 |
| `returnRequests[].refundMethod` | `String` | 12/74 |
| `returnRequests[].rejectionReason` | `String` | 11/74 |
| `returnRequests[].requestId` | `String` | 12/74 |
| `returnRequests[].requestedAt` | `Date` | 12/74 |
| `returnRequests[].returnShipping` | `Object` | 12/74 |
| `returnRequests[].returnShipping.carrier` | `String` | 12/74 |
| `returnRequests[].returnShipping.instructions` | `String` | 12/74 |
| `returnRequests[].returnShipping.notes` | `String` | 1/74 |
| `returnRequests[].returnShipping.receivedAt` | `Date | Null` | 12/74 |
| `returnRequests[].returnShipping.receivedNote` | `String` | 1/74 |
| `returnRequests[].returnShipping.shippedAt` | `Date | Null` | 12/74 |
| `returnRequests[].returnShipping.trackingCode` | `String` | 12/74 |
| `returnRequests[].status` | `String` | 12/74 |
| `reviewedAt` | `Date | Null` | 31/74 |
| `sessionId` | `String` | 5/74 |
| `shippedAt` | `Date | Null` | 49/74 |
| `shipping` | `Object` | 67/74 |
| `shipping.carrier` | `String` | 5/74 |
| `shipping.deliveredAt` | `Date | Null` | 67/74 |
| `shipping.estimatedDeliveryDate` | `Date | Null` | 62/74 |
| `shipping.fee` | `Number` | 5/74 |
| `shipping.method` | `String` | 67/74 |
| `shipping.provider` | `String` | 66/74 |
| `shipping.shippedAt` | `Date | Null` | 62/74 |
| `shipping.trackingCode` | `String` | 5/74 |
| `shipping.trackingNumber` | `String` | 66/74 |
| `shippingAddress` | `Object` | 74/74 |
| `shippingAddress.address` | `String` | 74/74 |
| `shippingAddress.addressDetail` | `String` | 48/74 |
| `shippingAddress.city` | `String` | 30/74 |
| `shippingAddress.country` | `String` | 25/74 |
| `shippingAddress.district` | `String` | 74/74 |
| `shippingAddress.districtCode` | `String` | 48/74 |
| `shippingAddress.districtName` | `String` | 48/74 |
| `shippingAddress.fullName` | `String` | 74/74 |
| `shippingAddress.phone` | `String` | 74/74 |
| `shippingAddress.province` | `String` | 74/74 |
| `shippingAddress.provinceCode` | `String` | 48/74 |
| `shippingAddress.provinceName` | `String` | 48/74 |
| `shippingAddress.ward` | `String` | 74/74 |
| `shippingAddress.wardCode` | `String` | 48/74 |
| `shippingAddress.wardName` | `String` | 48/74 |
| `shippingAddress.zip` | `String` | 25/74 |
| `shippingFee` | `Number` | 74/74 |
| `shippingLogs` | `Array` | 52/74 |
| `shippingLogs[]` | `Object` | 2/74 |
| `shippingLogs[].description` | `String` | 2/74 |
| `shippingLogs[].location` | `String` | 2/74 |
| `shippingLogs[].status` | `String` | 2/74 |
| `shippingLogs[].timestamp` | `Date` | 2/74 |
| `shippingMethodId` | `Null | ObjectId` | 63/74 |
| `shippingMethodSnapshot` | `Null | Object` | 63/74 |
| `shippingMethodSnapshot.code` | `String` | 61/74 |
| `shippingMethodSnapshot.estimatedDeliveryTime` | `String` | 61/74 |
| `shippingMethodSnapshot.fee` | `Number` | 61/74 |
| `shippingMethodSnapshot.name` | `String` | 61/74 |
| `shippingProvider` | `String` | 66/74 |
| `status` | `String` | 74/74 |
| `statusHistory` | `Array` | 69/74 |
| `statusHistory[]` | `Object` | 69/74 |
| `statusHistory[].changedAt` | `Date` | 5/74 |
| `statusHistory[].note` | `String` | 69/74 |
| `statusHistory[].status` | `String` | 69/74 |
| `statusHistory[].updatedAt` | `Date | String` | 68/74 |
| `statusHistory[].updatedBy` | `Null | ObjectId | String` | 64/74 |
| `subtotal` | `Number` | 74/74 |
| `taxAmount` | `Number` | 67/74 |
| `totalAmount` | `Number` | 74/74 |
| `trackingNumber` | `String` | 66/74 |
| `trackingUrl` | `String` | 52/74 |
| `transactionId` | `String` | 62/74 |
| `type` | `String` | 6/74 |
| `updatedAt` | `Date | String` | 74/74 |
| `userId` | `Null | ObjectId` | 73/74 |

## `products`

> Sản phẩm: thông tin, giá, tồn kho, hình ảnh, biến thể, danh mục.

- **Documents**: 99  
- **Sampled**: 99  
- **Fields**: 68  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `IdF` | `Number` | 98/99 |
| `__v` | `Number` | 99/99 |
| `_id` | `ObjectId` | 99/99 |
| `attributes` | `Object` | 98/99 |
| `attributes.classifications` | `Array` | 98/99 |
| `attributes.classifications[]` | `String` | 97/99 |
| `attributes.colors` | `Array` | 98/99 |
| `attributes.colors[]` | `Object` | 97/99 |
| `attributes.colors[].hex` | `String` | 97/99 |
| `attributes.colors[].name` | `String` | 97/99 |
| `attributes.sizes` | `Array` | 98/99 |
| `attributes.sizes[]` | `String` | 97/99 |
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
| `quantity` | `Number` | 13/99 |
| `rating` | `Number` | 99/99 |
| `reviewCount` | `Number` | 99/99 |
| `sk` | `Object` | 99/99 |
| `sk.visibility` | `Boolean` | 99/99 |
| `stock` | `Number` | 5/99 |
| `tags` | `Array` | 99/99 |
| `tags[]` | `String` | 98/99 |
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
| `vi.descriptionFull[]` | `String` | 98/99 |
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
- **Fields**: 25  

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
| `parentId` | `Null` | 4/4 |
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

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 11  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 2/2 |
| `code` | `String` | 2/2 |
| `createdAt` | `String` | 2/2 |
| `description` | `String` | 2/2 |
| `isActive` | `Boolean` | 2/2 |
| `name` | `String` | 2/2 |
| `paymentInfo` | `String` | 2/2 |
| `paymentType` | `String` | 2/2 |
| `status` | `String` | 2/2 |
| `type` | `String` | 2/2 |
| `updatedAt` | `String` | 2/2 |

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

- **Documents**: 44  
- **Sampled**: 44  
- **Fields**: 3  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `String` | 44/44 |
| `expires` | `Date` | 44/44 |
| `session` | `String` | 44/44 |

## `notification-popup`

> Thông báo popup hiển thị cho người dùng.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 18  

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
| `items[]` | `String` | 1/10 |
| `level` | `String` | 10/10 |
| `message` | `String` | 10/10 |
| `readAt` | `Date | Null` | 10/10 |
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
| `projectId` | `Null | ObjectId` | 3/3 |
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
| `publishedAt` | `Date | Null` | 2/2 |
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
- **Fields**: 103  

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
| `sections[].media.mobile` | `Null` | 1/1 |
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
| `sections[].typography.body.textAlign` | `String` | 1/1 |
| `sections[].typography.button` | `Object` | 1/1 |
| `sections[].typography.button.fontFamily` | `String` | 1/1 |
| `sections[].typography.button.fontSize` | `Number` | 1/1 |
| `sections[].typography.button.fontWeight` | `Number` | 1/1 |
| `sections[].typography.button.letterSpacing` | `Number` | 1/1 |
| `sections[].typography.button.lineHeight` | `Number` | 1/1 |
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
| `sections[].typography.heading.textAlign` | `String` | 1/1 |
| `sections[].typography.preset` | `String` | 1/1 |
| `sections[].typography.quote` | `Object` | 1/1 |
| `sections[].typography.quote.fontFamily` | `String` | 1/1 |
| `sections[].typography.quote.fontSize` | `Number` | 1/1 |
| `sections[].typography.quote.fontWeight` | `Number` | 1/1 |
| `sections[].typography.quote.letterSpacing` | `Number` | 1/1 |
| `sections[].typography.quote.lineHeight` | `Number` | 1/1 |
| `sections[].typography.quote.textAlign` | `String` | 1/1 |
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

- **Documents**: 4  
- **Sampled**: 4  
- **Fields**: 13  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 4/4 |
| `_id` | `ObjectId` | 4/4 |
| `comment` | `String` | 4/4 |
| `createdAt` | `Date` | 4/4 |
| `isVerifiedPurchase` | `Boolean` | 4/4 |
| `orderId` | `String` | 4/4 |
| `productId` | `ObjectId` | 4/4 |
| `rating` | `Number` | 4/4 |
| `status` | `String` | 4/4 |
| `updatedAt` | `Date` | 4/4 |
| `userAvatar` | `String` | 4/4 |
| `userId` | `ObjectId` | 4/4 |
| `userName` | `String` | 4/4 |

## `user_interactions`

> Nhật ký tương tác hành vi người dùng (view, add_to_cart, purchase, wishlist) phục vụ AI / Machine Learning gợi ý sản phẩm (Recommendation System).

- **Documents**: 794  
- **Sampled**: 500  
- **Fields**: 20  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 390/500 |
| `_id` | `ObjectId` | 500/500 |
| `datasetType` | `String` | 247/500 |
| `eventType` | `String` | 500/500 |
| `isSynthetic` | `Boolean` | 500/500 |
| `metadata` | `Object` | 500/500 |
| `metadata.generator` | `String` | 110/500 |
| `metadata.isSynthetic` | `Boolean` | 500/500 |
| `metadata.price` | `Number` | 15/500 |
| `metadata.quantity` | `Number` | 15/500 |
| `metadata.seed` | `Number` | 110/500 |
| `metadata.simulatedAt` | `String` | 110/500 |
| `metadata.source` | `String` | 390/500 |
| `metadata.userAgent` | `String` | 375/500 |
| `orderId` | `Null | String` | 247/500 |
| `productId` | `ObjectId` | 500/500 |
| `sessionId` | `Null | String` | 500/500 |
| `timestamp` | `Date` | 500/500 |
| `userId` | `Null | ObjectId` | 500/500 |
| `variantId` | `Null | String` | 390/500 |

## `ml_bootstrap_interactions`

> Dữ liệu tương tác mẫu (bootstrap/synthetic interaction) huấn luyện mô hình ML Recommendation khi hệ thống chưa đủ tương tác thực tế.

- **Documents**: 3264  
- **Sampled**: 500  
- **Fields**: 14  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 500/500 |
| `datasetType` | `String` | 500/500 |
| `eventType` | `String` | 500/500 |
| `isSynthetic` | `Boolean` | 500/500 |
| `metadata` | `Object` | 500/500 |
| `metadata.datasetType` | `String` | 500/500 |
| `metadata.isSynthetic` | `Boolean` | 500/500 |
| `metadata.persona` | `String` | 500/500 |
| `metadata.seed` | `Number` | 500/500 |
| `metadata.viewIndex` | `Number` | 500/500 |
| `productId` | `ObjectId` | 500/500 |
| `sessionId` | `String` | 500/500 |
| `timestamp` | `Date` | 500/500 |
| `userId` | `String` | 500/500 |

## `passwordresets`

> Token đặt lại mật khẩu (email, token, hết hạn).

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 14  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 2/2 |
| `_id` | `ObjectId` | 2/2 |
| `attempts` | `Number` | 2/2 |
| `createdAt` | `Date` | 2/2 |
| `email` | `String` | 2/2 |
| `expiresAt` | `Date` | 2/2 |
| `otpExpiresAt` | `Date` | 1/2 |
| `otpHash` | `String` | 2/2 |
| `otpLockUntil` | `Date` | 1/2 |
| `otpRequestCount` | `Number` | 1/2 |
| `resetTokenExpiresAt` | `Null` | 2/2 |
| `resetTokenHash` | `Null` | 2/2 |
| `updatedAt` | `Date` | 2/2 |
| `verified` | `Boolean` | 2/2 |

## `configs`

> Cấu hình hệ thống nội bộ (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*(Collection trống, chưa có document)*

## `themes`

> Theme giao diện website (reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*(Collection trống, chưa có document)*

## `product_variants`

> Biến thể sản phẩm độc lập (deprecated/reserved).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*(Collection trống, chưa có document)*

## `shipping_methods`

> Phương thức vận chuyển (alias/deprecated, dùng shippingmethods).

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*(Collection trống, chưa có document)*

## `orders_backup_20261005`

> Backup đơn hàng trước migration ngày 05/10/2026.

- **Documents**: 10  
- **Sampled**: 10  
- **Fields**: 140  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 1/10 |
| `_id` | `ObjectId` | 10/10 |
| `_user` | `Null | ObjectId` | 9/10 |
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
| `deliveredAt` | `Date | Null` | 9/10 |
| `discountAmount` | `Number` | 9/10 |
| `estimatedDeliveryDate` | `Date | Null` | 9/10 |
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
| `items[].variantId` | `Null` | 9/10 |
| `notes` | `String` | 10/10 |
| `orderId` | `String` | 10/10 |
| `outcome` | `Object` | 1/10 |
| `outcome.seller_message` | `String` | 1/10 |
| `paidAt` | `Null` | 1/10 |
| `paymentFee` | `Number` | 1/10 |
| `paymentMethodId` | `Null` | 1/10 |
| `paymentMethodSnapshot` | `Null` | 1/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `refundedAt` | `Null` | 1/10 |
| `shippedAt` | `Date | Null` | 9/10 |
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
| `shippingMethodId` | `Null` | 1/10 |
| `shippingMethodSnapshot` | `Null` | 1/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `Null | ObjectId` | 2/10 |
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
| `couponCode` | `Null | String` | 10/10 |
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
| `deliveredAt` | `Date | Null` | 9/10 |
| `discountAmount` | `Number` | 10/10 |
| `estimatedDeliveryDate` | `Date | Null` | 9/10 |
| `items` | `Array` | 10/10 |
| `items[]` | `Object` | 10/10 |
| `items[].image` | `String` | 10/10 |
| `items[].name` | `String` | 10/10 |
| `items[].productId` | `String` | 10/10 |
| `items[].productSnapshot` | `Object` | 10/10 |
| `items[].productSnapshot.brand` | `Null` | 9/10 |
| `items[].productSnapshot.category` | `Null | String` | 9/10 |
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
| `paidAt` | `Null` | 1/10 |
| `payment` | `Object` | 10/10 |
| `payment.method` | `String` | 10/10 |
| `payment.paidAt` | `Date | Null | String` | 10/10 |
| `payment.provider` | `Null | String` | 10/10 |
| `payment.refundedAmount` | `Number` | 10/10 |
| `payment.refundedAt` | `Null` | 10/10 |
| `payment.status` | `String` | 10/10 |
| `payment.transactionId` | `Null` | 10/10 |
| `paymentFee` | `Number` | 10/10 |
| `paymentMethodId` | `Null` | 1/10 |
| `paymentMethodSnapshot` | `Null` | 1/10 |
| `paymentProvider` | `String` | 1/10 |
| `paymentStatus` | `String` | 9/10 |
| `refundedAmount` | `Number` | 1/10 |
| `refundedAt` | `Null` | 1/10 |
| `shippedAt` | `Date | Null` | 9/10 |
| `shipping` | `Object` | 10/10 |
| `shipping.deliveredAt` | `Date | Null | String` | 10/10 |
| `shipping.estimatedDeliveryDate` | `Null` | 10/10 |
| `shipping.method` | `String` | 10/10 |
| `shipping.provider` | `String` | 10/10 |
| `shipping.shippedAt` | `Date | Null | String` | 10/10 |
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
| `shippingMethodId` | `Null` | 1/10 |
| `shippingMethodSnapshot` | `Null` | 1/10 |
| `shippingProvider` | `String` | 9/10 |
| `status` | `String` | 10/10 |
| `statusHistory` | `Array` | 10/10 |
| `statusHistory[]` | `Object` | 10/10 |
| `statusHistory[].note` | `String` | 10/10 |
| `statusHistory[].status` | `String` | 10/10 |
| `statusHistory[].updatedAt` | `Date | String` | 10/10 |
| `statusHistory[].updatedBy` | `Null | ObjectId` | 2/10 |
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

- **Documents**: 9  
- **Sampled**: 9  
- **Fields**: 14  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 9/9 |
| `createdAt` | `Date` | 9/9 |
| `guestCartId` | `String` | 9/9 |
| `items` | `Array` | 9/9 |
| `items[]` | `Object` | 8/9 |
| `items[].id` | `String` | 8/9 |
| `items[].isSelected` | `Boolean` | 8/9 |
| `items[].productId` | `String` | 8/9 |
| `items[].qty` | `Number` | 8/9 |
| `items[].selectedClassification` | `Null | String` | 8/9 |
| `items[].selectedColor` | `Null | String` | 8/9 |
| `items[].selectedSize` | `Null | String` | 8/9 |
| `items[].variantId` | `Null | String` | 8/9 |
| `updatedAt` | `Date` | 9/9 |

## `payment_transactions`

> Nhật ký giao dịch thanh toán trực tuyến / cổng thanh toán (mã giao dịch, trạng thái, số tiền, phương thức, VNPay/Stripe).

- **Documents**: 24  
- **Sampled**: 24  
- **Fields**: 15  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 24/24 |
| `_id` | `ObjectId` | 24/24 |
| `amount` | `Number` | 24/24 |
| `createdAt` | `Date` | 24/24 |
| `currency` | `String` | 24/24 |
| `failureReason` | `String` | 24/24 |
| `method` | `String` | 24/24 |
| `orderCode` | `String` | 24/24 |
| `orderId` | `ObjectId` | 24/24 |
| `paidAt` | `Date | Null` | 24/24 |
| `paymentLink` | `String` | 24/24 |
| `provider` | `String` | 24/24 |
| `providerTransactionId` | `String` | 24/24 |
| `status` | `String` | 24/24 |
| `updatedAt` | `Date` | 24/24 |

## `newsletter_subscribers`

> Danh sách khách hàng và khách vãng lai đăng ký nhận bản tin ưu đãi (email, trạng thái SUBSCRIBED/UNSUBSCRIBED, nguồn đăng ký, thời gian).

- **Documents**: 2  
- **Sampled**: 2  
- **Fields**: 8  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 2/2 |
| `_id` | `ObjectId` | 2/2 |
| `createdAt` | `Date` | 2/2 |
| `email` | `String` | 2/2 |
| `source` | `String` | 2/2 |
| `status` | `String` | 2/2 |
| `subscribedAt` | `Date` | 2/2 |
| `updatedAt` | `Date` | 2/2 |

## `conversations`

> Phiên hội thoại hỗ trợ khách hàng với nhân viên (trạng thái WAITING_ADMIN, IN_PROGRESS, CLOSED, thông tin khách, phân công admin, yêu cầu hủy 5s).

- **Documents**: 13  
- **Sampled**: 13  
- **Fields**: 28  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 12/13 |
| `_id` | `ObjectId` | 13/13 |
| `acceptedAt` | `Date | Null` | 13/13 |
| `adminLastReadAt` | `Date` | 13/13 |
| `assignedAdminId` | `Null | ObjectId` | 13/13 |
| `cancelRequest` | `Object` | 6/13 |
| `cancelRequest._id` | `ObjectId` | 6/13 |
| `cancelRequest.expiresAt` | `Date` | 6/13 |
| `cancelRequest.requestedAt` | `Date` | 6/13 |
| `cancelRequest.status` | `String` | 6/13 |
| `channel` | `String` | 13/13 |
| `closedAt` | `Date | Null` | 12/13 |
| `createdAt` | `Date` | 13/13 |
| `customerLastReadAt` | `Date | Null` | 12/13 |
| `guestId` | `Null | String` | 13/13 |
| `internalNote` | `String` | 13/13 |
| `internalNoteUpdatedAt` | `Date | Null` | 12/13 |
| `internalNoteUpdatedBy` | `Null` | 12/13 |
| `lastMessageAt` | `Date` | 13/13 |
| `lastMessageId` | `ObjectId` | 13/13 |
| `lastMessagePreview` | `String` | 13/13 |
| `requestedAt` | `Date` | 13/13 |
| `source` | `String` | 13/13 |
| `status` | `String` | 13/13 |
| `unreadAdminCount` | `Number` | 13/13 |
| `unreadCustomerCount` | `Number` | 13/13 |
| `updatedAt` | `Date` | 13/13 |
| `userId` | `Null | ObjectId` | 13/13 |

## `conversation_messages`

> Tin nhắn trong cuộc hội thoại hỗ trợ giữa khách hàng, nhân viên admin và hệ thống (CUSTOMER, ADMIN, SYSTEM, timestamp, systemEvent).

- **Documents**: 75  
- **Sampled**: 75  
- **Fields**: 17  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 50/75 |
| `_id` | `ObjectId` | 75/75 |
| `adminContent` | `Null | String` | 24/75 |
| `attachments` | `Array` | 50/75 |
| `clientMessageId` | `Null | String` | 51/75 |
| `content` | `String` | 75/75 |
| `conversationId` | `ObjectId` | 75/75 |
| `createdAt` | `Date` | 75/75 |
| `messageType` | `String` | 75/75 |
| `orderRefId` | `Null` | 50/75 |
| `productReferences` | `Array` | 50/75 |
| `readByAdminAt` | `Date | Null` | 50/75 |
| `readByCustomerAt` | `Date | Null` | 51/75 |
| `senderId` | `Null | ObjectId` | 51/75 |
| `senderType` | `String` | 75/75 |
| `systemEvent` | `Null | String` | 55/75 |
| `updatedAt` | `Date` | 75/75 |

## `chatbot_sessions`

> Phiên trò chuyện của người dùng với AI Assistant / Chatbot Chéri (lịch sử tin nhắn, sessionId, guestId, ngữ cảnh tư vấn).

- **Documents**: 8  
- **Sampled**: 8  
- **Fields**: 45  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 8/8 |
| `_id` | `ObjectId` | 8/8 |
| `context` | `Object` | 8/8 |
| `context.criteria` | `Object` | 1/8 |
| `context.criteria.category` | `String` | 1/8 |
| `context.criteria.onlyInStock` | `Boolean` | 1/8 |
| `context.criteria.queryText` | `String` | 1/8 |
| `context.lastIntent` | `String` | 8/8 |
| `context.lastMentionedProductId` | `String` | 1/8 |
| `context.lastProducts` | `Array` | 8/8 |
| `context.lastProducts[]` | `Object` | 1/8 |
| `context.lastProducts[].availableColors` | `Array` | 1/8 |
| `context.lastProducts[].availableColors[]` | `String` | 1/8 |
| `context.lastProducts[].availableSizes` | `Array` | 1/8 |
| `context.lastProducts[].availableSizes[]` | `String` | 1/8 |
| `context.lastProducts[].category` | `String` | 1/8 |
| `context.lastProducts[].colors` | `Array` | 1/8 |
| `context.lastProducts[].colors[]` | `String` | 1/8 |
| `context.lastProducts[].id` | `String` | 1/8 |
| `context.lastProducts[].imageUrl` | `String` | 1/8 |
| `context.lastProducts[].inStock` | `Boolean` | 1/8 |
| `context.lastProducts[].onSale` | `Boolean` | 1/8 |
| `context.lastProducts[].originalPrice` | `Number` | 1/8 |
| `context.lastProducts[].price` | `Number` | 1/8 |
| `context.lastProducts[].sizes` | `Array` | 1/8 |
| `context.lastProducts[].sizes[]` | `String` | 1/8 |
| `context.lastProducts[].stockSummary` | `String` | 1/8 |
| `context.lastProducts[].title` | `String` | 1/8 |
| `context.lastProducts[].titleUrl` | `String` | 1/8 |
| `context.sizingProfile` | `Object` | 2/8 |
| `context.sizingProfile.height` | `Number` | 1/8 |
| `context.sizingProfile.weight` | `Number` | 2/8 |
| `createdAt` | `Date` | 8/8 |
| `expiresAt` | `Date` | 8/8 |
| `isActive` | `Boolean` | 8/8 |
| `messages` | `Array` | 8/8 |
| `messages[]` | `Object` | 8/8 |
| `messages[]._id` | `ObjectId` | 8/8 |
| `messages[].content` | `String` | 8/8 |
| `messages[].intent` | `String` | 8/8 |
| `messages[].role` | `String` | 8/8 |
| `messages[].timestamp` | `Date` | 8/8 |
| `sessionId` | `String` | 8/8 |
| `updatedAt` | `Date` | 8/8 |
| `userId` | `ObjectId` | 4/8 |

## `chat_rate_limits`

> Giới hạn tần suất gửi tin nhắn chat của người dùng / IP để chống spam và tấn công DoS.

- **Documents**: 0  
- **Sampled**: 0  
- **Fields**: 0  

*(Collection trống, chưa có document)*

## `social_links`

> Cấu hình liên kết mạng xã hội chính thức của Chéri (Facebook, Instagram, TikTok, YouTube, URL, thứ tự hiển thị, trạng thái hoạt động).

- **Documents**: 3  
- **Sampled**: 3  
- **Fields**: 6  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `ObjectId` | 3/3 |
| `createdAt` | `Date` | 3/3 |
| `isActive` | `Boolean` | 3/3 |
| `platform` | `String` | 3/3 |
| `updatedAt` | `Date` | 3/3 |
| `url` | `String` | 3/3 |

## `recommendation_impressions`

> Nhật ký lượt hiển thị sản phẩm gợi ý ML đến người dùng (sessionId, productId, algorithm, rank, timestamp) phục vụ đo lường CTR và tối ưu hóa mô hình gợi ý.

- **Documents**: 489  
- **Sampled**: 489  
- **Fields**: 10  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `__v` | `Number` | 489/489 |
| `_id` | `ObjectId` | 489/489 |
| `currentProductId` | `String` | 489/489 |
| `productId` | `ObjectId` | 489/489 |
| `recommendationContextId` | `Null | String` | 321/489 |
| `sessionId` | `String` | 489/489 |
| `shownAt` | `Date` | 489/489 |
| `strategy` | `String` | 489/489 |
| `userId` | `Null | ObjectId` | 489/489 |
| `userKey` | `String` | 489/489 |

## `counters`

> Bộ đếm tự tăng (sequence / counter) phục vụ sinh mã số tự động trong hệ thống.

- **Documents**: 1  
- **Sampled**: 1  
- **Fields**: 3  

| Field (path) | Type | Frequency |
|-------------|------|----------|
| `_id` | `String` | 1/1 |
| `seq` | `Number` | 1/1 |
| `updatedAt` | `Date` | 1/1 |

