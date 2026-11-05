# Khảo sát địa điểm khó khăn

Chức năng mở rộng trong Campaign Service, sử dụng database GiveAid_Campaign. Không tạo Survey Service hoặc RabbitMQ.

## Dữ liệu

- SurveyReports: GUID id, OrganizationId, StaffId, ManagerId, Title, Province, Ward, AddressDetail, Category, Severity, AffectedHouseholds (nullable), Description, ProposedSupport, SurveyedAt, Status, ReviewNote, ReviewedBy, ReviewedAt, SubmittedAt, CreatedAt, UpdatedAt, IsDeleted và rowversion.
- SurveyReportImages: GUID id, ReportId (FK nội bộ), FileReference, FileName, ContentType, FileSize, Content (ảnh đã xử lý), UploadedBy và CreatedAt.
- SurveyReportEvents: lịch sử tạo/sửa/gửi/xóa/duyệt/thêm-xóa ảnh; ghi người thao tác và thời điểm.
- SurveyNotifications: phản hồi gửi đúng tài khoản, thời điểm tạo/đọc; lưu cùng transaction với thao tác gửi/duyệt.

Các ID tổ chức/tài khoản chỉ là tham chiếu, không có FK hoặc truy vấn xuyên database. Mọi thời điểm server lưu datetimeoffset; kiểu chữ nvarchar bảo toàn tiếng Việt. Hai bảng hỗ trợ giữ được lịch sử và thông báo phản hồi nhiều vòng bổ sung.

## Người quản lý trực tiếp

Organization Service sở hữu quan hệ `Members.SurveyManagerUserId` và giá trị tương ứng trên lời mời. Khi CAMPAIGN_MANAGER mời SURVEY_STAFF, server tự gán người phụ trách là người mời. Owner có thể chọn một CAMPAIGN_MANAGER hoạt động cùng tổ chức khi mời, hoặc gán lại từ Nhân sự & vai trò bằng `PUT /api/organizations/{org}/workspace/members/{memberId}/survey-manager` với `{surveyManagerUserId,version}`.

Các nhân viên cũ được khôi phục người phụ trách từ lời mời đã chấp nhận nếu người mời là CAMPAIGN_MANAGER. Người được Owner cấp role nhưng chưa phân công vẫn lưu nháp được; không gửi báo cáo được cho tới khi có người phụ trách. Không được tự làm Manager khảo sát của chính mình.

Campaign gọi API nội bộ Organization để kiểm tra role đang hoạt động, tổ chức ACTIVE và người phụ trách. Không tin StaffId, ManagerId hoặc người duyệt do client gửi. ManagerId trên báo cáo được xác định tại mỗi lần gửi và cố định cho vòng xét duyệt đó. Nếu đổi người phụ trách, lần gửi tiếp theo sử dụng người mới; không phát báo cáo tới toàn bộ Manager trong tổ chức.

## Quyền và trạng thái

SURVEY_STAFF tạo và xem báo cáo của chính mình trong tổ chức. Chỉ sửa, thêm/xóa ảnh và xóa báo cáo ở DRAFT hoặc NEEDS_REVISION. Xóa báo cáo là xóa mềm, giữ lịch sử và minh chứng nhưng ẩn khỏi danh sách và chặn truy cập ảnh. Báo cáo đã gửi, chấp nhận hoặc từ chối được khóa nội dung.

CAMPAIGN_MANAGER chỉ xem và xử lý báo cáo có ManagerId là mình, đã được gửi. Owner, Admin, nhân viên khác và Manager khác không có quyền mặc định xem báo cáo/ảnh. Manager không được tự duyệt báo cáo do mình tạo.

`DRAFT → SUBMITTED → APPROVED / NEEDS_REVISION / REJECTED`. Nhân viên chỉnh sửa NEEDS_REVISION và gửi lại. Yêu cầu bổ sung/từ chối bắt buộc có lý do. Rowversion ngăn ghi đè và duyệt trùng. Lịch sử phản hồi cũ vẫn được giữ khi có vòng xử lý mới.

## Ảnh minh chứng

Mỗi báo cáo tối đa 10 ảnh, mỗi ảnh từ 1 byte đến 5 MiB, chỉ `.jpg`, `.jpeg`, `.png`. Kiểm tra định dạng thực tế và phần mở rộng, giải mã ảnh bằng SkiaSharp rồi mã hóa lại thành JPEG. Không lưu nguyên file client; script, payload nối sau ảnh và EXIF gốc không được chuyển vào dữ liệu lưu. Tối đa 8000px mỗi chiều và 20 triệu pixel để giới hạn tài nguyên giải mã. Toàn bộ batch phải hợp lệ trước khi ghi ảnh. Cần ít nhất một ảnh để gửi báo cáo.

Ảnh riêng tư được trả qua API có JWT, không đặt vào static folder. Frontend dùng authenticated blob URL để hiển thị; không ghi token vào URL. Tên tệp lưu do server sinh, không dùng tên người dùng làm đường dẫn.

## API qua gateway

Prefix `/api/campaigns/surveys`, mọi thao tác cần JWT và header X-Requested-With cho request thay đổi dữ liệu.

| Method | Path dưới prefix | Chức năng |
|---|---|---|
| GET | /organizations/{org}/dashboard?mode=mine hoặc review | Thống kê của nhân viên hoặc Manager |
| GET | /organizations/{org}/reports?mode=mine hoặc review&status=&page=1 | Danh sách có phân trang 20 dòng |
| POST | /organizations/{org}/reports | Tạo nháp; server xác định tác giả |
| GET / PUT / DELETE | /reports/{id} | Chi tiết, sửa, xóa mềm |
| POST | /reports/{id}/images | Multipart version và nhiều phần files |
| GET / DELETE | /reports/{id}/images/{imageId} | Xem/xóa minh chứng theo quyền báo cáo |
| POST | /reports/{id}/submit | `{version}`, gửi đúng Manager |
| POST | /reports/{id}/review | `{version,decision,note}` |
| GET | /organizations/{org}/notifications?page=1 | Thông báo riêng của tài khoản |
| POST | /notifications/{id}/read | Đánh dấu đã đọc |

Form nhận các trường nội dung nêu trên; update/delete/submit/image-delete cần version. Không có API công khai khảo sát. Không cache quyền hoặc minh chứng. Tất cả API và ảnh đi qua gateway. Dashboard/lời nhắn tự làm mới mỗi 30 giây và có nút Làm mới; không dùng email hoặc message broker.

## Chạy và kiểm thử

Chạy start-dev.ps1 như bình thường: Organization migration thêm quan hệ phụ trách, Campaign migration tạo bốn bảng khảo sát, sau đó các API khởi động. Chạy `python scripts/test-surveys.py` để kiểm thử HTTP gateway: validate trường, role/tổ chức, ảnh giả/script/sai phần mở rộng/quá 5 MiB, batch nhiều ảnh, quyền xem ảnh, định tuyến Manager, bổ sung/gửi lại/duyệt/từ chối, thông báo và xóa mềm.

Script chỉ tạo fixture mới, không sửa dữ liệu thật và không tạo chiến dịch. Kết quả không chứa mật khẩu/token được lưu ở artifacts/survey-report-tests.json. Tùy chọn `--ui-fixture` chỉ dùng cho kiểm tra UI riêng: sinh file credential tạm gitignored; cần xóa artifacts/survey-ui-fixture.json sau khi kiểm tra xong.
