# Tìm kiếm cửa hàng — Design Spec

## Mục tiêu

Rà soát và hoàn thiện trải nghiệm tìm kiếm từ khóa hiện có, đồng thời ghi nhận chính xác trạng thái code tìm ảnh mà không mở rộng chức năng tìm ảnh trong chu kỳ này.

## Tìm kiếm từ khóa

- Main đã có search modal, query `search`, điều hướng tới trang cửa hàng, banner kết quả/xóa tìm kiếm và backend tìm theo nhiều field sản phẩm với token và tiếng Việt.
- Giữ flow popup → nhập từ khóa → tìm kiếm → trang cửa hàng có kết quả.
- Rà soát giữ query khi phân trang/lọc/sắp xếp, trạng thái rỗng, xóa query và kết quả tiếng Việt; chỉ sửa sai lệch cụ thể.

## Phân tích code tìm kiếm ảnh sau pull

- Modal nhận JPG/JPEG/PNG/WebP tối đa 5 MB, xem trước file và gọi `POST /api/products/search/image`.
- Controller dùng Multer memory storage và giới hạn 5 MB. `ImageSearchService` hiện chỉ là abstraction/scaffold: mặc định `pending_model_integration`; các nhánh `clip`, `resnet`, `vision_api` chưa hiện thực trích xuất vector và tìm sản phẩm, nhưng vẫn trả `success: true` cùng `matches: []`.
- Khi chưa cấu hình provider, service trả `success: false`, không có matches. Không có thuật toán matching local hiện được cài đặt; keyword gửi kèm chưa được sử dụng.
- Modal vẫn đóng và điều hướng với `imageSearch=1` kể cả khi API thất bại hoặc không có match. Trang products lọc theo `productIds` nếu có, còn `imageSearch` tự nó không tạo điều kiện truy vấn ở service; trường hợp không có IDs có thể hiển thị các sản phẩm không liên quan như kết quả ảnh.

## Quyết định và phạm vi

- Theo yêu cầu, chu kỳ hiện tại không triển khai, sửa, bật/tắt hay tích hợp provider cho chức năng tìm ảnh; chỉ giữ phân tích này trong plan làm rõ tình trạng hiện tại.
- Khi người dùng yêu cầu làm tiếp sau này, ràng buộc đã nêu là chạy trong dự án và không dùng API AI bên ngoài. Thiết kế giải pháp cục bộ sẽ được làm ở một chu kỳ riêng; không mặc định tích hợp `vision_api`.

## Điều kiện nghiệm thu thiết kế

- Tìm từ khóa từ modal tới cửa hàng giữ query và xử lý trạng thái rỗng/xóa/phân trang nhất quán.
- Kết quả phân tích tìm ảnh được lưu như hạng mục hoãn, cùng các điểm scaffold/no-match/fallback nêu trên.
- Không thay đổi code tìm ảnh trong chu kỳ hiện tại.
