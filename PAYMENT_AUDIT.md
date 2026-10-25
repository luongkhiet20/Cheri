# Rà soát thanh toán Chéri — 24/10/2026

## Kết luận về bill hiển thị COD

Đơn `CHE1792769018030561` được kiểm tra trực tiếp trong MongoDB `cheri` ngày 23/10:

- Tổng tiền: 1.254.000 VND.
- `payment.method`, `payment.provider`, `paymentMethodSnapshot.code`: `VNPAY`.
- `paymentStatus` và `payment.status`: `PAID`; đơn `CONFIRMED`.
- Có giao dịch VNPAY `PAID` tương ứng trong `payment_transactions`.
- Có người nhận, địa chỉ, tên và ảnh sản phẩm trong đơn gốc.

Lỗi nằm ở luồng đọc/hiển thị: trang bill gọi danh sách đơn, nhưng tài khoản admin nhận kết quả phân trang; khi store user chưa khôi phục sau redirect, trang còn rơi vào API tracking rút gọn. Template không hỗ trợ cấu trúc tracking và mặc định thành COD. Không cần đổi phương thức của đơn này trong database.

## Các sửa đổi đã thực hiện

| Phần | Sửa đổi |
| --- | --- |
| Bill | Lấy riêng đơn qua API có kiểm tra quyền, kể cả khi token đã có nhưng user signal chưa khôi phục. |
| Hiển thị | Đọc đúng mã phương thức, hỗ trợ tên/ảnh từ tracking; thiếu dữ liệu không tự suy ra COD hoặc dựng thông tin người nhận. |
| Trạng thái | VNPAY đang chờ/thất bại không hiện đặt hàng thành công; query `payment=success` không được dùng làm bằng chứng thanh toán. |
| Checkout | Bỏ điều hướng tự động từ store sang bill khi vừa tạo đơn; giữ giỏ trong lúc chờ VNPAY. |
| Chọn cổng | Dùng mã phương thức thay vì suy đoán từ loại `Online`, `CASH`, `PAYMENT_GATEWAY`; từ chối phương thức tắt, không hỗ trợ hoặc không khớp endpoint. |
| Tạo URL | HMAC SHA-512 với khoảng trắng `+`, giờ UTC+7 và thời hạn 15 phút. |
| Callback | Kiểm tra chữ ký, merchant, số tiền chính xác và cả hai mã kết quả VNPAY. |
| Tham chiếu | Tra cứu bằng `_id` giao dịch bất biến, không dùng mã nhà cung cấp đã bị ghi đè sau thanh toán. |
| Tính nhất quán | Giao dịch VNPAY, trạng thái đơn, tồn kho, coupon và giỏ tài khoản được cập nhật trong cùng MongoDB transaction. Callback lặp không xử lý mua hàng lần hai. |
| IPN | Trả HTTP 200 cùng mã xác nhận `00`, `02`, `01`, `04`, `97`, `99` theo kết quả xử lý. |
| Đơn đã hủy | Ghi nhận tiền đến muộn để đối soát nhưng không mở lại đơn hoặc trừ kho. |
| COD | Chặn thao tác đối soát COD với đơn thanh toán online ở cả hai backend. |
| Giá | Không chấp nhận giá snapshot từ client cho sản phẩm không tồn tại; kiểm tra biến thể thuộc sản phẩm, số lượng, giá và tiền tệ VND. |
| Stripe | Không đổi đơn đã đánh dấu trả tiền thành FAILED chỉ vì bước xử lý sau thanh toán gặp lỗi. |

Các file chính: [bill](client/src/app/user/pages/order/order.component.ts), [checkout](client/src/app/user/pages/cart/cart/cart.component.ts), [store](client/src/app/store/signal.store.ts), [orders service](server/src/orders/orders.service.ts), [payment service](server/src/orders/payment.service.ts), [tracking](server/src/orders/tracking-response.cjs).

## Database: kết quả đọc, không chỉnh sửa dữ liệu cũ

Tại thời điểm kiểm tra, chỉ VNPAY ACTIVE; COD, CREDIT_CARD và các phương thức khác INACTIVE. Thanh toán bằng thẻ trên trang VNPAY vẫn là giao dịch qua cổng VNPAY, khác với phương thức CREDIT_CARD/Stripe riêng của Chéri.

Ba bản ghi cũ không có giao dịch đối chiếu:

| Mã đơn | Hiện trạng |
| --- | --- |
| `ORD-ADMIN-STAGE3-SHIPPED` | Có `payment.status=PAID`, thiếu trạng thái cấp đơn. |
| `ORD-ADMIN-STAGE6-COMPLETED` | Có `payment.status=REFUNDED`, thiếu trạng thái cấp đơn. |
| `ORD-ADMIN-DELIV-03` | `paymentStatus=PENDING` nhưng `payment.status=PAID`. |

Không tự sửa thành PAID/REFUNDED khi thiếu chứng cứ. Các giá trị `paymentType` cũ như `Online`, `COD`, `Thẻ tín dụng / Ghi nợ` cũng khác enum của schema Nest. Định tuyến checkout đã dùng mã phương thức, nhưng cần chuẩn hóa dữ liệu và form quản trị trong một migration có kiểm tra trước/sau riêng.

Chạy lại kiểm tra chỉ đọc từ thư mục gốc:

```powershell
node server/scripts/audit-payments.cjs CHE1792769018030561
```

Script không in khóa bí mật hoặc thông tin liên hệ khách hàng.

## Những phần chưa hoàn chỉnh / chưa được chứng minh bằng giao dịch thực

1. **IPN public và đối soát:** localhost không nhận được IPN từ máy chủ VNPAY. Cần đăng ký URL public, kiểm thử callback khi khách đóng tab. Đã có querydr định kỳ cho giao dịch còn chờ, nhưng chưa kiểm thử với cổng sandbox thật; Return vẫn dùng chung bộ xử lý callback có xác minh chữ ký để phục vụ sandbox local.
2. **Khách vãng lai:** bản tracking cố ý không trả thông tin người nhận đầy đủ. Chưa có cơ chế receipt token riêng; đồng bộ giỏ local/session sau VNPAY thành công chưa được hoàn thiện như giỏ tài khoản. Không nới API public để trả thông tin cá nhân.
3. **Giữ hàng:** chưa giữ tồn kho lúc chuyển sang VNPAY. Hai khách mua cùng lượng hàng cuối trong thời gian chờ thanh toán vẫn có nguy cơ bán vượt tồn kho. Transaction callback giải quyết cập nhật dở dang/lặp, không thay thế cơ chế giữ hàng.
4. **Stripe:** phương thức hiện INACTIVE. Chưa kiểm thử trọn luồng capture/refund với Stripe; chưa có webhook/idempotency và quy trình đối soát đầy đủ khi cổng đã thu tiền nhưng ghi DB lỗi. Không nên bật thanh toán thật chỉ dựa vào unit test.
5. **Hoàn tiền VNPAY:** các thao tác quản trị ghi nhận hoàn tiền không tương đương việc gọi API chuyển tiền trả khách. Đã tích hợp querydr để đối soát đơn còn chờ, chưa tích hợp API refund VNPAY; cần đối soát hoàn tiền với cổng hoặc chứng từ chuyển khoản.
6. **Email sau commit:** gửi ngoài transaction để không gửi thư trong lần retry DB; chưa có outbox bảo đảm gửi lại nếu tiến trình dừng sau commit.
7. **Môi trường MongoDB:** cập nhật callback dùng transaction, cần replica set/MongoDB Atlas. Chưa chạy kiểm thử rollback/concurrency trên database thật; unit test dùng model giả để kiểm tra luồng và session.

## Kiểm thử

### Cập nhật 24/10: đối soát giao dịch VNPAY

- Đã thêm yêu cầu `querydr` POST tới VNPAY, ký yêu cầu và kiểm tra chữ ký, merchant, mã giao dịch, số tiền trong phản hồi trước khi cập nhật đơn.
- Tự đối soát tối đa 10 giao dịch `PENDING` mỗi 10 phút khi `VNPAY_RECONCILE_ENABLED=true`, chỉ xét giao dịch từ 20 phút đến 24 giờ tuổi. Có endpoint quản trị `POST /api/orders/payment/vnpay/reconcile` để chạy thủ công.
- Chỉ kết thúc đơn với trạng thái VNPAY thành công hoặc thất bại rõ ràng; giao dịch chưa hoàn tất hoặc cổng trả lỗi API vẫn để chờ.
- Nếu gửi email sau khi commit thất bại, kết quả thanh toán đã ghi trong database vẫn được trả là thành công. Chưa có outbox gửi lại email.
- 21 bài test thanh toán đạt, backend TypeScript không lỗi; API backend cổng 4000 và frontend cổng 3000 trả HTTP 200. Chưa có giao dịch sandbox mới chứng minh `querydr` hoạt động với khóa thật.
- Chưa cấu hình IPN công khai: ngrok trên máy chưa có token, Render `cheri-n0td.onrender.com` đang trả trang 503/Application loading. Giữ `VNPAY_RETURN_URL` ở localhost cho test trình duyệt trên cùng máy; cần URL HTTPS công khai chạy đúng phiên bản code trước khi đổi Return và đăng ký IPN với VNPAY.
- Trên VNPAY SIT Portal, đã thêm terminal bằng `VNPAY_TMN_CODE` hiện có. Portal hiển thị terminal "Cheri" ở trạng thái "Chờ duyệt"; ô "URL Nhận IPN (Webhook)" hiện là `#` và chưa được thay vì chưa có backend HTTPS công khai hoạt động. Portal chưa thấy giao dịch nào để tạo phiên kiểm thử; hướng dẫn yêu cầu ít nhất hai giao dịch mới.


```powershell
node --test server/src/orders/orders.payment.test.cjs server/src/orders/payment.service.test.cjs client/src/app/store/payment-flow.test.cjs
node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit --incremental false
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p client/tsconfig.app.json --noEmit
```

21 kiểm thử bao gồm COD/VNPAY, bill pending/failed/paid, đọc trạng thái từ API, chữ ký, merchant, số tiền, callback lặp, đơn đã hủy, chọn cổng, giá client, giữ phần giỏ chưa mua và chữ ký querydr. Chưa thực hiện một giao dịch sandbox end-to-end mới sau các sửa đổi.

Ngày 24/10: chạy lại 19 kiểm thử đều đạt; TypeScript backend và Angular compiler không có lỗi (Angular có cảnh báo import chưa dùng). Đã mở task frontend cổng 3000 và backend cổng 4000; backend tự khởi động admin cổng 5000. Hai API danh sách phương thức thanh toán ở cổng 4000/5000 trả HTTP 200.

Tham chiếu: [giao thức VNPAY và mã IPN](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [quy tắc ký VNPAY 2.1.0](https://sandbox.vnpayment.vn/apis/docs/chuyen-doi-thuat-toan/changeTypeHash.html).

### Cập nhật 24/10: thử kết nối sandbox qua Cloudflare Quick Tunnel

- Đã tạo URL HTTPS tạm thời `https://evaluating-falling-edwards-vessel.trycloudflare.com` trỏ tới backend local cổng 4000. GET `/api/orders/payment-methods` qua URL này từng trả HTTP 200; GET IPN không chữ ký trả `RspCode=97` như dự kiến.
- Đã đặt `VNPAY_RETURN_URL` và `VNPAY_IPN_URL` trong `.env` theo URL tạm thời. Portal VNPAY SIT đã lưu IPN và xác nhận giá trị còn nguyên sau tải lại trang. Terminal vẫn ở trạng thái "Chờ duyệt".
- Checkout phát hiện giao diện gửi ký hiệu tiền `đ` trong trường `currency`; backend yêu cầu `VND`. Đã sửa checkout gửi `VND`. Lần thử sau đã chuyển thành công sang trang chọn phương thức thanh toán VNPAY sandbox, không còn lỗi chữ ký ban đầu.
- Đơn thử `CHE1792823594686464` hiện chuyển về trang `payment=failed`. Chưa xác minh được callback và trạng thái cuối trong MongoDB do kết nối MongoDB Atlas bị lỗi DNS `querySrv ETIMEOUT` sau đó. Không coi việc mở được trang VNPAY là bằng chứng thanh toán thành công.
- Quick Tunnel chỉ dùng để thử nghiệm: URL có thể đổi và mất hiệu lực khi tiến trình tunnel dừng. Khi đó cần cập nhật lại Return URL trong `.env` và IPN trên VNPAY SIT Portal, hoặc chuyển sang hosting có URL HTTPS cố định. Render `cheri-n0td.onrender.com` trước đó trả 503.

### Cập nhật sau khi Quick Tunnel đầu tiên mất hiệu lực

- Cloudflare trả `Unauthorized: Tunnel not found` cho URL `evaluating-falling-edwards-vessel`, dù tiến trình cũ vẫn còn chạy. URL đó không dùng được nữa.
- Đã tạo tunnel mới `https://healing-appointed-jim-elegant.trycloudflare.com`, kiểm tra IPN không chữ ký trả `RspCode=97`, cập nhật `VNPAY_RETURN_URL`/`VNPAY_IPN_URL` trong `.env` và lưu IPN mới trên VNPAY SIT Portal. Đã khởi động lại backend để nạp `.env` mới.
- Kết nối trực tiếp MongoDB Atlas từ máy phát triển vẫn báo lỗi; cần xác minh lại kết nối, trạng thái đơn thử và một giao dịch VNPAY sandbox hoàn tất trước khi xác nhận luồng thanh toán end-to-end.

### Kết quả giao dịch sandbox mới

- Đã thanh toán bằng thẻ NCB và OTP **test** do tài liệu VNPAY cung cấp. VNPAY chuyển về Return URL local với `payment=success` cho đơn `CHE1792835199033768`.
- API tracking backend xác nhận đơn `CONFIRMED`, `paymentStatus=PAID`, `paymentMethod=VNPAY`. Bill trình duyệt hiển thị "Đặt hàng thành công", "Thanh toán qua VNPAY", "Đã thanh toán", đúng một sản phẩm và tổng 1.254.000 VND.
- Khắc phục bill bị kẹt trạng thái tải và đồng thời hiện "không tìm thấy đơn" do ứng dụng Angular dùng zoneless change detection: đánh dấu kiểm tra sau callback API và gộp ba trạng thái tải/rỗng/có đơn thành một chuỗi điều kiện loại trừ nhau.
- Đã tải lại VNPAY SIT Portal và xác nhận trường IPN vẫn là `https://healing-appointed-jim-elegant.trycloudflare.com/api/orders/payment/vnpay/ipn`.
- Luồng sandbox từ checkout tới đơn PAID đã được xác nhận. Lượt này chưa tách riêng bằng chứng IPN đến trước hay Return xử lý trước vì hai callback dùng chung hàm cập nhật. Quick Tunnel vẫn chỉ là URL tạm; hosting HTTPS cố định là bước cần làm khi triển khai lâu dài.

### COD tại checkout (24/10)

- Nguyên nhân COD không xuất hiện: bản ghi `payment_methods` mã `COD` có `status=INACTIVE`, `isActive=false`. Đã bật thành `ACTIVE` qua API quản trị; API backend cổng 4000 hiện trả cả `COD` và `VNPAY`.
- Khi chọn COD, backend tạo đơn `CONFIRMED` cùng lịch sử xác nhận, nhưng giữ `paymentStatus=PENDING`, `payment.status=PENDING` và giao dịch COD chờ thu tiền. Bill hiển thị "Đặt hàng thành công", "Đã xác nhận", "Thanh toán khi nhận hàng (COD)", "Chưa thanh toán".
- Đã đặt thử trực tiếp đơn `CHE1792837756669895` với thông tin kiểm thử. API quản trị xác nhận `status=CONFIRMED`, `paymentStatus=PENDING`; bill trình duyệt hiển thị đúng các trạng thái trên.
- 20 bài kiểm tra tập trung COD/VNPAY đạt; build backend và frontend hoàn tất. Kết nối MongoDB trực tiếp từ CLI lần này không trả kết quả, nên trạng thái giao dịch COD được đối chiếu bằng kiểm thử dịch vụ và mã tạo giao dịch; trạng thái đơn thực tế được xác nhận qua API.
