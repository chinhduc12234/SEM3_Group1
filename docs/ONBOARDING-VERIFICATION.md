# Kết quả kiểm tra tài khoản và xét duyệt tổ chức

Ngày kiểm tra: 02/11/2026. Môi trường: Docker Compose local, Nginx gateway, SQL Server 2022 và Redis. Không dùng EF InMemory.

- .NET solution build: thành công, 0 warning, 0 error.
- Next.js production build và Docker images: thành công.
- EF kiểm tra model: cả Identity và Organization không có thay đổi chưa được ghi thành migration.
- Provision và hai migration job exit 0; chạy lại giữ tài khoản Admin và dữ liệu đã có.
- Integration script: 65 HTTP/security assertions thành công, kèm đối chiếu SQL về mật khẩu băm có salt, mã hóa nội dung tệp, số định danh, Owner và quyền SQL.
- Đã kiểm tra role injection, JWT bị sửa, refresh token cũ, CSRF header, account lockout, password change/logout revocation, truy cập hồ sơ/tệp người khác, giấy tờ thiếu/giả/quá lớn, dữ liệu không hợp lệ, sửa hồ sơ đang chờ duyệt, hai lượt phê duyệt đồng thời, tự duyệt, yêu cầu bổ sung và từ chối.
- Trình duyệt: đăng ký USER, đăng nhập, lưu hồ sơ tổ chức và chuyển sang bước tải giấy tờ thành công; nút gửi duyệt khóa khi chưa đủ giấy tờ.
- Sau khi tạo lại container Organization, hồ sơ vẫn giải mã được từ keyring volume.
- Tài khoản và hồ sơ giả lập do quá trình kiểm tra tạo đã được dọn theo ID; tài khoản Admin giữ nguyên.

Chưa kiểm thử tải lớn, triển khai HTTPS/production, email verification/MFA hoặc quét antivirus/CDR. Chức năng duyệt hồ sơ là xét duyệt nội bộ; không xác minh với cơ quan nhà nước.
