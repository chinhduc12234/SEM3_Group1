"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/shared/api/api";
import { documentKinds, emptyProfile, fields, Organization, Profile, statuses } from "@/features/organizations/types/organizations";

export default function OrganizationForm({ id }: { id?: string }) {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profile, setProfile] = useState<Profile>({ ...emptyProfile });
  const [identityNumber, setIdentityNumber] = useState(""); const [consent, setConsent] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(!!id);
  useEffect(() => {
    if (id) api<Organization>("/api/organizations/" + id).then(data => { setOrganization(data); setProfile(data.profile); setIdentityNumber(data.identityNumber); setConsent(data.consent); })
      .catch(ex => setError(ex.message)).finally(() => setLoading(false));
  }, [id]);
  const editable = !organization || ["DRAFT", "CHANGES_REQUESTED"].includes(organization.status);
  async function save() {
    const data = await api<Organization>(id ? "/api/organizations/" + id : "/api/organizations", {
      method: id ? "PUT" : "POST", body: JSON.stringify({ profile, identityNumber, consent, version: organization?.version })
    });
    setOrganization(data); return data;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    try {
      const data = await save();
      if (!id) { router.replace("/organizations/" + data.id + "/edit"); return; }
      if (action === "send") {
        await api("/api/organizations/" + data.id + "/submit", { method: "POST", body: JSON.stringify({ version: data.version }) });
        router.push("/organizations/" + data.id);
      } else setMessage("Đã lưu hồ sơ.");
    } catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  async function upload(kind: string, file: File) {
    if (!organization) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Mỗi tệp tối đa 5 MB.");
      const form = new FormData(); form.append("file", file); form.append("version", organization.version);
      const data = await api<Organization>("/api/organizations/" + organization.id + "/documents/" + kind, { method: "POST", body: form });
      setOrganization(data); setMessage("Đã lưu giấy tờ.");
    } catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  if (loading) return <p>Đang tải hồ sơ…</p>;
  if (id && !organization) return <p className="notice error" role="alert">{error || "Không tìm thấy hồ sơ."}</p>;
  if (!editable) return <div className="notice">Hồ sơ {statuses[organization!.status]}. <Link href={"/organizations/" + id}>Xem chi tiết</Link></div>;
  return <><div className="page-title"><div><p className="eyebrow">Thông tin đầy đủ · Xét duyệt minh bạch</p><h1>{id ? "Cập nhật hồ sơ tổ chức" : "Đăng ký thành lập tổ chức"}</h1><p className="muted">Đăng ký tổ chức tham gia Give-AID. Hồ sơ được xét duyệt nội bộ, không thay thế thủ tục thành lập pháp nhân.</p></div></div>
    {organization?.status === "CHANGES_REQUESTED" && <div className="notice warning">Admin yêu cầu bổ sung: {organization.history.find(h => h.action === "REQUEST_CHANGES")?.reason}</div>}
    <form onSubmit={submit}>
    {["Thông tin pháp lý", "Liên hệ và hoạt động", "Người đại diện"].map((group, index) => <section className="panel" key={group}><h2><span className="step">{index + 1}</span>{group}</h2><div className="form-grid">
    {group === "Thông tin pháp lý" && <label>Loại hình tổ chức<select value={profile.organizationType} onChange={e => setProfile({ ...profile, organizationType: e.target.value })}><option value="NGO">Tổ chức phi chính phủ</option><option value="CHARITY">Tổ chức từ thiện</option><option value="FOUNDATION">Quỹ xã hội / từ thiện</option><option value="ASSOCIATION">Hiệp hội</option><option value="SOCIAL_ENTERPRISE">Doanh nghiệp xã hội</option></select></label>}
    {group === "Người đại diện" && <><label>Loại giấy tờ<select value={profile.identityType} onChange={e => setProfile({ ...profile, identityType: e.target.value })}><option value="CCCD">CCCD</option><option value="PASSPORT">Hộ chiếu</option></select></label><label>Số giấy tờ định danh<input required minLength={6} maxLength={30} value={identityNumber} onChange={e => setIdentityNumber(e.target.value)} autoComplete="off" /></label></>}
    {fields.filter(field => field.group === group).map(field => <label className={field.type === "textarea" ? "full" : ""} key={field.key}>{field.label}{!field.optional && " *"}
    {field.type === "textarea" ? <textarea required minLength={field.min} maxLength={field.max} value={profile[field.key] || ""} onChange={e => setProfile({ ...profile, [field.key]: e.target.value })} rows={4} />
      : <input type={field.type || "text"} required={!field.optional} minLength={field.min} maxLength={field.max} max={field.type === "date" ? new Date().toISOString().slice(0,10) : undefined} value={profile[field.key] || ""} onChange={e => setProfile({ ...profile, [field.key]: e.target.value })} />}</label>)}
    </div></section>)}
    <section className="panel"><h2><span className="step">4</span>Giấy tờ và xác nhận</h2><p className="muted">Cần đủ 3 nhóm giấy tờ. PDF, JPG hoặc PNG; mỗi tệp tối đa 5 MB. Chỉ bạn và Admin có quyền xem.</p>
    {!id ? <div className="notice">Lưu thông tin trước để tải giấy tờ lên ở bước tiếp theo.</div> : Object.entries(documentKinds).map(([kind,label]) => <div className="upload-row" key={kind}><div><strong>{label}</strong><p className="muted">{organization?.documents.find(d => d.kind === kind)?.fileName || "Chưa tải lên"}</p></div><input aria-label={label} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(kind, file); e.target.value = ""; }} /></div>)}
    <label className="check"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Tôi xác nhận thông tin và giấy tờ là chính xác, có quyền thay mặt tổ chức nộp hồ sơ và đồng ý việc Give-AID xử lý hồ sơ cho mục đích xét duyệt.</span></label>
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}
    <div className="actions"><button type="submit" value="save" disabled={busy}>{busy ? "Đang xử lý…" : id ? "Lưu thay đổi" : "Lưu và tiếp tục tải giấy tờ"}</button>
    {id && <button className="secondary" type="submit" value="send" disabled={busy || organization?.documents.length !== 3}>Lưu và gửi Admin xét duyệt →</button>}</div>
    </form></>;
}
