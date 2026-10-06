import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { request } from '../lib/api';

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, login, loading } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [created, setCreated] = useState(false);
  if (loading) return <div className="empty">Đang khôi phục phiên đăng nhập…</div>;
  if (user) return <Navigate to={user.role === 'Admin' ? '/admin' : '/'} replace/>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget); const email = String(data.get('email')); const password = String(data.get('password'));
    try {
      if (register) {
        if (password !== data.get('confirm')) throw new Error('Mật khẩu xác nhận chưa khớp.');
        await request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName: data.get('displayName') }) });
        setCreated(true);
      } else { await login(email, password); navigate('/'); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-story"><Link to="/" className="brand">S3 / SEM3</Link><div><span className="eyebrow">CÙNG NHAU BẮT ĐẦU</span><h1>Một tài khoản.<br/>Nhiều khả năng.</h1><p>Kết nối với không gian dự án của nhóm và bắt đầu trải nghiệm.</p></div><span><ShieldCheck size={18}/> Không gian riêng dành cho bạn</span></div><div className="auth-panel"><Link to="/" className="back-link">← Về trang chủ</Link><div className="auth-form"><span className="eyebrow">SEM3 · GROUP 01</span><h1>{register ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1><p>{register ? 'Bắt đầu với tài khoản khách hàng của bạn.' : 'Đăng nhập để tiếp tục vào không gian của bạn.'}</p>{error && <div className="alert" role="alert">{error}</div>}{created ? <div className="success" role="status">Đăng ký thành công. <Link to="/login">Đăng nhập ngay →</Link></div> : <form onSubmit={submit}>
    {register && <label>Họ và tên<input name="displayName" autoComplete="name" required minLength={2} maxLength={100} placeholder="Nguyễn Văn An"/></label>}
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="ban@example.com"/></label>
    <label>Mật khẩu<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 10 : 1} maxLength={128} placeholder="Nhập mật khẩu"/></label>
    {register && <><small className="form-hint">Ít nhất 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small><label>Xác nhận mật khẩu<input name="confirm" type="password" autoComplete="new-password" required maxLength={128} placeholder="Nhập lại mật khẩu"/></label></>}
    <button className="button full" disabled={busy}>{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}<ArrowRight size={18}/></button>
  </form>}<p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Đăng ký ngay'}</Link></p></div></div></div>;
}
