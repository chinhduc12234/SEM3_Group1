import { ArrowRight, ArrowUpRight, Boxes, Code2, Layers3, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Home({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  return <><div className="page-heading"><div><div className="eyebrow">{admin ? 'ADMIN WORKSPACE' : 'YOUR NEXT PROJECT STARTS HERE'}</div><h1>{admin ? 'Tổng quan quản trị' : `Xin chào${user ? `, ${user.displayName}` : ', bạn'}!`}</h1><p>Một khởi đầu vững chắc. Sẵn sàng cho ý tưởng của nhóm.</p></div><span className="version-tag">PHIÊN BẢN 0.1 <span className="status-dot"/></span></div>
    <section className="hero"><div className="hero-copy"><span className="hero-label"><span className="status-dot"/> SEM3 · GROUP 01</span><h2>Nền tảng hôm nay.<br/><em>Ý tưởng ngày mai.</em></h2><p>Khám phá bộ khung dự án với tài khoản, phân quyền và không gian quản lý được kết nối trong một trải nghiệm.</p><Link to={admin ? '/admin/products' : '/products'} className="button light">{admin ? 'Quản lý sản phẩm' : 'Khám phá danh mục'} <ArrowUpRight size={18}/></Link></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-tile tile-back"><Layers3 size={62}/></div><div className="art-tile tile-front"><span>S<span>3</span></span><small>BUILD SOMETHING GREAT</small></div><div className="art-pill"><span className="status-dot"/> Ready to build</div></div></section>
    <div className="section-heading"><h2>{admin ? 'Công cụ quản lý' : 'Mọi thứ bạn cần để bắt đầu'}</h2><span>ĐƯỢC XÂY DỰNG ĐỂ MỞ RỘNG</span></div>
    <div className="feature-grid">{[
      { icon: Boxes, title: 'Danh mục sản phẩm', text: 'Dữ liệu mẫu, tìm kiếm và phân trang. Điểm bắt đầu cho nghiệp vụ của nhóm.', to: admin ? '/admin/products' : '/products', label: admin ? 'Quản lý danh mục' : 'Xem danh mục' },
      { icon: admin ? Users : ShieldCheck, title: admin ? 'Quản lý người dùng' : 'Tài khoản của bạn', text: admin ? 'Phân quyền Admin / Customer và quản lý trạng thái hoạt động của tài khoản.' : 'Thông tin cá nhân và quyền truy cập được bảo vệ trong không gian riêng.', to: admin ? '/admin/users' : '/account', label: admin ? 'Xem người dùng' : 'Mở tài khoản' },
      { icon: Code2, title: 'Không gian mở rộng', text: 'Nghiệp vụ đang ở mức minh họa, sẵn sàng thay thế khi nhận đề tài chính thức.', to: '/products', label: 'Khám phá bản mẫu' }
    ].map((item, index) => <article className="feature-card" key={item.title}><div className="card-top"><span className="feature-icon"><item.icon size={23}/></span><span className="card-number">0{index + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p><Link to={item.to}>{item.label}<ArrowRight size={17}/></Link></article>)}</div>
    <section className="info-strip"><span className="info-icon"><Layers3 size={22}/></span><div><strong>Đây là không gian thử nghiệm của nhóm.</strong><p>Sản phẩm và nội dung hiện tại là dữ liệu mẫu phục vụ phát triển dự án.</p></div><span className="pill">STARTER PROJECT</span></section>
  </>;
}
