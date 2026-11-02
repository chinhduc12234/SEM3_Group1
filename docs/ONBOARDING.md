# Tài khoản và xét duyệt tổ chức

Đợt triển khai đầu tiên của Give-AID: đăng ký/đăng nhập USER, bootstrap ADMIN và đăng ký tổ chức kèm hồ sơ pháp lý. SQL Initial v1 do nhóm cung cấp được dùng để tham khảo ranh giới dữ liệu; hệ thống sử dụng EF Core migrations riêng, không chạy script tham khảo vào database.

## Chạy và tài khoản quản trị

Từ thư mục repository, chạy:

```powershell
powershell -NoProfile -File scripts/start-dev.ps1
```

Mở http://localhost:8080. Script sinh secret trong .env và khóa RSA trong .secrets, giữ nguyên ở các lần chạy sau. Đọc ADMIN_EMAIL/ADMIN_PASSWORD trong .env để đăng nhập lần đầu. Đổi mật khẩu ở /account; việc đổi mật khẩu thu hồi mọi phiên của tài khoản. ADMIN_PASSWORD là mật khẩu bootstrap ban đầu, không tự đồng bộ với mật khẩu đã đổi trong database.

Không chia sẻ .env, .secrets hay keyring. Mỗi thành viên chạy script trên máy của mình để có secret riêng. Trên một môi trường dùng chung, bootstrap và các khóa do người quản trị môi trường quản lý. Sau khi thay đổi code, chạy lại start-dev.ps1 để build và khởi động container mới.

Compose chạy sql-provision, sau đó identity-migrate / organization-migrate trước khi API hoạt động. Mỗi migration được EF quản lý phiên bản. Không dùng EnsureCreated và không sửa migration đã áp dụng; thêm migration mới khi đổi schema.

## Luồng nghiệp vụ

1. Khách đăng ký bằng họ tên, email và mật khẩu; backend chỉ cấp USER, bỏ qua role từ client.
2. USER đăng nhập và chọn đăng ký tổ chức. Hồ sơ gồm tên pháp lý, loại hình, số/ngày/cơ quan đăng ký, ngày thành lập, trụ sở, thông tin liên hệ, mục tiêu và người đại diện.
3. Lưu thông tin để tạo DRAFT. Người đại diện cung cấp họ tên, chức vụ, ngày sinh, email/điện thoại, CCCD/hộ chiếu và thông tin cấp giấy tờ.
4. Tải đủ ba nhóm tài liệu: giấy đăng ký/quyết định thành lập, giấy tờ định danh đại diện và văn bản chứng minh quyền đại diện/ủy quyền.
5. Người nộp xác nhận tính chính xác và gửi hồ sơ. Trạng thái PENDING_REVIEW khóa việc chỉnh sửa.
6. ADMIN xem danh sách, thông tin đầy đủ, tải giấy tờ và đưa ra một trong ba quyết định.
7. APPROVE chuyển sang ACTIVE và tạo membership OWNER cho người nộp trong cùng giao dịch SQL. USER vẫn là quyền cấp hệ thống; OWNER là quyền thuộc tổ chức, không phải tài khoản dùng chung.

| Trạng thái hiện tại | Thao tác | Kết quả |
|---|---|---|
| DRAFT | Người nộp cập nhật / tải giấy tờ | DRAFT |
| DRAFT | Gửi đủ hồ sơ | PENDING_REVIEW |
| PENDING_REVIEW | Admin yêu cầu bổ sung, kèm lý do | CHANGES_REQUESTED |
| CHANGES_REQUESTED | Người nộp sửa và gửi lại | PENDING_REVIEW |
| PENDING_REVIEW | Admin phê duyệt | ACTIVE + OWNER |
| PENDING_REVIEW | Admin từ chối, kèm lý do | REJECTED |

Admin không được tự duyệt hồ sơ do mình nộp. REJECTED là quyết định kết thúc hồ sơ trong phạm vi hiện tại; nên dùng yêu cầu bổ sung cho trường hợp có thể sửa. Số giấy đăng ký không được trùng để tránh nhiều hồ sơ cho cùng tổ chức. Toàn bộ thao tác tạo, sửa, tải giấy tờ, gửi và xét duyệt có lịch sử; rowversion chặn sửa/duyệt bằng bản cũ.

Phê duyệt là kiểm duyệt nội bộ Give-AID, không phải chứng nhận pháp nhân từ cơ quan nhà nước. Cơ quan xét duyệt phải đối chiếu giấy tờ thực tế theo quy trình tổ chức; hệ thống chưa kết nối cơ sở dữ liệu pháp lý.

## API

Mọi request ghi dữ liệu cần header X-Requested-With: GiveAid. Các API bảo vệ cần Authorization: Bearer accessToken. Frontend gọi cùng origin qua gateway; không mở CORS. Lỗi trả ProblemDetails hoặc validation errors; 401 hết phiên, 403 thiếu quyền, 404 dữ liệu ngoài phạm vi, 409 xung đột phiên bản/trùng đăng ký.

| Method | Đường dẫn | Quyền |
|---|---|---|
| POST | /api/auth/register | Khách, luôn tạo USER |
| POST | /api/auth/login | Khách |
| POST | /api/auth/refresh | Cookie refresh hợp lệ |
| POST | /api/auth/logout | Cookie / session hiện tại |
| GET | /api/auth/me | Đã đăng nhập |
| POST | /api/auth/password | Đã đăng nhập |
| GET | /api/organizations/mine | Người nộp, hồ sơ của mình |
| POST | /api/organizations | Đã đăng nhập |
| GET / PUT | /api/organizations/{id} | Chủ hồ sơ; Admin chỉ đọc |
| POST | /api/organizations/{id}/documents/{kind} | Chủ hồ sơ ở trạng thái cho sửa |
| GET | /api/organizations/{id}/documents/{documentId} | Chủ hồ sơ hoặc Admin |
| POST | /api/organizations/{id}/submit | Chủ hồ sơ |
| GET | /api/organizations?page=1&status=PENDING_REVIEW&search= | ADMIN, phân trang 20 hồ sơ |
| POST | /api/organizations/{id}/review | ADMIN |

Create/update nhận {profile,identityNumber,consent,version}. version trả trong detail và bắt buộc khi update, upload, submit, review. Upload multipart gồm file và version; kind là REGISTRATION, REPRESENTATIVE_ID hoặc AUTHORIZATION. Submit nhận {version}. Review nhận {decision,reason,version}; decision là APPROVE, REJECT hoặc REQUEST_CHANGES.

## Bảo mật và dữ liệu

- Password dùng ASP.NET Core Identity PBKDF2 HMAC-SHA512 210.000 vòng với salt riêng; không mã hóa có thể giải ngược và không lưu plaintext. Tối thiểu 12 ký tự, hoa/thường/số/ký tự đặc biệt. Sai 5 lần khóa đăng nhập 15 phút.
- JWT RS256 tồn tại 5 phút và chỉ nằm trong memory của frontend; refresh token ngẫu nhiên ở cookie HttpOnly, SameSite Strict, Secure ngoài Development. SQL chỉ lưu SHA-256 của refresh token; rowversion đảm bảo một lần refresh chỉ có một bên thắng.
- Redis là registry thu hồi phiên, được kiểm tra bởi các service mà không gọi Identity database. Logout/đổi mật khẩu làm token cũ mất hiệu lực. Redis không khả dụng thì xác thực thất bại; mất registry yêu cầu đăng nhập lại, không tự khôi phục phiên từ SQL.
- API giới hạn request xác thực theo ngân sách mỗi instance; UserManager quản lý lockout. Không ghi password/token/nội dung hồ sơ vào log request. Identity và Organization dùng login SQL riêng; API không được tạo/sửa schema và không được đọc database service khác.
- Số định danh và nội dung tệp được bảo vệ bằng Data Protection, keyring của Organization lưu bền ở volume organization-keys. Metadata và thông tin liên hệ không công khai, chỉ người nộp/Admin đọc. Giữ keyring cùng bản sao lưu database; triển khai thực cần bảo vệ keyring bằng secret manager/certificate và HTTPS.
- Tệp tối đa 5 MB, ba nhóm tài liệu. Backend kiểm tra extension và magic bytes PDF/JPEG/PNG, đổi tên tệp và trả attachment có xác thực. Tệp không nằm trong thư mục public. Kiểm tra định dạng không thay thế antivirus/CDR; chưa có dịch vụ quét mã độc. Không mở file đính kèm không đáng tin bằng phần mềm chưa cập nhật.
- Chưa có xác minh email, quên mật khẩu qua email, MFA, xác minh pháp lý tự động hoặc quy trình appeal hồ sơ bị từ chối. Các miền Campaign/Donation/Volunteer/Content tiếp tục là khung cho giai đoạn sau.

## Kiểm tra

```powershell
dotnet build Give-AID.slnx -m:1
cd frontend
npm ci
npm run build
cd ..
python scripts/check-onboarding.py
```

Integration check chỉ chạy trên stack local đang hoạt động. Script tạo tài khoản/hồ sơ giả lập rồi dọn đúng các ID do nó tạo, kiểm tra quyền, ownership, giấy tờ riêng tư, rowversion khi duyệt đồng thời, membership Owner, mật khẩu băm và chặn login SQL truy cập chéo database. Không chạy script này trên dữ liệu production.

Frontend hot reload: chạy npm run dev trong frontend, các URL /api được chuyển đến gateway :8080. Nếu đổi WEB_PORT, đặt API_GATEWAY_URL trước khi chạy Next.js dev, ví dụ http://127.0.0.1:8081.

Campaign/Donation/Volunteer/Content chưa có persistence trong đợt này và không nhận secret SQL. Khi thêm nghiệp vụ, nhóm bổ sung database/login riêng trong provision, migration riêng và connection string runtime chỉ có quyền trên database đó.
