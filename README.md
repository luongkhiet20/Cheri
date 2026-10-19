# Chéri - Nền Tảng Thương Mại Điện Tử (E-Commerce Platform)

Hệ thống E-Commerce full-stack kết hợp giữa **NestJS 11** (Backend REST API) và **Angular 20** (Frontend SPA & Server-Side Rendering) cùng **Admin Server (Express & MongoDB)**.

---

## 📋 Yêu Cầu Hệ Thống (Prerequisites)

- **Node.js**: >= 20.x (Khuyến nghị Node 24.x theo `engines`)
- **npm**: >= 10.x / 11.x
- **MongoDB**: Cụm MongoDB Atlas Cloud hoặc MongoDB Local

---

## 🛠️ Cài Đặt (Installation)

Cài đặt tất cả các dependencies cho cả Backend và Frontend:

```bash
npm install
```

---

## ⚙️ Cấu Hình Môi Trường (.env)

Sao chép file cấu hình mẫu `.env.example` thành `.env`:

```bash
# Trên Windows (PowerShell / CMD):
copy .env.example .env

# Trên macOS / Linux:
cp .env.example .env
```

Mở file `.env` và kiểm tra/cập nhật các thông số cần thiết:

```env
# Cấu hình Server (Backend)
PORT=4000
SERVER_URL="http://localhost:4000"

# Cấu hình Client (Frontend)
ORIGIN="http://localhost:3000"

# Cấu hình Admin Server
ADMIN_PORT=5000

# Bảo mật JWT & Session Cookie
JWT_EXPIRATION="7d"
JWT_SECRET="your_jwt_secret_key"
COOKIE_KEY="your_cookie_secret_key"

# Kết nối Cơ sở dữ liệu (MongoDB Atlas)
MONGO_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/cheri?retryWrites=true&w=majority"
```

---

## 🚀 Hướng Dẫn Chạy Dự Án (Running the Project)

### 1. Chạy Môi Trường Development (Khuyến Nghị)

Mở **2 cửa sổ Terminal**:

#### **Terminal 1: Chạy Backend (Cổng 4000 & 5000)**
```bash
npm run start:dev
```
- API Server khách hàng chạy tại: `http://localhost:4000`
- Tự động kích hoạt **Admin API Server** tại: `http://localhost:5000` (nếu chưa chạy).
- Tự động restart khi sửa code (`--watch`).

> *Lưu ý:* Bạn cũng có thể chạy riêng Admin Server bằng lệnh: `npm run start:admin`

#### **Terminal 2: Chạy Frontend (Angular - Cổng 3000)**
```bash
npm run start:client
```
- Giao diện Client chạy tại: `http://localhost:3000`
- Truy cập trang Admin tại: `http://localhost:3000/admin` *(Yêu cầu đăng nhập tài khoản có quyền `admin` như `admin@example.com`)*.
- Tự động reload trình duyệt khi sửa code (Live Reload).

---

### 2. Bảng Lệnh Thường Dùng

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run start:dev` | Chạy Backend NestJS (port 4000) & tự kích hoạt Admin API (port 5000) |
| `npm run start:client` | Chạy Frontend Angular (port 3000) |
| `npm run start:admin` | Chạy riêng Admin API server trên cổng 5000 (`node server/admin-server.js`) |
| `npm run start:client:https` | Chạy client với giao thức HTTPS trên cổng 3000 |
| `npm run start:debug` | Chạy backend NestJS với chế độ Debug |
| `npm run watch` | Theo dõi và build client ở chế độ development |

---

### 3. Chạy Môi Trường Production & SSR (Server-Side Rendering)

Khi cần build và triển khai SSR:

```bash
# 1. Build ứng dụng SSR
npm run build:ssr

# 2. Khởi chạy Server SSR
npm run serve:ssr
# hoặc
npm start
```

### 4. Triển khai chức năng quên mật khẩu trên Vercel

Vercel phục vụ giao diện và API proxy; backend NestJS phải được chạy trên một
dịch vụ Node.js riêng, có kết nối MongoDB và các biến môi trường backend. Trong
cài đặt Vercel, thêm biến môi trường `NEST_API_URL` trỏ tới origin backend,
không thêm `/api` ở cuối, ví dụ `https://cheri-api.example.com`. Ba endpoint
đặt lại mật khẩu sẽ được proxy tới backend qua `/api/auth`.

Trên dịch vụ backend, cấu hình `SENDGRID_KEY`, `EMAIL_FROM` (địa chỉ gửi đã xác
minh trong SendGrid), `PASSWORD_RESET_SECRET` (ít nhất 32 ký tự ngẫu nhiên),
`MONGO_URI`, cùng các biến môi trường backend cần thiết khác. Không đưa các giá
trị này vào frontend hoặc commit chúng vào Git. `NEST_API_URL` thuộc cấu hình
server-side của Vercel; khóa SendGrid chỉ được đặt ở backend.

Sau khi triển khai, kiểm tra:

1. Gọi `POST /api/auth/forgot-password` trên domain Vercel với email khách hàng
   đã đăng ký; phản hồi thành công nghĩa là yêu cầu đã tới backend, còn lỗi 503
   nghĩa là Vercel chưa được cấu hình `NEST_API_URL`.
2. Xem log backend nếu phản hồi 500. Backend ghi trạng thái SendGrid và lý do
   từ chối an toàn (không ghi API key); kiểm tra sender đã xác minh, quyền của
   API key và hạn mức SendGrid.
3. Nhập OTP trong giao diện, xác minh mã rồi đặt mật khẩu mới. OTP hết hạn sau
   5 phút và giới hạn gửi lại là 60 giây cho mỗi email.

---

### 5. Build Độc Lập

```bash
# Build riêng Backend
npm run build:server

# Build riêng Frontend Client
npm run build:client
```

---

## 🧹 Kiểm Tra & Định Dạng Code (Lint & Format)

```bash
# Format code backend bằng Prettier
npm run format

# Kiểm tra cú pháp TypeScript/ESLint
npm run lint
npm run lint:client

# Kiểm tra & sửa CSS bằng Stylelint
npm run lint:css
npm run lint:css:fix
```

---

## 🐳 Triển Khai Với Docker & Docker Compose

Xem hướng dẫn chi tiết toàn diện tại [Tài Liệu Hướng Dẫn Docker (docs/DOCKER.md)](docs/DOCKER.md).

### Khởi động nhanh bằng Docker Compose:

```bash
# 1. Sao chép và cấu hình biến môi trường
cp .env.example .env

# 2. Build và khởi chạy container
docker compose up -d --build

# 3. Xem logs ứng dụng
docker compose logs -f app
```

- **Storefront & API:** `http://localhost:4000`
- **Admin Server:** `http://localhost:5000`

### Dừng ứng dụng:
```bash
docker compose down
``` 


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
