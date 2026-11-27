# Cấu trúc frontend Give-AID

| Thư mục | Nội dung |
| --- | --- |
| `src/app` | Route, layout và điều hướng của Next.js. Màn hình nghiệp vụ được nhập từ `features`. |
| `src/features` | Màn hình, component, kiểu dữ liệu và CSS của từng tính năng. |
| `src/shared` | API client, bản dịch, khung giao diện và thành phần dùng chung. |

## Tìm phần cần sửa

- Quản lý tình nguyện viên theo chiến dịch ở `src/features/campaigns/management/volunteers`. Kế hoạch vận hành, ngày triển khai, hoạt động và đội phụ trách ở `src/features/campaigns/management/operations`.
- Đăng ký tình nguyện và ủng hộ từ trang chiến dịch ở `src/features/campaigns/components/volunteer` và `src/features/campaigns/components/donation`.
- Hồ sơ, nhiệm vụ và lịch sử tham gia của người dùng ở `src/features/account/participation`. Quản lý nhân sự của tổ chức ở `src/features/organizations/workspace/members`.
- Hộp thông báo và định tuyến từ thông báo ở `src/features/notifications/inbox`. Chuông thông báo và bộ đếm đi cùng `NotificationBell` trong `src/features/notifications/components`.
- Biểu mẫu đăng nhập và chọn trang sau đăng nhập ở `src/features/auth/forms`. Màn hình quản trị tổ chức và chủ tổ chức ở `src/features/admin/organizations` và `src/features/admin/owners`.

Đặt CSS Module cạnh component khi chỉ component đó dùng các lớp CSS. Giữ CSS dùng chung trong phạm vi tính năng nếu nhiều màn hình phụ thuộc vào cùng một bố cục. Dùng `src/shared/styles` cho kiểu hiển thị áp dụng toàn ứng dụng.

## Chạy và kiểm tra

Trong thư mục `frontend`, chạy `npm run dev` để phát triển hoặc `npm run build` để kiểm tra bản production. Dùng `npx tsc --noEmit` khi cần kiểm tra riêng TypeScript.
