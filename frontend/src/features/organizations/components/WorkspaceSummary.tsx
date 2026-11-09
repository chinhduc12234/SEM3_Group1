"use client";
import { Workspace, focusAreas, labelsForRoles } from "@/features/organizations/types/workspace";
import WorkspaceImage from "@/features/organizations/components/WorkspaceImage";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";

export default function WorkspaceSummary({ data }: { data: Workspace }) {
  return <LocalizedTree><>
    {data.profile.hasCover && <WorkspaceImage id={data.id} kind="cover" version={data.profile.version} />}
    <section className="panel ow-identity">
      {data.profile.hasLogo && <WorkspaceImage id={data.id} kind="logo" version={data.profile.version} />}
      <div><p className="eyebrow">Tổ chức đang hoạt động</p><h1>{data.profile.displayName}</h1><p>{data.legalName}</p>
        {data.roles.length > 0 && <span className="badge ACTIVE">{labelsForRoles(data.roles)}</span>}</div>
    </section>
    <div className="ow-metrics">
      {[ ["Thành viên hoạt động", data.statistics.activeMembers], ["Nhân sự ngoài OWNER", data.statistics.staffCount],
        ["Chiến dịch", "Chưa có dữ liệu"], ["Sự kiện", "Chưa có dữ liệu"] ].map(([label,value]) => <div className="panel" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}
    </div>
    <section className="panel"><h2>Tổ chức đang tập trung vào điều gì?</h2>
      <div className="ow-tags">{data.profile.focusAreas.length ? data.profile.focusAreas.map(x => <span className="badge" key={x}>{focusAreas[x] || x}</span>) : <span className="muted">Chưa cập nhật lĩnh vực hoạt động.</span>}</div>
      <p className="ow-prewrap">{data.profile.introduction}</p><h3>Sứ mệnh</h3><p className="ow-prewrap">{data.profile.mission}</p>
    </section>
    <section className="panel"><h2>Đại diện và liên hệ</h2><dl className="detail-grid">
      <div><dt>Đại diện pháp lý</dt><dd>{data.representativeName} · {data.representativeTitle}</dd></div>
      <div><dt>Số đăng ký</dt><dd>{data.registrationNumber}</dd></div>
      <div><dt>Email liên hệ</dt><dd>{data.profile.contactEmail}</dd></div><div><dt>Điện thoại</dt><dd>{data.profile.contactPhone}</dd></div>
      <div><dt>Địa chỉ liên hệ</dt><dd>{data.profile.address}</dd></div><div><dt>Website</dt><dd>{data.profile.website || "Chưa cập nhật"}</dd></div>
    </dl></section>
    <section className="panel"><h2>Hoạt động và nguồn lực</h2><p className="muted">Thống kê chiến dịch đã thực hiện, sự kiện, số tiền quyên góp, nguồn tài trợ và chiến dịch tiêu biểu sẽ được kết nối khi các phân hệ tương ứng hoàn thành.</p><span className="badge">Chưa có dữ liệu thống kê</span></section>
  </></LocalizedTree>;
}
