# Cấu trúc backend

Áp dụng cùng cách tổ chức khi thêm endpoint vào IdentityService, OrganizationService và các service tiếp theo.

| Thư mục | Trách nhiệm |
| --- | --- |
| `Controllers` | Route, model binding, xác thực HTTP, lấy thông tin người gọi và chuyển kết quả nghiệp vụ thành HTTP response. Cookie và header thuộc lớp này. |
| `Contracts` | Dữ liệu vào và ra của API hoặc use case. Tách refresh token nội bộ khỏi response trả cho client. |
| `Services` | Use case theo nhóm chức năng, kiểm tra quyền trên tài nguyên, quy tắc nghiệp vụ và điều phối ghi dữ liệu. |
| `Data` | Entity, EF Core DbContext, cấu hình lưu trữ và migration thuộc từng service. |

NotificationService tách entity sang `Models` và truy vấn inbox/subscription sang `Repositories`; `Data` giữ DbContext, `Realtime` giữ SignalR hub. Receiver/outbox worker giữ giao dịch ghi và retry thuộc use case, không đưa chúng vào controller. Chi tiết trong [NOTIFICATIONS.md](NOTIFICATIONS.md).

Controller gọi service qua dependency injection. Service nhận dữ liệu của use case và thông tin người gọi đã xác thực. Với upload, controller chuyển tên, kích thước và hàm mở stream cho service. Service kiểm tra nội dung, áp dụng giới hạn và quản lý stream. Quyền theo tổ chức vẫn được tra cứu trong database ở lớp nghiệp vụ.

Giữ thao tác ghi liên quan trong cùng use case. Ví dụ, xét duyệt hồ sơ tổ chức lưu trạng thái, lịch sử, quyền OWNER và email outbox trong cùng lần lưu. Dùng DbContext hiện có cho các truy vấn EF Core. Tách adapter khi có ranh giới thực tế như Redis, EmailJS hoặc HTTP giữa các service.

Khi viết automation test, gọi trực tiếp policy cho quy tắc thuần và service cho use case. Với transaction, rowversion và truy vấn EF Core, kiểm tra trên SQL Server. Hai bộ kiểm tra HTTP hiện có xác nhận hợp đồng qua gateway với SQL Server và Redis.

```powershell
python scripts/check-onboarding.py
python scripts/check-workspaces.py
```

Tắt `EMAILJS_ENABLED` và `NOTIFICATIONS_ENABLED` trên container Organization trước khi chạy hai bộ kiểm tra để dữ liệu thử nghiệm không phát email thật hoặc tạo inbox thử cho admin. Bật lại notification worker khi chạy bộ kiểm tra notification riêng.
