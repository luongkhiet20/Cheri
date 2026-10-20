# Chatbot Chéri — kết quả kiểm chứng

Ngày kiểm tra: 2026-10-20.

## Phần đã kiểm tra trong môi trường hiện tại

- Server unit/HTTP tests: **42 pass**, contract, lọc catalog và CMS, câu trả lời/policy, Gemini adapter giả lập, handler, limiter, parser Express/Nest, và Vercel wrapper.
- Client tests: **17/17 pass**, HTTP service, hiển thị phản hồi, retry, giới hạn gửi đồng thời, draft khi đang chờ, và lọc URL/thẻ sản phẩm.
- Nest production build: pass. Angular production SSR build: pass.
- Kiểm tra 37 JavaScript bundle trình duyệt: không thấy `GEMINI_API_KEY`, `GoogleGenAI` hoặc `@google/genai`.
- Test MongoDB đa instance được định nghĩa nhưng SKIP nếu thiếu `CHAT_TEST_MONGO_URI`.
- Prompt dùng nhiều cách tư vấn theo tình huống; giá, tồn kho, thuộc tính và nội dung policy vẫn phải dựa vào context backend. Product intro biến thiên chỉ được dùng nếu không chứa tuyên bố thương mại chưa xác minh.

## Chưa xác minh

- **Gemini thật:** `GEMINI_API_KEY` và `GEMINI_MODEL` không có trong môi trường hiện tại. Live test chưa chạy; không khẳng định đường gọi thật tới Google đã nghiệm thu.
- **Folder Drive gốc:** connector trả 404; chưa đọc hay nhập được folder Chat Box. Xem [source-integration.md](source-integration.md).
- **Browser end-to-end:** checker đã khởi chạy Chrome nhưng Chrome DevTools không phản hồi `Network.enable` trong thời gian cho phép ở hai lần chạy. Đây không phải kết quả pass; cần chạy lại trong môi trường Chrome ổn định.
- **Production hosting:** cấu hình Nest/Express/Vercel đã được build/test bằng adapter; chưa xác nhận deploy hoặc giới hạn runtime thực tế của project hosting.

Không sử dụng một website/Shopee khác có tên gần giống làm nguồn chính thức cho thương hiệu này. Nguồn sự thật khi chạy là catalog storefront và CMS public đã xuất bản được backend truy vấn; dữ liệu cửa hàng thật phụ thuộc vào database production.

## Chạy lại

```bash
npm run test:chat:server
npm run test:chat:client
npm run build:server
npm run build:ssr
```

Để kiểm chứng Gemini thật, cấu hình backend-only `GEMINI_API_KEY`, `GEMINI_MODEL`, `CHAT_BACKEND_URL` và chạy:

```bash
CHAT_LIVE_TEST=1 npm run test:chat:live
```

Test dùng 12 câu cách qua ngưỡng một phút để ở trong giới hạn 10 request/phút. Chỉ dùng API key của môi trường kiểm thử có quota phù hợp.
