"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { Invitation, Member, PageResult, labelsForRoles, memberRoles } from "@/features/organizations/types/workspace";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";

function RolePicker({roles,onChange,disabled,allowed}:{roles:string[];onChange:(roles:string[])=>void;disabled:boolean;allowed?:string[]}) {
  return <LocalizedTree><div className="ow-checks">{Object.entries(memberRoles).filter(([key])=>key!=="OWNER"&&key!=="SURVEY_STAFF"&&(!allowed||allowed.includes(key))).map(([key,label])=><label key={key}><input type="checkbox" disabled={disabled} checked={roles.includes(key)} onChange={e=>onChange(e.target.checked?[...roles,key]:roles.filter(x=>x!==key))}/>{label}</label>)}</div></LocalizedTree>;
}
function MemberRow({member,id,editable,reload}:{member:Member;id:string;editable:boolean;reload:()=>Promise<void>}) {
  const [roles,setRoles]=useState(member.roles.filter(role=>role!=="SURVEY_STAFF")); const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const canEdit=editable&&!member.roles.includes("OWNER");
  async function update(kind:"roles"|"state") {
    setBusy(true);setError("");
    try {await api(`/api/organizations/${id}/workspace/members/${member.id}/${kind}`,{method:"PUT",body:JSON.stringify(kind==="roles"?{roles,version:member.version}:{isActive:!member.isActive,version:member.version})});await reload();}
    catch(ex){setError((ex as Error).message);}finally{setBusy(false);}
  }
  return <LocalizedTree><article className="ow-member"><div className="ow-member-top"><div><strong>{member.fullName}</strong>{member.email&&<p className="muted">{member.email}</p>}<p>{labelsForRoles(member.roles)}</p></div><span className={"badge "+(member.isActive?"ACTIVE":"REJECTED")}>{member.isActive?"Đang hoạt động":"Đã khóa quyền"}</span></div>
    {!member.accountActive&&<p className="notice warning">Tài khoản không còn hoạt động trong dịch vụ tài khoản.</p>}
    {canEdit&&<><RolePicker roles={roles} onChange={setRoles} disabled={busy}/><div className="actions"><button className="secondary" disabled={busy||!roles.length} onClick={()=>void update("roles")}>Lưu vai trò</button><button className={member.isActive?"danger":"secondary"} disabled={busy} onClick={()=>{if(window.confirm(member.isActive?"Thu hồi quyền truy cập trong tổ chức này?":"Kích hoạt lại quyền thành viên?"))void update("state");}}>{member.isActive?"Khóa quyền tổ chức":"Kích hoạt lại"}</button></div></>}
    {error&&<p className="notice error" role="alert">{error}</p>}
  </article></LocalizedTree>;
}
export default function WorkspaceMembers({id,canManage=false,inviteRoles=[],onChange}:{id:string;canManage?:boolean;inviteRoles?:string[];onChange?:()=>Promise<void>}) {
  const allowed = canManage ? Object.keys(memberRoles).filter(role=>role!=="OWNER"&&role!=="SURVEY_STAFF") : inviteRoles;
  const canInvite = allowed.length>0;
  const allowedKey = allowed.join(",");
  const [result,setResult]=useState<PageResult<Member>|null>(null); const [invitations,setInvitations]=useState<PageResult<Invitation>|null>(null);
  const [page,setPage]=useState(1); const [invitePage,setInvitePage]=useState(1);const [roles,setRoles]=useState<string[]>(["STAFF"]);const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  const load=useCallback(async()=>{const data=await api<PageResult<Member>>(`/api/organizations/${id}/workspace/members?page=${page}`);setResult(data);if(canInvite){setInvitations(await api<PageResult<Invitation>>(`/api/organizations/${id}/workspace/invitations?page=${invitePage}`));}},[id,page,invitePage,canInvite]);
  useEffect(()=>{const permitted=allowedKey.split(",").filter(Boolean);setRoles(current=>{const retained=current.filter(role=>permitted.includes(role));return retained.length?retained:permitted.slice(0,1);});},[allowedKey,id]);
  useEffect(()=>{load().catch(ex=>setError(ex.message));},[load]);
  async function reload(){await load();if(onChange)await onChange();}
  async function invite(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{await api(`/api/organizations/${id}/workspace/invitations`,{method:"POST",body:JSON.stringify({email,roles})});setEmail("");await reload();setMessage("Đã tạo lời mời. Người nhận mở Tổ chức của tôi để chấp nhận.");}catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  async function revoke(invitation:Invitation){setBusy(true);setError("");try{await api(`/api/organizations/${id}/workspace/invitations/${invitation.id}/revoke`,{method:"POST",body:JSON.stringify({version:invitation.version})});await reload();}catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  return <LocalizedTree><><section className="panel"><h2>Nhân sự và người phụ trách</h2><p className="muted">Một người có thể kiêm nhiều vai trò. Quyền chỉ áp dụng trong tổ chức này.</p>{result?result.items.map(member=><MemberRow key={member.id+member.version} member={member} id={id} editable={canManage} reload={reload}/>):<p>Đang tải nhân sự…</p>}
    {result&&result.totalCount>20&&<div className="ow-pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}</span><button className="secondary" disabled={page*20>=result.totalCount} onClick={()=>setPage(page+1)}>Trang sau</button></div>}</section>
    {canInvite&&<><section className="panel"><h2>Mời nhân sự</h2><p className="muted">Nhập email tài khoản đã đăng ký Give-AID. Lời mời xuất hiện trong ứng dụng và hết hạn sau 7 ngày; quyền được cấp khi người nhận chấp nhận.</p><form onSubmit={invite}><label>Email tài khoản<input required type="email" maxLength={256} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label><h3>Vai trò được mời</h3><RolePicker roles={roles} onChange={setRoles} disabled={busy} allowed={allowed}/><div className="actions"><button disabled={busy||!roles.length}>Gửi lời mời trong ứng dụng</button></div></form></section>
    <section className="panel"><h2>Lịch sử lời mời</h2>{invitations?.items.map(item=><div className="upload-row" key={item.id}><div><strong>{item.fullName||item.email}</strong><p>{labelsForRoles(item.roles)}</p><small>{{PENDING:"Chờ chấp nhận",ACCEPTED:"Đã tham gia",DECLINED:"Đã từ chối",REVOKED:"Đã thu hồi",EXPIRED:"Đã hết hạn"}[item.state]} · {item.email}</small></div>{item.state==="PENDING"&&<button className="secondary" disabled={busy} onClick={()=>void revoke(item)}>Thu hồi</button>}</div>)}{invitations?.totalCount===0&&<p>Chưa có lời mời.</p>}
    {invitations&&invitations.totalCount>20&&<div className="ow-pagination"><button className="secondary" disabled={invitePage===1} onClick={()=>setInvitePage(invitePage-1)}>Trang trước</button><span>Trang {invitePage}</span><button className="secondary" disabled={invitePage*20>=invitations.totalCount} onClick={()=>setInvitePage(invitePage+1)}>Trang sau</button></div>}</section></>}
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  </></LocalizedTree>;
}
