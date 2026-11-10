import Link from "next/link";

const helpTopics = [
  { icon: "◉", title: "Tài khoản cá nhân", text: "Cập nhật họ tên, ảnh đại diện và thông tin liên hệ trong khu vực hồ sơ.", href: "/account", action: "Mở hồ sơ" },
  { icon: "◇", title: "Bảo mật tài khoản", text: "Đổi mật khẩu và xem các lưu ý giúp bảo vệ tài khoản Give-AID.", href: "/account/security", action: "Xem bảo mật" },
  { icon: "✳", title: "Chiến dịch cộng đồng", text: "Tìm hiểu mục tiêu, đơn vị tổ chức và thông tin liên hệ được đăng trên từng chiến dịch.", href: "/chien-dich", action: "Tìm chiến dịch" },
  { icon: "▤", title: "Hồ sơ tổ chức", text: "Khám phá thông tin các tổ chức và hoạt động cộng đồng trên nền tảng.", href: "/organizations", action: "Xem tổ chức" },
];

const faqs = [
  { q: "Làm thế nào để cập nhật hồ sơ cá nhân?", a: <>Đăng nhập Give-AID, mở tên tài khoản ở góc trên rồi chọn hồ sơ cá nhân. Tại đây bạn có thể cập nhật thông tin và ảnh đại diện.</> },
  { q: "Tôi quên mật khẩu hoặc muốn đổi mật khẩu thì làm sao?", a: <>Nếu vẫn đăng nhập được, mở mục <Link href="/account/security">Bảo mật</Link> để đổi mật khẩu. Nếu không thể đăng nhập, hãy sử dụng chức năng khôi phục mật khẩu trên màn hình đăng nhập nếu hệ thống đang cung cấp.</> },
  { q: "Tôi tìm thông tin của một chiến dịch ở đâu?", a: <>Mở trang <Link href="/chien-dich">Chiến dịch</Link>, chọn chiến dịch bạn quan tâm để xem mục tiêu, thời gian, địa điểm và thông tin liên hệ do đơn vị tổ chức cung cấp.</> },
  { q: "Give-AID đã hỗ trợ thanh toán trực tuyến chưa?", a: <>Thông tin giao dịch và thanh toán chỉ nên được thực hiện khi trang chiến dịch hiển thị rõ phương thức cùng bước xác nhận. Không gửi mật khẩu hoặc thông tin đăng nhập ngân hàng qua tin nhắn. Nếu chưa thấy hướng dẫn thanh toán trên chiến dịch, hiện chưa có giao dịch để xác nhận trong tài khoản.</> },
  { q: "Thông tin hồ sơ của tôi có được công khai không?", a: <>Thông tin liên hệ riêng tư như ngày sinh, địa chỉ và số điện thoại được quản lý trong hồ sơ cá nhân. Hãy xem <Link href="/account/policies">Chính sách</Link> để biết thêm về quyền riêng tư và an toàn tài khoản.</> },
];

export default function CustomerSupportPage() {
  return <main className="info-page support-page">
    <section className="support-hero"><div className="info-container support-hero-grid"><div><p className="info-eyebrow"><span/> TRUNG TÂM HỖ TRỢ GIVE-AID</p><h1>Chúng tôi ở đây<br/><em>để giúp bạn.</em></h1><p className="support-hero-copy">Tìm câu trả lời, chọn đúng hướng dẫn và tiếp tục hành trình sẻ chia của bạn.</p><a className="info-button" href="#cau-hoi">Xem câu hỏi thường gặp <span>↓</span></a></div><div className="support-hero-art" aria-hidden="true"><div className="support-art-orbit orbit-one"/><div className="support-art-orbit orbit-two"/><div className="support-art-orbit orbit-three"/><div className="support-art-center">✳</div><span className="support-art-label label-one">LẮNG NGHE</span><span className="support-art-label label-two">ĐỒNG HÀNH</span><span className="support-art-label label-three">SẺ CHIA</span></div></div></section>

    <section className="info-container support-topics"><div className="info-section-heading"><div><p className="info-eyebrow">BẠN ĐANG CẦN GÌ?</p><h2>Chọn chủ đề<br/><em>để được hướng dẫn.</em></h2></div><p>Các lối tắt dưới đây đưa bạn đến đúng khu vực trong Give-AID.</p></div><div className="support-topic-grid">{helpTopics.map(item=><article key={item.title}><span className="support-topic-icon" aria-hidden="true">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p><Link href={item.href}>{item.action}<span>↗</span></Link></article>)}</div></section>

    <section className="support-faq" id="cau-hoi"><div className="info-container support-faq-grid"><div className="support-faq-intro"><p className="info-eyebrow">CÂU TRẢ LỜI RÕ RÀNG</p><h2>Câu hỏi<br/><em>thường gặp.</em></h2><p>Chọn một câu hỏi để xem hướng dẫn chi tiết.</p><div className="support-faq-aside"><span>✦</span><p>Give-AID sẽ không bao giờ yêu cầu bạn cung cấp mật khẩu qua email hoặc tin nhắn.</p></div></div><div className="support-faq-list">{faqs.map((item,index)=><details key={item.q} open={index===0}><summary><span className="info-number">{String(index+1).padStart(2,"0")}</span><strong>{item.q}</strong><i aria-hidden="true">＋</i></summary><div className="support-faq-answer">{item.a}</div></details>)}</div></div></section>

    <section className="info-container support-contact"><div><p className="info-eyebrow">VẪN CẦN TRỢ GIÚP?</p><h2>Hãy cho chúng tôi biết<br/><em>bạn đang tìm điều gì.</em></h2><p>Chưa tìm thấy câu trả lời? Mở thông báo để xem các cập nhật mới nhất từ Give-AID hoặc quay lại khám phá nội dung trên nền tảng.</p></div><div className="support-contact-actions"><Link className="info-button" href="/notifications">Mở thông báo <span>↗</span></Link><Link className="info-text-link" href="/">Quay về trang chủ <span>→</span></Link></div></section>
  </main>;
}
