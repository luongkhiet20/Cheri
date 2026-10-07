# Chat box UI — Design Spec

## Mục tiêu

Thêm một chat widget trực quan trong storefront, không xây backend hội thoại.

## Bối cảnh hiện tại

- Không tìm thấy component chat trong code sau pull.
- Storefront dùng Angular 20 với các component standalone và lớp layout dùng chung.

## Thiết kế đã thống nhất

1. Tạo widget frontend riêng, gắn vào lớp layout storefront để dùng được ở các trang cửa hàng; không xuất hiện trong admin.
2. Có nút nổi mở/đóng, tiêu đề, lời chào/vùng hội thoại mẫu, ô nhập và nút gửi.
3. Tương tác chỉ ở local UI; không gọi API/AI, không lưu hội thoại hoặc ghi vào database.
4. Bố cục responsive, có nhãn truy cập cho điều khiển chính và có thể đóng/thu gọn dễ dàng.

## Không thuộc phạm vi

- Backend chatbot, kết nối mô hình AI, lưu lịch sử, phân công nhân viên hoặc tích hợp kênh chat.

## Điều kiện nghiệm thu thiết kế

- Widget mở/đóng được trên trang storefront ở desktop và mobile.
- UI thể hiện được cấu trúc hội thoại và ô nhập như prototype.
- Không phát sinh request chat hoặc ghi dữ liệu.
- Admin không render widget.
