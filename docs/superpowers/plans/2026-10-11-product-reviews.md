# Product Reviews and Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho user đã mua gửi/sửa một đánh giá/product, lưu MongoDB và cập nhật ngay review/rating trên chi tiết và trang chủ.

**Architecture:** Tái sử dụng cấu trúc review hiện hữu sau audit MongoDB; nếu chưa có, lưu embedded reviews trong Product và cập nhật nguyên tử. Backend xác minh quyền bằng JWT và Order hiện hữu; frontend tách API client, review controller, khu vực review và summary dùng chung. Summary override theo productId trong signal store giúp đồng bộ card mà không kích hoạt lại khởi tạo biến thể.

**Tech Stack:** Angular 20.2.2, RxJS hiện hữu, NestJS 11, Mongoose 8.4.1, MongoDB, TypeScript, `node:test`; không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-11-product-reviews-design.md`

Trạng thái: chờ người dùng duyệt plan và chọn cách thực thi. Baseline `ed6ee42`; worktree `.worktrees/product-reviews`, nhánh `feature/product-reviews`. Các checkbox là công việc tương lai, chưa được thực hiện.

## Global Constraints

- Giữ nguyên logic chọn biến thể, tồn kho, giá, số lượng và thêm vào giỏ hàng.
- Đánh giá gắn với product, không gắn với variant, trừ khi cấu trúc MongoDB hiện hữu đã thiết kế khác; khi phát hiện khác biệt phải trình lại thiết kế trước khi triển khai.
- Tái sử dụng cấu trúc/model đánh giá hiện hữu nếu có; không tạo collection/schema trùng lặp.
- Không hardcode review/rating, không dùng API AI bên ngoài, không thêm dependency mới cho chức năng này.
- Không sửa hoặc commit cấu hình MongoDB local của người dùng.
- Không lưu tài khoản, mật khẩu, token, connection string hoặc thông tin cá nhân của khách hàng vào tài liệu, test fixture hay Git.
- Chưa ghi dữ liệu MongoDB khi đang thiết kế/lập plan. Khi triển khai chỉ kiểm thử ghi trên database phát triển đã được xác nhận; không sửa trạng thái đơn thật để tạo điều kiện đánh giá.
- Worktree riêng: `.worktrees/product-reviews`; các thay đổi ngoài phạm vi được giữ nguyên.
- Một review/user/product, được sửa; rating số nguyên 1–5, comment văn bản thuần trim dài 1–1000 ký tự. Không giới hạn 30 ngày.
- PAID HOẶC DELIVERED/COMPLETED; loại CANCELLED/CANCELED, RETURNED và REFUNDED toàn bộ. PARTIALLY_REFUNDED chỉ đủ điều kiện nếu vẫn đạt PAID hoặc DELIVERED.
- Summary `{ average: number | null, count: number }`; count 0 có average null. UI một chữ số thập phân, không lấy rating mặc định 5 làm review thật.
- Không push/PR ở bước lập plan. Sau nghiệm thu mới xóa tài liệu đã hoàn thành theo yêu cầu người dùng.

## Review Focus

1. ID legacy String/ObjectId và paymentStatus trái với nested payment.status: xét đúng sở hữu và ưu tiên trạng thái chính, không mở quyền nhầm (Task 1).
2. Comment bắt đầu `$`, chứa HTML và request đồng thời: lưu literal, không thực thi HTML, không tạo hai review/user/product (Tasks 2, 4, 7).
3. GET cũ trả về sau PUT/đổi product/đổi user: không đè kết quả mới hoặc lộ form user trước (Task 4).
4. Summary đổi khi đã chọn variant và quantity: cập nhật rating nhưng không chạy lại `initProductState` (Task 5).
5. Đơn có nhiều variant cùng product, product bị ẩn hoặc thiếu slug: gộp đúng product, không mở review sai hoặc bypass visibility (Tasks 3, 6).

## File structure và hợp đồng dùng chung

Các file mới nhỏ, mỗi file một trách nhiệm; không refactor toàn bộ service/store. Đường dẫn bên dưới tính từ worktree.

- `server/src/products/reviews/review.types.ts`: các kiểu DTO response/domain server.
- `server/src/products/reviews/purchase-eligibility.ts`: hàm thuần quyền mua và trích product ID theo cấu trúc đã audit.
- `server/src/products/reviews/review-write.ts`: validation, pipeline cập nhật và projection review/summary.
- `server/src/products/reviews/product-reviews.service.ts`: phối hợp Product/Order, xác minh quyền và lưu.
- `server/src/products/reviews/product-reviews.controller.ts`: ba endpoint review và JWT/validation; đăng ký vào ProductsModule.
- `server/src/products/reviews/dto/review.dto.ts`: DTO PUT và query phân trang.
- `server/test/helpers/load-typescript.cjs`: dùng TypeScript đã có để nạp module TS CommonJS cho node:test, không sửa resolver/global runtime ứng dụng.
- `client/src/app/user/shared/reviews/review.models.ts`: hợp đồng frontend tương ứng server.
- `client/src/app/services/product-reviews.service.ts`: HTTP storefront, giữ nguyên lỗi cho caller.
- `client/src/app/user/shared/reviews/review-controller.ts`: state machine/RxJS độc lập Angular để test hành vi bất đồng bộ.
- `client/src/app/user/shared/reviews/product-reviews.component.ts`, `.html`, `.css`: standalone child, form ReactiveForms và danh sách.
- `client/src/app/user/shared/reviews/rating-summary.component.ts`, `.html`, `.css`: standalone summary tái sử dụng, không tự gọi API.
- `client/src/app/user/shared/reviews/rating-view.ts`: formatter text/độ tô sao thuần.
- `client/src/app/user/pages/profile/order-review-links.ts`: tạo danh sách product có thể mở từ đơn, không quyết định quyền backend.
- `client/test/helpers/load-typescript.cjs`: harness TS cho controller/helper; test hành vi bằng RxJS thật, không chỉ grep template.
- Test riêng từng task nằm ở `server/test/product-reviews-*.test.cjs` và `client/test/product-reviews-*.test.cjs`; browser/integration ở Task 7.

### Kiểu API chuẩn

```ts
type ReviewSummary = { average: number | null; count: number };
type PublicReview = { id: string; authorName: string; rating: number; comment: string; createdAt: string; updatedAt: string };
type ReviewDraft = { rating: number; comment: string };
type ReviewPage = { productId: string; summary: ReviewSummary; reviews: PublicReview[]; page: number; pageSize: number; total: number };
type ReviewEligibility = { productId: string; eligible: boolean; reason: 'ELIGIBLE' | 'NOT_PURCHASED'; myReview: PublicReview | null };
type ReviewSaveResult = ReviewPage & { myReview: PublicReview };
```

Định nghĩa tương ứng trong hai file `review.types.ts` và `review.models.ts`, contract test khóa cùng tên/kiểu. Domain server thêm `StoredReview` gồm `_id: Types.ObjectId`, `userId: Types.ObjectId`, `authorName: string`, `rating`, `comment`, `createdAt: Date`, `updatedAt: Date`. authorName do server lấy tên hiển thị từ User, fallback `Khách hàng`, không fallback email.

## Chuẩn thực thi

Mỗi task: test đỏ → implementation tối thiểu → test xanh → kiểm tra diff → commit file cụ thể. Lệnh dưới dùng PowerShell, `npm.cmd`/`npx.cmd`; git dùng `-c safe.directory='<đường dẫn tuyệt đối worktree>'` nếu cần. Không `git add .`, không chạm root dirty config. Không cập nhật dependencies/package-lock nếu không cần.

Hai harness `load-typescript.cjs` cung cấp `loadTypeScript(filePath, mocks = {}): Record<string, unknown>`: transpile TS bằng dependency TypeScript hiện hữu và loader scoped cho từng test, giữ dependency thật như RxJS/Mongoose; chỉ mock Angular/Nest injection tại ranh giới cần thiết. Không sửa global require hook hoặc môi trường ứng dụng. Test HTTP Task 3 phải dùng real Nest controller/validation/guard, không stub controller; test DOM vẫn cần browser Task 7. Lệnh test liệt kê file cụ thể vì PowerShell không bảo đảm expand glob cho chương trình native.

### Task 1: Audit cấu trúc và xác minh quyền mua

**Files:** tạo `server/src/products/reviews/review.types.ts`, `purchase-eligibility.ts`, `server/test/helpers/load-typescript.cjs`, `server/test/product-reviews-eligibility.test.cjs`. Audit ghi kết luận metadata vào mục này, không tạo artifact chứa document thật.

**Interfaces:**
- Consumes: OrderSchema hiện hữu, `User._id`, Product `_id`.
- Produces: `normalizeReviewOrderStatus(value: unknown): string`, `getReviewPaymentStatus(order: ReviewOrder): string`, `getPurchasedProductIds(order: ReviewOrder): string[]`, `isReviewPurchaseEligible(order: ReviewOrder, userId: string, productId: string): boolean` trong `purchase-eligibility.ts`. `ReviewOrder` là shape tối thiểu cho userId/_user/status/paymentStatus/payment/items/cart, định nghĩa trong `review.types.ts`.

- [ ] **Step 1: Kiểm tra baseline sau khi plan được duyệt.** Trong worktree: `git status --short`, `npm.cmd ci`, `npm.cmd run test:order-tracking`, `node --test client/src/app/user/pages/product/product/product-description.test.cjs client/src/app/admin/pages/orders/orders-report-csv.test.cjs`, `npm.cmd run build:server`, `npm.cmd run build:client -- --configuration development`. Kỳ vọng exit 0; nếu baseline lỗi, báo và xin hướng xử lý trước khi quy lỗi cho review. Không khởi động API kết nối Mongo chỉ để chạy build.
- [ ] **Step 2: Audit MongoDB chỉ đọc.** Xác nhận chính xác target phát triển với người dùng; dùng cấu hình local có sẵn nhưng không in URI. Chỉ kiểm tra collection names, index definitions, field types/review shape và legacy cart product path. Không dump document/PII, không tạo collection/index/seed. Nếu đã có reviews/model khác, cập nhật spec/plan và xin duyệt trước khi tiếp tục Tasks 2–7. Nếu Mongo chưa kết nối, vẫn làm test thuần nhưng đánh dấu audit chưa đạt; chưa triển khai fallback schema như thể đã audit.
- [ ] **Step 3: Viết test `purchase eligibility is tied to one owned order` và các ca trạng thái/ID.** Fixture tổng hợp; assertions:

```js
assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, productId), true);
assert.equal(isReviewPurchaseEligible(ownedDeliveredOrder, userId, productId), true);
assert.equal(isReviewPurchaseEligible(ownedPaidOrder, otherUserId, productId), false);
assert.equal(isReviewPurchaseEligible(ownedPaidOrder, userId, otherProductId), false);
assert.equal(isReviewPurchaseEligible({ ...ownedPaidOrder, status: 'RETURNED' }, userId, productId), false);
assert.equal(getReviewPaymentStatus({ paymentStatus: 'PENDING', payment: { status: 'PAID' } }), 'PENDING');
```

Thêm table test cho CANCELLED/CANCELED, REFUNDED dù DELIVERED, unpaid/PENDING, COMPLETED, PARTIALLY_REFUNDED+DELIVERED và PARTIALLY_REFUNDED+PENDING; String/ObjectId cho cả `_user`/userId; guest email trùng không mở quyền; variantId không phải productId; đơn A của user và đơn B chứa product không kết hợp thành quyền; legacy cart đúng path được audit; không có deadline 30 ngày.
- [ ] **Step 4: Chạy test đỏ.** `node --test server/test/product-reviews-eligibility.test.cjs`; FAIL vì module/hàm chưa có, không vì fixture/harness sai.
- [ ] **Step 5: Implement interfaces bằng so sánh canonical ID và tất cả điều kiện trong cùng đơn.** Không đọc/ghi Mongo trong helper; giữ chính sách backend có thể tái sử dụng cho UI hint nhưng UI không thay thế xác minh server.
- [ ] **Step 6: Chạy lại test Task 1.** Kỳ vọng 0 failures; ghi số test thực tế và kết luận audit. Không đánh dấu audit hoàn thành nếu chỉ có snapshot repo.
- [ ] **Step 7: Commit đúng các file Task 1.** Note: `feat: xác minh quyền đánh giá theo đơn hàng đã mua`.

### Task 2: Lưu một review/product và summary nguyên tử

**Files:** tạo `server/src/products/reviews/review-write.ts`, `product-reviews.service.ts`, `server/test/product-reviews-persistence.test.cjs`; sửa `server/src/products/schemas/product.schema.ts`, `server/src/products/models/product.model.ts`, `server/src/products/products.module.ts`.

**Interfaces:**
- Consumes: Task 1; Mongoose Product/Order hiện hữu, user từ GetUser.
- Produces: `validateReviewDraft(input: unknown): ReviewDraft`, `buildReviewUpdatePipeline(userId: Types.ObjectId, reviewId: Types.ObjectId, authorName: string, draft: ReviewDraft, now: Date): object[]`, `summarizeReviews(reviews: StoredReview[]): ReviewSummary`, `toPublicReview(review: StoredReview): PublicReview` trong `review-write.ts`.
- Produces: `ProductReviewsService.getPage(productId: string, page: number, pageSize: number): Promise<ReviewPage>`, `.getMine(productId: string, user: User): Promise<ReviewEligibility>`, `.saveMine(productId: string, user: User, draft: ReviewDraft): Promise<ReviewSaveResult>`.

- [ ] **Step 1: Viết test validation, pipeline và service với Product/Order repository doubles.** Assertions chính:

```js
assert.deepEqual(validateReviewDraft({ rating: 5, comment: '  Tốt  ' }), { rating: 5, comment: 'Tốt' });
assert.throws(() => validateReviewDraft({ rating: 1.5, comment: 'Tốt' }));
assert.throws(() => validateReviewDraft({ rating: 5, comment: 'x'.repeat(1001) }));
assert.deepEqual(summarizeReviews([{ rating: 5 }, { rating: 4 }]), { average: 4.5, count: 2 });
assert.deepEqual(summarizeReviews([]), { average: null, count: 0 });
assert.equal(publicReview.authorName.includes('@'), false);
assert.deepEqual(Object.keys(publicReview).sort(), ['authorName', 'comment', 'createdAt', 'id', 'rating', 'updatedAt']);
```

Thêm 0/6/string rating, trim rỗng, comment đúng 1000, body dư userId/variantId/authorName, nội dung `$price` được `$literal`, giữ reviewId/createdAt khi sửa, count không tăng; model spy xác nhận chỉ một atomic Product write không read-then-push; không đủ quyền không ghi; lỗi model truyền về lỗi API chứ không thành công. Pipeline test kiểm tra stages/giá trị literal; không dùng mô phỏng JS để tuyên bố đã chứng minh atomic Mongo.
- [ ] **Step 2: Chạy test đỏ.** `node --test server/test/product-reviews-persistence.test.cjs`; FAIL đúng hành vi thiếu.
- [ ] **Step 3: Implement fallback embedded chỉ sau audit Task 1 xác nhận chưa có cấu trúc khác.** Thêm review subdocument trong ProductSchema hiện hữu, không `MongooseModule.forFeature` tên Review/collection mới. Inject OrderSchema hiện hữu trong ProductsModule, không kéo OrdersService/Stripe/mail vào review. DTO/domain validate/cast trước pipeline. Thêm stage thay review cùng user hoặc append mới, stage sau tính rating từ mảng mới; dedup các entry cùng user nếu có dữ liệu trùng legacy trong chính lần sửa, không chạy migration bulk. Chưa có reviews dùng mảng rỗng. Không cần unique multikey index/transaction.
- [ ] **Step 4: Implement service.** Chỉ xét đơn sở hữu qua userId/_user String/ObjectId, gọi helper Task 1 với product ID canonical. Check visibility giống product storefront trước mọi read/write; query cập nhật cũng chặn product đã ẩn. Từ atomic write dùng `returnDocument: 'after'`/tùy chọn Mongoose tương ứng để dựng summary/page/myReview; không tính từ bản đọc cũ. GET phân trang mới nhất theo updatedAt giảm dần, ID phụ giảm dần; chỉ populate/project tên cần thiết, không trả raw Product/User. Mongo thất bại không bắt và đổi thành mảng rỗng.
- [ ] **Step 5: Chạy test Task 1–2 và build server.** `node --test server/test/product-reviews-eligibility.test.cjs server/test/product-reviews-persistence.test.cjs`; `npm.cmd run build:server`; exit 0. Concurrent thật và durability để Task 7, chưa claim đã kiểm chứng.
- [ ] **Step 6: Commit đúng file Task 2.** Note: `feat: lưu đánh giá sản phẩm và tính điểm trung bình nguyên tử`.

### Task 3: API review, summary sản phẩm và bảo vệ field hệ thống

**Files:** tạo `server/src/products/reviews/product-reviews.controller.ts`, `dto/review.dto.ts`, `server/test/product-reviews-api.test.cjs`; sửa `products.module.ts`, `server/src/shared/utils/prepareUtils.ts`, `server/src/products/products.service.ts`, `server/admin-server.js` chỉ tại whitelist ghi sản phẩm, `package.json` chỉ thêm script test.

**Interfaces:**
- Consumes: Task 2 service và response types.
- Produces: ba endpoint đúng Spec §5; body PUT `{ rating, comment }`; query mặc định page 1/pageSize 10, pageSize tối đa 50.
- Produces: product response mới có `reviewSummary: ReviewSummary`, không trả embedded `reviews`; `prepareProduct` vẫn giữ hợp đồng các field cũ.
- Produces: `test:product-reviews:server` = `node --test server/test/product-reviews-eligibility.test.cjs server/test/product-reviews-persistence.test.cjs server/test/product-reviews-api.test.cjs`, không bao gồm integration ghi DB.

- [ ] **Step 1: Viết API test bằng Nest app cục bộ port tạm, real controller/validation/JWT guard và injected model doubles.** JWT test tạo trong bộ nhớ bằng fixture user/key test, không log/lưu token. Assert guest GET page 200, GET/PUT me 401; thiếu đơn GET me 200 eligible false và PUT 403; sai ID 400, thiếu/ẩn product 404; PUT hợp lệ 200 có page đầu 10/myReview/summary; page 0/1.5, pageSize 51, body rating string/field dư 400; model lỗi 5xx và response không chứa stack/URI. Sản phẩm slug/variant không thay canonical product ID; generic route `/:name` không nuốt review routes.

```js
assert.equal(guestPut.status, 401);
assert.equal(nonBuyerPut.status, 403);
assert.equal(successfulPut.status, 200);
assert.deepEqual(successfulPut.body.summary, { average: 4.5, count: 2 });
assert.equal(successfulPut.body.pageSize, 10);
assert.equal(JSON.stringify(publicPage.body).includes('userId'), false);
assert.deepEqual(preparedUnreviewedProduct.reviewSummary, { average: null, count: 0 });
```

Thêm response whitelist test không lộ reviews/userId ngay cả strict:false và langData có field review/rating; summary canonical phải được gán sau langData. Add/edit/import qua Nest và admin server không ghi đè reviews/rating/reviewSummary/reviewCount từ body, nhưng các field sản phẩm hợp lệ vẫn ghi như cũ.
- [ ] **Step 2: Chạy test đỏ.** `node --test server/test/product-reviews-api.test.cjs`.
- [ ] **Step 3: Implement controller/DTO và đăng ký ProductsModule.** Tái sử dụng AuthModule/JwtStrategy hiện hữu, không định nghĩa strategy/secret mới cho review; AuthGuard('jwt') + GetUser cho me/PUT, không admin bypass. DTO whitelist + forbidNonWhitelisted, rating không implicit convert từ string, comment trim trước validate. Chuẩn hóa lỗi đã nêu, không xuất dữ liệu nhạy cảm. Không thêm endpoint review vào admin-server.
- [ ] **Step 4: Implement product response summary và whitelist writes.** Tính summary từ reviews thật đã tải, không thêm query/User populate theo từng card. Mảng reviews không serialize qua chuẩn bị product hoặc spread langData. Bảo vệ field hệ thống ở cả Nest và admin product writers; không đụng cấu hình MongoDB local của root, shipping hoặc sync variant.
- [ ] **Step 5: Chạy `npm.cmd run test:product-reviews:server`, `npm.cmd run test:order-tracking`, `npm.cmd run build:server`.** Kỳ vọng 0 failures/exit 0; diff package chỉ script, không lock/dependency/config.
- [ ] **Step 6: Commit đúng file Task 3.** Note: `feat: cung cấp API đánh giá và bảo vệ dữ liệu rating`.

### Task 4: UI gửi/sửa review và xử lý trạng thái bất đồng bộ

**Files:** tạo `client/src/app/user/shared/reviews/review.models.ts`, `review-controller.ts`, `product-reviews.component.ts`, `.html`, `.css`, `client/src/app/services/product-reviews.service.ts`, `client/test/helpers/load-typescript.cjs`, `client/test/product-reviews-ui.test.cjs`; sửa `client/src/app/user/pages/product/product.module.ts`, `product/product.component.ts`, `.html`, `.css` chỉ điểm mount review; `package.json` thêm script client.

**Interfaces:**
- Consumes: Task 3 API; selectors.user, canonical product._id, ngModule và interceptor hiện hữu.
- Produces: `ProductReviewsApi.getPage(productId: string, page?: number, pageSize?: number): Observable<ReviewPage>`, `.getMine(productId: string): Observable<ReviewEligibility>`, `.saveMine(productId: string, draft: ReviewDraft): Observable<ReviewSaveResult>` trong service.
- Produces: `ReviewController(api: ReviewApiPort)`, `state$: Observable<ReviewUiState>`, `summaryChanged$: Observable<{ productId: string; summary: ReviewSummary }>`, `.setContext(productId: string | null, userId: string | null): void`, `.loadPage(page: number): void`, `.setDraft(draft: ReviewDraft): void`, `.submit(): void`, `.retry(): void`, `.destroy(): void`; các type `ReviewApiPort`, `ReviewUiState` trong controller, chứa page/eligibility/draft/loading/submitting/error/success và context revision.
- Produces: `ProductReviewsComponent` selector `app-product-reviews`, inputs `productId: string`, `lang: string`, output `summaryChanged`; `.focusReviews(): void` focus heading/cuộn trong popup bằng DOM browser-only. API lỗi không bị service catch thành response thành công giả.

`ReviewApiPort` dùng đúng ba signatures Observable của ProductReviewsApi. `ReviewUiState` có `productId: string | null`, `userId: string | null`, `revision: number`, `page: ReviewPage | null`, `eligibility: ReviewEligibility | null`, `draft: ReviewDraft`, `loadingPage: boolean`, `loadingEligibility: boolean`, `submitting: boolean`, `error: { kind: 'page' | 'eligibility' | 'validation' | 'auth' | 'forbidden' | 'submit'; message: string } | null`, `success: string | null`. Draft ban đầu rating 0/comment rỗng, không chọn sẵn 5 sao; sau submit thành công lấy draft từ myReview.

- [ ] **Step 1: Viết controller/API-client test dùng RxJS Subject để điều khiển thứ tự response.** Spy URL localhost/storefront interceptor giữ nguyên; guest không GET me hoặc submit. Assert NOT_PURCHASED không form, existing review điền draft, validation chặn rating/comment sai, gửi trùng chỉ một PUT, success cập nhật page/summary/myReview và edit không tăng count; 401 cần đăng nhập, 403 đóng form, 5xx/network giữ draft và retry; GET page lỗi không hiển thị empty success.

```js
assert.equal(apiCalls.filter(x => x.method === 'PUT').length, 1);
assert.deepEqual(latestState.page.summary, { average: 4.5, count: 2 });
assert.equal(latestState.draft.comment, 'Bản nháp chưa gửi được');
assert.equal(staleResultApplied, false);
assert.equal(previousUserReviewVisibleAfterLogout, false);
```

Test đổi product A→B, user U→V/null và destroy trong lúc GET/PUT; GET cũ đến sau save không đè response save. Comment HTML chỉ text; thêm template contract assertion nhưng không dùng nó thay browser test Task 7.
- [ ] **Step 2: Chạy test đỏ.** `node --test client/test/product-reviews-ui.test.cjs`.
- [ ] **Step 3: Implement service/controller.** GET/PUT theo canonical ID, truyền errors; context generation và cancellation cho cả product/user, revision sau write bỏ GET cũ. State reset riêng tư khi auth đổi, không mang draft giữa user/product; đang gửi khóa submit, không optimistic success. Đăng nhập returnUrl chỉ dùng route local hiện hữu.
- [ ] **Step 4: Implement component/template và mount child trong ProductModule.** ReactiveForms rating radio 1–5 (bàn phím/label), textarea maxlength 1000; text `Gửi đánh giá`/`Cập nhật đánh giá`, loading/empty/error/retry/success inline với aria-live. Hiển thị comment bằng interpolation, không innerHTML. Đặt khu vực review trong popup dưới thông tin sản phẩm; không thay xử lý variation/gallery/cart, không chuyển ProductComponent standalone. Luôn đọc public reviews khi chưa login.
- [ ] **Step 5: Chạy test và build client.** Thêm script `test:product-reviews:client` = `node --test client/test/product-reviews-ui.test.cjs`; Task 5 thêm `client/test/product-reviews-rating.test.cjs`, Task 6 thêm `client/test/product-reviews-profile.test.cjs` khi các file được tạo. Chạy script + `npm.cmd run build:client -- --configuration development`; exit 0. Test controller chưa thay kiểm thử DOM thực tế.
- [ ] **Step 6: Commit đúng file Task 4.** Note: `feat: thêm giao diện gửi và chỉnh sửa đánh giá sản phẩm`.

### Task 5: Dòng rating trang chủ/chi tiết và đồng bộ không reset variant

**Files:** tạo `rating-view.ts`, `rating-summary.component.ts`, `.html`, `.css` dưới `client/src/app/user/shared/reviews/`, `client/test/product-reviews-rating.test.cjs`; sửa `client/src/app/user/shared/models.ts`, `client/src/app/store/signal.store.selectors.ts`, `signal.store.ts`, `client/src/app/user/pages/cheri/home/home.component.ts`, `.html`, `.css`, `client/src/app/user/pages/product/product.module.ts`, `product/product.component.ts`, `.html`, `.css`, `package.json` chỉ mở rộng script test client.

**Interfaces:**
- Consumes: Task 4 summaryChanged và Task 3 product.reviewSummary.
- Produces: `formatReviewSummary(summary: ReviewSummary): string`, `getStarFill(average: number | null, starIndex: number): number` trong rating-view (starIndex 0–4, kết quả 0–100).
- Produces: selectors `reviewSummaries` map productId→ReviewSummary; `SignalStore.updateProductReviewSummary(productId: string, summary: ReviewSummary): void`, `.resolveProductReviewSummary(product: Product): ReviewSummary`; ưu tiên override trong cùng phiên trên response cũ, nếu chưa có dùng reviewSummary canonical, thiếu thì `{ average: null, count: 0 }`.
- Produces: `RatingSummaryComponent` selector `app-rating-summary`, inputs summary/showStars/interactive, output activate. Trang chủ showStars=false/interactive=false; chi tiết true/true nối focusReviews().

- [ ] **Step 1: Viết formatter/store test.** Assertions:

```js
assert.equal(formatReviewSummary({ average: 4.75, count: 12 }), '4,8/5 · 12 đánh giá');
assert.equal(formatReviewSummary({ average: null, count: 0 }), 'Chưa có đánh giá');
assert.equal(getStarFill(4.5, 4), 50);
assert.equal(getStarFill(null, 0), 0);
assert.equal(productAfterSummaryUpdate, originalProductReference);
assert.equal(initProductStateCallsAfterSummaryUpdate, 0);
assert.deepEqual(otherProductSummaryAfterUpdate, otherProductSummaryBeforeUpdate);
```

Gắn regression vào subscription thật của ProductComponent bằng harness dependencies: chọn variant, quantity 3, cập nhật summary; selectedVariant/quantity/price/gallery giữ nguyên. Home section lấy product từ cùng products signal nên override canonical có hiệu lực ở slider/grid/fallback, kể cả GET products cũ vừa về; summary update không tạo HTTP request/card. Test link activate bằng keyboard và event không lan ra nút đóng popup/card.
- [ ] **Step 2: Chạy test đỏ.** `node --test client/test/product-reviews-rating.test.cjs`.
- [ ] **Step 3: Implement summary map và component.** Product type thêm optional reviewSummary. Dùng signal riêng cho overrides, không thay `productState.product` nên subscription `initProductState` không chạy lại; các view gọi resolveProductReviewSummary(product) với product._id. Không sửa logic biến thể. Reset override khi kết thúc phiên nếu cần nhưng không cache review riêng tư; không merge dữ liệu qua product ID khác.
- [ ] **Step 4: Mount dưới tên mọi card trang chủ và dưới tên chi tiết.** Chỉ một dòng nhỏ; formatter vi-VN một chữ số; năm sao partial bằng CSS, aria-hidden và text accessible. Chi tiết dùng button/link đúng semantics; focus vào child review heading. Count 0 không sao tô, không fake5; API lỗi có thông báo riêng tại khu vực review. OnPush lấy signal cập nhật, responsive width 360px không tràn; giữ cấu hình CMS nguyên vẹn.
- [ ] **Step 5: Chạy client tests, product description regression và build.** `npm.cmd run test:product-reviews:client`; `node --test client/src/app/user/pages/product/product/product-description.test.cjs`; `npm.cmd run build:client -- --configuration development`; exit 0. Browser xác nhận variant không reset ở Task 7.
- [ ] **Step 6: Commit đúng file Task 5.** Note: `feat: hiển thị rating đồng bộ trên trang chủ và chi tiết sản phẩm`.

### Task 6: Nối nút đánh giá trong tài khoản tới từng product

**Files:** tạo `client/src/app/user/pages/profile/order-review-links.ts`, `client/test/product-reviews-profile.test.cjs`; sửa `client/src/app/user/pages/profile/profile.ts`, `profile.html`, `profile.css`, `client/src/app/user/pages/product/product/product.component.ts` chỉ xử lý query mở review, `package.json` chỉ mở rộng script test client; nếu resolver cần hỗ trợ ID, sửa `server/src/products/products.service.ts` đúng phương thức getProductByName và thêm regression vào `server/test/product-reviews-api.test.cjs`.

**Interfaces:**
- Consumes: order user hiện hữu; chính sách Task 1, productId canonical; Task 4 focusReviews.
- Produces: `getOrderReviewProducts(order: Order): Array<{ productId: string; title: string }>`, `canShowOrderReviewAction(order: Order): boolean` trong order-review-links; đây là UI hint, không cấp quyền.
- Produces: `Profile.openProductReview(productId: string): void`, `ProductComponent.focusReviewsFromQuery(): void`; route `/:lang/product/:productId?review=1` sử dụng product resolver Mongo ID hiện hữu sau test xác nhận; query chỉ có review=1.

- [ ] **Step 1: Viết test order links/status.** Assert hai variant cùng product chỉ một lựa chọn; nhiều product đều có mục riêng; PAID chưa giao vẫn hiện nút; DELIVERED hiện; CANCELLED/RETURNED/REFUNDED không hiện; không suy ra product từ variantId/SKU hay description; legacy chỉ path đã audit. Thiếu productId không dựng link giả, hiển thị giải thích; productId không có slug vẫn resolve đúng bằng API getProductByName hỗ trợ Mongo ID; bị ẩn không mở form vòng qua visibility. Không hiện deadline 30 ngày.

```js
assert.equal(getOrderReviewProducts(twoVariantsSameProduct).length, 1);
assert.equal(canShowOrderReviewAction(paidPendingOrder), true);
assert.equal(canShowOrderReviewAction(returnedOrder), false);
assert.deepEqual(navigationQuery, { review: 1 });
assert.equal(reviewDeadlineDisplayed, false);
```

- [ ] **Step 2: Chạy test đỏ.** `node --test client/test/product-reviews-profile.test.cjs`.
- [ ] **Step 3: Implement helper và handler profile.** Một product dẫn thẳng; nhiều product mở danh sách lựa chọn inline trong card đơn, dedup bằng productId. Giữ filter/tabs/tra cứu đơn hiện hữu; chỉ gỡ deadline review cũ và thay placeholder. Nếu resolver hiện hữu không nhận Mongo ID, mở rộng đúng nhánh read product bằng ID có regression test, không thêm lookup email/orderId hoặc đổi variant resolver.
- [ ] **Step 4: Implement focus theo query.** Chỉ focus sau product và review child đã mount, browser-only, không focus liên tục khi rating đổi. Deep-link và refresh vẫn hoạt động, logout vẫn chỉ đọc và yêu cầu đăng nhập để gửi.
- [ ] **Step 5: Chạy client tests, server API test về resolver/visibility, build client/server.** `npm.cmd run test:product-reviews:client`; `node --test server/test/product-reviews-api.test.cjs`; `npm.cmd run build:client -- --configuration development`; `npm.cmd run build:server`. Exit 0; xác nhận không thay đổi đơn/trạng thái thật.
- [ ] **Step 6: Commit đúng file Task 6.** Note: `feat: mở đánh giá từng sản phẩm từ đơn hàng cá nhân`.

### Task 7: MongoDB integration, browser thật và bàn giao

**Files:** tạo `server/test/integration/product-reviews-mongo.test.cjs` và `docs/testing/product-reviews-acceptance.md` (chỉ kết quả không chứa PII); sửa test đã có khi thêm regression thật. Không đưa cấu hình local vào Git.

**Interfaces:**
- Consumes: toàn bộ Tasks 1–6 và database phát triển đã xác nhận.
- Produces: bằng chứng persistence/concurrency/UI/build, danh sách phần chưa xác minh; không tự coi skipped integration là PASS.

- [ ] **Step 1: Viết integration test opt-in, bị tắt mặc định và yêu cầu hai gate.** Cấu hình process-memory/env local không commit, xác nhận database phát triển cụ thể và quyền tạo fixture riêng trước khi test có ghi. Không nhận URI/token qua CLI hoặc in ra. Fixture chỉ trong collections hiện hữu và user/product/order ID tổng hợp thuộc test; trường hợp chưa cho phép fixture thì không chạy ghi, chỉ test thủ công trên product/đơn đã được người dùng xác nhận. Cleanup chỉ đúng ID đã tạo trong run này, không deleteMany rộng/drop DB.
- [ ] **Step 2: Chạy integration đỏ trên target được phép trước khi hoàn thiện regression.** `node --test server/test/integration/product-reviews-mongo.test.cjs` với gates trong process; assertion thiếu phải FAIL, gate thiếu phải SKIP kèm lý do. Không rollback code production bằng lệnh git destructive. Nếu chưa được phép, ghi chưa xác minh thay vì chạy để có số PASS.
- [ ] **Step 3: Test Mongo thật.** Assert 10 PUT song song cùng user/product chỉ count1; thêm user thứ hai rating3 sau user đầu rating5 cho average4/count2; sửa user đầu rating1 cho average2/count2 và createdAt không đổi; đọc lại/new service instance vẫn có review; payload `$price` lưu literal; không có collection Review mới. Thực thi pipeline thật, không mock concurrency. Ghi đúng tài liệu được phép; không đổi đơn thật. Fix phát hiện phải có regression đỏ→xanh.
- [ ] **Step 4: Kiểm thử browser thật với API local và tài khoản được cung cấp chỉ dùng tương tác đăng nhập.** Bắt đầu backend chỉ sau target Mongo xác nhận; kiểm tra cổng để không ghi đè dịch vụ local đang chạy. Các lệnh `npm.cmd run start:dev`/`npm.cmd run start:client` trong worktree, helper background Windows dùng cửa sổ ẩn. Test viewport 360px và desktop: guest/read/login, NOT_PURCHASED, PAID-before-delivery, delivered, edit; một dòng rating ở slider/grid/fallback; link sao focus đúng; submit khóa; 400/401/403/5xx và network giữ draft; comment HTML không thực thi; thay route/logout khi request chậm; chọn variant/quantity rồi submit không reset. Trường hợp tài khoản không có đơn hợp lệ ghi nhận, không tự seed để vượt quyền. Không coi helper/grep tests thay DOM thực.
- [ ] **Step 5: Chạy verification đầy đủ.** `npm.cmd run test:product-reviews:server`; `npm.cmd run test:product-reviews:client`; `npm.cmd run test:order-tracking`; `node --test client/src/app/user/pages/product/product/product-description.test.cjs client/src/app/admin/pages/orders/orders-report-csv.test.cjs`; `npm.cmd run build:server`; `npm.cmd run build:client -- --configuration development`; `git diff --check`. Ghi số test, exit code, warning có sẵn và phần integration/browser chưa test. Không dùng script lint hiện hữu `--fix` trên toàn repo; nếu lint, chạy scoped không auto-fix các file ngoài phạm vi.
- [ ] **Step 6: Review toàn nhánh theo spec, rồi ghi kết quả acceptance.** Soát từng yêu cầu và Review Focus; diff chỉ review/rating/tài liệu/test liên quan, không đổi variant, dependencies hoặc Mongo config; công khai không lộ dữ liệu. Nếu chọn Native, sau khi test/build đạt mới dùng một reviewer độc lập theo `requesting-code-review`; nếu chọn Subagent-driven, thêm whole-branch review sau review từng task. Sửa lỗi cần regression và chạy lại lệnh liên quan.
- [ ] **Step 7: Commit kết quả kiểm thử.** Note: `test: kiểm chứng lưu đánh giá và cập nhật rating đầu cuối`; chỉ file acceptance/test hợp lệ. Nếu Mongo/browser còn thiếu không báo hoàn tất Task 7, bàn giao phần đã làm với lý do và cách tiếp tục.
- [ ] **Step 8: Sau nghiệm thu, xóa hai tài liệu đã hoàn thành và commit bàn giao.** Chỉ `docs/superpowers/specs/2026-10-11-product-reviews-design.md` và `docs/superpowers/plans/2026-10-11-product-reviews.md`; giữ acceptance và code/tests, không xóa cả thư mục. Note: `chore: dọn tài liệu kế hoạch đánh giá đã hoàn thành`. Push/PR chỉ khi người dùng yêu cầu; PR nêu checklist Mongo/browser thật và giới hạn còn lại.

## Phụ thuộc và cách thực thi

Thứ tự: 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 2 trở đi bị chặn nếu audit phát hiện cấu trúc review khác chưa được duyệt. Thiếu Mongo có thể làm test thuần/quyền, nhưng không kết luận schema hay hoàn tất integration.

Đề xuất **Native**: tôi triển khai tuần tự trong worktree này, test từng task, một review độc lập cuối nhánh; các task phụ thuộc hợp đồng và trạng thái chung nên cách này ít đổi context. **Subagent-driven** là lựa chọn khác: agent riêng triển khai/review từng task, kỹ hơn nhưng chi phí cao hơn. Chưa tự spawn agent hay triển khai trước khi người dùng duyệt plan và chọn cách thực thi.

## Self-review trước bàn giao plan

- [x] Spec §1–4: constraints/audit/eligibility/storage có Task 1–2 và test cụ thể.
- [x] Spec §5: API, auth, projection, phân trang, lỗi và bảo vệ field có Task 3.
- [x] Spec §6: form/state/rating/profile có Task 4–6; không reset biến thể bằng summary signal riêng.
- [x] Spec §7–8: Mongo/browser thật, hồi quy, quyền ghi, handoff/dọn tài liệu có Task 7.
- [x] Interfaces trước/sau dùng cùng response types; các tên helper/controller/store đều có file và task định nghĩa.
- [x] Năm Review Focus có assertions/verification trong task sở hữu; không chỉ test source-string rồi tuyên bố chạy được.
- [x] Không placeholder/TODO, không implementation body dài; giữ audit khác cấu trúc là gate rõ ràng, không quyết định thay người dùng.
