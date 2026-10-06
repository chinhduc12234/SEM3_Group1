import { useAuth } from '../auth/AuthContext';
export function Account() {
  const { user } = useAuth();
  return <><div className="page-heading"><div><div className="eyebrow">YOUR PROFILE</div><h1>Tài khoản của tôi</h1><p>Thông tin tài khoản và quyền truy cập hiện tại.</p></div></div><section className="panel profile"><span className="avatar large">{user?.displayName[0]}</span><h2>{user?.displayName}</h2><dl><dt>Email</dt><dd>{user?.email}</dd><dt>Vai trò</dt><dd><span className="pill">{user?.role}</span></dd><dt>Trạng thái</dt><dd>Đang hoạt động</dd><dt>Ngày tham gia</dt><dd>{user && new Date(user.createdAt).toLocaleDateString('vi-VN')}</dd></dl></section></>;
}
