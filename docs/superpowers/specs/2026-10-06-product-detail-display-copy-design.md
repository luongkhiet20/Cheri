# Nội dung mô tả ở chi tiết sản phẩm — Design Spec

## Mục tiêu

Loại bỏ nội dung mô tả rỗng hoặc rập khuôn khỏi phần hiển thị chi tiết sản phẩm mà không sửa dữ liệu lưu trong MongoDB.

## Bối cảnh hiện tại

- Product detail popup đọc `description` và `descriptionFull` từ dữ liệu sản phẩm; danh sách `descriptionFull` đang được render thành các bullet.
- Chưa thấy lớp lọc nội dung trước khi render.
- Component cũng cập nhật meta description; metadata và các màn hình khác không thuộc thay đổi được duyệt.

## Thiết kế đã thống nhất

1. Rà các ví dụ đang hiển thị để xác định câu/dạng filler cụ thể trước khi đặt quy tắc lọc.
2. Tạo view model/formatter chỉ ở client cho phần chi tiết sản phẩm; không ghi ngược API/MongoDB và không tự viết lại nội dung bằng AI.
3. Loại bỏ dòng trống, câu filler đã xác định hoặc nội dung lặp vô nghĩa; giữ thông tin sản phẩm có ích.
4. Nếu sau lọc không còn bullet có ích, ẩn khối mô tả thay vì dựng nội dung giả.
5. Giữ nguyên meta description và dữ liệu ở admin/catalog cho đến khi có yêu cầu riêng.

## Điều kiện nghiệm thu thiết kế

- UI chi tiết không hiển thị các filler đã xác định.
- Nội dung sản phẩm thật vẫn hiển thị nguyên văn và theo thứ tự.
- Không có thay đổi write/API/database đối với sản phẩm.
- Khối mô tả rỗng sau lọc được ẩn gọn.

## Ghi nhận triển khai — 2026-10-07

- Phạm vi được người dùng xác nhận: chỉ sửa nội dung hiển thị, không sửa logic biến thể và không commit cấu hình MongoDB local.
- Formatter frontend bỏ bullet không phải chuỗi, chuỗi chỉ có khoảng trắng và bullet trùng sau chuẩn hóa Unicode/khoảng trắng. Câu được giữ lại vẫn nguyên văn, theo thứ tự; dữ liệu nguồn không bị sửa.
- Giữ ưu tiên dữ liệu `vi.descriptionFull` hiện có. Nếu mảng tiếng Việt đã chọn bị lọc hết, khối chi tiết được ẩn; không đưa nội dung root cũ trở lại.
- Không thay đổi template/layout, metadata, API, schema, dữ liệu sản phẩm hoặc hành vi mua hàng. Bỏ biến mô tả ngắn không được template sử dụng.
- Chưa có mẫu câu filler từ dữ liệu sản phẩm thực tế trong repo. Chưa thêm blacklist hay nhận diện AI dựa trên từ khóa chung; cần ví dụ xác nhận để lọc riêng mà không xóa nhầm thông tin hữu ích.
