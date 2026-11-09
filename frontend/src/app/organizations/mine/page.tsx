"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { statuses } from "@/features/organizations/types/organizations";
import { Invitation, labelsForRoles } from "@/features/organizations/types/workspace";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
type Summary = { id: string; legalName: string; status: string; createdAt: string; roles?: string[] };
function Mine() {
  const [items, setItems] = useState<Summary[]>([]); const [organizations,setOrganizations]=useState<Summary[]>([]); const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const [apps,orgs,invites]=await Promise.all([api<Summary[]>("/api/organizations/mine"),api<Summary[]>("/api/organizations/workspaces/mine"),api<Invitation[]>("/api/organizations/invitations/mine")]);setItems(apps);setOrganizations(orgs);setInvitations(invites);setError("");},[]);
  useEffect(() => { load().catch(ex => setError(ex.message)).finally(() => setLoading(false)); }, [load]);
  async function respond(item:Invitation,accept:boolean){setBusy(true);setError("");try{await api(`/api/organizations/invitations/${item.id}/respond`,{method:"POST",body:JSON.stringify({accept,version:item.version})});await load();}catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  return <LocalizedTree><><div className="ga-mine-page"><div className="page-title ga-mine-hero"><div><p className="eyebrow">Hành trình của tổ chức</p><h1>Tổ chức của tôi</h1><p className="muted">Theo dõi hồ sơ, bổ sung giấy tờ và nhận phản hồi xét duyệt.</p></div><Link className="button" href="/organizations/new">+ Đăng ký tổ chức <span aria-hidden="true">↗</span></Link></div>
  <button className="secondary" disabled={busy} onClick={()=>{load().catch(ex=>setError(ex.message));}}>Làm mới</button>
  {invitations.length>0&&<section className="panel"><h2>Lời mời tham gia tổ chức</h2>{invitations.map(item=><div className="upload-row" key={item.id}><div><strong>{item.organizationName}</strong><p>{labelsForRoles(JSON.parse(item.rolesJson) as string[])}</p><small>Hết hạn: {new Date(item.expiresAt).toLocaleString("vi-VN")}</small></div><div className="actions"><button disabled={busy} onClick={()=>void respond(item,true)}>Chấp nhận</button><button className="secondary" disabled={busy} onClick={()=>void respond(item,false)}>Từ chối</button></div></div>)}</section>}
  <section className="ga-mine-section"><div className="ga-mine-section-heading"><span>01</span><div><h2>Tổ chức đang tham gia</h2><p>Không gian làm việc và các tổ chức bạn đang đồng hành.</p></div></div>{organizations.length?<div className="cards">{organizations.map(item=><article className="card ga-mine-card" key={item.id}><span className="badge ACTIVE">Đang hoạt động</span><h2>{item.legalName}</h2><p>{labelsForRoles(item.roles||[])}</p><Link className="button" href={`/organizations/${item.id}/manage`}>Vào không gian tổ chức <span aria-hidden="true">→</span></Link></article>)}</div>:!loading&&<p className="ga-mine-empty-note">Bạn chưa tham gia tổ chức đang hoạt động. Hồ sơ được duyệt hoặc lời mời được chấp nhận sẽ xuất hiện tại đây.</p>}</section>
  <section className="ga-mine-section"><div className="ga-mine-section-heading"><span>02</span><div><h2>Hồ sơ đăng ký của tôi</h2><p>Theo dõi tiến độ xét duyệt và cập nhật hồ sơ khi cần.</p></div></div>{error && <p className="notice error" role="alert">{error}</p>}{loading ? <p>Đang tải hồ sơ…</p> : items.length === 0 ? <div className="empty ga-mine-empty"><div className="ga-mine-empty-icon" aria-hidden="true">✳</div><h2>Bắt đầu từ một hồ sơ minh bạch</h2><p>Bạn chưa có hồ sơ tổ chức. Chuẩn bị giấy đăng ký và thông tin người đại diện để bắt đầu.</p><Link className="button" href="/organizations/new">Tạo hồ sơ đầu tiên <span aria-hidden="true">↗</span></Link></div> :
  <div className="cards">{items.map(item => <article className="card ga-mine-card" key={item.id}><span className={"badge " + item.status}>{statuses[item.status]}</span><h2>{item.legalName}</h2><p className="muted">Tạo ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p><Link href={"/organizations/" + item.id}>Xem hồ sơ →</Link></article>)}</div>}</section></div></></LocalizedTree>;
}
export default function Page() { return <Protected><Mine /></Protected>; }
