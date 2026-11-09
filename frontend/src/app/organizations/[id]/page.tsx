"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Protected, useAuth } from "@/features/auth/components/AuthProvider";
import { api, downloadDocument } from "@/shared/api/api";
import { documentKinds, fields, Organization, statuses } from "@/features/organizations/types/organizations";
import { OrganizationEmailStatus } from "@/features/organizations/components/OrganizationEmailStatus";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
function Detail() {
  const id = useParams<{ id: string }>()?.id; const { user } = useAuth();
  const [data, setData] = useState<Organization | null>(null); const [error, setError] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Organization>("/api/organizations/" + id).then(setData).catch(ex => setError(ex.message)); }, [id]);
  async function review(decision: string) {
    if (!data || !window.confirm("Xác nhận xử lý hồ sơ: " + ({ APPROVE: "Phê duyệt", REJECT: "Từ chối", REQUEST_CHANGES: "Yêu cầu bổ sung" }[decision]) + "?")) return;
    setBusy(true); setError("");
    try { setData(await api<Organization>("/api/organizations/" + id + "/review", { method: "POST", body: JSON.stringify({ decision, reason, version: data.version }) })); }
    catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  if (!data) return <LocalizedTree><p className={error ? "notice error" : "notice"}>{error || "Đang tải hồ sơ…"}</p></LocalizedTree>;
  return <LocalizedTree><><Link href={user?.roles.includes("ADMIN") ? "/admin/organizations" : "/organizations"}>← Danh sách hồ sơ</Link>
    <div className="page-title"><div><p className="eyebrow">Hồ sơ tổ chức</p><h1>{data.profile.legalName}</h1><span className={"badge " + data.status}>{statuses[data.status]}</span></div>
    {data.applicantUserId === user?.id && ["DRAFT", "CHANGES_REQUESTED"].includes(data.status) && <Link className="button" href={"/organizations/" + id + "/edit"}>Cập nhật / gửi duyệt</Link>}</div>
    {data.status === "ACTIVE" && <div className="notice success">Hồ sơ đã được phê duyệt. Người nộp đã được ghi nhận là Owner của tổ chức. <Link href={user?.roles.includes("ADMIN") ? `/admin/organization-directory/${data.id}` : `/organizations/${data.id}/manage`}>Mở không gian tổ chức →</Link></div>}
    {data.status === "PENDING_REVIEW" && <div className="notice">Hồ sơ đang chờ Admin xét duyệt. Thông tin được khóa chỉnh sửa trong thời gian này.</div>}
    {["Thông tin pháp lý", "Liên hệ và hoạt động", "Người đại diện"].map(group => <section className="panel" key={group}><h2>{group}</h2><dl className="detail-grid">
    {fields.filter(f => f.group === group).map(f => <div className={f.type === "textarea" ? "full" : ""} key={f.key}><dt>{f.label}</dt><dd>{data.profile[f.key] || "—"}</dd></div>)}
    {group === "Thông tin pháp lý" && <div><dt>Loại hình</dt><dd>{data.profile.organizationType}</dd></div>}
    {group === "Người đại diện" && <div><dt>{data.profile.identityType}</dt><dd>{data.identityNumber}</dd></div>}
    </dl></section>)}
    <section className="panel"><h2>Giấy tờ đính kèm</h2>{Object.entries(documentKinds).map(([kind, label]) => { const document = data.documents.find(d => d.kind === kind); return <div className="upload-row" key={kind}><div><strong>{label}</strong><p className="muted">{document ? Math.ceil(document.size / 1024) + " KB" : "Chưa có tệp"}</p></div>{document && <button className="secondary" onClick={async () => { try { await downloadDocument("/api/organizations/" + id + "/documents/" + document.id, document.fileName); } catch(ex) { setError((ex as Error).message); } }}>Tải giấy tờ</button>}</div>; })}</section>
    {user?.roles.includes("ADMIN") && data.status === "PENDING_REVIEW" && data.applicantUserId !== user.id && <section className="panel review"><p className="eyebrow">Dành cho quản trị viên</p><h2>Kết quả xét duyệt</h2><p>Đối chiếu hồ sơ pháp lý, tính đầy đủ của giấy tờ và thông tin người đại diện trước khi quyết định. Phê duyệt nội bộ không phải xác nhận pháp lý của cơ quan nhà nước.</p><label>Nhận xét / lý do (bắt buộc khi từ chối hoặc yêu cầu bổ sung)<textarea rows={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="actions"><button disabled={busy} onClick={() => review("APPROVE")}>Phê duyệt tổ chức</button><button className="secondary" disabled={busy || !reason.trim()} onClick={() => review("REQUEST_CHANGES")}>Yêu cầu bổ sung</button><button className="danger" disabled={busy || !reason.trim()} onClick={() => review("REJECT")}>Từ chối</button></div></section>}
    {user?.roles.includes("ADMIN") && <OrganizationEmailStatus key={data.version} organizationId={data.id} />}
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="panel"><h2>Lịch sử hồ sơ</h2><div className="timeline">{data.history.map((entry,index) => <div key={index}><strong>{{ CREATED: "Tạo hồ sơ", UPDATED: "Cập nhật thông tin", DOCUMENT_UPDATED: "Cập nhật giấy tờ", SUBMITTED: "Gửi xét duyệt", APPROVE: "Phê duyệt", REJECT: "Từ chối", REQUEST_CHANGES: "Yêu cầu bổ sung" }[entry.action] || entry.action}</strong><small>{new Date(entry.at).toLocaleString("vi-VN")}</small>{entry.reason && <p>{documentKinds[entry.reason] || entry.reason}</p>}</div>)}</div></section></></LocalizedTree>;
}
export default function Page() { return <Protected><Detail /></Protected>; }
