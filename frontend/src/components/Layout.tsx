import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Boxes, LayoutDashboard, LogOut, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useState } from 'react';

export function Layout({ admin = false }: { admin?: boolean }) {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState('');
  async function signOut() { try { await logout(); navigate('/'); } catch (e) { setError((e as Error).message); } }
  return <div className="app-shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-mark">S<span>3</span></span><span>SEM3<span className="brand-caption">PROJECT FOUNDATION</span></span></Link>
      <div className="workspace-tag"><span className="status-dot"/> {admin ? 'Không gian quản trị' : 'Không gian khách hàng'}</div>
      <span className="nav-label">KHÁM PHÁ</span>
      <nav>
        {admin ? <><NavLink to="/admin" end><LayoutDashboard size={19}/> Tổng quan</NavLink><NavLink to="/admin/products"><Boxes size={19}/> Sản phẩm mẫu</NavLink><NavLink to="/admin/users"><Users size={19}/> Người dùng</NavLink><NavLink to="/"><ArrowUpRight size={19}/> Xem trang khách hàng</NavLink></> : <><NavLink to="/" end><LayoutDashboard size={19}/> Tổng quan</NavLink><NavLink to="/products"><Boxes size={19}/> Danh mục sản phẩm</NavLink><NavLink to="/account"><UserRound size={19}/> Tài khoản của tôi</NavLink>{user?.role === 'Admin' && <NavLink to="/admin"><ShieldCheck size={19}/> Quản trị hệ thống</NavLink>}</>}
      </nav>
      <div className="sidebar-note"><ShieldCheck size={23}/><strong>Sẵn sàng để bắt đầu.</strong><p>Nền tảng dùng chung cho hành trình xây dựng dự án của nhóm.</p><span>SEM3 / GROUP 01</span></div>
      <div className="sidebar-bottom"><span className="status-dot"/> Code base · v0.1</div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span className="breadcrumb">Không gian làm việc <span>/</span> <b>{admin ? 'Quản trị' : 'Khách hàng'}</b></span><div className="top-actions"><span className="environment">BẢN MẪU</span>{user ? <><Link className="user-chip" to="/account"><span className="avatar">{user.displayName[0]?.toUpperCase()}</span><span>{user.displayName}<small>{user.role}</small></span></Link><button className="icon-button" onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18}/></button></> : <Link to="/login" className="button small">Đăng nhập <ArrowUpRight size={15}/></Link>}</div></header>
      {error && <div role="alert" className="alert">{error}</div>}
      <main className="main-content"><Outlet/></main>
      <footer><span>© {new Date().getFullYear()} SEM3 · Group 01</span><span>Cùng xây dựng điều tiếp theo.</span></footer>
    </div>
  </div>;
}
