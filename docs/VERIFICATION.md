# Kết quả kiểm tra — 06/10/2026

- `dotnet build SEM3.slnx -m:1`: thành công, 0 warning / 0 error.
- `npm run build`: TypeScript + Vite production build thành công.
- Docker build: Identity, Catalog, React/Nginx thành công.
- Hai SQL Server healthy; hai migration job exit code 0.
- `python scripts/smoke-test.py`: **52 HTTP assertions thành công**, cộng kiểm tra role, phân trang, cookie và concurrent refresh một lần.
- Trình duyệt: đăng ký thành công, đăng nhập Customer, khôi phục phiên khi tải lại, Customer bị chặn tại `/admin` (403), đăng nhập Admin và bảng người dùng hiển thị đúng.
- Kiểm tra bố cục desktop 1440px và mobile 390px; trang chủ mobile không tràn ngang. Tài khoản UI test được hạ về Customer và khóa sau kiểm tra.

Smoke test kiểm tra dữ liệu thật qua gateway và SQL Server, không dùng EF InMemory. Các tài khoản `smoke-*` và `ui-check-*` là dữ liệu kiểm thử local; sản phẩm do smoke test tạo được xóa khi hoàn tất.

Chưa kiểm thử tải lớn, deployment production hoặc email/mobile (chưa triển khai). Docker Development dùng localhost HTTP; không coi cấu hình hiện tại là cấu hình production.
