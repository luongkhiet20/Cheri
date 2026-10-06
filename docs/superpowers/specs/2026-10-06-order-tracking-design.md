# Tra cứu đơn hàng — Design Spec

## Mục tiêu

Hoàn thiện trang tra cứu đơn công khai hiện có trên main để khách xem được tiến trình của đơn thật và đơn demo sau khi chu kỳ quản lý đơn đã tạo dữ liệu trong MongoDB.

## Bối cảnh hiện tại

- Main đã có route `/vi/tracking`, component standalone `OrderTrackingComponent`, luồng chọn đơn của user đăng nhập và form tra cứu khách vãng lai.
- API `POST /api/orders/track` tìm theo mã đơn/mã vận đơn cùng email hoặc số điện thoại; service hỗ trợ nhiều dạng field legacy.
- Response hiện chứa địa chỉ người nhận đầy đủ, số điện thoại đã che một phần, giá trị tiền và snapshot sản phẩm.
- Component có thể đọc email/số điện thoại từ query string và tự gửi tra cứu.

## Thiết kế đã thống nhất

1. Tái sử dụng UI, route và API hiện có; rà soát, chỉ sửa phần chưa đạt.
2. Phần admin + seed demo phải hoàn tất và được xem trên admin trước khi kiểm tra public lookup.
3. Khách vãng lai xác minh bằng mã đơn/mã vận đơn và email hoặc số điện thoại đã đặt hàng. Gửi qua POST body.
4. Giữ luồng user đăng nhập chọn đơn của chính họ.
5. Phản hồi công khai chỉ giữ thông tin cần để theo dõi: mã đơn, trạng thái/lịch sử, tiến trình và mã vận đơn/đơn vị vận chuyển/ngày dự kiến, cùng tóm tắt sản phẩm. Không trả email hay địa chỉ giao hàng đầy đủ. Trạng thái thanh toán/hoàn tiền được trả khi cần để giải thích đơn hoàn trả.
6. Không đưa email/số điện thoại lên URL hoặc tự động điền từ query string. Có thể tiếp tục hỗ trợ link mang mã đơn; khách vẫn nhập thông tin xác minh.
7. Tra cứu phải xử lý cùng dữ liệu Mongo cho đơn demo, đơn hiện hành và các bản ghi legacy đang được hệ thống hỗ trợ.
8. Sai mã hoặc sai thông tin liên hệ dùng cùng thông báo tổng quát.

## Phụ thuộc và không thuộc phạm vi

- Phụ thuộc vào seed idempotent từ `order-admin-seed`.
- Không tạo collection riêng hoặc thêm schema field chỉ cho lookup nếu dữ liệu hiện có đáp ứng.
- Không sử dụng dữ liệu đơn thật trong fixture demo.

## Điều kiện nghiệm thu thiết kế

- Khách chưa đăng nhập tra được đơn demo chỉ với mã và liên hệ khớp.
- Sai mã/liên hệ không tiết lộ đơn có tồn tại.
- Kết quả phản ánh trạng thái mới nhất, lịch sử và vận chuyển; không lộ địa chỉ/email.
- Khách đăng nhập vẫn chọn được đơn của mình.
- URL không chứa PII.
