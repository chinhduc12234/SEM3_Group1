"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, downloadDocument } from "@/shared/api/api";
import Icon from "@/features/admin/components/AdminIcon";
import { statuses } from "@/features/organizations/types/organizations";

type DocumentFile = {
  id: string;
  kind: string;
  fileName: string;
  size: number;
  uploadedAt: string;
};
type OrganizationProfile = {
  legalName: string;
  organizationType: string;
  registrationNumber: string;
  registrationDate: string;
  registrationAuthority: string;
  foundedDate: string;
  taxCode: string | null;
  address: string;
  province: string;
  contactEmail: string;
  contactPhone: string;
  website: string | null;
  mission: string;
  representativeName: string;
  representativeTitle: string;
  representativeBirthDate: string;
  representativeEmail: string;
  representativePhone: string;
  identityType: string;
  identityIssuedDate: string;
  identityIssuedBy: string;
};
type Organization = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  ownerSince: string;
  profile: OrganizationProfile;
  identityNumber: string;
  documents: DocumentFile[];
  history: { action: string; reason: string; at: string }[];
};
type OwnerDetail = {
  account: { id: string; fullName: string; email: string; isActive: boolean };
  role: string;
  ownerSince: string;
  organizations: Organization[];
};

const kindLabels: Record<string, string> = {
  REGISTRATION: "Đăng ký / quyết định thành lập",
  REPRESENTATIVE_ID: "CCCD / hộ chiếu người đại diện",
  AUTHORIZATION: "Văn bản ủy quyền / đại diện",
};
const typeLabels: Record<string, string> = {
  NGO: "Tổ chức phi chính phủ",
  CHARITY: "Tổ chức từ thiện",
  FOUNDATION: "Quỹ xã hội / từ thiện",
  ASSOCIATION: "Hiệp hội",
  SOCIAL_ENTERPRISE: "Doanh nghiệp xã hội",
};
const actionLabels: Record<string, string> = {
  CREATED: "Tạo hồ sơ",
  UPDATED: "Cập nhật hồ sơ",
  SUBMITTED: "Gửi xét duyệt",
  APPROVE: "Đã phê duyệt",
  REJECT: "Đã từ chối",
  REQUEST_CHANGES: "Yêu cầu bổ sung",
  DOCUMENT_UPDATED: "Cập nhật giấy tờ",
};
const date = (value: string) =>
  value.includes("T")
    ? new Date(value).toLocaleDateString("vi-VN")
    : new Date(value + "T00:00:00").toLocaleDateString("vi-VN");

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <LocalizedTree>
      <div className={adminStyles.ownerField}>
        <dt>{label}</dt>
        <dd>{value?.trim() || "Chưa cung cấp"}</dd>
      </div>
    </LocalizedTree>
  );
}

export default function OwnerProfileDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OwnerDetail | null>(null);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let live = true;
    api<OwnerDetail>(`/api/organizations/admin/owners/${id}`)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((ex) => {
        if (live) setError((ex as Error).message);
      });
    return () => {
      live = false;
    };
  }, [id]);

  async function download(organizationId: string, file: DocumentFile) {
    setBusy(file.id);
    setDownloadError("");
    try {
      await downloadDocument(
        `/api/organizations/${organizationId}/documents/${file.id}`,
        file.fileName,
      );
    } catch (ex) {
      setDownloadError((ex as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (error)
    return (
      <LocalizedTree>
        <>
          <Link className={adminStyles.ownerBack} href="/admin/owner-profiles">
            ← Danh sách Owner
          </Link>
          <div className="notice error" role="alert">
            {error}
          </div>
        </>
      </LocalizedTree>
    );
  if (!data)
    return (
      <LocalizedTree>
        <p className={adminStyles.loading}>Đang tải hồ sơ Owner…</p>
      </LocalizedTree>
    );

  const initial = data.account.fullName.trim().charAt(0).toLocaleUpperCase("vi-VN");
  return (
    <LocalizedTree>
      <>
        <Link className={adminStyles.ownerBack} href="/admin/owner-profiles">
          ← Danh sách Owner
        </Link>
        <div className={`${adminStyles.pageHeading} ${adminStyles.ownerHeading}`}>
          <div>
            <p className={adminStyles.eyebrow}>HỒ SƠ TÀI KHOẢN OWNER</p>
            <h1>{data.account.fullName}</h1>
            <p>Thông tin tài khoản và các hồ sơ tổ chức đã đăng ký.</p>
          </div>
        </div>
        <section className={adminStyles.ownerProfileCard}>
          <span className={`${adminStyles.ownerAvatar} ${adminStyles.isLarge}`}>{initial}</span>
          <div className={adminStyles.ownerProfileMain}>
            <span
              className={`${adminStyles.ownerState} ${data.account.isActive ? "is-active" : adminStyles.isInactive}`}
            >
              {data.account.isActive ? "Tài khoản đang hoạt động" : "Tài khoản đã khóa"}
            </span>
            <h2>{data.account.fullName}</h2>
            <a href={`mailto:${data.account.email}`}>{data.account.email}</a>
          </div>
          <div className={adminStyles.ownerProfileMeta}>
            <span>VAI TRÒ</span>
            <strong>OWNER</strong>
            <span>OWNER TỪ</span>
            <strong>{date(data.ownerSince)}</strong>
          </div>
        </section>
        <section className={adminStyles.ownerDataNote}>
          <Icon name="shield" size={18} />
          <p>
            Thông tin tài khoản hiển thị gồm họ tên, email và trạng thái. Mật khẩu cùng dữ liệu xác
            thực không được cung cấp trong hồ sơ này.
          </p>
        </section>

        <div className={adminStyles.ownerSectionTitle}>
          <div>
            <p className={adminStyles.eyebrow}>HỒ SƠ ĐÃ KÊ KHAI</p>
            <h2>
              Tổ chức liên kết{" "}
              <span className={adminStyles.count}>{data.organizations.length}</span>
            </h2>
          </div>
        </div>
        {data.organizations.map((org) => (
          <article className={adminStyles.ownerOrganization} key={org.id}>
            <div className={adminStyles.ownerOrgHeading}>
              <div>
                <span className={adminStyles.eyebrow}>
                  HỒ SƠ TỔ CHỨC · OWNER TỪ {date(org.ownerSince)}
                </span>
                <h3>{org.profile.legalName}</h3>
                <p>
                  {org.profile.province} ·{" "}
                  {typeLabels[org.profile.organizationType] || org.profile.organizationType}
                </p>
              </div>
              <span className={`badge ${org.status}`}>{statuses[org.status] || org.status}</span>
            </div>
            <div className={adminStyles.ownerInfoBlock}>
              <h4>Thông tin pháp lý</h4>
              <dl className={adminStyles.ownerFields}>
                <Field label="Tên pháp lý" value={org.profile.legalName} />
                <Field
                  label="Loại hình tổ chức"
                  value={typeLabels[org.profile.organizationType] || org.profile.organizationType}
                />
                <Field label="Mã số đăng ký" value={org.profile.registrationNumber} />
                <Field label="Ngày đăng ký" value={date(org.profile.registrationDate)} />
                <Field label="Cơ quan cấp phép" value={org.profile.registrationAuthority} />
                <Field label="Ngày thành lập" value={date(org.profile.foundedDate)} />
                <Field label="Mã số thuế" value={org.profile.taxCode} />
                <Field label="Số CCCD / hộ chiếu đã kê khai" value={org.identityNumber} />
                <Field
                  label="Địa chỉ trụ sở"
                  value={`${org.profile.address}, ${org.profile.province}`}
                />
              </dl>
            </div>
            <div className={adminStyles.ownerInfoBlock}>
              <h4>Liên hệ & hoạt động</h4>
              <dl className={adminStyles.ownerFields}>
                <Field label="Email tổ chức" value={org.profile.contactEmail} />
                <Field label="Điện thoại tổ chức" value={org.profile.contactPhone} />
                <Field label="Website" value={org.profile.website} />
                <div className={`${adminStyles.ownerField} ${adminStyles.isWide}`}>
                  <dt>Sứ mệnh</dt>
                  <dd>{org.profile.mission}</dd>
                </div>
              </dl>
            </div>
            <div className={adminStyles.ownerInfoBlock}>
              <h4>Người đại diện đã kê khai</h4>
              <dl className={adminStyles.ownerFields}>
                <Field label="Họ tên" value={org.profile.representativeName} />
                <Field label="Chức vụ" value={org.profile.representativeTitle} />
                <Field label="Ngày sinh" value={date(org.profile.representativeBirthDate)} />
                <Field label="Email" value={org.profile.representativeEmail} />
                <Field label="Điện thoại" value={org.profile.representativePhone} />
                <Field
                  label="Loại giấy tờ"
                  value={org.profile.identityType === "CCCD" ? "CCCD" : "Hộ chiếu"}
                />
                <Field label="Ngày cấp giấy tờ" value={date(org.profile.identityIssuedDate)} />
                <Field label="Nơi cấp" value={org.profile.identityIssuedBy} />
              </dl>
            </div>
            <div className={adminStyles.ownerInfoBlock}>
              <div className={adminStyles.ownerDocHeading}>
                <h4>Giấy tờ đính kèm</h4>
                <Link className={adminStyles.rowLink} href={`/admin/organizations/${org.id}`}>
                  Mở trang xét duyệt <Icon name="arrow" size={16} />
                </Link>
              </div>
              {org.documents.length ? (
                <div className={adminStyles.ownerDocuments}>
                  {org.documents.map((file) => (
                    <div className={adminStyles.ownerDocument} key={file.id}>
                      <span className={adminStyles.ownerDocIcon}>
                        <Icon name="folder" size={18} />
                      </span>
                      <span>
                        <strong>{kindLabels[file.kind] || file.kind}</strong>
                        <small>
                          {file.fileName} · {Math.max(1, Math.ceil(file.size / 1024))} KB · tải lên{" "}
                          {date(file.uploadedAt)}
                        </small>
                      </span>
                      <button
                        className="secondary"
                        disabled={busy === file.id}
                        onClick={() => download(org.id, file)}
                      >
                        {busy === file.id ? "Đang tải…" : "Tải giấy tờ"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Hồ sơ chưa có giấy tờ đính kèm.</p>
              )}
              {downloadError && (
                <p className="notice error" role="alert">
                  {downloadError}
                </p>
              )}
            </div>
            <div className={adminStyles.ownerInfoBlock}>
              <h4>Lịch sử hồ sơ</h4>
              {org.history.length ? (
                <div className={adminStyles.ownerHistory}>
                  {org.history.map((event, index) => (
                    <div key={`${event.at}-${index}`}>
                      <span className={adminStyles.ownerHistoryDot} />
                      <strong>{actionLabels[event.action] || event.action}</strong>
                      <time>{new Date(event.at).toLocaleString("vi-VN")}</time>
                      {event.reason && <p>{event.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Chưa có lịch sử cập nhật.</p>
              )}
            </div>
          </article>
        ))}
      </>
    </LocalizedTree>
  );
}
