# Chéri Gemini Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện widget Chéri với câu trả lời Gemini có dữ liệu công khai, API key ở backend và bằng chứng kiểm thử xuyên suốt.

**Architecture:** Angular gọi POST /api/chat. NestJS và Express/Vercel dùng chung core CommonJS trong server/shared/chat; core kiểm tra request, lấy context công khai, gọi Gemini một lần và xác thực kết quả. Lịch sử chỉ ở bộ nhớ component; MongoDB chỉ lưu bộ đếm giới hạn, không lưu transcript.

**Tech Stack:** Angular 20.2.2, RxJS, NestJS 11, Express 5, MongoDB, Node 24.4.1, SDK chính thức @google/genai; node:test và browser checker theo tiền lệ repo.

**Spec:** [2026-10-20-cheri-chatbot-design.md](../specs/2026-10-20-cheri-chatbot-design.md), đã được người dùng duyệt.

## Global Constraints

Các giá trị sau được giữ nguyên từ spec:

- `message`: string đã trim, từ 1 đến 1000 ký tự.
- `history`: mặc định `[]`, tối đa 10 phần tử; chỉ `user` hoặc `assistant`, mỗi text từ 1 đến 1000 ký tự; không nhận system role hoặc prompt từ frontend.
- `lang`: mặc định `vi`; cho phép `vi`, `en`. Fallback thiếu thông tin luôn dùng nguyên văn câu tiếng Việt đã yêu cầu.
- Chỉ chấp nhận các field đã định nghĩa; body tối đa 16 KiB. Giới hạn tại route và kiểm thử với parser hiện có, tránh thay giới hạn toàn ứng dụng.
- Tìm tối đa 8 ứng viên, ưu tiên bộ lọc trong câu hỏi và lịch sử gần nhất. Không nạp toàn catalog vào prompt; giới hạn context công khai tối đa 12000 ký tự.
- Backend kiểm tra schema, độ dài reply tối đa 1000 ký tự và giao danh sách ID với tập ứng viên; sai schema hoặc claim không có nguồn kiểm chứng thì trả fallback an toàn.
- `products` tối đa 3 phần tử, chỉ có sản phẩm công khai được backend xác thực; bỏ field giá/ảnh nếu không có giá trị hợp lệ. Không cung cấp raw document hoặc trường nội bộ.
- Thiếu thông tin: “Chéri chưa có thông tin này”.
- `GEMINI_API_KEY` và `GEMINI_MODEL` chỉ đọc ở backend. `.env.example` dùng placeholder; không đổi hoặc ghi đè các biến môi trường cũ. Thiếu cấu hình chỉ làm chat unavailable, không làm toàn bộ shop ngừng khởi động.
- Giới hạn 10 request/phút cho mỗi địa chỉ client đã xác minh. Dùng bộ đếm MongoDB với cập nhật atomic và TTL để giới hạn tồn tại qua nhiều instance/serverless; không tin trực tiếp header X-Forwarded-For do khách tự gửi. Không đổi trust proxy toàn ứng dụng khi chưa kiểm tra hạ tầng.
- Một yêu cầu Gemini mỗi lượt chat; timeout 20 giây, không tự retry không giới hạn.
- Không log key, prompt, transcript, raw Gemini response, URI database hoặc lỗi nhà cung cấp ra client. Log chỉ có mã lỗi, request ID và thời gian.
- Response chỉ hiển thị bằng Angular text interpolation; không dùng innerHTML cho nội dung mô hình. Product path phải là route nội bộ hợp lệ.
- Không tuyên bố hoàn tất nhập folder khi chưa đọc được nguồn. Không tuyên bố Gemini end-to-end đã qua nếu chỉ chạy mock hoặc chưa có key hợp lệ; báo chính xác phần còn thiếu.

## Review Focus

1. Request chunked hoặc Content-Length giả: áp dụng giới hạn byte thực tế, không để parser 10 MB chạy trước bộ giới hạn chat; Task 5.
2. History giả danh assistant hoặc prompt injection trong mô tả: không xác nhận thông tin cửa hàng từ dữ liệu không tin cậy; Task 3 và 4.
3. Giá bằng 0, giá sale không hợp lệ, sản phẩm ẩn theo ngôn ngữ và variant hết hàng: không xuất giá/tồn kho giả; Task 2.
4. Serverless nhiều instance và giả mạo proxy header: cùng danh tính phải dùng chung bộ đếm, không dựa vào TTL đã dọn xong; Task 5.
5. Đóng widget hoặc thay draft khi đang chờ rồi retry: chỉ một request/lượt và không nhân đôi tin nhắn; Task 6.

## Trình tự và điều kiện bắt đầu

User yêu cầu được thông báo khi tới bước bắt đầu code. Bản plan này chỉ là tài liệu; chưa cài package hoặc sửa product code. Sau review plan và chốt cách thực thi, thông báo rõ trước khi chạy bước code đầu tiên.

Đề xuất thực thi **Native**, làm tuần tự trong cùng phiên vì core, hai adapter và widget dùng chung một hợp đồng. Chưa phân công subagent. Nếu chọn phương pháp khác, thực hiện theo lựa chọn người dùng và skill tương ứng.

Trước code: dùng using-git-worktrees để kiểm tra workspace cô lập; dùng TDD cho từng task. Kiểm tra status, cập nhật `git pull origin main` trước khi tạo nhánh `feature/cheri-gemini-chatbot`; giữ file untracked có sẵn và `.env`. Không copy secret vào tài liệu. Push nhánh sau khi kiểm tra xong; không force-push và không tự merge main khi chưa có yêu cầu rõ.

Folder Drive đang 404: Task 1 là điều kiện hoàn tất nhập nguồn, không cản các task độc lập 2–6. Task 7 chỉ nghiệm thu đầy đủ khi đã đối chiếu nguồn và gọi Gemini thật. Nếu source thay đổi contract/thiết kế đáng kể, cập nhật thiết kế và review trước khi sửa theo nguồn.

## Hợp đồng dùng chung

Các tên kiểu dưới đây là JSDoc cho CommonJS và interface TypeScript phía client; không tạo dependency server → client.

```typescript
type ChatRequest = { message: string; history: { role: 'user'|'assistant'; text: string }[]; lang: 'vi'|'en' };
type ProductCard = { id: string; title: string; path: string; imageUrl?: string; price?: number };
type PublicProduct = ProductCard & { description: string; categories: string[]; colors: string[]; sizes: string[]; availability: 'available'|'unavailable'|'unknown' };
type PublicPolicy = { id: string; title: string; path: string; text: string };
type PublicContext = { products: PublicProduct[]; policies: PublicPolicy[] };
type ModelAnswer = { status: 'answer'|'unknown'|'out_of_scope'|'abusive'; mode: 'general'|'products'|'policy'; reply: string; productIds: string[]; policyIds: string[] };
type ChatResponse = { reply: string; products: ProductCard[] };
type ChatResult = { status: number; body: ChatResponse | { error: { code: string; message: string } }; headers: Record<string,string> };
```

API shape của request/response/error giữ nguyên spec. Các field `mode`, `policyIds` chỉ nằm giữa Gemini và backend, không mở rộng payload công khai.

## Task 1: Đối chiếu folder Chat Box gốc

**Files:** Create `docs/chatbot/source-integration.md`; Modify các file widget chỉ khi thực hiện Task 6, không nhập nguyên app/dependencies không dùng.

**Interfaces:** Consumes folder Drive ID `1pW14sxUkvovzaphkuTff3IIGmRxmW4w-`; Produces bảng source path → destination path, phần giữ lại và phần cần chuyển đổi.

- [ ] **Step 1:** Thử đọc lại metadata/list folder qua Google Drive; nếu vẫn 404, hỏi cách cấp quyền hoặc vị trí bản local, không tự thay bằng UI khác và gọi là đã nhập nguồn.
- [ ] **Step 2:** Khi có nguồn, đọc cấu trúc và code; xác định framework, assets, tương tác và bất kỳ lệnh gọi API trực tiếp. Không in hoặc mang key từ nguồn sang frontend.
- [ ] **Step 3:** Ghi mapping trong `source-integration.md`, nguồn truy cập, tài nguyên thực sự dùng, cách chuyển sang Angular widget và yêu cầu giữ bản quyền nếu có. Đánh dấu blocked rõ nếu chưa có nguồn.
- [ ] **Step 4:** Xác minh mọi file nguồn cần dùng có điểm đến trong Task 6; kiểm tra không có `.env`, node_modules hoặc project lồng không cần thiết trong staged files.
- [ ] **Step 5:** Commit riêng tài liệu mapping đã có bằng chứng: `docs: record chat box source integration`.

## Task 2: Hợp đồng request và truy xuất context công khai

**Files:** Create `server/shared/chat/chat-contract.cjs`, `server/shared/chat/chat-context.cjs`, `server/test/chat-contract.test.cjs`, `server/test/chat-context.test.cjs`.

**Interfaces:** `validateChatRequest(body: unknown): ChatRequest` ném lỗi có code `INVALID_REQUEST`; `loadPublicContext(db, request: ChatRequest): Promise<PublicContext>`. Input `db` là Mongo native Db của connection hiện có, không mở connection mới mỗi request.

- [ ] **Step 1 — tests:** Thêm `valid_request_gets_defaults`, `rejects_blank_1001_chars_11_history_system_role_extra_fields`, `accepts_1000_chars_10_history_vi_en`. Assert lần lượt defaults `history=[]`, `lang='vi'`; invalid trả code đúng; message được trim.
- [ ] **Step 2 — tests:** Thêm `hidden_root_or_vi_or_requested_language_is_excluded`, `zero_price_is_not_replaced_by_truthy_fallback`, `invalid_sale_does_not_override_regular_price`, `variant_stock_is_not_invented`, `context_excludes_users_orders_reviews_raw`. Fixture có marker bí mật; assert marker không xuất hiện trong context.
- [ ] **Step 3 — red:** Chạy `node --test server/test/chat-contract.test.cjs server/test/chat-context.test.cjs`; xác nhận fail do module/hành vi chưa có, không do fixture lỗi.
- [ ] **Step 4 — implement:** Validation allowlist tất cả object lồng; không nhận Mongo operator từ request. Context đọc `products` với projection allowlist, visibility cấp gốc/vi/lang và truy vấn từ khóa đã escape. Chuẩn hóa dấu tiếng Việt, tách token; giới hạn 50 candidate ở database rồi chấm mức khớp từ khóa/danh mục/màu/ngân sách, chỉ giữ tối đa 8 trong 12000 ký tự. Không có kết quả phù hợp thì không ép gợi ý sản phẩm bất kỳ.
- [ ] **Step 5 — implement:** Chuẩn hóa trường theo lang → vi → root với nullish/giá trị hợp lệ, không dùng `||` cho giá 0. Giá sale chỉ áp dụng khi onSale hợp lệ và giá không âm/không vượt giá thường; variant không xác định thì availability unknown. Path sản phẩm `/${lang}/product/${encodeURIComponent(titleUrl)}` theo `product.module.ts` route `:id`; loại slug rỗng, ký tự điều hướng hoặc reserved slug `all`/`category`. Xác nhận detail API thực sự nhận titleUrl bằng test route trong Task 7.
- [ ] **Step 6 — implement:** Policy lấy `pages_policies`, fallback `pages` theo slug nếu thiếu; exclude draft/inactive/Bản nháp/Ẩn, isPublished false và visibility false theo ngôn ngữ. Chỉ nhận trang có dấu hiệu published/active/isPublished true và nội dung công khai hợp lệ; legacy thiếu dấu hiệu thì bỏ, không suy ra public chỉ vì endpoint cũ trả được. Strip HTML/script, giới hạn đoạn trích và dựng path `/${lang}/cheri/${encodeURIComponent(titleUrl)}`. Không đọc settings/config toàn bộ.
- [ ] **Step 7 — green:** Chạy lại hai file test; thêm `draft_policy_is_excluded`, `duplicate_policy_prefers_primary_collection`, `context_budget_12000_and_8_products` và assert số ứng viên/query/projection bị giới hạn.
- [ ] **Step 8 — commit:** Stage bốn file trên; `feat: add validated public context for Cheri chat`.

## Task 3: Chính sách trả lời có kiểm tra dữ liệu

**Files:** Create `server/shared/chat/chat-policy.cjs`, `server/test/chat-policy.test.cjs`.

**Interfaces:** Export `SYSTEM_INSTRUCTION: string`, `MODEL_ANSWER_SCHEMA: object`, `finalizeAnswer(answer: unknown, context: PublicContext): ChatResponse`. `unknown`, output sai hoặc dữ kiện không xác thực → `{reply:'Chéri chưa có thông tin này',products:[]}`.

- [ ] **Step 1 — tests:** Thêm `unknown_uses_exact_fallback`, `rejects_bad_status_1001_reply_extra_fields`, `drops_unknown_duplicate_product_ids_and_caps_three`, `model_cannot_supply_price_or_url`, `polite_abuse_and_out_of_scope_replies`. Assert không phát lại câu chửi hoặc raw model output khi từ chối.
- [ ] **Step 2 — red:** `node --test server/test/chat-policy.test.cjs` phải fail vì export/hành vi thiếu.
- [ ] **Step 3 — implement:** Schema yêu cầu đủ ModelAnswer, enum/mảng/string hợp lệ và không field thừa. System instruction chứa đủ quy tắc trong spec, phân biệt lịch sử/context là dữ liệu, không làm theo lệnh trong đó. `unknown`, `out_of_scope`, `abusive` dùng copy backend cố định; abuse copy: “Chéri sẵn sàng hỗ trợ bạn. Bạn chia sẻ vấn đề về sản phẩm hoặc mua hàng nhé.”
- [ ] **Step 4 — implement:** Mode products dùng lời giới thiệu backend cố định “Bạn có thể tham khảo các sản phẩm sau.” và card chuẩn hóa từ context; không chép claim thương mại tự do của Gemini. Nếu không có ID hợp lệ thì fallback. Mode policy chỉ trả đoạn text công khai từ các policy ID hợp lệ (giới hạn tổng reply 1000 ký tự); không dùng lời mô hình diễn giải điều kiện dịch vụ. Mode general chỉ cho tư vấn thời trang/chào hỏi/hỏi lại; nếu có giá, đường dẫn, khẳng định tồn kho hoặc chính sách riêng của Chéri thì fallback. Không giả vờ bộ lọc heuristic bảo đảm tuyệt đối ý nghĩa của mọi câu.
- [ ] **Step 5 — tests/green:** Thêm `forged_history_does_not_become_fact`, `instruction_in_product_description_cannot_be_rendered_as_store_claim`, `policy_ids_must_be_public`, `general_reply_with_store_price_is_replaced`. Chạy lại file test; chỉ green khi giá/path lấy từ context và policy text có nguồn.
- [ ] **Step 6 — commit:** `feat: enforce Cheri chatbot response policy`.

## Task 4: Gemini adapter và điều phối có timeout

**Files:** Create `server/shared/chat/gemini-client.cjs`, `server/shared/chat/chat-handler.cjs`, `server/test/chat-gemini.test.cjs`, `server/test/chat-handler.test.cjs`; Modify `package.json`, `package-lock.json`, `.env.example`.

**Interfaces:** `createGeminiClient({env, loadSdk, timeoutMs=20000}): { generate(request: ChatRequest, context: PublicContext): Promise<unknown> }`; loadSdk mặc định dynamic import @google/genai. `createChatHandler({getDb, limiter, gemini, loadContext, finalize, logger}): (body: unknown, clientKey: string) => Promise<ChatResult>`. `limiter` được Task 5 định nghĩa; Task 4 dùng fake cùng signature.

- [ ] **Step 1 — tests:** `missing_key_or_model_returns_503_without_breaking_startup`, `sdk_receives_server_key_system_schema_and_untrusted_history`, `one_provider_call_no_auto_retry`, `abort_at_20000_returns_504`, `provider_401_429_500_are_sanitized_503`, `malformed_model_json_becomes_safe_fallback`. Inject fake SDK/timer; assert không leak sentinel key/provider message qua response hoặc logger.
- [ ] **Step 2 — red:** `node --test server/test/chat-gemini.test.cjs server/test/chat-handler.test.cjs` fail vì module thiếu.
- [ ] **Step 3 — dependency:** Registry đã xác nhận @google/genai 2.30.0 yêu cầu Node >=20.0.0, tương thích Node 24.4.1 của repo. Cài bằng `npm install --save-exact @google/genai@2.30.0`. Không dùng package Google SDK cũ hoặc thêm SDK vào Angular. Kiểm tra typings đã cài xác nhận `models.generateContent`, `systemInstruction`, JSON response schema, abort signal và retry options.
- [ ] **Step 4 — implement:** Lazy khởi tạo GoogleGenAI bằng key môi trường; model bắt buộc từ `GEMINI_MODEL`, không hard-code model suy đoán. Gọi generateContent một lần, roles user/model tương ứng nhưng history không được nâng thành system. System instruction tách riêng; context serialize trong vùng dữ liệu. Dùng JSON schema, tối đa 1024 output tokens, tắt SDK retry/automatic continuation nếu phiên bản hỗ trợ; kiểm thử số transport call để chứng minh chỉ một lần.
- [ ] **Step 5 — implement:** Abort thực sự request provider sau 20000 ms và clear timer; không chỉ Promise.race để request vẫn chạy. Handler thứ tự validate → limit → context → Gemini → finalize. Các lỗi được map vào ChatResult theo spec; thiếu cấu hình/provider lỗi là 503, timeout là 504; không thêm callback debug có secret. History lỗi/greeting không do backend tự tạo.
- [ ] **Step 6 — configuration:** Thêm hai dòng placeholder `GEMINI_API_KEY=your-gemini-api-key` và `GEMINI_MODEL=your-supported-model-id` trong `.env.example`. Không đổi `.env` hoặc biến FE_.
- [ ] **Step 7 — green:** Chạy test Task 2–4; thêm `database_failure_returns_503_without_gemini_call`, `invalid_request_does_not_consume_gemini`, `mocked_assistant_secret_claim_not_authoritative`. Kiểm tra khóa cài đặt chỉ thay package liên quan.
- [ ] **Step 8 — commit:** `feat: connect backend chat to Gemini securely`.

## Task 5: Hai HTTP adapter, giới hạn body và rate limit dùng chung

**Files:** Create `server/shared/chat/chat-limit.cjs`, `server/shared/chat/chat-http.cjs`, `server/src/chat/chat.module.ts`, `server/src/chat/chat.controller.ts`, `server/src/chat/chat.service.ts`, `server/src/routes/chat-routes.js`, `server/test/chat-limit.test.cjs`, `server/test/chat-http.test.cjs`, `server/test/chat-entrypoints.test.cjs`; Modify `server/src/app.module.ts`, `server/src/main.ts`, `server/src/main-ssr.ts`, `server/admin-server.js`, `api/index.js`, `vercel.json`.

**Interfaces:** `createMongoLimiter(db): { consume(clientKey:string, nowMs:number): Promise<{allowed:boolean,retryAfterSeconds:number}> }`; `chatBodyGate` và `chatErrorHandler` Express middleware; `resolveClientKey(req):string`; `createChatRouter({handler})` Express Router; Nest `ChatService.handle(body,clientKey):Promise<ChatResult>`, controller POST api/chat.

- [ ] **Step 1 — tests:** Viết HTTP tests bằng server ephemeral port/native fetch cho Express và Nest standalone test module (không import toàn AppModule gây DB/bootstrap/fork). Chạy cùng bảng 200/400/413/429/503/504 và kiểm tra body shape/Retry-After. Thêm raw HTTP chunked 16385 byte, Content-Length lớn và multibyte UTF-8; assert không gọi core/provider khi quá giới hạn.
- [ ] **Step 2 — tests:** Mongo integration dùng DB test riêng do `CHAT_TEST_MONGO_URI` cung cấp, collection tạm độc lập. 11 consume đồng thời qua hai limiter instances cùng key cho đúng 10 allowed; TTL chưa dọn vẫn cho cửa sổ phút mới; key khác độc lập; duplicate-key race không biến thành 500. Không được chạy test ghi bộ đếm lên DB production.
- [ ] **Step 3 — red:** `node --test server/test/chat-limit.test.cjs server/test/chat-http.test.cjs server/test/chat-entrypoints.test.cjs`. Mongo integration thiếu URI phải report SKIP riêng, không coi đã pass kiểm thử atomic.
- [ ] **Step 4 — implement limit:** Collection `chat_rate_limits`, `_id` hash của canonical client address + phút UTC, `$inc` atomic và `$setOnInsert` expiresAt; TTL index expiresAt expireAfterSeconds 0. Cửa sổ tính từ now, không phụ thuộc TTL xóa. Duplicate-key upsert race retry một lần update không upsert. Không ghi message/transcript/raw IP; DB lỗi thì 503 fail closed.
- [ ] **Step 5 — implement identity:** Local/Nest dùng socket address; chỉ dùng forwarded IP khi kết nối thực sự từ proxy đã được cấu hình tin cậy. Vercel xác minh header IP do platform ghi đè theo tài liệu và topology triển khai trước khi dùng. Chưa chứng minh được thì dùng key chung cho đường proxy và ghi giới hạn độ công bằng, không tin X-Forwarded-For tùy ý hoặc đổi trust proxy toàn app. Test hai request thay X-Forwarded-For vẫn cùng bucket khi peer không tin cậy.
- [ ] **Step 6 — implement body:** Mount parser riêng `/api/chat` với limit 16384 byte trước parser toàn app. Nest khởi tạo `bodyParser:false` ở main và main-ssr, mount chat gate rồi mới parser/default tương đương cho endpoint khác; bảo toàn JSON/urlencoded hiện tại trong setAppDB. Gate phát lỗi có handler JSON cục bộ, không để lỗi chat bị SSR fallback render HTML. Test Content-Type sai là 400; transport abort không để lỗi unhandled.
- [ ] **Step 7 — wire:** Nest ChatService dùng InjectConnection().db; Express router dùng getDb từ connectToMongo. Gắn ChatModule vào AppModule. Gắn route Express sau middleware CORS và trước catch-all; parser phải nằm trước global express.json 10mb. Require shared dùng đường dẫn giữ được ở source và server/dist; test require compiled adapter để xác nhận server/shared không bị thiếu trong runtime.
- [ ] **Step 8 — Vercel entry:** Bọc lỗi connectToMongo trong `api/index.js` cho riêng POST /api/chat thành CHAT_UNAVAILABLE đã sanitize; các endpoint khác giữ luồng cũ. Thêm `functions["api/index.js"].maxDuration = 30` vào vercel.json để có dư thời gian cho Gemini 20s và Mongo; kiểm tra project hosting cho phép 30s, timeout adapter giữ 20s. Nếu hosting thực tế thấp hơn thì cập nhật plan/giá trị trước code thay thế, không suy ra cấu hình tài khoản từ tài liệu chung.
- [ ] **Step 9 — green:** Chạy lại ba test, gồm handler qua `api/index.js` với require cache stub có khôi phục sau test; xác nhận rewrite /api/chat vào đúng index. Kiểm tra startup thiếu key vẫn phục vụ endpoint khác. Chạy lại `npm run test:server` để bắt regression auth/upload. Chạy Mongo integration trên DB test và ghi rõ kết quả riêng.
- [ ] **Step 10 — commit:** `feat: expose safe chat API on Nest and Vercel`.

## Task 6: Nối widget với API và nguồn Chat Box

**Files:** Create `client/src/app/user/shared/chat-widget/chat.models.ts`, `client/src/app/services/chat.service.ts`, `client/test/chat-service.test.cjs`; Modify `client/src/app/user/shared/chat-widget/chat-widget.component.ts`, `.html`, `.css`, `chat-widget.test.cjs`, `chat-widget.browser-check.cjs`; file nguồn thêm theo mapping Task 1 nếu có.

**Interfaces:** `ChatService.send(request:ChatRequest):Observable<ChatResponse>`; widget `sendMessage():void`, `retryMessage():void`, signal `isSending`, `errorMessage` và pending request snapshot; giữ API mở/đóng và draft hiện tại. UI lang lấy vi/en từ route, fallback vi.

- [ ] **Step 1 — tests:** Service mock HttpClient assert POST `${environment.apiUrl}/api/chat`, body đúng, không gọi Google từ browser. Widget inject fake ChatService qua TestBed hoặc constructor phù hợp; cập nhật test gọi `new ChatWidgetComponent()` và SSR shell theo DI mới.
- [ ] **Step 2 — tests:** `send_renders_user_then_reply`, `second_send_while_pending_ignored`, `error_clears_loading_retry_reuses_snapshot_without_duplicate`, `history_last_10_excludes_greeting_errors_and_current_user_message`, `close_open_while_pending_keeps_single_request`, `typing_during_pending_preserves_new_draft`, `destroy_cleans_subscription`, `model_html_is_text`. Giữ nguyên test bàn phím, focus, scroll và admin shell.
- [ ] **Step 3 — red:** `node --test client/test/chat-service.test.cjs client/src/app/user/shared/chat-widget/chat-widget.test.cjs` fail vì behavior mới chưa có.
- [ ] **Step 4 — implement:** HttpClient/RxJS chỉ gửi tới backend; request snapshot chốt trước append user bubble, history lấy các lượt thành công trước request. Dùng finalize xóa loading và cleanup khi destroy; retry không append user bubble lần hai và không đưa failed request vào history. Đóng widget chỉ thu gọn; pending không bị khởi tạo lại.
- [ ] **Step 5 — implement UI:** Loading `role=status`, lỗi ngắn có nút Thử lại, disable gửi khi đang chờ; product card tối đa 3 dùng RouterLink path backend và text interpolation. Image chỉ URL http(s) hợp lệ; không render HTML/Markdown tự do. Copy: “Trợ lý AI Chéri”; ghi chú “Chéri sử dụng Gemini để hỗ trợ trả lời. Bạn vui lòng không gửi thông tin nhạy cảm.” Giữ accessible controls/mobile/safe area. Áp dụng assets/mẫu từ Task 1 theo mapping khi đã có nguồn.
- [ ] **Step 6 — browser harness:** Checker hiện bootstrap component độc lập; thêm HttpClient mock cho UI test, tách mock mode khỏi app thật để không nhận nhầm là kiểm chứng Gemini. SSR test dùng fake service không gọi mạng lúc render.
- [ ] **Step 7 — green:** Chạy lại hai test; chạy `node client/src/app/user/shared/chat-widget/chat-widget.browser-check.cjs`. Kiểm tra desktop/mobile, focus, loading, retry, liên kết và không hiện dashboard. Chỉ lưu artifact liên quan trong `docs/chatbot/` khi đã loại dữ liệu nhạy cảm.
- [ ] **Step 8 — commit:** `feat: enable Gemini conversations in Cheri chat widget`.

## Task 7: Kiểm chứng thực tế, hướng dẫn và push

**Files:** Create `server/test/chat-live.test.cjs`, `docs/chatbot/verification.md`; Modify `README.md`, `package.json`; có thể bổ sung kết quả vào `docs/chatbot/source-integration.md`.

**Interfaces:** Script `test:chat:server` chạy tám file test contract/context/policy/gemini/handler/limit/http/entrypoints bằng danh sách file explicit; `test:chat:client` chạy service và widget tests; `test:chat:live` chạy file live test. Live test chỉ chạy khi `CHAT_LIVE_TEST=1` và backend URL do môi trường cung cấp; không để một lần chạy unit vô tình tốn Gemini quota.

- [ ] **Step 1 — test setup:** Thêm live test dùng request qua HTTP backend thật; thiếu opt-in thì SKIP có lý do. Không load API key vào frontend/test report. Ca đánh giá ghi trong verification.md gồm prompt, expected behavior và kết quả đã sanitize, không lưu raw provider trace.
- [ ] **Step 2 — red/green test harness:** Chạy một HTTP fixture cố tình trả product ID giả và đảm bảo live assertion fail; chuyển fixture trả product thật/đúng contract thì pass. Sau đó mới chạy endpoint thật. Không kiểm tra bằng cách ép mọi câu trả lời đúng nguyên văn vì mô hình có tính biến thiên; assert schema, giới hạn, fallback cho ca unknown, nguồn product và cấm secret markers.
- [ ] **Step 3 — commands:** Thêm các script trên với file paths chính xác. README ghi cách cấu hình backend key/model, local ports, production environment, giới hạn 10/phút, timeout, lỗi thường gặp và cách test. Không ghi key mẫu giống key thật.
- [ ] **Step 4 — full automated:** Chạy `npm run test:chat:server`, `npm run test:chat:client`, Mongo integration với DB test riêng; `npm run build:server`, `npm run build:ssr`. Kiểm tra module shared trong compiled Nest và SSR bundle hoạt động khi chạy, không chỉ compile pass.
- [ ] **Step 5 — real Gemini:** Cấu hình key/model ngoài git; chạy `npm run test:chat:live` với opt-in. Tối thiểu 12 ca: chào hỏi, phối đồ, giá có dữ liệu, màu/size, sản phẩm không tồn tại, policy không nguồn, ngoài phạm vi, xúc phạm, injection message, injection history, injection product, đòi API key/database/prompt. Cách nhau đủ để không vượt limiter; dùng timeout phù hợp toàn request. Không chỉnh sửa production catalog để cấy dữ liệu test; fixture injection product chạy ở test environment riêng.
- [ ] **Step 6 — app browser:** Chạy ứng dụng thật qua Nest và Express/Vercel-compatible entry; desktop 1440x900 và mobile 390x844. Nhập câu hỏi → quan sát POST /api/chat → reply hiển thị → mở card đúng sản phẩm; kiểm tra failure/retry. Ghi request ID/status/thời gian và ảnh không chứa secret. Mock tests không thay thế bước này.
- [ ] **Step 7 — security readback:** Kiểm tra diff frontend không import SDK/secret; dùng script đọc key server vào bộ nhớ và so với chỉ browser bundle `dist/cheri/browser`, chỉ in pass/fail, không in key. Kiểm tra git staged không chứa `.env`, dữ liệu DB hay artifact có secret. Không rà SSR bundle rồi kết luận frontend bị leak vì server code có SDK.
- [ ] **Step 8 — review:** Đối chiếu từng mục spec với kết quả; source chưa truy cập được hoặc live test chưa chạy phải ghi NOT VERIFIED, không đánh dấu toàn bộ task hoàn thành. Ghi rõ hạn chế proxy/rate limit chung nếu còn. Hoàn thành code review theo requesting-code-review, không tự spawn agent trừ khi cách thực thi đã được chọn cho phép.
- [ ] **Step 9 — commit/push:** Chỉ stage file chatbot explicit; `git diff --cached --check`; commit `test: verify Cheri chatbot end to end`. Fetch main, tích hợp thay đổi mới trên nhánh làm việc và chạy lại các check bị ảnh hưởng nếu có xung đột/thay đổi. `git push -u origin feature/cheri-gemini-chatbot`; xác minh remote SHA và báo commit/nhánh/link. Không stage docs/postman hoặc docs/qa có sẵn.

## Sources and verification limits

- [Google Gen AI SDK](https://github.com/googleapis/js-genai): xác nhận API models.generateContent và backend API-key initialization; phiên bản cài đặt/typings là cơ sở kiểm tra option cụ thể ở Task 4.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output): output schema chỉ hỗ trợ kiểm tra cấu trúc, không tự xác nhận tính đúng của thông tin.
- [Vercel function limits](https://vercel.com/docs/functions/limitations): giới hạn phụ thuộc runtime/project; repo chưa cho biết cấu hình hosting thực tế, do đó Task 5 kiểm tra maxDuration trước khi nghiệm thu deployment.

Plan self-review: mapping yêu cầu → Task 1 nguồn; Task 2 dữ liệu/contract; Task 3 quy tắc/output; Task 4 secret/provider; Task 5 HTTP/two runtimes/limits; Task 6 UX; Task 7 build/live/security/push. Năm Review Focus đều có test cụ thể trong task sở hữu. Chưa thực thi checkbox hoặc sửa product code khi viết plan.
