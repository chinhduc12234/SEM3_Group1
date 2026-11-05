# Vai trò Nhân viên khảo sát và quyền mời nhân sự

`SURVEY_STAFF` là vai trò thành viên trong một Organization, không phải role hệ thống. Organization Service quản lý việc gán/thu hồi và lời mời; dữ liệu role tiếp tục lưu tại GiveAid_Organization.Members và OrganizationMemberRole. Không thay đổi schema vì các bảng hiện đã lưu role bằng chuỗi; không cần migration hoặc service mới.

Ngoài role và lời mời, Campaign Service đã có báo cáo khảo sát, ảnh minh chứng, dashboard, thông báo và xét duyệt bởi Manager phụ trách. Xem [chức năng khảo sát](SURVEY-REPORTS.md). SURVEY_STAFF không tự có quyền tạo/sửa/duyệt Campaign.

## Ma trận quyền

| Thao tác | OWNER | CAMPAIGN_MANAGER | SURVEY_STAFF và các role khác |
|---|---|---|---|
| Mời người có tài khoản sẵn vào cùng tổ chức | Mọi role nhân sự được phép gán | Chỉ SURVEY_STAFF | Không |
| Xem lịch sử lời mời | Tất cả lời mời trong tổ chức | Chỉ lời mời do chính mình gửi | Không |
| Thu hồi lời mời đang chờ | Mọi lời mời trong tổ chức | Chỉ lời mời SURVEY_STAFF do chính mình gửi | Không |
| Thay đổi vai trò/kích hoạt/khóa thành viên hiện có | Theo quy tắc Owner có sẵn | Không | Không |

Role nhân sự được gán: ORGANIZATION_MANAGER, CAMPAIGN_MANAGER, VOLUNTEER_COORDINATOR, FINANCE_MANAGER, STAFF, SURVEY_STAFF. OWNER và ADMIN không được cấp từ form nhân sự, giữ nguyên quy tắc cũ. Không có ngoại lệ cho ADMIN khi gửi lời mời.

## Luồng sử dụng

Trong Nhân sự & vai trò, Owner hoặc Campaign Manager nhập email một tài khoản Give-AID đã đăng ký. Form dùng chung; danh sách role dựa vào `invitableRoles` của API workspace. Owner thấy sáu lựa chọn; Campaign Manager chỉ thấy Nhân viên khảo sát. Lời mời có hiệu lực 7 ngày, quyền được cấp khi người nhận mở Tổ chức của tôi và chấp nhận.

Không cấp quyền dựa trên giao diện hoặc role client gửi lên. API kiểm tra tư cách thành viên đang hoạt động, tổ chức ACTIVE và role hiện tại trong database. Payload trộn SURVEY_STAFF với một role không được phép bị từ chối toàn bộ. Người nhận không thể chấp nhận lời mời nếu người gửi đã mất quyền mời hoặc bị khóa; Owner có thể thu hồi và gửi lại lời mời mới.

API sử dụng các route `/api/organizations/.../workspace/invitations` và `/api/organizations/invitations/.../respond` hiện có qua gateway. Không đọc database Identity trực tiếp; lookup tài khoản vẫn dùng HTTP contract sẵn có.

## Kiểm thử

Chạy `python scripts/test-survey-invitations.py` sau khi khởi động stack. Script tạo tài khoản và tổ chức riêng cho test qua HTTP API; không tạo chiến dịch và không sửa tư cách thành viên thực tế. Kết quả được lưu tại `artifacts/survey-invitation-tests.json` (gitignored), không chứa mật khẩu/token. Các ca kiểm tra bao gồm đúng/sai role, leo thang quyền, tổ chức khác, role dành riêng, chấp nhận lời mời, phạm vi lịch sử/thu hồi và mất quyền người gửi.
