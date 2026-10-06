import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Boxes, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { request } from '../lib/api';
import type { Page, Product } from '../types';
import { Pagination } from '../components/Pagination';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export function Products({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Page<Product> | null>(null); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [revision, setRevision] = useState(0);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Partial<Product> | null>(null); const [selected, setSelected] = useState<Product | null>(null); const [formError, setFormError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    request<Page<Product>>(`/products?page=${page}&pageSize=9&search=${encodeURIComponent(query)}`)
      .then(result => { if (active) { if (page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages)); else setData(result); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, revision, admin]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setFormError('');
    const fields = new FormData(event.currentTarget);
    const body = { name: fields.get('name'), description: fields.get('description'), category: fields.get('category'), price: Number(fields.get('price')), isPublished: fields.get('isPublished') === 'on' };
    try { await request(editing.id ? `/products/${editing.id}` : '/products', { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(body) }); setEditing(null); setRevision(r => r + 1); }
    catch (e) { setFormError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(product: Product) {
    if (!window.confirm(`Xóa sản phẩm “${product.name}”?`)) return;
    setBusy(true); setError('');
    try { await request(`/products/${product.id}`, { method: 'DELETE' }); setRevision(r => r + 1); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">{admin ? 'CATALOG MANAGEMENT' : 'EXPLORE THE COLLECTION'}</div><h1>{admin ? 'Quản lý sản phẩm' : 'Danh mục sản phẩm'}</h1><p>Dữ liệu minh họa cho nghiệp vụ của dự án.</p></div>{admin && <button className="button" onClick={() => { setFormError(''); setEditing({ isPublished: true }); }}><Plus size={18}/> Thêm sản phẩm</button>}</div>
    <form className="searchbar" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search); }}><Search size={19}/><input aria-label="Tìm sản phẩm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên sản phẩm hoặc danh mục…" maxLength={100}/><button className="button small">Tìm kiếm</button></form>
    {error && <div className="alert" role="alert">{error}<button className="text-button" onClick={() => setRevision(r => r + 1)}>Thử lại</button></div>}
    {loading ? <div className="empty" role="status">Đang tải danh mục…</div> : !error && data && <>{data.items.length === 0 ? <div className="empty"><Boxes size={38}/><h2>Chưa có sản phẩm phù hợp</h2><p>Hãy thử từ khóa khác hoặc thêm sản phẩm mới.</p></div> : <div className="product-grid">{data.items.map((product, index) => <article className="product-card" key={product.id}><button className={`product-art tone-${index % 3}`} onClick={() => setSelected(product)} aria-label={`Xem ${product.name}`}><Boxes size={58} strokeWidth={1}/><span>SEM3 / COLLECTION</span></button><div className="product-body"><div className="product-meta"><span>{product.category}</span>{!product.isPublished && <span className="pill draft">Bản nháp</span>}</div><h3><button className="text-button" onClick={() => setSelected(product)}>{product.name}</button></h3><p>{product.description}</p><div className="product-bottom"><strong>{money(product.price)}</strong>{admin ? <div><button className="icon-button" aria-label={`Sửa ${product.name}`} onClick={() => { setFormError(''); setEditing(product); }}><Pencil size={17}/></button><button className="icon-button danger" disabled={busy} aria-label={`Xóa ${product.name}`} onClick={() => remove(product)}><Trash2 size={17}/></button></div> : <button className="text-button" onClick={() => setSelected(product)}>Chi tiết ↗</button>}</div></div></article>)}</div>}<Pagination page={page} totalCount={data.totalCount} totalPages={data.totalPages} onChange={setPage}/></>}
    {editing && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><div className="section-heading"><h2 id="product-form-title">{editing.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2><button className="icon-button" disabled={busy} onClick={() => setEditing(null)} aria-label="Đóng"><X/></button></div>{formError && <div className="alert" role="alert">{formError}</div>}<form onSubmit={save}><label>Tên sản phẩm<input name="name" autoFocus defaultValue={editing.name} required minLength={2} maxLength={160}/></label><label>Danh mục<input name="category" defaultValue={editing.category} required maxLength={80}/></label><label>Mô tả<textarea name="description" defaultValue={editing.description} required maxLength={2000} rows={3}/></label><label>Giá (VND)<input name="price" type="number" defaultValue={editing.price ?? 0} min={0} max={999999999999} step="0.01" required/></label><label className="checkbox"><input name="isPublished" type="checkbox" defaultChecked={editing.isPublished}/> Công khai sản phẩm</label><button className="button full" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</button></form></section></div>}
    {selected && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title"><div className="section-heading"><span className="pill">{selected.category}</span><button autoFocus className="icon-button" onClick={() => setSelected(null)} aria-label="Đóng"><X/></button></div><h2 id="product-detail-title">{selected.name}</h2><p className="detail-text">{selected.description}</p><strong className="detail-price">{money(selected.price)}</strong><p className="form-hint">Sản phẩm minh họa. Chức năng đặt hàng sẽ được bổ sung theo đề tài.</p></section></div>}
  </>;
}
