# 🛍️ Chéri Fashion - Nền Tảng Thương Mại Điện Tử (E-Commerce Platform)

Hệ thống E-Commerce full-stack hiện đại kết hợp giữa **NestJS 11** (Backend REST API), **Angular 20** (Frontend SPA & Server-Side Rendering) và **Admin Management Server (Express & MongoDB)**.

> 🌐 **Địa chỉ triển khai (Demo):**
> - **Bản triển khai Vercel:** [https://cheri-three.vercel.app/](https://cheri-three.vercel.app/)
> - **Bản triển khai Render:** [https://cheri-n0td.onrender.com/](https://cheri-n0td.onrender.com/)

---

## 🌟 Tính Năng Nổi Bật (Key Features)

### 🛒 Giao Diện Khách Hàng (Storefront)
- **Tối ưu SEO & Hiệu năng cao**: Tích hợp Angular 20 Server-Side Rendering (SSR) giúp tải trang tức thì và tối ưu tìm kiếm Google.
- **Danh mục & Tìm kiếm thông minh**: Lọc sản phẩm theo danh mục, mức giá, màu sắc, kích cỡ; gợi ý sản phẩm liên quan (Recommendations & Interactions tracking).
- **Giỏ hàng & Wishlist**: Quản lý giỏ hàng trực quan, lưu sản phẩm yêu thích.
- **Đa dạng cổng thanh toán**:
  - Tiền mặt khi nhận hàng (COD).
  - Cổng thanh toán quốc tế **Stripe**.
  - Cổng thanh toán nội địa **VNPay** (hỗ trợ Sandbox test card, IPN xác thực giao dịch tự động).
- **Theo dõi đơn hàng & Hoàn trả**:
  - Tra cứu mã vận đơn với timeline trạng thái chi tiết theo thời gian thực.
  - Gửi yêu cầu hoàn hàng kèm tải ảnh minh chứng trực tiếp lên **Cloudinary**.
- **Bảo mật & Xác thực tài khoản**:
  - Đăng nhập/Đăng ký qua Email/Mật khẩu với JWT & Session Cookie.
  - Đăng nhập nhanh bằng **Google OAuth 2.0** và **Facebook Login**.
  - Quên mật khẩu an toàn với mã xác minh **OTP 6 số** gửi qua **SendGrid**.
- **Đánh giá & Trò chuyện**: Đánh giá/bình luận sản phẩm theo số sao và trò chuyện hỗ trợ khách hàng.

### 💼 Trang Quản Trị Hệ Thống (Admin Portal)
- **Dashboard phân tích trực quan**: Biểu đồ thống kê doanh thu, số lượng đơn hàng, người dùng mới.
- **Quản lý sản phẩm & danh mục**: Thêm/sửa/xóa sản phẩm, biến thể màu sắc/kích thước, danh mục đa cấp, upload ảnh tự động lên Cloudinary.
- **Quản lý đơn hàng & Vận chuyển**: Cập nhật trạng thái đơn, gán mã vận đơn, duyệt hoàn trả và xử lý hoàn tiền.
- **Đồng bộ tồn kho tự động (Inventory Sync)**: Tự động giữ hàng (reserve) khi đặt và hoàn lại kho (restore) khi hủy đơn.
- **Khuyến mãi & Mã giảm giá (Coupons)**: Tạo coupon theo phần trăm hoặc số tiền cố định, giới hạn lượt dùng và thời gian áp dụng.
- **Quản lý cấu hình & Hệ thống**: Cấu hình phí ship, phương thức thanh toán, liên kết mạng xã hội (Social Links), bật/tắt chế độ bảo trì hệ thống.

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)

```
                       ┌────────────────────────┐
                       │   Khách Hàng / Admin   │
                       └───────────┬────────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
    (Cổng 3000 / 4000)                          (Cổng 5001 / 5000)
┌─────────────────────────┐                 ┌─────────────────────────┐
│     Angular 20 Client   │                 │   Express Admin Server  │
│  (SPA & Angular SSR)    │                 │ (Dashboard, Uploads,    │
└────────────┬────────────┘                 │  Inventory, Coupons)    │
             │                              └────────────┬────────────┘
             │ (Cổng 4000 API)                           │
┌────────────▼────────────┐                              │
│   NestJS 11 Backend API │                              │
│ (Auth, Cart, Orders,    │                              │
│  Products, VNPay, ...)  │                              │
└────────────┬────────────┘                              │
             │                                           │
             └─────────────────────┬─────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   MongoDB Database  │
                        │ (Atlas hoặc Local)  │
                        └─────────────────────┘
```

---

## 📋 Yêu Cầu Hệ Thống (Prerequisites)

- **Node.js**: `>= 20.x` (Khuyến nghị **Node 24.4.1** theo cấu hình `engines`)
- **npm**: `>= 10.x` (Khuyến nghị **npm 11.4.2**)
- **MongoDB**: Cụm cơ sở dữ liệu [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) hoặc MongoDB Local `>= 7.0`
- **Docker & Docker Compose** (Tùy chọn nếu muốn chạy môi trường container)

---

## 🛠️ Cài Đặt (Installation)

Cài đặt tất cả dependencies cho cả Backend và Frontend:

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

Mở file `.env` và điền các tham số cần thiết:

```env
# ==============================================================================
# Server & Ports
# ==============================================================================
PORT=4000
ADMIN_PORT=5001
SERVER_URL="http://localhost:4000"
ORIGIN="http://localhost:3000"

# ==============================================================================
# Security & JWT Secrets
# ==============================================================================
JWT_EXPIRATION="7d"
JWT_SECRET="replace-with-a-very-strong-jwt-secret-key-at-least-32-chars"
COOKIE_KEY="replace-with-a-random-cookie-encryption-key"
PASSWORD_RESET_SECRET="replace-with-a-random-secret-of-at-least-32-characters"

# ==============================================================================
# Database (MongoDB Atlas hoặc Local)
# ==============================================================================
MONGO_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/cheri?retryWrites=true&w=majority"

# ==============================================================================
# Emails & OTP Notifications (SendGrid)
# ==============================================================================
SENDGRID_KEY="SG.your-sendgrid-api-key"
EMAIL_FROM="your-verified-sender@example.com"
ADMIN_EMAILS="contact.cheri@gmail.com,admin@example.com"

# ==============================================================================
# Cloudinary Media Storage (Ảnh sản phẩm, chứng từ hoàn hàng)
# ==============================================================================
CLOUDINARY_NAME="your-cloud-name"
CLOUDINARY_KEY="your-cloudinary-key"
CLOUDINARY_SECRET="your-cloudinary-secret"

# ==============================================================================
# Payment Gateways (Stripe & VNPay)
# ==============================================================================
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRETKEY="sk_test_..."
FE_STRIPE_PUBLISHABLE_KEY="pk_test_..."

VNPAY_TMN_CODE="your-tmn-code"
VNPAY_HASH_SECRET="your-hash-secret"
VNPAY_PAYMENT_URL="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
VNPAY_RETURN_URL="http://localhost:4000/api/orders/payment/vnpay/return"
VNPAY_IPN_URL="http://localhost:4000/api/orders/payment/vnpay/ipn"

# ==============================================================================
# Social OAuth (Google & Facebook)
# ==============================================================================
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
FACEBOOK_APP_ID="your-facebook-app-id"
FACEBOOK_APP_SECRET="your-facebook-app-secret"
```

> [!NOTE]
> Mặc định trong môi trường phát triển local, **Admin API Server** sử dụng cổng **`5001`** để tránh xung đột với tiến trình *AirPlay Receiver* trên macOS (vốn mặc định chiếm cổng 5000).

---

## 🚀 Hướng Dẫn Chạy Môi Trường Phát Triển (Local Development)

Mở **2 cửa sổ Terminal**:

### **Terminal 1: Chạy Backend (Cổng 4000 & 5001)**
```bash
npm run start:dev
```
- **NestJS API Server**: chạy tại `http://localhost:4000`
- **Admin Express Server**: tự động kích hoạt tại `http://localhost:5001` (nếu chưa có tiến trình nào chạy).
- Tự động reload khi bạn chỉnh sửa mã nguồn backend (`--watch`).

> *Mẹo:* Bạn cũng có thể khởi chạy riêng Admin Server độc lập bằng lệnh:
> ```bash
> npm run start:admin
> ```

### **Terminal 2: Chạy Frontend (Angular - Cổng 3000)**
```bash
npm run start:client
```
- **Storefront Khách hàng**: `http://localhost:3000`
- **Trang Quản trị Admin**: `http://localhost:3000/admin` *(Đăng nhập tài khoản có quyền `admin`)*.
- Hỗ trợ Live Reload khi thay đổi code giao diện.

---

## 📑 Bảng Lệnh Thường Dùng (NPM Scripts)

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run start:dev` | Chạy Backend NestJS (port 4000) & tự kích hoạt Admin API (port 5001) với `--watch` |
| `npm run start:client` | Chạy giao diện Frontend Angular trên cổng `3000` |
| `npm run start:admin` | Chạy riêng máy chủ Admin Express API trên cổng `5001` |
| `npm run start:client:https` | Chạy frontend với giao thức bảo mật HTTPS trên cổng `3000` |
| `npm run start:debug` | Chạy backend NestJS ở chế độ Debugger |
| `npm run watch` | Theo dõi và build client ở chế độ development |
| `npm run build:client` | Biên dịch bản build cho Frontend Client |
| `npm run build:server` | Biên dịch bản build cho Backend NestJS |
| `npm run build:ssr` | Biên dịch toàn diện cả Frontend Browser và Server SSR |
| `npm run serve:ssr` | Chạy ứng dụng production đã build SSR (`dist/cheri/server/server.mjs`) |
| `npm start` | Viết tắt của `npm run serve:ssr` |
| `npm run docker:build` | Build Docker image cho toàn bộ dự án |
| `npm run docker:up` | Khởi chạy container Docker ở chế độ nền |
| `npm run docker:down` | Dừng và hạ các container Docker |
| `npm run docker:logs` | Xem logs thời gian thực từ container ứng dụng |
| `npm run lint` | Kiểm tra cú pháp TypeScript/ESLint cho backend |
| `npm run lint:client` | Kiểm tra cú pháp Angular ESLint cho frontend |
| `npm run lint:css` | Kiểm tra định dạng CSS/SCSS bằng Stylelint |
| `npm run format` | Định dạng toàn bộ code backend bằng Prettier |

---

## ⚡ Chạy Môi Trường Production & Server-Side Rendering (SSR)

Để chạy hệ thống với cơ chế SSR tối ưu tốc độ và SEO:

```bash
# 1. Biên dịch ứng dụng SSR
npm run build:ssr

# 2. Khởi chạy Server SSR
npm run serve:ssr
# (hoặc: npm start)
```
Ứng dụng SSR sẽ lắng nghe tại cổng `4000`, tự động phục vụ giao diện storefront và các API backend.

---

## 🐳 Triển Khai Nhanh Bằng Docker & Docker Compose

Dự án cung cấp sẵn cấu hình Docker nhiều tầng (Multi-stage build) và Nginx Reverse Proxy.

### Khởi động nhanh:
```bash
# 1. Sao chép và cấu hình biến môi trường
cp .env.example .env

# 2. Build và khởi chạy container
npm run docker:up
# hoặc: docker compose up -d --build

# 3. Theo dõi log ứng dụng
npm run docker:logs
# hoặc: docker compose logs -f app
```

- **Storefront & API:** `http://localhost:4000`
- **Admin Management API:** `http://localhost:5000`

### Các chế độ chạy Docker Compose:
- **Chạy mặc định:** `docker compose up -d` (kết nối MongoDB Atlas trên cloud).
- **Kèm Nginx Proxy:** `docker compose --profile proxy up -d` (gom API và Frontend về cổng duy nhất 80 / 3000).
- **Chạy Offline Local:** `docker compose --profile local-db up -d` (khởi chạy kèm container MongoDB 7.0 nội bộ).

> 📖 **Xem hướng dẫn chi tiết toàn diện:** Cấu hình VPS Linux, chứng chỉ SSL HTTPS Caddy/Nginx và xử lý lỗi tại **[Tài Liệu Docker Chi Tiết (docs/DOCKER.md)](docs/DOCKER.md)**.

---

## ☁️ Triển Khai Trên Vercel & Thiết Lập Quên Mật Khẩu OTP

Khi triển khai Frontend & Serverless Functions lên **Vercel**:
1. Vercel tự động nhận diện cấu hình trong [`vercel.json`](vercel.json) để điều hướng các route và serverless proxy trong thư mục [`api/`](api/).
2. Trong cài đặt Vercel Project (**Settings $\rightarrow$ Environment Variables**), khai báo biến:
   - `NEST_API_URL`: URL origin của Backend NestJS (ví dụ `https://api.cheri.vn`, không có `/api` ở cuối).
3. Trên máy chủ Backend (VPS / Container): Cần đảm bảo đã cấu hình đầy đủ `SENDGRID_KEY`, `EMAIL_FROM`, `PASSWORD_RESET_SECRET` và `MONGO_URI`.
4. **Quy trình kiểm tra OTP:**
   - Người dùng yêu cầu mã tại trang Quên mật khẩu.
   - SendGrid gửi mã xác nhận 6 số đến email (OTP có hiệu lực trong 5 phút, giới hạn gửi lại sau 60 giây).
   - Xác thực mã OTP thành công cho phép đặt lại mật khẩu mới.

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
Cheri/
├── api/                    # Serverless Functions phục vụ Vercel deployment
├── client/                 # Mã nguồn Angular 20 Frontend (SPA & SSR)
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/      # Các trang và dịch vụ quản trị (Dashboard, Products, Orders,...)
│   │   │   ├── user/       # Giao diện khách hàng (Home, Cart, Checkout, Tracking,...)
│   │   │   ├── services/   # Angular Services (API, Auth, Cart, SEO,...)
│   │   │   └── store/      # State management (NgRx / RxJS BehaviorSubject)
│   │   └── environments/   # Cấu hình môi trường Frontend (Local: 5001, Prod: /api)
├── docker/                 # Cấu hình Nginx reverse proxy
├── docs/                   # Tài liệu kỹ thuật chi tiết (DOCKER.md)
├── server/                 # Mã nguồn Backend NestJS 11 & Express Admin Server
│   ├── admin-server.js     # Express Admin Management Server (cổng 5001 local / 5000 docker)
│   └── src/
│       ├── auth/           # Xác thực người dùng, JWT, Google/Facebook OAuth
│       ├── cart/           # Xử lý giỏ hàng
│       ├── cheri/          # Giao diện trang chủ và cấu hình hiển thị
│       ├── orders/         # Quản lý đơn hàng, VNPay, Stripe, đồng bộ tồn kho
│       ├── products/       # Quản lý danh mục, biến thể và chi tiết sản phẩm
│       ├── recommendations/# Tracking tương tác và thuật toán gợi ý sản phẩm
│       └── services/       # Cloudinary, SendGrid, Google OAuth service integrations
├── compose.yaml            # Docker Compose quản lý multi-container
├── Dockerfile              # Dockerfile Multi-stage build tối ưu cho Node 24
└── vercel.json             # Cấu hình routing & rewrite cho Vercel Serverless
```

---

## 🤝 Đóng Góp & Phát Triển (Contributing)

1. Fork dự án và tạo nhánh mới (`git checkout -b feature/AmazingFeature`).
2. Kiểm tra định dạng code trước khi commit:
   ```bash
   npm run lint
   npm run lint:client
   npm run lint:css
   npm run format
   ```
3. Commit thay đổi (`git commit -m 'feat: Add some AmazingFeature'`).
4. Push nhánh của bạn lên remote (`git push origin feature/AmazingFeature`).
5. Tạo một **Pull Request** mới.

---

## 📄 Bản Quyền (License)

Dự án được phân phối dưới giấy phép **MIT License**. Xem chi tiết tại mã nguồn.
