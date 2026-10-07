# Roadmap các luồng thương mại điện tử — Design Overview

## Mục tiêu

Điều phối năm luồng đã duyệt thành các chu kỳ spec/plan độc lập để phần tra cứu đơn dựa trên dữ liệu admin đã có, còn các thay đổi storefront có thể kiểm tra riêng.

## Thứ tự

1. `order-admin-seed`: kiểm tra quản lý đơn hiện có, rà bật/tắt/hoàn trả/CSV/phương thức thanh toán, tạo dữ liệu demo Mongo an toàn và xác nhận dữ liệu hiển thị trong admin.
2. `order-tracking`: hoàn thiện UI/API tra cứu main có sẵn, phụ thuộc đơn demo từ bước 1.
3. `storefront-search`: rà tìm kiếm từ khóa; lưu phân tích code tìm ảnh làm ghi chú hoãn, không triển khai tìm ảnh.
4. `product-detail-display-copy`: lọc nội dung mô tả chỉ ở giao diện, không ghi Mongo.
5. `chat-widget-ui`: thêm prototype chat thuần frontend.

## Ranh giới chung

- Seed là thao tác duy nhất trong các hạng mục fixture có chủ đích tạo dữ liệu demo trong Mongo; chỉ chạy với database development được chỉ định và phải idempotent. Các thao tác CRUD admin hiện hữu tiếp tục phục vụ quản lý đơn bình thường.
- Không cập nhật dữ liệu sản phẩm để sửa mô tả.
- Không dùng API AI bên ngoài cho tìm ảnh; phần này được hoãn hoàn toàn.
- Không nối chat widget với backend/AI.
- Các luồng UI và API hiện có được rà trước; plan không tạo lại các tính năng main đã có.

## Tài liệu con

- [Order admin và seed](2026-10-06-order-admin-seed-design.md)
- [Tra cứu đơn](2026-10-06-order-tracking-design.md)
- [Tìm kiếm cửa hàng và phân tích ảnh](2026-10-06-storefront-search-design.md)
- [Hiển thị mô tả sản phẩm](2026-10-06-product-detail-display-copy-design.md)
- [Chat widget UI](2026-10-06-chat-widget-ui-design.md)
