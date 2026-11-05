"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  { src: "/images/slide-1.jpg", alt: "Trao nhu yếu phẩm hỗ trợ người dân sau mưa lũ", label: "Chung tay sẻ chia", title: "Một hành động nhỏ,", accent: "một hy vọng lớn." },
  { src: "/images/slide-2.webp", alt: "Những nụ cười trong buổi gặp gỡ và thăm hỏi người cao tuổi", label: "Kết nối yêu thương", title: "Trao đi quan tâm,", accent: "nhận về nụ cười." },
  { src: "/images/slide-3.jpg", alt: "Đôi bàn tay nâng niu một trái tim đỏ", label: "Mỗi tấm lòng đều đáng quý", title: "Sự tử tế bắt đầu", accent: "từ chính bạn." },
  { src: "/images/slide-4.jpg", alt: "Những người làm thiện nguyện đến thăm và trao quà cho một cụ bà", label: "Đồng hành cùng cộng đồng", title: "Đến gần hơn,", accent: "để hiểu và sẻ chia." },
  { src: "/images/slide-5.jpg", alt: "Những em nhỏ vui đùa bên nhau trước hiên nhà", label: "Vì những ngày mai tươi sáng", title: "Cùng vun đắp", accent: "những nụ cười nhỏ." },
  { src: "/images/slide-6.webp", alt: "Buổi thăm hỏi và tặng quà cho người cao tuổi", label: "Lan tỏa điều tốt đẹp", title: "Một lần chung tay,", accent: "thêm nhiều ấm áp." },
];

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % slides.length);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [index, reduced]);

  const go = (next: number) => setIndex((next + slides.length) % slides.length);
  const slide = slides[index];

  return (
    <section className="ga-slider" aria-label="Những khoảnh khắc sẻ chia" aria-roledescription="trình chiếu">
      <div className="ga-slider-layout">
        <div className="ga-slider-copy">
          <p className="ga-overline"><span /> CÙNG NHAU TẠO NÊN THAY ĐỔI</p>
          <div key={index} className="ga-slider-message" aria-live="off">
            <h1>{slide.title}<br /><em>{slide.accent}</em></h1>
          </div>
          <p>Kết nối những tấm lòng với những câu chuyện cần được sẻ chia. Cùng Give-AID góp sức cho một cộng đồng tốt đẹp hơn.</p>
          <div className="ga-hero-actions"><Link className="ga-button" href="/chien-dich">Khám phá chiến dịch <span>↗</span></Link><Link className="ga-hero-link" href="/cach-tham-gia">Cách tham gia ↓</Link></div>
        </div>
        <div className="ga-slider-visual">
          {slides.map((item, i) => <img key={item.src} className={`ga-slider-photo${i === index ? " is-active" : ""}`} src={item.src} alt={i === index ? item.alt : ""} aria-hidden={i !== index} fetchPriority={i === 0 ? "high" : "auto"} />)}
          <div className="ga-slider-caption"><span>{slide.label}</span><span>{String(index + 1).padStart(2, "0")} / 06</span></div>
        </div>
      </div>
      <div className="ga-slider-dots" aria-label="Chọn trang trình chiếu">{slides.map((item, i) => <button key={item.src} type="button" aria-label={`Xem ảnh ${i + 1}: ${item.label}`} aria-pressed={i === index} className={i === index ? "is-active" : ""} onClick={() => go(i)}><span /></button>)}</div>
    </section>
  );
}
