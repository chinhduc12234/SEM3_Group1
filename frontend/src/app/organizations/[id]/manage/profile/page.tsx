"use client";
import { FormEvent, useEffect, useState } from "react";
import { useWorkspace } from "@/features/organizations/components/OrganizationWorkspaceShell";
import WorkspaceImage from "@/features/organizations/components/WorkspaceImage";
import { api } from "@/shared/api/api";
import { focusAreas, WorkspaceProfile } from "@/features/organizations/types/workspace";

export default function Page() {
  const {data,reload}=useWorkspace(); const [profile,setProfile]=useState<WorkspaceProfile>(data.profile);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
  useEffect(()=>{setProfile(data.profile);},[data.profile]);
  const dirty=JSON.stringify(profile)!==JSON.stringify(data.profile);
  async function save(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try { await api(`/api/organizations/${data.id}/workspace/profile`,{method:"PUT",body:JSON.stringify(profile)});await reload();setMessage("Đã cập nhật thông tin tổ chức."); }
    catch(ex){setError((ex as Error).message);}finally{setBusy(false);}
  }
  async function upload(kind:string,file:File) {
    setBusy(true);setError("");setMessage("");
    try {const form=new FormData();form.append("file",file);form.append("version",data.profile.version);await api(`/api/organizations/${data.id}/workspace/media/${kind}`,{method:"POST",body:form});await reload();setMessage("Đã cập nhật ảnh.");}
    catch(ex){setError((ex as Error).message);}finally{setBusy(false);}
  }
  return <><p className="eyebrow">NHẬN DIỆN & HOẠT ĐỘNG</p><h1>Thông tin tổ chức</h1><p className="muted">Thông tin giới thiệu và liên hệ. Tên pháp lý, số đăng ký và thông tin đại diện chỉ thay đổi qua xét duyệt.</p>
    {!data.canEdit&&<p className="notice">Chỉ chủ tổ chức và quản lý tổ chức được cập nhật phần này.</p>}
    <form onSubmit={save}><section className="panel"><h2>Giới thiệu và liên hệ</h2><fieldset disabled={!data.canEdit||busy} style={{border:0,padding:0,margin:0}}><div className="form-grid">
      <label>Tên hiển thị<input required minLength={3} maxLength={200} value={profile.displayName} onChange={e=>setProfile({...profile,displayName:e.target.value})}/><small>Tên hiển thị không thay thế tên pháp lý.</small></label>
      <label>Email liên hệ<input required type="email" maxLength={256} value={profile.contactEmail} onChange={e=>setProfile({...profile,contactEmail:e.target.value})}/></label>
      <label>Điện thoại<input required type="tel" maxLength={25} value={profile.contactPhone} onChange={e=>setProfile({...profile,contactPhone:e.target.value})}/></label>
      <label>Website<input type="url" maxLength={300} value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})}/></label>
      <label className="full">Địa chỉ liên hệ<input required minLength={10} maxLength={400} value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label>
      <label className="full">Giới thiệu<textarea required rows={5} minLength={30} maxLength={4000} value={profile.introduction} onChange={e=>setProfile({...profile,introduction:e.target.value})}/></label>
      <label className="full">Sứ mệnh<textarea required rows={4} minLength={30} maxLength={4000} value={profile.mission} onChange={e=>setProfile({...profile,mission:e.target.value})}/></label>
    </div><h3>Lĩnh vực hoạt động (chọn ít nhất một)</h3><div className="ow-checks">{Object.entries(focusAreas).map(([key,label])=><label key={key}><input type="checkbox" checked={profile.focusAreas.includes(key)} onChange={e=>setProfile({...profile,focusAreas:e.target.checked?[...profile.focusAreas,key]:profile.focusAreas.filter(x=>x!==key)})}/>{label}</label>)}</div>
    </fieldset></section>{data.canEdit&&<button disabled={busy||!profile.focusAreas.length}>{busy?"Đang lưu…":"Lưu thông tin"}</button>}</form>
    <section className="panel"><h2>Logo và ảnh bìa</h2><p className="muted">PNG/JPG. Logo tối đa 2 MB, ảnh bìa tối đa 5 MB. Lưu thông tin đang sửa trước khi tải ảnh.</p>
      {(["logo","cover"] as const).map(kind=><div className="upload-row" key={kind}><div><strong>{kind==="logo"?"Logo tổ chức":"Ảnh bìa"}</strong>{(kind==="logo"?data.profile.hasLogo:data.profile.hasCover)&&<WorkspaceImage id={data.id} kind={kind} version={data.profile.version}/>}</div>{data.canEdit&&<input aria-label={kind==="logo"?"Tải logo":"Tải ảnh bìa"} type="file" accept=".png,.jpg,.jpeg" disabled={busy||dirty} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(kind,file);e.target.value="";}}/>}</div>)}
    </section>{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  </>;
}
