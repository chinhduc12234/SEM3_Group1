# Workspace tổ chức và giám sát của admin

## Đã triển khai

Admin hệ thống xem tổng số tổ chức ACTIVE, số lượt thành viên hoạt động, số người riêng biệt và số yêu cầu pháp lý chờ duyệt. Danh bạ có tìm kiếm tên/đại diện, lọc lĩnh vực, phân trang. Trong từng tổ chức, admin xem mục tiêu, lĩnh vực, liên hệ, đại diện và nhân sự/phân công. Admin không thay OWNER cập nhật hồ sơ vận hành hoặc cấp quyền nhân sự.

OWNER và thành viên có không gian riêng cho từng tổ chức: tổng quan, thông tin, nhân sự; OWNER có thêm pháp lý và nhật ký. `Tổ chức của tôi` tổng hợp các tổ chức đang tham gia, lời mời và hồ sơ đã đăng ký. Đăng nhập tài khoản có một membership hoạt động vào thẳng workspace; nhiều tổ chức hoặc có lời mời thì vào trang chọn tổ chức. USER chưa tham gia vẫn vào trang cộng đồng.

Giới thiệu, sứ mệnh, lĩnh vực, tên hiển thị, email/điện thoại/địa chỉ liên hệ, website, logo/ảnh bìa được quản lý riêng với hồ sơ pháp lý. Tên hiển thị không đổi tên pháp lý. Logo PNG/JPG tối đa 2 MB, ảnh bìa 5 MB; kiểm tra extension/signature, lưu bytes mã hóa, truy cập có xác thực. Signature không thay thế antivirus/CDR hoặc kiểm định toàn bộ cấu trúc ảnh. Chưa công khai hồ sơ/ảnh cho khách chưa đăng nhập.

Chiến dịch, sự kiện, tổng tiền, nguồn tài trợ và chiến dịch tiêu biểu chưa có dịch vụ dữ liệu nghiệp vụ: API trả `null`, giao diện ghi “Chưa có dữ liệu”. Không dùng số giả để tạo cảm giác đã có thống kê.

## Vai trò và ranh giới quyền

Tài khoản vẫn là USER trong Identity. Sau phê duyệt, người nộp có membership OWNER trong Organization. Không thêm OWNER vào JWT và không dùng frontend làm nơi quyết định quyền. Một người có thể thuộc nhiều tổ chức với nhiều vai trò khác nhau. Mỗi request kiểm tra membership hiện tại từ OrganizationDB; khóa hoặc đổi quyền không cần chờ JWT hết hạn.

| Vai trò | Quyền ở giai đoạn này | Phần phát triển tiếp |
|---|---|---|
| ADMIN | Giám sát tất cả tổ chức; xét duyệt đăng ký và yêu cầu pháp lý | Xét duyệt chiến dịch/báo cáo theo quy trình riêng |
| OWNER | Toàn bộ workspace của tổ chức; nhân sự, lời mời, yêu cầu pháp lý, nhật ký | Giám sát chiến dịch/tình nguyện/tài chính |
| ORGANIZATION_MANAGER | Xem workspace/nhân sự, cập nhật thông tin và hình ảnh vận hành | Không có quyền cấp vai trò hoặc đổi pháp lý |
| CAMPAIGN_MANAGER | Xem workspace và phân công | Campaign/Beneficiary của đúng tổ chức |
| VOLUNTEER_COORDINATOR | Xem workspace và phân công | Lịch, nhiệm vụ, điểm danh |
| FINANCE_MANAGER | Xem workspace và phân công | Donation/Expense/báo cáo của đúng tổ chức |
| STAFF | Xem workspace và tên/vai trò thành viên | Chức năng nhân viên được thiết kế tiếp theo |

OWNER là membership cố định trong đợt này: không được mời/gán OWNER hoặc ADMIN qua API nhân sự; không được tự hạ quyền/khóa OWNER. Chưa có chuyển quyền sở hữu. Thay người đại diện pháp lý không tự chuyển tài khoản OWNER. Thành viên thường không xem email cá nhân của các thành viên khác hoặc giấy tờ pháp lý. Chỉ OWNER và ADMIN xem hồ sơ pháp lý; quản lý tổ chức không được xem CCCD. Admin không cần tham gia tổ chức để giám sát và không được mời làm nhân viên qua luồng này.

## Lời mời và nhân sự

1. Người được mời đăng ký tài khoản cá nhân trước, không dùng chung tài khoản OWNER.
2. OWNER nhập email và chọn một hoặc nhiều vai trò. Identity xác định tài khoản qua API nội bộ có key; Organization không đọc IdentityDB.
3. Lời mời xuất hiện trong `Tổ chức của tôi` của đúng tài khoản nhận, hết hạn sau 7 ngày. **Chưa gửi email mời nhân sự** vì hai template EmailJS hiện có dành cho tiếp nhận và xét duyệt đăng ký tổ chức.
4. Chỉ người nhận được chấp nhận/từ chối. Chấp nhận tạo membership cùng giao dịch cập nhật lời mời và nhật ký. Trước khi chấp nhận chưa có quyền tổ chức.
5. OWNER có thể thu hồi lời mời pending, sửa nhiều vai trò, khóa/kích hoạt lại thành viên. Khóa chỉ thu hồi quyền trong tổ chức đó, không khóa tài khoản cá nhân hoặc tổ chức khác.

Lời mời pending trùng bị chặn bằng unique index. Lời mời hết hạn có thể thay bằng lời mời mới. Trạng thái và rowversion chặn replay/chấp nhận sau khi thu hồi. Không xóa membership hoặc nhật ký khi khóa.

## Thay đổi pháp lý

OWNER gửi đầy đủ hồ sơ đề nghị, lý do và ba giấy tờ mới: đăng ký, định danh đại diện, quyền đại diện. Một tổ chức chỉ có một yêu cầu PENDING. Các trường được kiểm tra tương đương đăng ký ban đầu và phải có consent, version của hồ sơ hiện tại.

Tổ chức vẫn ACTIVE với hồ sơ cũ trong khi chờ. Admin khác người yêu cầu/OWNER xem đối chiếu hồ sơ và giấy tờ, ghi nhận xét để chấp thuận hoặc từ chối. Chấp thuận thay hồ sơ pháp lý và giấy tờ live trong cùng transaction, lưu bản hồ sơ/giấy tờ trước đó dưới dạng mã hóa trong yêu cầu. Từ chối không thay dữ liệu live; OWNER có thể tạo yêu cầu mới. Không đổi membership hoặc thông tin giới thiệu khi duyệt pháp lý. Cạnh tranh hai admin chỉ một người thành công; số đăng ký phải tiếp tục duy nhất.

Kết quả theo dõi trong workspace/danh bạ admin. **Chưa tái sử dụng template email đăng ký cho thay đổi pháp lý**, vì nội dung đó có thể thông báo sai việc cấp OWNER/duyệt tổ chức lần đầu. Thông báo email cho lời mời và thay đổi pháp lý là phần mở rộng riêng.

## Database và migration

OrganizationDB sở hữu `Workspaces`, `Members`, `OrganizationMemberRole`, `Invitations`, `Activities`, `LegalChanges`, `LegalChangeDocument`. ID tài khoản chỉ tham chiếu logic sang Identity. Migration `OrganizationWorkspaceAndMembers` bổ sung schema, kích hoạt và backfill các membership đã có, khởi tạo workspace cho các tổ chức ACTIVE trước đó. Không phê duyệt tự động hồ sơ đang PENDING_REVIEW.

`Members.Role` giữ tương thích với owner/bootstrap cũ; bảng role mới là tập vai trò cho các thành viên khác. Không tự ghi Role/Roles bằng SQL từ service khác. Profile, ảnh, nhân sự và yêu cầu pháp lý dùng SQL rowversion; frontend gửi version trong JSON hoặc multipart, nhận 409 thì tải lại để tránh ghi đè thay đổi mới.

Ảnh và hồ sơ pháp lý dùng Data Protection keyring volume `organization-keys`. Sao lưu cả DB và keyring. Hồ sơ đề nghị và bản trước khi đổi được mã hóa; nhật ký không lưu lại mật khẩu, token hoặc số CCCD dạng rõ.

## Routes giao diện

| Đường dẫn | Mục đích |
|---|---|
| `/admin` | Tổng quan nền tảng và tình hình đăng ký |
| `/admin/organization-directory` | Danh bạ ACTIVE và yêu cầu pháp lý chờ duyệt |
| `/admin/organization-directory/{id}` | Giám sát tổ chức, nhân sự, pháp lý |
| `/admin/organization-directory/{id}/legal/{changeId}` | Đối chiếu và duyệt thay đổi pháp lý |
| `/organizations/mine` | Chọn tổ chức, chấp nhận lời mời, xem hồ sơ đăng ký |
| `/organizations/{id}/manage` | Tổng quan workspace |
| `.../manage/profile` | Thông tin và hình ảnh vận hành |
| `.../manage/members` | Nhân sự, vai trò và lời mời |
| `.../manage/legal` | OWNER gửi/theo dõi thay đổi pháp lý |
| `.../manage/activity` | OWNER xem nhật ký |

## API để chia công việc

Mọi API dưới đây cần bearer JWT, trừ các health endpoint. Các mutation cần header `X-Requested-With: GiveAid`. Base URL đi qua gateway; không gọi port/database service trực tiếp từ frontend.

| API (prefix `/api/organizations`) | Người dùng |
|---|---|
| `GET /admin/overview` | ADMIN: số liệu toàn nền tảng |
| `GET /admin/directory?page=&search=&focus=` | ADMIN: danh bạ ACTIVE |
| `GET /workspaces/mine` | Membership hoạt động của chính tài khoản |
| `GET /invitations/mine` | Lời mời còn hạn của chính tài khoản |
| `POST /invitations/{invitationId}/respond` | Người nhận: `{accept, version}` |
| `GET /{id}/workspace` | ADMIN hoặc thành viên hoạt động; profile, roles, capabilities, statistics |
| `GET /{id}/workspace/permissions` | Quyền hiện tại của chính người gọi trong tổ chức |
| `PUT /{id}/workspace/profile` | OWNER/ORGANIZATION_MANAGER; `WorkspaceRequest` |
| `POST /{id}/workspace/media/{logo|cover}` | OWNER/ORGANIZATION_MANAGER; multipart `file`, `version` |
| `GET /{id}/workspace/media/{logo|cover}` | ADMIN/thành viên; ảnh phải fetch bằng bearer rồi tạo blob URL |
| `GET /{id}/workspace/members?page=` | ADMIN/thành viên; danh sách 20 mục/trang |
| `PUT /{id}/workspace/members/{memberId}/roles` | OWNER; `{roles: string[], version}` |
| `PUT /{id}/workspace/members/{memberId}/state` | OWNER; `{isActive, version}` |
| `GET /{id}/workspace/invitations?page=` | OWNER/ADMIN |
| `POST /{id}/workspace/invitations` | OWNER; `{email, roles: string[]}` |
| `POST /{id}/workspace/invitations/{invitationId}/revoke` | OWNER; `{version}` |
| `GET /{id}/workspace/activity?page=` | OWNER/ADMIN |
| `GET /{id}/workspace/legal-changes?page=` | OWNER/ADMIN |
| `GET /{id}/workspace/legal-changes/{changeId}` | OWNER/ADMIN: đề nghị và metadata giấy tờ |
| `POST /{id}/workspace/legal-changes` | OWNER; multipart mô tả bên dưới |
| `GET /{id}/workspace/legal-changes/{changeId}/documents/{documentId}` | OWNER/ADMIN |
| `GET /admin/legal-changes?page=` | ADMIN: hàng đợi pháp lý |
| `POST /{id}/workspace/legal-changes/{changeId}/review` | ADMIN độc lập; `{decision: APPROVE|REJECT, reason, version}` |

Tạo yêu cầu pháp lý dùng multipart: `proposal` là JSON `{profile, identityNumber, consent, version}` cùng cấu trúc `OrganizationRequest` ban đầu; `reason` là chuỗi; `registration`, `representativeId`, `authorization` là ba tệp tối đa 5 MB/tệp. Gateway cho riêng endpoint này body tối đa 17 MB; các upload khác giữ giới hạn 6 MB.

`workspace/permissions` trả `organizationId`, `userId`, `roles`, `canView`, `canEditProfile`, `canManageMembers`, `canManageCampaigns`, `canManageVolunteers`, `canManageFinance`, `canViewFinance`. ADMIN có quyền giám sát tài chính, không tự có các cờ sửa vận hành. Campaign/Donation/Volunteer phải tự bảo vệ endpoint và đối chiếu quyền hiện tại với OrganizationService; không tin `roles`/`organizationId` do frontend tự gửi. Khi dùng API này từ backend, chuyển tiếp bearer hợp lệ của người thực hiện và xử lý timeout/fail-closed. Chưa có service-to-service credential cho quyền thao tác thay mặt user.

## Chia việc gợi ý cho hai người

| Người phụ trách | Phạm vi chính | Điểm nối cần thống nhất |
|---|---|---|
| Bạn A | OrganizationService, nhân sự, phân quyền, pháp lý; frontend workspace | Giữ ổn định các endpoint/DTO trong tài liệu này |
| Bạn B | CampaignService và frontend Campaign/Beneficiary; sau đó mở rộng Volunteer hoặc Donation theo phân công | Dùng OrganizationId, kiểm tra quyền `CAMPAIGN_MANAGER`/OWNER hiện tại; database và migration riêng |

Bạn B bắt đầu bằng Campaign DRAFT → gửi admin duyệt → công khai; không ghi bảng Members/Workspaces từ CampaignDB. Khi đã có dữ liệu chiến dịch thật, bổ sung API/sự kiện tổng hợp cho dashboard admin/OWNER; không cho OrganizationService truy vấn trực tiếp CampaignDB hoặc DonationDB. Nếu chia riêng frontend/backend, người làm UI dùng `frontend/src/lib/workspace.ts`, giữ nguyên Authorization/CSRF/version và quy ước null của số liệu chưa có dữ liệu.

## Kiểm tra

Tạm tắt EMAILJS_ENABLED trên container Organization khi chạy kiểm tra giả lập; giữ `.env` chính vẫn cấu hình true rồi bật lại container sau khi xong. Chạy `python scripts/check-workspaces.py` kiểm tra tenant isolation, nhiều vai trò, không nâng thành ADMIN/OWNER, lời mời/expiry/replay, khóa quyền có hiệu lực ngay, quyền thấp hơn ở tổ chức thứ hai, dữ liệu admin thật, thay đổi pháp lý/giấy tờ và cạnh tranh xét duyệt. Chạy `python scripts/check-onboarding.py` để kiểm tra hồi quy tài khoản, đăng ký/xét duyệt và email outbox. Fixture chỉ được dọn theo ID đã tạo.

Kết quả ngày 03/11/2026: 104 kiểm tra HTTP workspace/quyền và 73 kiểm tra hồi quy tài khoản/xét duyệt/email thành công trên gateway, SQL và Redis thật. Backend build không warning/error; Next.js production build và TypeScript thành công; EF xác nhận không có model change chưa tạo migration. Đã xem giao diện admin, danh bạ, workspace và biểu mẫu OWNER bằng trình duyệt; xác nhận đăng nhập OWNER tự chuyển vào workspace, kiểm tra màn hình hẹp không tràn ngang. Fixture UI/API được dọn riêng, không duyệt hoặc xóa hồ sơ demo cũ.
