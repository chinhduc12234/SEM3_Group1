"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, downloadDocument } from "@/shared/api/api";
import { documentKinds, fields, Organization, Profile } from "@/features/organizations/types/organizations";
import { PageResult } from "@/features/organizations/types/workspace";

type Change={id:string;state:string;reason:string;createdAt:string;reviewedAt:string|null;reviewReason:string;version:string};
type Detail=Change&{proposed:{profile:Profile;identityNumber:string};documents:{id:string;kind:string;fileName:string}[]};
const states:Record<string,string>={PENDING:"Chờ xét duyệt",APPROVED:"Đã chấp thuận",REJECTED:"Đã từ chối"};

function ProposalForm({id,onDone}:{id:string;onDone:()=>Promise<void>}) {
  const [organization,setOrganization]=useState<Organization|null>(null);const [profile,setProfile]=useState<Profile|null>(null);const [identityNumber,setIdentityNumber]=useState("");const [reason,setReason]=useState("");const [consent,setConsent]=useState(false);const [files,setFiles]=useState<Record<string,File>>({});const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{api<Organization>(`/api/organizations/${id}`).then(org=>{setOrganization(org);setProfile(org.profile);setIdentityNumber(org.identityNumber);}).catch(ex=>setError(ex.message));},[id]);
  async function submit(event:FormEvent){event.preventDefault();if(!organization||!profile)return;setBusy(true);setError("");try{
    const form=new FormData();form.append("proposal",JSON.stringify({profile,identityNumber,consent,version:organization.version}));form.append("reason",reason);
    form.append("registration",files.REGISTRATION);form.append("representativeId",files.REPRESENTATIVE_ID);form.append("authorization",files.AUTHORIZATION);
    await api(`/api/organizations/${id}/workspace/legal-changes`,{method:"POST",body:form});await onDone();
  }catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  return <section className="panel"><h2>Yêu cầu cập nhật pháp lý</h2><p className="muted">Tổ chức vẫn hoạt động với hồ sơ đã duyệt. Nội dung mới chỉ có hiệu lực sau khi admin chấp thuận. Gửi đầy đủ giấy tờ mới để admin đối chiếu.</p>
    {profile&&<form onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0}}><div className="form-grid">
      <label>Loại hình<select value={profile.organizationType} onChange={e=>setProfile({...profile,organizationType:e.target.value})}>{["NGO","CHARITY","FOUNDATION","ASSOCIATION","SOCIAL_ENTERPRISE"].map(x=><option key={x}>{x}</option>)}</select></label>
      {fields.map(field=><label className={field.type==="textarea"?"full":""} key={field.key}>{field.label}{field.type==="textarea"?<textarea required={!field.optional} rows={3} minLength={field.min} maxLength={field.max} value={profile[field.key]||""} onChange={e=>setProfile({...profile,[field.key]:e.target.value})}/>:<input type={field.type||"text"} required={!field.optional} minLength={field.min} maxLength={field.max} value={profile[field.key]||""} onChange={e=>setProfile({...profile,[field.key]:e.target.value})}/>}</label>)}
      <label>Giấy tờ định danh<select value={profile.identityType} onChange={e=>setProfile({...profile,identityType:e.target.value})}><option>CCCD</option><option>PASSPORT</option></select></label>
      <label>Số giấy tờ<input required minLength={6} maxLength={30} value={identityNumber} onChange={e=>setIdentityNumber(e.target.value)}/></label>
      <label className="full">Lý do và nội dung thay đổi<textarea required minLength={3} maxLength={2000} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </div><h3>Giấy tờ cập nhật</h3>{Object.entries(documentKinds).map(([kind,label])=><label key={kind}>{label}<input type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={e=>{const file=e.target.files?.[0];if(file)setFiles({...files,[kind]:file});}}/></label>)}<p className="muted">Mỗi tệp tối đa 5 MB. Giấy tờ chỉ OWNER và admin được truy cập.</p>
      <label className="check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Tôi có quyền đại diện và xác nhận thông tin, giấy tờ được cung cấp là chính xác.</span></label>
      <button disabled={busy||Object.keys(files).length!==3}>{busy?"Đang gửi…":"Gửi admin xét duyệt"}</button></fieldset></form>}
    {error&&<p className="notice error" role="alert">{error}</p>}
  </section>;
}

export default function OrganizationLegalChanges({id,canRequest=false,canReview=false,initialChangeId}:{id:string;canRequest?:boolean;canReview?:boolean;initialChangeId?:string}) {
  const [result,setResult]=useState<PageResult<Change>|null>(null);const [page,setPage]=useState(1);const [selected,setSelected]=useState(initialChangeId||"");const [detail,setDetail]=useState<Detail|null>(null);const [current,setCurrent]=useState<Organization|null>(null);const [creating,setCreating]=useState(false);const [reason,setReason]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  const load=useCallback(async()=>{setResult(await api<PageResult<Change>>(`/api/organizations/${id}/workspace/legal-changes?page=${page}`));},[id,page]);
  useEffect(()=>{load().catch(ex=>setError(ex.message));},[load]);
  useEffect(()=>{if(!selected){setDetail(null);return;}setDetail(null);setError("");Promise.all([api<Detail>(`/api/organizations/${id}/workspace/legal-changes/${selected}`),api<Organization>(`/api/organizations/${id}`)]).then(([detail,org])=>{setDetail(detail);setCurrent(org);setReason("");}).catch(ex=>setError(ex.message));},[id,selected]);
  async function review(decision:string){if(!detail||!window.confirm(decision==="APPROVE"?"Chấp thuận thay đổi hồ sơ pháp lý này?":"Từ chối yêu cầu thay đổi này?"))return;setBusy(true);setError("");try{await api(`/api/organizations/${id}/workspace/legal-changes/${detail.id}/review`,{method:"POST",body:JSON.stringify({decision,reason,version:detail.version})});setDetail(null);setSelected("");await load();setMessage("Đã lưu kết quả xét duyệt.");}catch(ex){setError((ex as Error).message);}finally{setBusy(false);}}
  return <>{canRequest&&<div className="actions"><button className="secondary" onClick={()=>setCreating(!creating)}>{creating?"Đóng biểu mẫu":"Tạo yêu cầu cập nhật pháp lý"}</button></div>}
    {creating&&<ProposalForm id={id} onDone={async()=>{setCreating(false);await load();setMessage("Đã gửi yêu cầu. Hồ sơ hiện tại vẫn giữ nguyên cho đến khi được duyệt.");}}/>}
    <section className="panel"><h2>Yêu cầu thay đổi pháp lý</h2>{result?.items.map(item=><div className="upload-row" key={item.id}><div><strong>{states[item.state]}</strong><p>{item.reason}</p><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>{item.reviewReason&&<p>Phản hồi: {item.reviewReason}</p>}</div><button className="secondary" onClick={()=>setSelected(item.id)}>Xem chi tiết</button></div>)}{result?.totalCount===0&&<p>Chưa có yêu cầu cập nhật pháp lý.</p>}
    {result&&result.totalCount>20&&<div className="ow-pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}</span><button className="secondary" disabled={page*20>=result.totalCount} onClick={()=>setPage(page+1)}>Trang sau</button></div>}</section>
    {detail&&current&&<section className="panel"><h2>Đối chiếu hồ sơ</h2><p>{detail.reason}</p><div className="ow-legal-comparison">{[{label:"Hồ sơ hiện tại",profile:current.profile,identityNumber:current.identityNumber},{label:"Thông tin đề nghị",...detail.proposed}].map((column,index)=><div key={column.label}><h3>{column.label}</h3><dl>{fields.map(field=><div className={index===1&&column.profile[field.key]!==current.profile[field.key]?"changed":""} key={field.key}><dt>{field.label}</dt><dd>{column.profile[field.key]||"—"}</dd></div>)}<dt>Loại hình</dt><dd>{column.profile.organizationType}</dd><dt>Giấy tờ định danh</dt><dd>{column.profile.identityType} · {column.identityNumber}</dd></dl></div>)}</div>
      <h3>Giấy tờ đề nghị</h3>{detail.documents.map(doc=><div className="upload-row" key={doc.id}><strong>{documentKinds[doc.kind]}</strong><button className="secondary" onClick={async()=>{try{await downloadDocument(`/api/organizations/${id}/workspace/legal-changes/${detail.id}/documents/${doc.id}`,doc.fileName);}catch(ex){setError((ex as Error).message);}}}>Tải giấy tờ</button></div>)}
      {canReview&&detail.state==="PENDING"&&<><label>Nhận xét xét duyệt<textarea required minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="actions"><button disabled={busy||reason.trim().length<3} onClick={()=>void review("APPROVE")}>Chấp thuận thay đổi</button><button className="danger" disabled={busy||reason.trim().length<3} onClick={()=>void review("REJECT")}>Từ chối yêu cầu</button></div></>}
      {detail.reviewReason&&<p>Phản hồi admin: {detail.reviewReason}</p>}
    </section>}
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  </>;
}
