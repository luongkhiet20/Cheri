# HƯỚNG DẪN SỬ DỤNG MODULE MACHINE LEARNING — CHÉRI E-COMMERCE

Module này chịu trách nhiệm **chuẩn bị dữ liệu huấn luyện Machine Learning (Bước 2)** cho đề tài:  
*“Nghiên cứu và ứng dụng Machine Learning trong dự đoán sản phẩm khách hàng có khả năng quan tâm trên website thời trang Chéri”.*

---

## 1. Cấu trúc thư mục

```text
server/
├── ml/
│   ├── data/                   # Chứa các file CSV dataset đã chuẩn hóa (.gitignore)
│   ├── reports/                # Báo cáo kiểm định chất lượng dữ liệu (JSON & Markdown)
│   ├── src/                    # Mã nguồn pipeline xử lý dữ liệu
│   │   ├── config.py           # Cấu hình kết nối, chuẩn hóa ID và ẩn danh hóa PII
│   │   ├── extract_data.py     # Trích xuất dữ liệu từ MongoDB Atlas
│   │   ├── validate_data.py    # Kiểm tra tính toàn vẹn, deduplication kỹ thuật
│   │   ├── feature_engineering.py # Xây dựng đặc trưng Người dùng - Sản phẩm (chống Data Leakage)
│   │   ├── build_dataset.py    # Gắn nhãn mục tiêu tương lai và phân chia Time-based split
│   │   └── export_dataset.py   # Điều phối xuất file dataset và báo cáo chất lượng
│   ├── tests/                  # Bộ kiểm thử tự động 16 test cases
│   │   └── test_pipeline.py
│   ├── main.py                 # CLI entrypoint chạy pipeline
│   ├── requirements.txt        # Danh sách thư viện Python
│   ├── .env.example            # File mẫu cấu hình biến môi trường
│   ├── .gitignore              # Ngăn chặn commit dữ liệu nhạy cảm
│   └── README.md               # Tài liệu hướng dẫn sử dụng
└── src/                        # Mã nguồn backend NestJS (giữ nguyên độc lập)
```

---

## 2. Yêu cầu môi trường

- **Python**: `>= 3.10` (Đã kiểm thử tương thích tốt trên Python 3.12).
- **Hệ điều hành**: Windows 10/11 (PowerShell) hoặc Linux / macOS.
- **Quyền truy cập MongoDB**: Chuỗi kết nối MongoDB Atlas (được lưu an toàn trong file `.env`).

---

## 3. Cài đặt từng bước

Mở **Windows PowerShell** và chuyển tới thư mục `server/ml/`:

```powershell
# Di chuyển vào thư mục ml
cd c:\Users\ACER\Downloads\Cheri\server\ml

# (Tùy chọn) Tạo môi trường ảo riêng biệt
python -m venv venv
.\venv\Scripts\Activate.ps1

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

---

## 4. Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env`:

```powershell
cp .env.example .env
```

Mở file `.env` và điền cấu hình (Pipeline cũng tự động đọc fallback từ file `.env` ở thư mục gốc của project):

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/cheri?retryWrites=true&w=majority
MONGO_DB_NAME=cheri
OUTPUT_DATA_DIR=./data
OUTPUT_REPORT_DIR=./reports
FUTURE_WINDOW_DAYS=14
```

> **LƯU Ý BẢO MẬT**: File `.env` chứa mật khẩu kết nối cơ sở dữ liệu đã được cấu hình trong `.gitignore`, **tuyệt đối không commit file này lên GitHub**.

---

## 5. Các lệnh chạy Pipeline

### 5.1. Kiểm tra kết nối MongoDB
Kiểm tra xem Python có kết nối tới cơ sở dữ liệu MongoDB Atlas thành công hay không:

```powershell
python main.py --test-conn
```

### 5.2. Chế độ kiểm tra nhanh dữ liệu (Check-Only)
Quét toàn bộ collections, kiểm tra số lượng và chất lượng dữ liệu, in báo cáo ra màn hình mà **không ghi đè file dataset**:

```powershell
python main.py --check-only
```

### 5.3. Chạy toàn bộ Pipeline và xuất Dataset
Trích xuất dữ liệu, làm sạch, kỹ thuật hóa đặc trưng, tạo nhãn và xuất ra các file CSV cùng báo cáo:

```powershell
python main.py
```

### 5.4. Chạy bộ kiểm thử tự động (Unit Tests)
Chạy toàn bộ các ca kiểm thử kiểm tra tính chính xác của thuật toán:

```powershell
# Chạy kiểm thử pipeline tiền xử lý (16 tests)
python tests/test_pipeline.py

# Chạy kiểm thử script mô phỏng tương tác (8 tests)
python tests/test_simulation.py
```

### 5.5. Giả lập lượt xem sản phẩm để kiểm thử (simulate_interactions.py)
Script này dùng để tạo dữ liệu lượt xem sản phẩm phục vụ kiểm thử pipeline ML:
- Chỉ sử dụng tài khoản và sản phẩm thực tế có trong MongoDB.
- Mặc định chạy ở chế độ **Dry-run** (chỉ xem trước, không ghi vào database).
- Đánh dấu bản ghi giả lập bằng `isSynthetic: true` và `metadata.isSynthetic: true`.
- Không chạm vào thông tin cá nhân (email, SĐT, địa chỉ) hay dữ liệu đơn hàng/tài khoản.

**Xem trước lượt xem giả lập (Dry-run - Mặc định):**
```powershell
python src/simulate_interactions.py --users 10 --events-per-user 5
```

**Ghi dữ liệu giả lập vào MongoDB (Yêu cầu cờ `--commit`):**
```powershell
python src/simulate_interactions.py --users 10 --events-per-user 5 --commit
```

**Dọn dẹp riêng các bản ghi giả lập khỏi MongoDB (Không chạm vào dữ liệu thật):**
```powershell
# Xem trước số bản ghi synthetic sẽ xóa (dry-run):
python src/simulate_interactions.py --cleanup-synthetic

# Xác nhận xóa sạch các bản ghi synthetic khỏi MongoDB:
python src/simulate_interactions.py --cleanup-synthetic --commit
```

**Kiểm thử Pipeline với dữ liệu Synthetic:**
```powershell
# Pipeline mặc định sẽ TÁCH BIỆT (cách ly) dữ liệu synthetic khỏi tập clean:
python main.py --check-only

# Để nạp dữ liệu synthetic vào chạy thử nghiệm pipeline:
python main.py --include-synthetic
```


---

## 6. Các file đầu ra được tạo trong `server/ml/`

1. **`data/products_features.csv`**:
   - Danh mục 99 sản phẩm thời trang Chéri đã được làm sạch.
   - Các cột: `product_id`, `sku`, `title`, `title_url`, `primary_category`, `regular_price`, `sale_price`, `visibility`, `quantity`, `is_in_stock`, `variant_count`, `date_added`.
2. **`data/interactions_clean.csv`**:
   - Dữ liệu tương tác đã loại bỏ lỗi kỹ thuật và ẩn danh hóa danh tính.
   - Các cột: `user_key`, `is_guest`, `clean_product_id`, `variant_id`, `event_type`, `event_timestamp`, `is_linked_to_catalog`.
3. **`data/user_product_dataset.csv`**:
   - Bảng đặc trưng User-Product phục vụ huấn luyện (chỉ xuất khi có tương tác).
   - Chống rò rỉ dữ liệu (No Data Leakage): các đặc trưng tại mốc $T$ chỉ tính từ dữ liệu trước $T$.
   - Nhãn `label = 1` nếu có đơn hàng mua sản phẩm trong khoảng $[T, T + 14\text{ ngày}]$.
   - Cột `split`: Phân chia tập `train`, `val`, `test` theo dòng thời gian.
4. **`reports/data_quality_report.json`**:
   - Báo cáo định dạng máy đọc phục vụ kiểm soát chất lượng tự động (CI/CD).
5. **`reports/data_quality_report.md`**:
   - Báo cáo tổng hợp chất lượng dữ liệu phục vụ nghiên cứu và phân tích.

---

## 7. Các biện pháp bảo vệ và nguyên tắc dữ liệu

1. **Không can thiệp NestJS**:
   - Thư mục `server/ml/` đã được loại trừ khỏi `server/tsconfig.json` và `server/tsconfig.build.json`. NestJS compile và chạy hoàn toàn bình thường, không bị ảnh hưởng bởi code Python.
2. **Bảo vệ thông tin cá nhân (PII)**:
   - Toàn bộ email, số điện thoại, tên thật và địa chỉ giao hàng của khách hàng **không bao giờ được xuất ra dataset**.
   - Định danh khách hàng được thay thế bằng chuỗi giả danh hash SHA-256 (`usr_...` cho tài khoản thành viên, `gst_...` cho phiên khách vãng lai).
3. **Tương thích khóa sản phẩm & biến thể**:
   - Nhận diện chính xác ObjectId 24 ký tự hex.
   - Tự động bóc tách Compound ID (dạng `${productId}_${variantId}`) thành Product ID thuần để đối chiếu chính xác với catalog, không làm phát sinh lỗi ép kiểu.
4. **Đơn hàng hợp lệ (Verified Conversion)**:
   - Chỉ tính đơn hàng có `paymentStatus == 'PAID'` hoặc `status == 'DELIVERED'` là chuyển đổi thành công.
   - Các đơn hàng bị `CANCELLED`, `RETURNED` hoặc `FAILED` bị loại bỏ khỏi nhãn tích cực.

---

## 8. Xử lý các lỗi thường gặp

- **Lỗi `ModuleNotFoundError: No module named 'src'`**:
  - Đảm bảo bạn đang đứng ở thư mục `server/ml/` khi chạy lệnh, hoặc gọi qua file `main.py`.
- **Lỗi `UnicodeEncodeError: 'charmap' codec can't encode characters` trên PowerShell**:
  - Module đã tích hợp sẵn cơ chế cấu hình UTF-8 `sys.stdout.reconfigure(encoding='utf-8')`. Bạn cũng có thể thiết lập PowerShell sang UTF-8 bằng lệnh:  
    `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8`
- **Lỗi `ServerSelectionTimeoutError` khi kết nối MongoDB**:
  - Kiểm tra xem máy bạn có quyền truy cập Internet để kết nối tới MongoDB Atlas không, và kiểm tra IP của bạn đã được whitelist trong MongoDB Atlas Network Access hay chưa.
