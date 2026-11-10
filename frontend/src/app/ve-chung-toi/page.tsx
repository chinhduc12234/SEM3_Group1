import Link from "next/link";

const principles = [
  { number: "01", title: "Minh bạch", text: "Thông tin chiến dịch và tổ chức được trình bày rõ ràng để cộng đồng có thêm cơ sở tìm hiểu trước khi đồng hành." },
  { number: "02", title: "Tôn trọng", text: "Mỗi câu chuyện và hoàn cảnh đều được tiếp cận bằng sự thấu cảm, tôn trọng quyền riêng tư và phẩm giá." },
  { number: "03", title: "Cùng hành động", text: "Give-AID kết nối người muốn sẻ chia với các tổ chức và hoạt động cộng đồng, để mỗi người tìm được cách đóng góp phù hợp." },
];

export default function AboutPage() {
  return <main className="info-page about-page">
    <section className="info-hero about-hero">
      <div className="info-hero-image" role="img" aria-label="Tình nguyện viên cùng cộng đồng" />
      <div className="info-container info-hero-content">
        <p className="info-eyebrow"><span/> VỀ GIVE-AID</p>
        <h1>Kết nối lòng tốt,<br/><em>nuôi dưỡng niềm tin.</em></h1>
        <p className="info-hero-copy">Một cộng đồng nơi những tấm lòng gặp nhau, lắng nghe các câu chuyện và cùng tạo nên thay đổi tích cực.</p>
        <div className="info-actions"><Link className="info-button" href="/chien-dich">Khám phá chiến dịch <span>↗</span></Link><Link className="info-text-link" href="/organizations">Tìm hiểu các tổ chức <span>→</span></Link></div>
      </div>
      <div className="info-hero-caption">GIVE-AID <span>·</span> CÙNG NHAU SẺ CHIA</div>
    </section>

    <section className="info-container about-intro">
      <div><p className="info-eyebrow">MỤC ĐÍCH CỦA CHÚNG TÔI</p><h2>Để sự quan tâm<br/><em>đến được đúng nơi.</em></h2></div>
      <div className="about-intro-copy"><p>Give-AID giúp mọi người khám phá các chiến dịch cộng đồng, tìm hiểu tổ chức đang hoạt động và lựa chọn cách đồng hành phù hợp với mình.</p><p>Chúng tôi tin rằng những thay đổi bền vững bắt đầu từ thông tin dễ hiểu, sự kết nối tử tế và những hành động được thực hiện cùng nhau.</p></div>
    </section>

    <section className="about-principles"><div className="info-container"><div className="info-section-heading"><div><p className="info-eyebrow">ĐIỀU CHÚNG TÔI THEO ĐUỔI</p><h2>Lòng tốt cần<br/><em>một nền tảng đáng tin.</em></h2></div><p>Ba nguyên tắc định hướng cách Give-AID xây dựng trải nghiệm kết nối cộng đồng.</p></div><div className="about-principle-grid">{principles.map(item=><article key={item.number}><span className="info-number">{item.number}</span><h3>{item.title}</h3><p>{item.text}</p><span className="about-card-mark" aria-hidden="true">✳</span></article>)}</div></div></section>

    <section className="info-container about-steps"><p className="info-eyebrow">BẮT ĐẦU TỪ MỘT KẾT NỐI</p><h2>Mỗi người đều có thể<br/><em>chung tay theo cách riêng.</em></h2><div className="about-step-list"><article><span>01</span><div><h3>Lắng nghe câu chuyện</h3><p>Tìm hiểu mục tiêu, hoạt động và thông tin của chiến dịch hoặc tổ chức.</p></div></article><article><span>02</span><div><h3>Chọn cách đồng hành</h3><p>Khám phá những cơ hội phù hợp với thời gian, khả năng và điều bạn quan tâm.</p></div></article><article><span>03</span><div><h3>Lan tỏa điều tốt đẹp</h3><p>Cùng cộng đồng góp sức và theo dõi thông tin hoạt động được cập nhật trên nền tảng.</p></div></article></div></section>

    <section className="info-cta"><div className="info-container info-cta-inner"><div><p className="info-eyebrow">CÙNG GIVE-AID</p><h2>Một hành động nhỏ<br/><em>có thể mở ra hy vọng.</em></h2></div><Link className="info-button info-button-light" href="/chien-dich">Bắt đầu khám phá <span>↗</span></Link></div></section>
  </main>;
}
