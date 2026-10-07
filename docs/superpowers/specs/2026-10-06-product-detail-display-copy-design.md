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
