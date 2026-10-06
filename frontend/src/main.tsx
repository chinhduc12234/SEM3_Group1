import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { AuthPage } from './pages/AuthPage';
import { Products } from './pages/Products';
import { Users } from './pages/Users';
import { Account } from './pages/Account';
import './styles.css';

function Protected({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">Đang khôi phục phiên đăng nhập…</div>;
  if (!user) return <Navigate to="/login" replace/>;
  if (admin && user.role !== 'Admin') return <div className="empty"><h1>403 · Không có quyền truy cập</h1><Link to="/">Về trang khách hàng</Link></div>;
  return <Outlet/>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Routes>
  <Route element={<Layout/>}><Route index element={<Home/>}/><Route path="products" element={<Products/>}/><Route element={<Protected/>}><Route path="account" element={<Account/>}/></Route></Route>
  <Route element={<Protected admin/>}><Route path="admin" element={<Layout admin/>}><Route index element={<Home admin/>}/><Route path="products" element={<Products admin/>}/><Route path="users" element={<Users/>}/></Route></Route>
  <Route path="login" element={<AuthPage key="login"/>}/><Route path="register" element={<AuthPage key="register" register/>}/>
  <Route path="*" element={<div className="empty"><h1>404 · Không tìm thấy trang</h1><Link to="/">Về trang chủ</Link></div>}/>
</Routes></AuthProvider></BrowserRouter>);
