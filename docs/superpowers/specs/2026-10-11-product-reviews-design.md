# Thiết kế đánh giá và rating sản phẩm

Ngày: 2026-10-11. Nhánh: `feature/product-reviews`.
Baseline đã kiểm tra: `origin/main` tại `ed6ee42`.
Trạng thái: người dùng đã duyệt spec ngày 2026-10-11; implementation plan chờ duyệt trước khi thực thi.

## 1. Mục tiêu và phạm vi đã duyệt

Cho khách đã đăng nhập đánh giá đúng sản phẩm đã mua, lưu thật vào MongoDB và hiển thị rating từ các đánh giá thực tế. Mỗi user có một đánh giá cho mỗi product và được chỉnh sửa. Đơn đã thanh toán HOẶC đã giao thành công đủ điều kiện; loại trừ đơn đã hủy, hoàn trả hoặc hoàn tiền toàn bộ. Không tự thêm giới hạn đánh giá 30 ngày.

Trang chủ hiển thị một dòng nhỏ dưới tên từng sản phẩm. Chi tiết sản phẩm hiển thị một dòng nhỏ dưới tên, có sao và liên kết đến khu vực đánh giá. Gửi/sửa thành công cập nhật ngay danh sách, điểm trung bình và số lượng, không tải lại toàn bộ trang.

### Ràng buộc chung

- Giữ nguyên logic chọn biến thể, tồn kho, giá, số lượng và thêm vào giỏ hàng.
- Đánh giá gắn với product, không gắn với variant, trừ khi cấu trúc MongoDB hiện hữu đã thiết kế khác; khi phát hiện khác biệt phải trình lại thiết kế trước khi triển khai.
- Tái sử dụng cấu trúc/model đánh giá hiện hữu nếu có; không tạo collection/schema trùng lặp.
- Không hardcode review/rating, không dùng API AI bên ngoài, không thêm dependency mới cho chức năng này.
- Không sửa hoặc commit cấu hình MongoDB local của người dùng.
- Không lưu tài khoản, mật khẩu, token, connection string hoặc thông tin cá nhân của khách hàng vào tài liệu, test fixture hay Git.
- Chưa ghi dữ liệu MongoDB khi đang thiết kế/lập plan. Khi triển khai chỉ kiểm thử ghi trên database phát triển đã được xác nhận; không sửa trạng thái đơn thật để tạo điều kiện đánh giá.
- Worktree riêng: `.worktrees/product-reviews`; các thay đổi ngoài phạm vi được giữ nguyên.

Ngoài phạm vi: ảnh/video đánh giá, kiểm duyệt đánh giá, phản hồi của admin, đánh giá đơn hàng, tự liên kết đơn khách vãng lai, chức năng tìm kiếm ảnh và các tính năng quản trị khác.

## 2. Hiện trạng và giới hạn bằng chứng

Trong code baseline chưa tìm thấy model/service/API lưu review. Product có `rating` mặc định 5, chưa đủ bằng chứng để coi là trung bình đánh giá. Nút “Đánh giá” ở trang tài khoản hiện là placeholder, chỉ hiện cho đơn giao thành công và chưa có handler. Mốc 30 ngày chỉ là hiển thị cũ, không phải chính sách backend.

Snapshot schema trong repo không liệt kê collection review. Đây không phải kiểm tra MongoDB đang chạy; ProductSchema còn dùng `strict: false`, nên dữ liệu thật có thể chứa trường chưa được mô tả.

Điểm tích hợp đã xác định:

- `server/src/products/schemas/product.schema.ts`: ProductSchema hiện hữu.
- `server/src/products/products.module.ts`, `products.controller.ts`: tích hợp review vào API storefront NestJS.
- `server/src/orders/schemas/order.schema.ts`: tái sử dụng OrderSchema để xác minh giao dịch.
- `server/src/shared/utils/prepareUtils.ts`: đưa summary đánh giá vào response product.
- `client/src/app/user/pages/product/product/product.component.*`, `product.module.ts`: trang chi tiết dùng NgModule, không chuyển sang standalone.
- `client/src/app/user/pages/cheri/home/home.component.*`: card trang chủ có nhiều nhánh slider/grid/fallback; tất cả cần cùng cách hiển thị rating.
- `client/src/app/store/signal.store.ts`: cập nhật summary mà không gọi lại luồng chuẩn bị product/variant.
- Trang tài khoản hiện hữu: nối nút “Đánh giá” đến đúng sản phẩm.

## 3. Lựa chọn lưu trữ

Đầu tiên kiểm tra chỉ đọc database phát triển: tên collection, trường review, kiểu ID, index và cấu trúc đơn. Chỉ ghi nhận metadata cần thiết, không dump khách hàng hoặc toàn bộ document. Nếu có cấu trúc review phù hợp, tái sử dụng; nếu hợp đồng khác tài liệu này, dừng để cập nhật thiết kế và xin duyệt, không tạo cấu trúc song song.

Nếu chưa có cấu trúc đánh giá, lựa chọn đã duyệt là mảng `reviews` trong collection Product hiện hữu. Không tạo collection Review. Phương án collection riêng thuận lợi khi lượng đánh giá lớn nhưng chưa chọn cho phạm vi này.

Mỗi review gồm ID nội bộ, `userId` tham chiếu User, `rating`, `comment`, `createdAt`, `updatedAt`. Tên người đánh giá do server lấy từ User; response công khai không chứa email, userId, orderId, token hoặc dữ liệu thanh toán. Không có variantId trong cấu trúc mới.

`rating` là số nguyên 1–5; `comment` là văn bản thuần, trim trước khi lưu, dài 1–1000 ký tự. Không nhận userId/tên tác giả/thời gian/điểm trung bình do client cung cấp; DTO từ chối trường ngoài hợp đồng. ID sản phẩm phải hợp lệ.

Sử dụng một cập nhật MongoDB nguyên tử trên Product để thêm hoặc thay thế review của user, đồng thời tính lại trung bình và số lượng từ mảng sau cập nhật. Không dùng luồng đọc-kiểm tra-rồi-push; unique index multikey không bảo đảm duy nhất trong cùng một mảng. Chỉnh sửa giữ nguyên ID và `createdAt`, chỉ cập nhật nội dung, sao và `updatedAt`. Gửi đồng thời vẫn chỉ có một review/user/product; lần ghi cuối là kết quả cuối.

Nếu dùng update pipeline, phải tự validate/cast trước khi ghi và dùng giá trị literal cho nội dung người dùng, không dựa vào validation/casting tự động của Mongoose pipeline. Không cần transaction nhiều document cho phương án embedded. Với mảng lớn có giới hạn kích thước document MongoDB; thiết kế này phù hợp quy mô hiện tại, không tự mở rộng sang collection mới.

Summary chuẩn: `{ average: number | null, count: number }`; trung bình không làm tròn khi lưu/tính, UI làm tròn một chữ số thập phân. Khi không có review: `average: null`, `count: 0`; không biến rating mặc định 5 thành đánh giá thật. Sau ghi, cập nhật trường Product `rating` cho sort/filter hiện hữu; response summary luôn được tính từ review thật. Đường chỉnh sửa/import sản phẩm không được cho phép ghi đè trường review/summary do client admin gửi lên.

## 4. Điều kiện đánh giá và bảo mật

Backend là nơi quyết định quyền, áp dụng cho cả tạo mới và chỉnh sửa:

1. Xác thực bằng JWT hiện hữu và lấy user từ `GetUser`, không từ request body.
2. Tìm đơn sở hữu qua `userId` hoặc `_user` của user, tương thích String/ObjectId theo dữ liệu thật.
3. Cùng một đơn phải chứa đúng product trong `items[].productId`; hỗ trợ cấu trúc `cart` legacy chỉ sau khi kiểm tra đúng hình dạng dữ liệu. Variant mua khác nhau vẫn quy về product.
4. Loại đơn `CANCELLED`/legacy `CANCELED`, `RETURNED` hoặc payment `REFUNDED` toàn bộ.
5. Những đơn còn lại đủ điều kiện nếu payment `PAID` HOẶC status `DELIVERED`/legacy `COMPLETED`.

Ưu tiên `paymentStatus` hiện hữu; chỉ fallback `payment.status` khi trường chính thiếu, không để nested PAID cũ lấn át trạng thái chính mới. Hoàn tiền một phần không tự loại đơn: vẫn cần đạt điều kiện PAID hoặc DELIVERED. Nếu có nhiều đơn, chỉ cần một đơn thỏa mọi điều kiện trên.

Không cấp quyền dựa vào email trùng nhau, orderId client đưa vào, variantId hoặc sản phẩm mua bởi người khác. Không có ngoại lệ cho admin. Khi đơn không còn đủ điều kiện, review đã lưu vẫn được đọc, nhưng không cho gửi/sửa tiếp nếu không có đơn khác hợp lệ.

## 5. Hợp đồng API

Các route mới trong API storefront, không nhân đôi sang `server/admin-server.js`. Product ID là `_id` canonical, không phải slug hoặc variantId.

- `GET /api/products/:productId/reviews?page=1&pageSize=10`: công khai, trả `productId`, `summary`, `reviews`, `page`, `pageSize`, `total`; mỗi review công khai chỉ có ID review, tên hiển thị, rating, comment và thời gian. Mới nhất trước; thứ tự phụ bằng ID để ổn định. Page nguyên dương, pageSize 1–50. Sản phẩm bị ẩn không được truy cập vòng qua API review.
- `GET /api/products/:productId/reviews/me`: JWT bắt buộc, trả `productId`, `eligible`, `reason`, `myReview`; reason là `ELIGIBLE` hoặc `NOT_PURCHASED`. myReview chỉ thuộc user đã xác thực.
- `PUT /api/products/:productId/reviews/me`: JWT bắt buộc, body chỉ `{ rating, comment }`, tạo/sửa review của chính user. Thành công HTTP 200 trả `productId`, `myReview`, `summary`, và trang đầu danh sách đã lưu cùng metadata phân trang, để UI cập nhật ngay từ kết quả server.

Lỗi thống nhất: 400 dữ liệu/ID/phân trang sai; 401 chưa đăng nhập hoặc hết phiên; 403 không có đơn đủ điều kiện; 404 sản phẩm không tồn tại/không khả dụng; 5xx lỗi hệ thống/database. Không lộ stack trace hoặc connection string. GET me trả 200 với eligible false cho user chưa mua, không coi trạng thái UI bình thường là lỗi hệ thống.

## 6. Giao diện và cập nhật trạng thái

Tách component summary nhỏ dùng chung và component khu vực review phụ trách danh sách, quyền gửi, form và trạng thái request. API client dùng URL storefront/interceptor xác thực hiện hữu, không dùng API admin hoặc scheme đăng nhập mới.

Trang chủ: dưới tên từng sản phẩm, một dòng gọn như `4,8/5 · 12 đánh giá`; không bắt buộc sao ở trang chủ. Summary đi cùng response danh sách sản phẩm, không tạo một request cho từng card. Áp dụng tất cả card slider/grid/fallback hiện có, không sửa cấu hình nội dung trang chủ.

Chi tiết: dưới tên, một dòng gồm năm sao biểu diễn tỷ lệ điểm (có phần sao), điểm một chữ số thập phân và số đánh giá. Dòng này là nút/liên kết có thể dùng bàn phím, đưa focus/cuộn tới khu vực review trong popup hiện hữu. Sao trang trí được ẩn khỏi screen reader, điểm đọc bằng text. Không có review hiển thị `Chưa có đánh giá`, không hiển thị sao được tô như đã có điểm.

Khu vực review: mọi người đọc được danh sách công khai; khách chưa đăng nhập thấy nút đăng nhập có returnUrl; user chưa mua thấy giải thích và không có form gửi; user đủ điều kiện chọn 1–5 sao và nhập nội dung. Nếu đã đánh giá, điền sẵn review và nút `Cập nhật đánh giá`; lần đầu nút `Gửi đánh giá`. Không hiển thị email tác giả, không render comment dưới dạng HTML.

Trong khi gửi khóa thao tác gửi trùng. Chỉ báo thành công sau khi server xác nhận ghi; cập nhật danh sách/summary từ response, không tạo dữ liệu thành công giả. Cập nhật summary của product hiện tại và những card cùng product trong state/cache đã tải, kể cả dữ liệu section trang chủ; không gọi lại toàn bộ `getProduct` làm reset variant hoặc số lượng. Product khác không bị sửa.

Request cũ sau đổi product/đăng xuất/đổi user phải bị hủy hoặc bỏ qua dựa vào cả product và phiên user; không để kết quả product A ghi sang B hoặc form của user trước hiện cho user sau. Request summary/list khởi tạo không được ghi đè kết quả mới sau PUT.

Đủ trạng thái: loading, danh sách rỗng, chưa đăng nhập, đang kiểm tra quyền, chưa mua, hợp lệ để gửi, đang gửi, thành công, validation lỗi, lỗi tải/API. 401 dẫn về đăng nhập, 403 cập nhật quyền và giải thích; lỗi mạng/5xx giữ bản nháp và cho thử lại. Lỗi tải review hiển thị lỗi chứ không giả `Chưa có đánh giá`. Giao diện gọn trên mobile, không thay đổi bố cục mua hàng hoặc xử lý biến thể.

Nút đánh giá trong trang tài khoản áp dụng PAID hoặc DELIVERED cùng loại trừ đã thống nhất. Nếu đơn có nhiều product, cho chọn từng sản phẩm; gộp các variant cùng product, dẫn đến trang chi tiết đúng sản phẩm và khu vực review, không tạo form đánh giá đơn riêng. Không dùng query chứa email/userId/orderId. Backend vẫn kiểm tra lại quyền khi gửi.

## 7. Kiểm thử và tiêu chí nghiệm thu

Plan tiếp theo phải có test trước implementation cho từng phần:

- Quyền: khách không đăng nhập; user khác sở hữu đơn; chỉ mua product khác; đơn chưa thanh toán/chưa giao; PAID trước giao; DELIVERED; CANCELLED, RETURNED, REFUNDED và PARTIALLY_REFUNDED theo quy tắc trên; legacy trạng thái/ID; nhiều đơn và đơn guest không liên kết user.
- Lưu trữ: một review/user/product, sửa không tăng count, giữ createdAt; hai user cho trung bình chính xác; request đồng thời không tạo trùng; rating 0/6/1.5/string, comment rỗng/1001 ký tự/trường ngoài DTO, comment bắt đầu bằng `$` và chứa HTML không thực thi; lỗi ghi không báo thành công.
- API: phân trang và projection công khai không lộ thông tin nhạy cảm, ID sai/không tồn tại, auth hết hạn, sản phẩm ẩn, không bypass quyền qua userId/variantId body.
- UI: dòng rating ở mọi card trang chủ; sao và link chi tiết; trạng thái rỗng/lỗi không nhầm nhau; form tạo/sửa, cập nhật ngay, giữ draft khi lỗi; đổi route/user khi request đang chạy; response GET cũ không đè PUT mới; giữ variant, giá và số lượng sau gửi.
- Hồi quy: product-detail display, order tracking và các test baseline hiện hữu; build client/server; kiểm tra diff chỉ có thay đổi trong phạm vi.
- MongoDB integration trên target phát triển đã xác nhận: gửi, tải lại vẫn còn review; chỉnh sửa vẫn một review; summary đúng; kiểm tra không tạo collection trùng. Nếu chưa kết nối được, ghi rõ phần integration chưa xác minh, không tuyên bố hoàn tất.

Không seed/sửa đơn thật cho tài khoản thử nghiệm. Ca âm dùng fixture tổng hợp. Ca dương dùng đơn đủ điều kiện đã có; tạo fixture persistent riêng chỉ khi người dùng cho phép và phải giới hạn đúng database/document được duyệt.

## 8. Trình tự bàn giao

1. Người dùng duyệt spec này.
2. Dùng `writing-plans` viết plan chi tiết: audit/hợp đồng, quyền và lưu review, API/UI review, summary trang chủ/chi tiết, nối trang tài khoản, kiểm thử tích hợp/hồi quy. Mỗi task có test, file cụ thể, bước kiểm tra và commit tiếng Việt.
3. Người dùng duyệt plan và chọn cách thực thi; sau đó mới cài dependency/chạy baseline và triển khai.
4. Xác nhận target MongoDB trước khi test ghi; giữ cấu hình local ngoài Git. Không push hoặc tạo PR ở bước tài liệu nếu chưa được yêu cầu.
5. Sau khi triển khai và nghiệm thu xong, xóa spec/plan đã hoàn thành trước commit bàn giao theo yêu cầu trước đó của người dùng; không xóa khi công việc còn đang thực hiện.
