# Nghiệm thu đánh giá sản phẩm

Ngày chạy: 14-10-2026. Môi trường: development MongoDB `cheri`, local Angular/ Nest app, Chrome headless qua Chrome DevTools Protocol. Không dùng tài khoản thật; luồng đăng nhập UI dùng hai user tổng hợp với mật khẩu tạo trong bộ nhớ. Không lưu URI, token, mật khẩu, email người dùng hoặc PII trong tài liệu/log.

## Bổ sung sau review toàn nhánh (15-10-2026)

Review độc lập phát hiện hai lỗi quan trọng và đã được sửa trong `24b6cfd` và `51ca97f`: response fallback công khai phải loại mảng review khỏi mọi cấp của `raw` nhưng vẫn trả `reviewSummary`; summary đọc mới phải được lưu trong cache dùng chung để mọi bản sao Product đồng bộ, đồng thời revision ngăn GET cũ ghi đè. Regression kiểm tra cả list/detail fallback, dữ liệu nested, detail top-level `raw`, summary từ người mua khác và request cũ đến muộn.

Sau các sửa đổi: toàn bộ `*.test.cjs` **145 pass, 1 integration skip mặc định, 0 fail**; build server/client và `git diff --check` đều exit 0. Client build vẫn có sáu cảnh báo NG8113 cũ ở các component ngoài task.

## MongoDB thật

Integration opt-in chạy trên collection hiện hữu `users`, `products`, `orders`; `autoIndex` và `autoCreate` tắt. Trước khi insert, harness kiểm tra database/collection/index, ID, email, SKU, title URL và order ID. Harness tạo 5 document tổng hợp (2 user, 1 product, 2 order) có marker riêng của run; `finally` xóa từng document bằng `_id` chính xác kèm marker rồi xác nhận không còn document nào.

Kết quả `node --test server/test/integration/product-reviews-mongo.test.cjs` với ba gate opt-in/target/fixture đã được cấp: **6/6 pass**. Đã xác nhận 10 PUT song song cùng user/product vẫn chỉ tạo một review; rating 5 và 3 cho average 4/count 2; sửa rating đầu thành 1 cho average 2/count 2 và giữ review ID/`createdAt`; service instance mới đọc lại được dữ liệu; `$price` được lưu như chuỗi literal. Danh sách collection và toàn bộ index trước/sau giống nhau, không tạo collection/index Review. Cleanup: 5 tracked, còn 0, từ chối ownership 0, lỗi 0.

## Browser thật

Harness khởi chạy API từ AppModule và frontend build trên các port đã xác nhận trống; dùng Chrome thật ở desktop và viewport 360px. Mongo auto-index/create tắt. Session là memory-only; mọi route ghi ngoài đăng nhập/logout và reviews bị chặn. API/auth/review/product cùng fixture persistence dùng code thật. Các response CMS homepage alternate cho slider/grid/fallback được cấp qua browser interception để kiểm tra layout; không sửa hoặc ghi cấu hình CMS.

Đã đạt:

- Guest đọc được trạng thái rỗng, không có form; Enter trên rating link kích hoạt native button và focus heading đánh giá.
- Đăng nhập UI bình thường: user có đơn PAID trước giao và user có đơn DELIVERED gửi được review; user chưa mua thấy giải thích và không có form.
- Request pending khóa form và chỉ phát một PUT; lưu thành công cập nhật summary ngay; sửa review không tạo bản thứ hai; refresh nạp review hiện có vào form.
- Nội dung HTML được hiển thị như text, không tạo element/thực thi handler.
- Lỗi 400, 401, 403, 500 và network được kiểm tra; draft được giữ, form được mở lại hoặc chuyển sang trạng thái đăng nhập/không đủ điều kiện tương ứng.
- Chọn variant M và quantity 3 trước khi gửi không làm đổi variant, quantity, giá hoặc SKU.
- Trang chủ slider/grid/fallback đều có một dòng summary mỗi card, không gọi API review riêng cho card; summary mới đồng bộ vào các card đang cache. CMS response cho các layout được mô phỏng trong browser harness.
- Rating rỗng và một phần được render đúng, phần sao trang trí có `aria-hidden`; query focus chạy một lần; request cũ không làm lẫn trạng thái khi đổi product; logout trong lúc PUT chờ trở về guest, không còn draft/success riêng tư.
- Review section vừa viewport 360px, không tràn ngang.

Cleanup của browser run: 6 document tổng hợp (2 user, 2 product, 2 order), còn 0, từ chối ownership 0, lỗi 0; collection/index không đổi; Chrome, API/frontend do harness khởi chạy và browser profile tạm đã được dừng/xóa.

## Code và regression

Browser đã xác nhận lỗi zoneless: API trả `eligible=true` và controller state hợp lệ nhưng template chưa cập nhật; một lần `ng.applyChanges` trong chẩn đoán làm form hiện ngay. Ứng dụng dùng `provideZonelessChangeDetection()` trong khi component cập nhật field từ RxJS subscription thủ công. Sửa tối thiểu là gọi `ChangeDetectorRef.markForCheck()` trong subscription trạng thái; regression riêng đỏ trước/sáng sau kiểm tra thông báo render cho eligibility, submit pending và lỗi giữ draft. Browser run cuối xác nhận form hiện mà không cần repaint thủ công.

Verification cuối:

| Lệnh | Kết quả |
| --- | --- |
| `npm.cmd run test:product-reviews:server` | 68/68 pass |
| `npm.cmd run test:product-reviews:client` | 57/57 pass |
| `npm.cmd run test:order-tracking` | 9/9 pass; có SendGrid warning tồn tại từ trước |
| `node --test client/src/app/user/pages/product/product/product-description.test.cjs client/src/app/admin/pages/orders/orders-report-csv.test.cjs` | 9/9 pass |
| Toàn bộ discovered `*.test.cjs` | 143 pass, 1 integration skip (default gates off), 0 fail |
| `npm.cmd run build:server` | exit 0 |
| `npm.cmd run build:client -- --configuration development` | exit 0; 6 NG8113 warning có sẵn ở các component không thuộc task |
| `git diff --check` | pass |

Các warning từ trước gồm SendGrid key-format diagnostic, cart signout test output và sáu NG8113 unused-import warnings; không có warning build mới do review feature. Không chạy lint toàn repo.

Không chỉnh đơn/tài khoản thật, không đổi cấu hình Mongo, không tạo collection/index, không push/merge. Tài khoản do người dùng cung cấp không được dùng; browser auth được kiểm chứng bằng user tổng hợp đăng nhập qua UI bình thường. Acceptance bao phủ development DB `cheri`; staging/production và tài khoản thật chưa được kiểm thử.
