import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { request } from '../lib/api';
import type { Page, User } from '../types';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../auth/AuthContext';

export function Users() {
  const { user: currentUser } = useAuth(); const [data, setData] = useState<Page<User> | null>(null);
  const [page, setPage] = useState(1); const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    request<Page<User>>(`/users?page=${page}&pageSize=10&search=${encodeURIComponent(query)}`).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, revision]);
  async function update(user: User, role: User['role'], isActive: boolean) {
    if (!window.confirm(`Cập nhật ${user.email}: quyền ${role}, ${isActive ? 'hoạt động' : 'khóa tài khoản'}? Phiên đăng nhập của người dùng sẽ bị thu hồi.`)) return;
    setBusy(true); setError('');
    try { await request(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role, isActive }) }); setRevision(r => r + 1); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">ACCESS MANAGEMENT</div><h1>Người dùng</h1><p>Quản lý vai trò và trạng thái truy cập của thành viên.</p></div></div><form className="searchbar" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search); }}><Search size={19}/><input aria-label="Tìm người dùng" value={search} onChange={e => setSearch(e.target.value)} maxLength={100} placeholder="Tìm theo email hoặc tên…"/><button className="button small">Tìm kiếm</button></form>{error && <div className="alert" role="alert">{error}<button className="text-button" onClick={() => setRevision(r => r + 1)}>Thử lại</button></div>}{loading ? <div className="empty" role="status">Đang tải người dùng…</div> : data && <section className="panel"><div className="table-scroll"><table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(user => <tr key={user.id}><td><strong>{user.displayName}{user.id === currentUser?.id ? ' (Bạn)' : ''}</strong><small>{user.email}</small></td><td><select aria-label={`Vai trò ${user.email}`} disabled={busy || user.id === currentUser?.id} value={user.role} onChange={e => update(user, e.target.value as User['role'], user.isActive)}><option value="Customer">Customer</option><option value="Admin">Admin</option></select></td><td><span className={`pill ${user.isActive ? '' : 'draft'}`}>{user.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td><td>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td><td><button className="button secondary small" disabled={busy || user.id === currentUser?.id} onClick={() => update(user, user.role, !user.isActive)}>{user.isActive ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table>{!data.items.length && <div className="empty">Không tìm thấy người dùng.</div>}</div><Pagination page={page} totalPages={data.totalPages} totalCount={data.totalCount} onChange={setPage}/></section>}</>;
}
