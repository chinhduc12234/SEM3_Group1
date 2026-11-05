# Campaign và Owner xét duyệt

Quyết định nghiệp vụ cập nhật theo yêu cầu nhóm ngày 03/11/2026: thành viên có đúng role `CAMPAIGN_MANAGER` tạo chiến dịch; `OWNER` cùng tổ chức xét duyệt. Thay thế quy trình Admin duyệt Campaign trong SRS 2.0. Tạo mới mặc định `COMBINED`; cả mục tiêu tiền và số tình nguyện viên phải lớn hơn 0. Owner không có quyền tạo chỉ bằng role OWNER. Không cho người tạo tự duyệt.

## Cách dùng

Owner mời tài khoản có sẵn vào tổ chức với role Quản lý chiến dịch. Sau khi người nhận chấp nhận lời mời, mở Tổ chức của tôi → không gian tổ chức → Chiến dịch → Tạo chiến dịch. Lưu bản nháp, tải ảnh/tài liệu nếu có rồi gửi Owner duyệt. Owner mở cùng mục Chiến dịch để phê duyệt, yêu cầu sửa hoặc từ chối. Mục Các chiến dịch công khai chỉ lấy chiến dịch PUBLISHED. Mỗi lần lưu hoặc chuyển trạng thái cần rowversion mới nhất.

## Quyền và ranh giới service

- Campaign sở hữu database `GiveAid_Campaign`, các bảng `Campaigns`, `Reviews`, `Media`, migrations và lịch sử trạng thái. Không có FK, query hoặc transaction chéo database.
- API runtime dùng login `giveaid_campaign` chỉ có db_datareader/db_datawriter trong GiveAid_Campaign. Migration job dùng bootstrap login riêng khỏi runtime.
- Organization sở hữu tư cách thành viên và vai trò. Campaign gọi `GET /internal/organizations/{organizationId}/campaign-access/{userId}` bằng X-Internal-Key, timeout 10 giây. Gateway chặn `/internal`. Kiểm tra trạng thái ACTIVE và role mới nhất trên mỗi thao tác; không cache quyền. Lỗi kết nối trả 503, không cấp quyền mặc định.
- JWT và thu hồi phiên dùng plumbing Shared sẵn có. Không dựa vào role do trình duyệt gửi. Campaign manager của tổ chức A không thao tác được chiến dịch tổ chức B; STAFF/FINANCE_MANAGER/VOLUNTEER_COORDINATOR và ADMIN không được dùng thay role CAMPAIGN_MANAGER/OWNER.
- Chưa cache nội dung công khai; response no-store nên không có dữ liệu duyệt cũ sau thay đổi.
- Beneficiary trong phạm vi này là mô tả nhóm/khu vực thụ hưởng. Chưa thêm CRUD hồ sơ Beneficiary nhạy cảm. Schedule/Task thuộc Volunteer theo Team Base Guide và sẽ tích hợp qua ID/API, không tạo bảng lịch/nhiệm vụ trong Campaign DB.

## Dữ liệu và API

CampaignRequest: organizationId, title (3–200), description (30–10000), campaignType (mặc định COMBINED), cause, beneficiaryDescription (10–4000), goalAmount (decimal 18,2; >0), volunteerTarget (1–1000000), startDate, endDate, location, contactEmail, contactPhone. Update thêm version. ID, người tạo, trạng thái, timestamps, rowversion và lịch sử do server quản lý. Ngày kết thúc không trước ngày bắt đầu hoặc ngày hiện tại.

| Method | Endpoint | Quyền / kết quả |
|---|---|---|
| GET | /api/campaigns?page=1&search=&cause= | Công khai, PUBLISHED, 20 dòng/trang |
| GET | /api/campaigns/{id} | Chỉ PUBLISHED; không trả lịch sử/metadata tài liệu nội bộ |
| GET | /api/campaigns/organization/{orgId}?page=1 | Manager hoặc Owner cùng tổ chức |
| GET | /api/campaigns/{id}/manage | Manager hoặc Owner cùng tổ chức |
| POST | /api/campaigns | CAMPAIGN_MANAGER, tạo DRAFT, 201 |
| PUT | /api/campaigns/{id} | CAMPAIGN_MANAGER, chỉ DRAFT/NEEDS_REVISION |
| POST | /api/campaigns/{id}/submit | `{version}`, Manager → PENDING_REVIEW |
| POST | /api/campaigns/{id}/review | `{version,decision,note}`, OWNER cùng tổ chức |
| POST | /api/campaigns/{id}/media | Multipart version, kind COVER/GALLERY/DOCUMENT, file |
| GET | /api/campaigns/{id}/media/{mediaId} | Ảnh công khai khi duyệt; DOCUMENT luôn cần quyền quản lý |

Review decision APPROVE → PUBLISHED, REQUEST_CHANGES → NEEDS_REVISION, REJECT → REJECTED. Yêu cầu sửa/từ chối bắt buộc ghi lý do. Đã gửi thì nội dung và tệp bị khóa; yêu cầu sửa cho phép chỉnh sửa và gửi lại. Sau công khai, CAMPAIGN_MANAGER được sửa tên và mô tả trực tiếp; liên hệ, mục tiêu, đối tượng thụ hưởng, danh mục, thời gian, địa điểm và loại chiến dịch bị khóa. Mỗi lần sửa lưu lịch sử CONTENT_UPDATED và kiểm tra rowversion. Từ chối là trạng thái kết thúc trong phiên bản này.

Tệp tối đa 5 MB, 12 tệp/chiến dịch; kiểm tra signature PNG/JPEG/PDF; PDF chỉ dùng DOCUMENT. Tệp lưu SQL bytes trong Campaign DB; URL dùng ID, không có đường dẫn filesystem do client quyết định. Tài liệu tải ở chế độ attachment. Người quản lý xem tên tệp; trang công khai chỉ hiển thị ảnh.

401: chưa đăng nhập; 403: sai quyền/tổ chức chưa ACTIVE; 404: không tồn tại hoặc chưa công khai; 400: dữ liệu không hợp lệ; 409: trạng thái hoặc version xung đột; 503: chưa xác minh được quyền qua Organization Service.

## Chạy và kiểm thử

`powershell -NoProfile -File scripts/start-dev.ps1` khởi tạo secret CAMPAIGN_DB_PASSWORD, provision database/login, chạy campaign-migrate rồi khởi động Campaign API.

`python scripts/test-campaigns.py` chạy kiểm thử HTTP tích hợp trên localhost:8080, đọc admin bootstrap từ .env. Nếu admin đã đổi mật khẩu cần cập nhật thông tin bootstrap dùng riêng cho lần kiểm thử. Script tạo dữ liệu có tên Campaign TEST và email riêng mỗi lần, không sửa dữ liệu người dùng. Dữ liệu mẫu được giữ để xem xét; kết quả ở artifacts/campaign-tests.json (gitignored). Bao gồm validate dữ liệu, đúng/sai role, sai tổ chức, khóa thành viên, optimistic concurrency, gửi duyệt, yêu cầu sửa/gửi lại, Owner duyệt/từ chối, ảnh/tài liệu, tính riêng tư và khả năng hiển thị công khai.

Sau công khai, CAMPAIGN_MANAGER cùng tổ chức được thay COVER hoặc thêm/thay GALLERY. Upload multipart có replaceId tùy chọn; ảnh đại diện mới tự thay COVER cũ. DOCUMENT vẫn khóa sau duyệt; thao tác dùng rowversion và lưu lịch sử.
