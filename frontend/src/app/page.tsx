import Link from "next/link";
// The public entry point explains the first available Give-AID workflow.
export default function HomePage() {
  return <div className="hero"><div><p className="eyebrow">Cùng nhau tạo nên thay đổi</p><h1>Mỗi kết nối.<br />Một cơ hội sẻ chia.</h1>
  <p className="intro">Give-AID kết nối cộng đồng với các tổ chức hoạt động vì xã hội. Đăng ký tài khoản để bắt đầu hoặc gửi hồ sơ tổ chức của bạn để được xét duyệt.</p>
  <div className="actions"><Link className="button" href="/organizations/new">Đăng ký tổ chức →</Link><Link className="button secondary" href="/register">Tham gia cộng đồng</Link></div></div>
  <aside className="hero-card"><div className="symbol">✳</div><h2>Niềm tin bắt đầu từ minh bạch</h2><ol><li>Đăng ký tài khoản cá nhân</li><li>Cung cấp hồ sơ và giấy tờ tổ chức</li><li>Admin xem xét và phản hồi</li><li>Kích hoạt sau khi được phê duyệt</li></ol><p className="muted">Phê duyệt là kết quả xét duyệt nội bộ trên Give-AID.</p></aside></div>;
}
