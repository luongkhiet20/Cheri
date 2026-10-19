# BÁO CÁO CHẤT LƯỢNG DỮ LIỆU MACHINE LEARNING — CHÉRI E-COMMERCE

> **Thời điểm tạo báo cáo**: `2026-10-15T09:43:42.413796+00:00`  
> **Môi trường Database**: MongoDB Atlas (`cheri`)  

## 1. TỔNG QUAN MỨC ĐỘ SẴN SÀNG CHO MACHINE LEARNING

- **Đủ điều kiện huấn luyện ngay**: `CHƯA ĐỦ ĐIỀU KIỆN (Cần tích lũy thêm dữ liệu tương tác thực tế)`
- **Chiến lược khuyến nghị**: `DATASET_INITIALIZING`
- **Dữ liệu sản phẩm**: `99 sản phẩm` (Sẵn sàng 100%)
- **Dữ liệu đơn hàng**: `43 đơn hàng` (Có 21 đơn chuyển đổi thành công)
- **Dữ liệu tương tác**: `113 lượt tương tác trong collection user_interactions`

---

## 2. CHI TIẾT KHẢO SÁT TỪNG NGUỒN DỮ LIỆU

### 2.1. Danh mục Sản phẩm (Collection `products`)
- **Tổng số sản phẩm**: 99
- **Sản phẩm có giá bán hợp lệ (> 0)**: 99/99
- **Sản phẩm có danh mục/phân loại**: 99/99
- **Sản phẩm đang hiển thị (visibility=true)**: 96/99
- **Sản phẩm còn hàng (in_stock=true)**: 3/99

### 2.2. Lịch sử Đơn hàng (Collection `orders`)
- **Tổng số đơn hàng**: 43
- **Đơn hàng thành công (Verified Conversion)**: 21
- **Tổng số dòng sản phẩm trong đơn**: 80
- **Dòng sản phẩm liên kết chính xác với Catalog**: 76/80
- **Dòng sản phẩm không thể liên kết**: 4

### 2.3. Lịch sử Tương tác (Collection `user_interactions`)
- **Tổng số document**: 113
- **Sự kiện thực tế từ người dùng (Real Events)**: 4
- **Sự kiện giả lập kiểm thử (Synthetic Events)**: 109
- **Bao gồm sự kiện giả lập trong dataset**: `KHÔNG (Chỉ giữ sự kiện thực tế)`
- **Số lượt xem sản phẩm (VIEW)**: 4
- **Số người dùng đăng nhập định danh**: 0
- **Số phiên khách vãng lai định danh**: 1
- **Lượt tương tác chứa Compound ID**: 0
- **Lượt tương tác liên kết thành công với sản phẩm**: 4
- **Lượt tương tác không tìm thấy sản phẩm**: 0
- **Bản ghi thiếu hoặc sai timestamp**: 0
- **Lặp kỹ thuật được lọc (< 2 giây)**: 1
- **Khoảng thời gian dữ liệu**: Từ `2026-10-15T09:42:12.914000+00:00` đến `2026-10-15T09:42:34.926000+00:00`

---

## 3. CƠ CHẾ BẢO MẬT VÀ PHÒNG CHỐNG RÒ RỈ DỮ LIỆU

- **Bảo vệ PII (Thông tin cá nhân)**: Toàn bộ email, số điện thoại, họ tên và địa chỉ của khách hàng KHÔNG ĐƯỢC XUẤT ra file dataset. Định danh được chuyển đổi thành mã giả danh an toàn (`usr_...` hoặc `gst_...`) bằng SHA-256 có Salt.
- **Chống rò rỉ dữ liệu (No Data Leakage)**: Mọi đặc trưng của cặp User-Product tại thời điểm $T$ chỉ được tính từ các sự kiện trước $T$. Nhãn chuyển đổi mua hàng được quan sát độc lập trong cửa sổ tương lai $[T, T + 14\text{ ngày}]$.
- **Chia tập dữ liệu (Time-based Split)**: Hỗ trợ phân chia Train / Validation / Test theo dòng thời gian thay vì chia ngẫu nhiên.

---

## 4. KẾT LUẬN VÀ BƯỚC TIẾP THEO

1. Pipeline chuẩn bị dữ liệu đã được hoàn thiện 100% và sẵn sàng hoạt động tự động.
2. Hiện có 4 sự kiện thực tế và 109 sự kiện giả lập kiểm thử.
3. **Hành động tiếp theo**: Kích hoạt bộ thu thập sự kiện tương tác (`user_interactions`) trên frontend Angular để ghi nhận lượt xem thực tế của người dùng trước khi tiến hành huấn luyện mô hình Random Forest và XGBoost.