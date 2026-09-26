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

---

### 4. Build Độc Lập

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

## 🐳 Triển Khai Với Docker (Tùy Chọn)

```bash
# Kéo image Docker
docker pull pararel/eshop-mean:latest

# Chạy Docker kèm file .env
docker run --env-file .env --network=host pararel/eshop-mean:latest
```
