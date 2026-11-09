# Thông báo tổ chức

## Phạm vi

| Sự kiện mới | Người nhận | Khi mở thông báo |
| --- | --- | --- |
| Gửi hoặc gửi lại hồ sơ | Tất cả ADMIN đang hoạt động | Hồ sơ để xét duyệt |
| APPROVE | Tài khoản nộp hồ sơ | Không gian quản lý tổ chức |
| REQUEST_CHANGES / REJECT | Tài khoản nộp hồ sơ | Hồ sơ và lý do admin phản hồi |

EmailJS tiếp tục gửi email độc lập. Chưa chuyển notification khảo sát/campaign của CampaignService sang service này. Không gửi lại các sự kiện lịch sử trước migration.

## Kiến trúc

`OrganizationService → SQL outbox → HTTP nội bộ → NotificationService → SQL inbox + push deliveries → SignalR / Firebase`.

- NotificationService sở hữu database `GiveAid_Notification`, SQL login và Data Protection key volume riêng. Không truy cập bảng Identity hoặc Organization trực tiếp.
- Controller xử lý HTTP, `Contracts` chứa DTO, `Models` chứa entity, `Repositories` chứa truy vấn inbox/subscription, `Services` điều phối nghiệp vụ và adapter, `Realtime` chứa hub. Receiver/worker quản lý transaction và persistence của hàng đợi.
- `NotificationEvents` được lưu cùng `OrganizationReview`, trạng thái hồ sơ, email outbox và quyền OWNER trong giao dịch EF. Lỗi SQL/rowversion không tạo notification rời rạc.
- Worker nguồn gửi có thứ tự theo tổ chức, retry vô thời hạn với backoff tối đa 5 phút. Lỗi kéo dài phải kiểm tra `Attempts`, `NextAttemptAt`, `LastErrorCode` và log theo event ID.
- Receiver xác thực shared internal key, nhận contract `Shared/OrganizationNotificationEvent.cs`, tra ADMIN qua API Identity. Event ID và hash nội dung chống tạo trùng khi nguồn gửi lại sau timeout; cùng ID nhưng payload khác trả 409. Receipt và inbox/fanout commit nguyên tử.
- SignalR gửi `notificationsChanged` không chứa nội dung hồ sơ. Client gọi API có JWT và kiểm tra phiên Redis để lấy dữ liệu. Reconnect/focus và đối chiếu 30 giây giúp bù cập nhật bị lỡ. Redis backplane hỗ trợ nhiều replica notification.
- Push có delivery riêng cho từng thiết bị tại thời điểm nhận sự kiện. Lưu kết quả từng delivery để tránh gửi lại các thiết bị đã thành công. Retry tối đa 10 lần; `Unregistered` làm vô hiệu token; đã đọc, đổi chủ token, tắt push hoặc phiên hết hiệu lực thì bỏ qua.
- FCM là at-least-once: có thể gửi trùng nếu tiến trình mất sau khi provider nhận nhưng trước khi ghi SQL. Dùng tag ổn định theo notification ID để giảm thông báo trùng trên trình duyệt. FCM chấp nhận yêu cầu không đảm bảo hệ điều hành đã hiển thị.

## Cấu hình local

1. Chạy `scripts/init-dev.ps1` để thêm `NOTIFICATION_DB_PASSWORD`, giữ nguyên các secret đã có.
2. Firebase chưa cấu hình: giữ `FIREBASE_ENABLED=false`. Inbox và SignalR vẫn dùng được.
3. Bật push: điền các `FIREBASE_*` trong `.env.example` vào `.env` riêng. Đặt service account JSON ở `.secrets/firebase/firebase-admin.json` và bật `FIREBASE_ENABLED=true`. Backend kiểm tra project của JSON khớp Web config.
4. `WEBSITE_URL` là đúng origin frontend, ví dụ `http://localhost:8080`; staging/production cần HTTPS. Truy cập bằng origin khác sẽ bị chặn ở hub. Khi mở bằng `localhost`, tránh dùng URL IP hoặc cổng dev khác mà chưa chỉnh cấu hình.
5. Chạy `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1`. Script stage file Firebase riêng; Docker chỉ mount read-only vào NotificationService. Backup volume `notification-keys` nếu cần giữ token đã mã hóa.
6. Đăng nhập → chuông → **Bật thông báo** → cho phép trong trình duyệt. Không tự bật hộ người dùng. Từ chối quyền, trình duyệt không hỗ trợ, hoặc offline vẫn xem được inbox khi kết nối lại.

Web config và VAPID public key được trả từ endpoint runtime, không cần build lại frontend khi thay cấu hình. Service account/private key không trả cho client, không copy vào image và không commit Git. Không cần bật Firebase Auth, Firestore hoặc Realtime Database.

`SQL_PORT` mặc định 1433; đặt cổng khác trong `.env` nếu Windows đã có SQL Server chiếm cổng. Container vẫn dùng `sqlserver:1433`.

## API public

Tất cả API trừ config cần JWT. Các thao tác ghi cần `X-Requested-With: GiveAid`.

| Method | Route | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/notifications?page=1&unread=false` | 20 dòng/trang, tổng số, chưa đọc và mốc `asOf` |
| GET | `/api/notifications/unread-count` | Đếm thông báo của người đang đăng nhập |
| PUT | `/api/notifications/{id}/read` | Đánh dấu đã đọc, idempotent, sai người nhận trả 404 |
| PUT | `/api/notifications/read-all` | Body `{ "through": "asOf từ danh sách" }`; không đọc nhầm thông báo vừa đến |
| POST | `/api/notifications/push-subscriptions` | Body `{ "token": "FCM registration token" }` |
| DELETE | `/api/notifications/push-subscriptions/current-session` | Tắt token thuộc phiên hiện tại |
| GET | `/api/notifications/config` | Chỉ cấu hình Firebase Web public |

Hub `/hubs/notifications` cần JWT; hết hạn access token sẽ đóng kết nối để client refresh/reconnect. Chỉ hub nhận query `access_token`; gateway và backend tắt request logging ở đường này. REST không nhận bearer token từ query. Token push được mã hóa bằng Data Protection và gắn cả user ID lẫn session ID. Logout thu hồi session trong Redis ngay cả khi xóa token trình duyệt gặp lỗi. Push chỉ chứa câu thông báo chung và dẫn đến inbox cần đăng nhập.

## Kiểm tra

Tắt EmailJS cho fixture giả bằng override môi trường khi tạo lại container Organization; giữ `.env` thật để khôi phục sau kiểm tra. Với hai regression cũ, tắt thêm `NOTIFICATIONS_ENABLED` để không phát sinh inbox thử cho admin. Worker notification vẫn chạy để kiểm tra API.

```powershell
python scripts/check-onboarding.py
python scripts/check-workspaces.py
# Bật lại NOTIFICATIONS_ENABLED=true trên container Organization cho bộ dưới.
python scripts/check-notifications.py
node scripts/check-notification-realtime.mjs
# Dừng container notification trước bộ worker giả lập, rồi khởi động lại sau kiểm tra.
# Cấu hình NOTIFICATION_TEST_DATABASE riêng trỏ SQL local (runtime login notification).
dotnet run --project scripts/NotificationChecks/NotificationChecks.csproj
# Dry-run FCM riêng: đặt FIREBASE_TEST_CREDENTIAL thành đường dẫn JSON local.
dotnet run --project scripts/NotificationChecks/NotificationChecks.csproj -- --validate-firebase
```

Bộ notification tạo/xóa dữ liệu riêng, dừng rồi khởi động lại container notification để kiểm tra outbox recovery; chỉ chạy local. Bộ realtime mở socket thật qua gateway, kiểm tra phân người nhận, anonymous và cross-origin. Không tự gửi push tới thiết bị của thành viên nhóm. Kiểm thử nhận push thật cần người dùng cấp quyền trên trình duyệt của họ.

Kiểm tra vận hành trong SQL NotificationService: `Deliveries` có `State`, `Attempts`, `NextAttemptAt`, `LastErrorCode`, `SentAt`; `Notifications.BroadcastAt` theo dõi tín hiệu realtime. Không log hoặc xuất `ProtectedToken`. Khi delivery FAILED, xử lý nguyên nhân trước rồi đưa đúng dòng về PENDING, reset Attempts/LastErrorCode và NextAttemptAt; inbox vẫn tồn tại độc lập với lỗi push.
