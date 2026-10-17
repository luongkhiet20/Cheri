# HƯỚNG DẪN TRIỂN KHAI DOCKER CHO DỰ ÁN CHÉRI FASHION

Tài liệu này cung cấp hướng dẫn đầy đủ, chi tiết từ môi trường phát triển (Local) đến triển khai thực tế (Production VPS) cho dự án thương mại điện tử **Chéri Fashion** bằng Docker & Docker Compose.

---

## 1. Kiến trúc Docker trong dự án

Dự án Chéri Fashion sử dụng kiến trúc Fullstack hiện đại kết hợp:
1. **Storefront & Server-Side Rendering (SSR):** Angular 20 SSR chạy trên Node.js 24 (`dist/cheri/server/server.mjs`).
2. **Backend API chính:** NestJS REST API (xử lý sản phẩm, giỏ hàng, đơn hàng, đánh giá, xác thực khách hàng) chạy trên cổng `4000`.
3. **Admin Management Server:** Express Server (`server/admin-server.js`) chạy trên cổng `5000` (xử lý thống kê dashboard, quản lý đơn hàng, danh mục, cài đặt hệ thống, chữ ký upload Cloudinary).

### Các thành phần Docker đã thiết lập:
- **`Dockerfile`:** Sử dụng kỹ thuật **Multi-stage build** tối ưu:
  - *Stage 1 (Builder):* Cài đặt dependencies, biên dịch Angular SSR (`build:ssr`) và NestJS (`build:server`), sau đó loại bỏ devDependencies (`npm prune --omit=dev`).
  - *Stage 2 (Runner):* Dùng `node:24-alpine` siêu nhẹ, tích hợp `dumb-init` để điều phối tín hiệu tắt container an toàn, chạy dưới quyền user không có đặc quyền (`USER node`), kiểm tra sức khỏe tự động (`HEALTHCHECK`).
- **`compose.yaml`:** Quản lý vòng đời dịch vụ bằng 1 lệnh duy nhất. Hỗ trợ 3 chế độ:
  - **Mặc định:** Chạy ứng dụng Chéri kết nối trực tiếp cơ sở dữ liệu đám mây **MongoDB Atlas**.
  - **Profile `proxy`:** Kích hoạt Nginx Reverse Proxy làm cổng vào duy nhất (cổng 80/3000) điều hướng mượt mà giữa API và giao diện.
  - **Profile `local-db`:** Khởi chạy thêm container MongoDB 7.0 nội bộ nếu muốn chạy offline không cần internet.
- **`.dockerignore`:** Bảo vệ an toàn tuyệt đối, ngăn rò rỉ file `.env`, secrets, mã nguồn tạm hoặc dependencies vào image.

---

## 2. Chuẩn bị trước khi chạy

### Yêu cầu hệ thống trên Windows:
1. Đã cài đặt **Docker Desktop** (khuyến nghị kích hoạt WSL 2 Backend).
2. Kiểm tra Docker hoạt động trong PowerShell / Terminal:
   ```powershell
   docker --version
   docker compose version
   ```

### Cấu hình biến môi trường:
1. Sao chép file mẫu `.env.example` thành `.env`:
   ```powershell
   cp .env.example .env
   ```
2. Mở file `.env` và điền chuỗi kết nối MongoDB Atlas (`MONGO_URI`), mã bí mật JWT (`JWT_SECRET`), thông tin Cloudinary, SendGrid,...

---

## 3. Hướng dẫn chạy ứng dụng

### A. Chạy lần đầu (Mặc định - Dùng MongoDB Atlas)
Khởi động ứng dụng Chéri kết nối MongoDB Atlas:

```bash
# 1. Kiểm tra cấu hình compose hợp lệ
docker compose config

# 2. Build image
docker compose build

# 3. Khởi chạy container ở chế độ nền (background)
docker compose up -d

# 4. Kiểm tra trạng thái container
docker compose ps

# 5. Xem log khởi động thời gian thực
docker compose logs -f app
```

**Các cổng truy cập:**
- Storefront & Khách hàng: `http://localhost:4000`
- API Backend NestJS: `http://localhost:4000/api`
- API Quản trị & Dashboard: `http://localhost:5000/api`

---

### B. Chạy kèm Nginx Reverse Proxy (Khuyến nghị cho Production)
Nginx sẽ gom toàn bộ về một cổng duy nhất (cổng 80 hoặc 3000):

```bash
docker compose --profile proxy up -d --build
```
- Truy cập toàn bộ website tại: `http://localhost:3000` hoặc `http://localhost`

---

### C. Chạy hoàn toàn Offline với MongoDB Local
Nếu bạn không có mạng hoặc muốn phát triển độc lập với Atlas:

```bash
# Trong file .env, đổi MONGO_URI="mongodb://mongo:27017/cheri"
docker compose --profile local-db up -d --build
```

---

## 4. Quy trình cập nhật khi sửa mã nguồn

Khi bạn chỉnh sửa mã nguồn Angular hoặc NestJS:

1. **Cần build lại Docker image:**
   Vì Docker đóng gói bản dựng production tối ưu (`dist/`), mọi thay đổi mã nguồn cần được build lại:
   ```bash
   docker compose build app
   docker compose up -d app
   ```
2. **Khi chỉ sửa cấu hình `.env`:**
   Chỉ cần khởi động lại container mà không cần build lại:
   ```bash
   docker compose restart app
   ```

---

## 5. Dừng và gỡ bỏ ứng dụng

- **Dừng các container (an toàn, giữ nguyên dữ liệu):**
  ```bash
  docker compose stop
  ```
- **Hạ toàn bộ hệ thống (giữ nguyên volume dữ liệu):**
  ```bash
  docker compose down
  ```
- ⚠️ **LƯU Ý:** Không dùng `docker compose down -v` trừ khi bạn thực sự muốn xóa sạch toàn bộ volume dữ liệu (như file upload hoặc database local).

---

## 6. Xử lý sự cố thường gặp (Troubleshooting)

### 1. Lỗi trùng cổng (`EADDRINUSE: address already in use 0.0.0.0:4000` hoặc `5000`)
- **Nguyên nhân:** Có tiến trình Node.js hoặc terminal khác đang chạy ở máy host chiếm cổng 4000 hoặc 5000 (ví dụ `npm run start:server` hoặc `ng serve`).
- **Cách khắc phục:**
  - Trên Windows PowerShell, tìm tiến trình đang chiếm cổng:
    ```powershell
    Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess
    ```
  - Tắt tiến trình đó hoặc đổi cổng ánh xạ trong `compose.yaml` (ví dụ `4001:4000`).

### 2. Không kết nối được MongoDB Atlas (`MongooseServerSelectionError` / `connection timeout`)
- **Nguyên nhân:** IP của máy chạy Docker chưa được cấp quyền (whitelist) trên MongoDB Atlas.
- **Cách khắc phục:** Truy cập [MongoDB Atlas](https://cloud.mongodb.com/) $\rightarrow$ mục **Network Access** $\rightarrow$ bấm **Add IP Address** $\rightarrow$ chọn **Add Current IP Address** (hoặc `0.0.0.0/0` cho môi trường thử nghiệm).

### 3. Container thoát ngay sau khi chạy (`Exited with code 1`)
- **Cách kiểm tra:**
  ```bash
  docker compose logs app
  ```
- Thường do thiếu biến môi trường bắt buộc như `MONGO_URI` hoặc `JWT_SECRET` trong `.env`.

---

## 7. Hướng dẫn triển khai Production trên VPS Linux (Ubuntu / Debian)

### Bước 1: Chuẩn bị VPS
Cài đặt Docker & Docker Compose plugin:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

### Bước 2: Tải mã nguồn và thiết lập `.env`
```bash
git clone https://github.com/luongkhiet20/Cheri.git /opt/cheri
cd /opt/cheri
cp .env.example .env
nano .env  # Điền các thông tin production thật
```

### Bước 3: Khởi chạy
```bash
docker compose up -d --build
```

### Bước 4: Cấu hình Tên miền & SSL HTTPS miễn phí với Caddy hoặc Nginx
Khuyến nghị dùng **Caddy** vì Caddy tự động cấp và gia hạn chứng chỉ SSL Let's Encrypt:
```caddy
# /etc/caddy/Caddyfile
cheri.vn, www.cheri.vn {
    reverse_proxy localhost:4000
}

api.cheri.vn {
    reverse_proxy localhost:5000
}
```
Khởi động Caddy: `sudo systemctl restart caddy`. Website của bạn sẽ tự động có HTTPS xanh hợp lệ!

---

## 8. Tương thích với Vercel

Việc tích hợp Docker **hoàn toàn độc lập** với cấu hình Vercel:
- File [`vercel.json`](file:///c:/Users/ACER/Downloads/Cheri/vercel.json) và các serverless function trong [`api/`](file:///c:/Users/ACER/Downloads/Cheri/api) vẫn được bảo toàn nguyên vẹn 100%.
- Khi bạn push code lên GitHub, Vercel vẫn tự động nhận diện và build deploy serverless bình thường theo quy trình cũ của bạn.
- Bạn có thể lựa chọn chạy trên Vercel hoặc tự host trên VPS Docker bất kỳ lúc nào mà không bị xung đột kỹ thuật.
