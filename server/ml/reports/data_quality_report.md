# BÁO CÁO CHẤT LƯỢNG DỮ LIỆU MACHINE LEARNING — CHÉRI E-COMMERCE

> **Thời điểm tạo báo cáo**: `2026-11-03T16:01:55.808055+00:00`  
> **Môi trường Database**: MongoDB Atlas (`cheri`)  

## 1. TỔNG QUAN MỨC ĐỘ SẴN SÀNG CHO MACHINE LEARNING

- **Đủ điều kiện huấn luyện ngay**: `CÓ`
- **Chiến lược khuyến nghị**: `PURCHASE_PREDICTION`
- **Dữ liệu sản phẩm**: `99 sản phẩm` (Sẵn sàng 100%)
- **Dữ liệu đơn hàng**: `68 đơn hàng` (Có 35 đơn chuyển đổi thành công)
- **Dữ liệu tương tác**: `559 lượt tương tác trong collection user_interactions`

---

## 2. CHI TIẾT KHẢO SÁT TỪNG NGUỒN DỮ LIỆU

### 2.1. Danh mục Sản phẩm (Collection `products`)
- **Tổng số sản phẩm**: 99
- **Sản phẩm có giá bán hợp lệ (> 0)**: 99/99
- **Sản phẩm có danh mục/phân loại**: 99/99
- **Sản phẩm đang hiển thị (visibility=true)**: 97/99
- **Sản phẩm còn hàng (in_stock=true)**: 96/99
- **Sản phẩm hết hàng (in_stock=false)**: 3/99
- **Sản phẩm thiếu trường tồn kho**: 0
- **Sản phẩm lỗi ép kiểu tồn kho**: 0

### 2.2. Lịch sử Đơn hàng (Collection `orders`)
- **Tổng số đơn hàng**: 68
- **Đơn hàng thành công (Verified Conversion)**: 35
- **Tổng số dòng sản phẩm trong đơn**: 106
- **Dòng sản phẩm liên kết chính xác với Catalog**: 102/106
- **Dòng sản phẩm không thể liên kết**: 4

### 2.3. Lịch sử Tương tác (Collection `user_interactions`)
- **Tổng số document**: 559
- **Sự kiện thực tế từ người dùng (Real Events)**: 449
- **Sự kiện giả lập kiểm thử (Synthetic Events)**: 110
- **Bao gồm sự kiện giả lập trong dataset**: `KHÔNG (Chỉ giữ sự kiện thực tế)`
- **Số lượt xem sản phẩm (VIEW)**: 428
- **Số người dùng đăng nhập định danh**: 6
- **Số phiên khách vãng lai định danh**: 0
- **Lượt tương tác chứa Compound ID**: 0
- **Lượt tương tác liên kết thành công với sản phẩm**: 446
- **Lượt tương tác không tìm thấy sản phẩm**: 3
- **Bản ghi thiếu hoặc sai timestamp**: 0
- **Lặp kỹ thuật được lọc (< 2 giây)**: 12
- **Khoảng thời gian dữ liệu**: Từ `2026-10-15T09:42:12.914000+00:00` đến `2026-11-03T16:00:19.121000+00:00`

---

## 3. CƠ CHẾ BẢO MẬT VÀ PHÒNG CHỐNG RÒ RỈ DỮ LIỆU

- **Bảo vệ PII (Thông tin cá nhân)**: Toàn bộ email, số điện thoại, họ tên và địa chỉ của khách hàng KHÔNG ĐƯỢC XUẤT ra file dataset. Định danh được chuyển đổi thành mã giả danh an toàn (`usr_...` hoặc `gst_...`) bằng SHA-256 có Salt.
- **Chống rò rỉ dữ liệu (No Data Leakage)**: Mọi đặc trưng của cặp User-Product tại thời điểm $T$ chỉ được tính từ các sự kiện trước $T$. Nhãn chuyển đổi mua hàng được quan sát độc lập trong cửa sổ tương lai $[T, T + 14\text{ ngày}]$.
- **Chia tập dữ liệu (Time-based Split)**: Hỗ trợ phân chia Train / Validation / Test theo dòng thời gian thay vì chia ngẫu nhiên.

---

## 3b. DATASET DỰ ĐOÁN MUA HÀNG 14 NGÀY (SNAPSHOT)

- **Nguồn dữ liệu**: `user_interactions + orders` | **Synthetic**: `False`
- **Định nghĩa nhãn**: label=1 nếu tồn tại đơn hàng THÀNH CÔNG của cùng user và cùng product trong [T, T+14 ngày]; label=0 nếu đã quan sát đủ 14 ngày sau T mà không có đơn như vậy. Snapshot chưa đủ 14 ngày theo dõi bị loại, không gán 0.
- **Chính sách trạng thái sản phẩm**: Không có lịch sử tồn kho/hiển thị theo thời điểm trong DB, nên tại snapshot lịch sử product_in_stock và product_visibility được đặt = 1 (sản phẩm đã được xem trước T nên đang hiển thị); không dùng trạng thái hiện tại để tránh leakage. product_price/product_variant_count lấy từ catalog hiện tại (không có lịch sử giá) — đây là giới hạn đã biết.
- **Khoảng thời gian sự kiện**: `['2026-10-15T09:42:12.914000+00:00', '2026-11-03T16:00:19.121000+00:00']` | **Observation end**: `2026-11-03T16:01:55.808055+00:00`
- **Snapshot ứng viên**: 7 (bước 3 ngày, lookback 30 ngày)
- **Snapshot bị loại vì chưa đủ 14 ngày theo dõi**: 5 (326 cặp user-product)
- **Snapshot/mẫu bị purge do embargo giữa các split**: 0 / 0
- **Snapshot trong dataset**: 2 | **Khoảng T**: `['2026-10-16T00:00:00+00:00', '2026-10-19T00:00:00+00:00']`
- **Số mẫu**: 86 | **Users**: 3 | **Products**: 29
- **Phân bố nhãn**: `{'0': 79, '1': 7}` | **Tỷ lệ dương**: `0.0814`
- **Phân bố theo split**: `{'train': {'0': 79, '1': 7}}`
- **Snapshot sớm nhất có thể đủ follow-up**: `2026-10-30T00:00:00+00:00`

---

## 4. KẾT LUẬN VÀ BƯỚC TIẾP THEO

1. Pipeline chuẩn bị dữ liệu đã được hoàn thiện 100% và sẵn sàng hoạt động tự động.
2. Hiện có 449 sự kiện thực tế và 110 sự kiện giả lập kiểm thử.
3. **Hành động tiếp theo**: Kích hoạt bộ thu thập sự kiện tương tác (`user_interactions`) trên frontend Angular để ghi nhận lượt xem thực tế của người dùng trước khi tiến hành huấn luyện mô hình Random Forest và XGBoost.