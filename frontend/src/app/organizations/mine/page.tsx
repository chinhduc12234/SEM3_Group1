"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { statuses } from "@/features/organizations/types/organizations";
import { Invitation, labelsForRoles } from "@/features/organizations/types/workspace";
type Summary = { id: string; legalName: string; status: string; createdAt: string; roles?: string[] };
function Mine() {
  const [items, setItems] = useState<Summary[]>([]); const [organizations,setOrganizations]=useState<Summary[]>([]); const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const [apps,orgs,invites]=await Promise.all([api<Summary[]>("/api/organizations/mine"),api<Summary[]>("/api/organizations/workspaces/mine"),api<Invitation[]>("/api/organizations/invitations/mine")]);setItems(apps);setOrganizations(orgs);setInvitations(invites);setError("");},[]);
  useEffect(() => { load().catch(ex => setError(ex.message)).finally(() => setLoading(false)); }, [load]);
  async function respond(item:Invitation,accept:boolean){setBusy(true);setError("");try{await api(`/api/organizations/invitations/${item.id}/respond`,{method:"POST",body:JSON.stringify({accept,version:item.version})});await load();}catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  return <><div className="page-title"><div><p className="eyebrow">Hành trình của tổ chức</p><h1>Tổ chức của tôi</h1><p className="muted">Theo dõi hồ sơ, bổ sung giấy tờ và nhận phản hồi xét duyệt.</p></div><Link className="button" href="/organizations/new">+ Đăng ký tổ chức</Link></div>
  <button className="secondary" disabled={busy} onClick={()=>{load().catch(ex=>setError(ex.message));}}>Làm mới</button>
  {invitations.length>0&&<section className="panel"><h2>Lời mời tham gia tổ chức</h2>{invitations.map(item=><div className="upload-row" key={item.id}><div><strong>{item.organizationName}</strong><p>{labelsForRoles(JSON.parse(item.rolesJson) as string[])}</p><small>Hết hạn: {new Date(item.expiresAt).toLocaleString("vi-VN")}</small></div><div className="actions"><button disabled={busy} onClick={()=>void respond(item,true)}>Chấp nhận</button><button className="secondary" disabled={busy} onClick={()=>void respond(item,false)}>Từ chối</button></div></div>)}</section>}
  <h2>Tổ chức đang tham gia</h2>{organizations.length?<div className="cards">{organizations.map(item=><article className="card" key={item.id}><span className="badge ACTIVE">Đang hoạt động</span><h2>{item.legalName}</h2><p>{labelsForRoles(item.roles||[])}</p><Link className="button" href={`/organizations/${item.id}/manage`}>Vào không gian tổ chức →</Link></article>)}</div>:!loading&&<p>Bạn chưa tham gia tổ chức đang hoạt động. Hồ sơ được duyệt hoặc lời mời được chấp nhận sẽ xuất hiện tại đây.</p>}
  <h2>Hồ sơ đăng ký của tôi</h2>{error && <p className="notice error" role="alert">{error}</p>}{loading ? <p>Đang tải hồ sơ…</p> : items.length === 0 ? <div className="empty"><h2>Bắt đầu từ một hồ sơ minh bạch</h2><p>Bạn chưa có hồ sơ tổ chức. Chuẩn bị giấy đăng ký và thông tin người đại diện để bắt đầu.</p><Link href="/organizations/new">Tạo hồ sơ đầu tiên →</Link></div> :
  <div className="cards">{items.map(item => <article className="card" key={item.id}><span className={"badge " + item.status}>{statuses[item.status]}</span><h2>{item.legalName}</h2><p className="muted">Tạo ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p><Link href={"/organizations/" + item.id}>Xem hồ sơ →</Link></article>)}</div>}</>;
}
export default function Page() { return <Protected><Mine /></Protected>; }
