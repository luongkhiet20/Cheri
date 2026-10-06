# Quản lý đơn hàng admin và dữ liệu mẫu — Design Spec

## Mục tiêu

Rà soát và hoàn thiện trang quản lý đơn hàng hiện có, sau đó cung cấp dữ liệu đơn giả lập an toàn trong MongoDB để dùng cho kiểm tra admin và làm nền cho tra cứu đơn.

## Bối cảnh hiện tại

- Admin orders đã có thêm/sửa/xem/xóa, tìm kiếm, lọc trạng thái/thanh toán, phân trang và xuất CSV.
- Bộ lọc thanh toán tải toàn bộ phương thức thanh toán qua các trang API và ánh xạ giá trị từ mã/ID phương thức.
- CSV đang được tạo phía client bằng `text/csv`; phần triển khai cần được kiểm tra để bảo đảm xuất đúng dữ liệu cần báo cáo, escape CSV và không tạo XLSX.
- Schema đã có `RETURNED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `refundedAmount` và `refundedAt`. Admin có trạng thái `DELIVERY_FAILED` và các chuyển tiếp hoàn trả từ `DELIVERY_FAILED`/`DELIVERED`.
- Danh sách hành động đơn hàng hiện có Xem, Sửa, Xóa; chưa tìm thấy thao tác bật/tắt hoặc trường trạng thái hoạt động riêng cho đơn hàng.

## Thiết kế đã thống nhất

1. Giữ và kiểm tra các luồng admin đang có thay vì dựng lại CRUD.
2. Có một bước kiểm tra bật/tắt riêng. Nếu vẫn không có sau khi rà UI/API/schema, ghi nhận kết quả và không tự thêm `isActive` hoặc ngữ nghĩa mới cho đơn hàng khi chưa có yêu cầu cụ thể.
3. Đối chiếu trạng thái hoàn trả/hoàn tiền ở schema, giao diện chi tiết, quy tắc chuyển trạng thái, bộ lọc và báo cáo; chỉ thêm field nếu chứng minh được thiếu field cần thiết.
4. Kiểm tra bộ lọc thanh toán với các phương thức thật đang cấu hình, gồm phương thức inactive và đơn lịch sử giữ snapshot.
5. Tạo seed script có thể chạy lặp an toàn, tạo đơn nhận diện được là demo, có trạng thái và phương thức thanh toán đa dạng. Seed dùng sản phẩm/phương thức có sẵn, không trừ tồn kho, không gửi email và chỉ chạy với database development được chỉ định tường minh.
6. Dữ liệu seed phải hiện trong trang admin để kiểm tra trước khi bắt đầu phần tra cứu đơn.

## Không thuộc phạm vi

- Không sửa dữ liệu/mô tả sản phẩm trong MongoDB.
- Không chạy seed lên production hoặc database không được chỉ định.
- Không thêm trạng thái bật/tắt đơn hàng trước khi ngữ nghĩa được xác định.

## Điều kiện nghiệm thu thiết kế

- Admin CRUD, tìm kiếm, lọc, chi tiết, trạng thái trả hàng và CSV được kiểm tra theo code sau pull; lỗi cụ thể được sửa trong chu kỳ triển khai phần này.
- CSV có đuôi `.csv`, MIME `text/csv`, ký tự tiếng Việt đọc được và không phải XLSX.
- Chạy seed nhiều lần không nhân đôi đơn demo và không làm thay đổi kho/email.
- Đơn demo có thông tin xác minh giả lập ổn định để phần tra cứu dùng ở chu kỳ tiếp theo.
