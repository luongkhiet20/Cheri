# Nguồn Chat Box

Nguồn yêu cầu: https://drive.google.com/drive/folders/1pW14sxUkvovzaphkuTff3IIGmRxmW4w-

Ngày 2026-10-20: Google Drive connector trả NOT_FOUND (404) khi đọc metadata folder. Chưa tải hoặc nhập nội dung nguồn. Yêu cầu đối chiếu folder gốc đang **BLOCKED**.

Trong khi chờ nguồn, chatbot được nối vào widget Angular hiện có tại `client/src/app/user/shared/chat-widget/`; launcher, bố cục storefront, accessibility và bàn phím được giữ lại.

Khi folder truy cập được, cần lập bảng từng source path → destination path, kiểm tra quyền/attribution và chuyển phần cần thiết sang Angular. Không đưa `.env`, API key hoặc dependencies lồng vào frontend. Thiết kế nguồn thay đổi đáng kể cần được đối chiếu với đặc tả đã duyệt.
