# Email đăng ký và xét duyệt tổ chức

OrganizationService gửi email qua EmailJS REST API từ backend. Frontend không giữ private key và không quyết định nội dung/người nhận email.

## Cấu hình

Chạy `scripts/init-dev.ps1` để tạo `INTERNAL_API_KEY` ngẫu nhiên dùng giữa Identity và Organization. Điền các biến sau trong `.env` (không commit):

```dotenv
EMAILJS_ENABLED=true
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
EMAILJS_SUBMITTED_TEMPLATE_ID=your_submitted_template_id
EMAILJS_REVIEW_TEMPLATE_ID=your_review_template_id
EMAILJS_SUPPORT_EMAIL=support@example.com
EMAILJS_WEBSITE_URL=http://localhost:8080
```

Trong EmailJS Account > Security, cho phép API gọi từ ứng dụng ngoài trình duyệt và cấu hình xác thực private key tương ứng. Email Services phải kết nối được tài khoản gửi. Cả hai template dùng To Email `{{to_email}}`, From Name `Give-AID`, From Email mặc định và Reply To `{{support_email}}`.

Chạy lại `scripts/start-dev.ps1` sau khi đổi cấu hình; chỉ restart container không nạp lại biến môi trường Compose. Cấu hình mặc định trên máy clone mới là tắt gửi mail. Khi tắt, các tác vụ vẫn được lưu trong SQL để xử lý khi bật lại; lưu ý backlog có thể chứa các thông báo cũ. Không tự tạo mail cho hồ sơ đã nộp/duyệt trước migration này.

Website URL lấy từ cấu hình, không lấy từ Host header hoặc dữ liệu form. HTTP chỉ cho địa chỉ loopback khi phát triển; dùng HTTPS cho website thật. Localhost trong email chỉ mở được trên máy chạy dự án.

## Luồng nghiệp vụ

| Sự kiện lưu thành công | Trạng thái hồ sơ | Template |
|---|---|---|
| SUBMITTED (bao gồm gửi lại sau bổ sung) | PENDING_REVIEW | Tiếp nhận hồ sơ |
| APPROVE | ACTIVE và membership OWNER | Kết quả xét duyệt, is_approved=true |
| REQUEST_CHANGES | CHANGES_REQUESTED | Kết quả xét duyệt, is_changes_requested=true |
| REJECT | REJECTED | Kết quả xét duyệt, is_rejected=true |

Tạo/sửa bản nháp, tải giấy tờ hoặc quyết định không hợp lệ không tạo email. Các cờ luôn là JSON boolean; chỉ một cờ kết quả true. Lý do giữ nguyên nội dung đã lưu của admin; thời điểm lấy từ sự kiện và chuyển UTC+7. Hồ sơ bị từ chối không được chỉnh sửa/gửi lại theo nghiệp vụ hiện tại.

Địa chỉ nhận là email tài khoản của `ApplicantUserId`, không phải ContactEmail, RepresentativeEmail hay tài khoản admin. Worker gọi `GET /internal/accounts/{id}/notification-recipient` bên Identity với `X-Internal-Key`, lấy tối thiểu email/họ tên tài khoản đang hoạt động. Gateway chặn `/internal`; Identity không publish cổng ra host. Không đọc chéo database. Môi trường production cần bảo vệ giao tiếp nội bộ bằng mạng riêng/TLS và quản lý secret phù hợp.

## Biến template

Chung: `to_email`, `to_name`, `organization_name`, `application_id`, `registration_number`, `representative_name`, `submitted_at`, `application_url`, `management_url`, `login_url`, `support_email`.

Kết quả: `review_title`, `review_status`, `reviewed_at`, `approved_at` (chỉ phê duyệt), `review_reason`, `is_approved`, `is_changes_requested`, `is_rejected`.

Tên, số đăng ký, đại diện, lý do và thời gian được chụp lại tại sự kiện. Email/họ tên tài khoản được lấy khi gửi; URL và support email dùng cấu hình deployment hiện tại. Không gửi mật khẩu, CCCD, ngày sinh, JWT hoặc tài liệu pháp lý lên EmailJS. Dùng `{{variable}}` trong template cho nội dung người dùng, không dùng triple braces để chèn HTML không escape.

## Độ tin cậy và vận hành

`EmailNotifications` nằm trong database Organization; tác vụ và hồ sơ/lịch sử/membership được lưu bằng cùng một `SaveChanges` transaction. Mỗi EventId chỉ có một tác vụ. Giao dịch bị rollback hoặc thua cạnh tranh rowversion không tạo thông báo rời.

Worker giữ SQL application lock trong lúc xử lý và nghỉ 1,2 giây giữa các lần gửi, nên nhiều replica Organization không gửi đồng thời hoặc vượt 1 request/giây trên hàng đợi này. Các ứng dụng khác dùng cùng tài khoản EmailJS vẫn chia sẻ quota/rate limit. Duy trì thứ tự sự kiện theo từng tổ chức: thông báo pending trước phải kết thúc trước khi gửi thông báo sau.

Lỗi tạm thời được thử lại tối đa 10 lần với backoff 30 giây tăng dần đến 1 giờ. HTTP 400/422 hoặc không còn tài khoản hoạt động được đánh dấu FAILED; HTTP 401/403/429/5xx/network timeout có thể retry sau khi sửa cấu hình/kết nối. Nếu tiến trình chết giữa lúc gửi, tác vụ được xét lại sau khoảng 2 phút. Payload snapshot được mã hóa bằng Data Protection; giữ volume organization-keys cùng bản sao lưu DB. Xóa payload sau khi EmailJS tiếp nhận thành công, giữ metadata phục vụ vận hành.

SENT nghĩa là EmailJS đã trả HTTP thành công, không chứng minh thư vào inbox. Kiểm tra EmailJS History, spam/bounce khi cần. Không có cam kết exactly-once qua EmailJS: nếu provider đã nhận nhưng response bị mất hoặc tiến trình chết trước khi ghi SENT, lần retry có thể gửi trùng. Không tự động thử lại qua HttpClient ngoài cơ chế outbox.

Trong chi tiết hồ sơ, admin có phần **Thông báo email**, tự cập nhật khi có mail pending và nút **Thử gửi lại** cho tác vụ FAILED. API quản trị:

- `GET /api/organizations/notifications?page=1&state=FAILED&organizationId={id}`: phân trang, trả metadata; bộ lọc state/organizationId là tùy chọn.
- `POST /api/organizations/notifications/{id}/retry`: chỉ ADMIN, chỉ FAILED, trả 202; cần header CSRF `X-Requested-With: GiveAid` như API khác.

Kiểm tra quyền ở backend; USER không xem hoặc retry hàng đợi. Retry không thay đổi hồ sơ hoặc quyết định admin. Khi retry thông báo cũ, nội dung vẫn phản ánh sự kiện cũ và có timestamp tương ứng. SENT không cho gửi lại từ API. Log chỉ gồm notification ID/action/mã lỗi, không log body EmailJS hoặc secret.

## Kiểm tra

`dotnet run --project scripts/EmailChecks` kiểm tra bốn payload, boolean, người nhận, thời gian và phân loại lỗi bằng HTTP giả lập, không gửi mail thật. Có thể truyền `EMAIL_TEST_DATABASE` trỏ đến DB Organization local để kiểm tra worker SQL: retry/backoff, hai worker đồng thời, SENT không gửi lại và lỗi vĩnh viễn. Chỉ chạy phần SQL khi worker thật đã tắt; fixture được xóa theo ID trong finally.

`python scripts/check-onboarding.py` kiểm tra nghiệp vụ/security và tính nguyên tử của hàng đợi qua gateway thật. Script yêu cầu container Organization có `EmailJS__Enabled=false` để không gửi mail tới tài khoản giả lập. Trên staging context, có thể tạm dùng `$env:EMAILJS_ENABLED='false'` trước `docker compose up -d --no-deps organization`; sau kiểm tra bỏ biến override và recreate Organization để bật lại.

Kiểm tra gửi thật (tốn sáu lượt EmailJS, cần hộp thư do bạn sở hữu, địa chỉ chưa đăng ký tài khoản):

```powershell
python scripts/check-organization-email.py --send-real --recipient your-test-mailbox@example.com
```

Script tạo hai hồ sơ giả lập qua API, kiểm tra submit/bổ sung/gửi lại/phê duyệt/từ chối và trạng thái SENT, rồi xóa chính fixture đã tạo. Email test còn trong hộp thư/EmailJS History; script không đọc hay xóa email. Không dùng dữ liệu hồ sơ thật để kiểm tra này.

Tham khảo: [EmailJS REST send](https://www.emailjs.com/docs/rest-api/send/), [biến và điều kiện](https://www.emailjs.com/docs/user-guide/dynamic-variables-templates/).

## Kết quả kiểm tra ngày 03/11/2026

- Backend và Docker publish thành công; frontend Next.js production build/TypeScript thành công.
- 73 kiểm tra HTTP/security qua gateway thật thành công, gồm số lượng sự kiện outbox, cạnh tranh phê duyệt và quyền retry của admin.
- Kiểm tra payload bằng HTTP giả lập thành công; kiểm tra SQL worker xác nhận backoff, lỗi vĩnh viễn, không xử lý lại SENT và hai worker không gửi đồng thời cùng tác vụ.
- Sáu email thật từ hai hồ sơ test được EmailJS tiếp nhận; đã đi qua toàn bộ quyết định admin. Không đọc hộp thư để xác nhận inbox. Fixture SQL/Redis của các bài kiểm tra đã dọn; hồ sơ demo cũ được giữ nguyên.
- Quét 112 file source không phát hiện secret thực tế từ `.env`; `.env` được Git ignore.
