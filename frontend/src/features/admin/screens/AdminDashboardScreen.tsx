"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import Icon from "@/features/admin/components/AdminIcon";
import AdminOrganizationOverview from "@/features/admin/organizations/AdminOrganizationOverview";
type Item = {
  id: string;
  legalName: string;
  registrationNumber: string;
  submittedAt: string | null;
};
type Result = { totalCount: number; items: Item[] };
const metrics = [
  { status: "", label: "Tổng hồ sơ", icon: "folder", note: "Tất cả tổ chức đã đăng ký" },
  {
    status: "PENDING_REVIEW",
    label: "Chờ xét duyệt",
    icon: "clock",
    note: "Hồ sơ cần được xem xét",
  },
  { status: "ACTIVE", label: "Đã phê duyệt", icon: "check", note: "Đã hoàn tất xét duyệt" },
  {
    status: "CHANGES_REQUESTED",
    label: "Cần bổ sung",
    icon: "edit",
    note: "Đang chờ tổ chức cập nhật",
  },
] as const;

const statusColors = {
  amber: adminStyles.colorAmber,
  green: adminStyles.colorGreen,
  blue: adminStyles.colorBlue,
  gray: adminStyles.colorGray,
};

type StatusSection = {
  label: string;
  value: number;
  color: keyof typeof statusColors;
};

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<Result[] | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    setData(null);
    Promise.all(
      metrics.map((m) =>
        api<Result>("/api/organizations?" + new URLSearchParams({ page: "1", status: m.status })),
      ),
    )
      .then((r) => {
        if (live) {
          setData(r);
          setUpdated(
            new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          );
        }
      })
      .catch((ex) => {
        if (live) setError(ex.message);
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  const total = data?.[0].totalCount ?? 0;
  const sections: StatusSection[] = data
    ? [
        { label: "Chờ xét duyệt", value: data[1].totalCount, color: "amber" },
        { label: "Đã phê duyệt", value: data[2].totalCount, color: "green" },
        { label: "Cần bổ sung", value: data[3].totalCount, color: "blue" },
        {
          label: "Trạng thái khác",
          value: Math.max(0, total - data[1].totalCount - data[2].totalCount - data[3].totalCount),
          color: "gray",
        },
      ]
    : [];
  return (
    <LocalizedTree>
      <>
        <AdminOrganizationOverview />
        <div className={adminStyles.pageHeading}>
          <div>
            <p className={adminStyles.eyebrow}>GÓC NHÌN TỔNG QUAN</p>
            <h1>Chào mừng trở lại, {user?.fullName}.</h1>
            <p>Theo dõi hồ sơ và cùng chăm sóc những kết nối của Give-AID.</p>
          </div>
          <button
            className="secondary"
            disabled={!data && !error}
            onClick={() => setRefresh((x) => x + 1)}
          >
            <Icon name="refresh" size={17} />
            Làm mới
          </button>
        </div>
        <section className={adminStyles.featureBanner}>
          <div>
            <span className={adminStyles.bannerLabel}>CÙNG NHAU TẠO NÊN THAY ĐỔI</span>
            <h2>
              Mỗi hồ sơ rõ ràng.
              <br />
              Thêm một kết nối tin cậy.
            </h2>
            <p>Bắt đầu từ những hồ sơ đang chờ bạn xem xét hôm nay.</p>
            <Link
              href="/admin/organizations?status=PENDING_REVIEW"
              className={adminStyles.bannerButton}
            >
              Đến trang quản trị <Icon name="arrow" size={17} />
            </Link>
          </div>
          <img src="/images/giveaid-organization.png" alt="Niềm vui sẻ chia cùng trẻ em vùng cao" />
        </section>
        {error && (
          <p className="notice error" role="alert">
            {error}{" "}
            <button className="quiet" onClick={() => setRefresh((x) => x + 1)}>
              Thử lại
            </button>
          </p>
        )}
        <div className={adminStyles.sectionCaption}>
          <h2>Tình hình hồ sơ</h2>
          <span>{updated ? "Cập nhật lúc " + updated : "Đang tải dữ liệu…"}</span>
        </div>
        <div className={adminStyles.metrics}>
          {metrics.map((m, i) => (
            <Link
              key={m.label}
              className={[
                adminStyles.stat,
                ["", adminStyles["stat-1"], adminStyles["stat-2"], adminStyles["stat-3"]][i],
              ]
                .filter(Boolean)
                .join(" ")}
              href={"/admin/organizations?status=" + m.status}
            >
              <div className={adminStyles.statTop}>
                <span className={adminStyles.statIcon}>
                  <Icon name={m.icon} />
                </span>
                <Icon name="arrow" size={16} />
              </div>
              <span>{m.label}</span>
              <strong>
                {data ? (
                  data[i].totalCount
                ) : error ? (
                  "—"
                ) : (
                  <span className={adminStyles.skeleton} aria-label="Đang tải" />
                )}
              </strong>
              <small>{m.note}</small>
            </Link>
          ))}
        </div>
        <div className={adminStyles.overviewGrid}>
          <section className={adminStyles.panel}>
            <div className={adminStyles.panelHeading}>
              <div>
                <span className={adminStyles.eyebrow}>DANH SÁCH ƯU TIÊN</span>
                <h2>
                  Hồ sơ chờ xét duyệt{" "}
                  <span className={adminStyles.count}>{data?.[1].totalCount ?? "—"}</span>
                </h2>
              </div>
              <Link
                className={adminStyles.inlineLink}
                href="/admin/organizations?status=PENDING_REVIEW"
              >
                Xem tất cả <Icon name="arrow" size={16} />
              </Link>
            </div>
            {!data ? (
              <div className={adminStyles.loading} role="status">
                {error ? "Chưa tải được dữ liệu." : "Đang tải hồ sơ…"}
              </div>
            ) : data[1].items.length ? (
              <ul className={adminStyles.queue}>
                {data[1].items.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <span className={adminStyles.orgAvatar}>{item.legalName.charAt(0)}</span>
                    <div>
                      <strong>{item.legalName}</strong>
                      <small>
                        {item.registrationNumber} ·{" "}
                        {item.submittedAt
                          ? new Date(item.submittedAt).toLocaleDateString("vi-VN")
                          : "Chưa gửi"}
                      </small>
                    </div>
                    <Link
                      href={"/admin/organizations/" + item.id}
                      aria-label={"Xem hồ sơ " + item.legalName}
                    >
                      <Icon name="arrow" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={adminStyles.empty}>
                <span className={adminStyles.emptyIllustration}>
                  <Icon name="check" size={36} />
                </span>
                <h3>Mọi việc đã gọn gàng!</h3>
                <p>
                  Hiện chưa có hồ sơ chờ xét duyệt. Khi tổ chức gửi hồ sơ mới, bạn sẽ tìm thấy tại
                  đây.
                </p>
                <Link href="/admin/organizations?status=" className={adminStyles.inlineLink}>
                  Xem tất cả hồ sơ <Icon name="arrow" size={16} />
                </Link>
              </div>
            )}
          </section>
          <section className={`${adminStyles.panel} ad-distribution`}>
            <div className={adminStyles.panelHeading}>
              <div>
                <span className={adminStyles.eyebrow}>PHÂN BỐ TRẠNG THÁI</span>
                <h2>Hành trình của hồ sơ</h2>
              </div>
            </div>
            <div className={adminStyles.distributionTotal}>
              <strong>{data ? total : "—"}</strong>
              <span>hồ sơ trên hệ thống</span>
            </div>
            <div className={adminStyles.stacked} aria-hidden="true">
              {total ? (
                sections.map((s) => (
                  <span
                    key={s.label}
                    className={statusColors[s.color]}
                    style={{ width: (100 * s.value) / total + "%" }}
                  />
                ))
              ) : (
                <span className={adminStyles.colorGray} style={{ width: "100%" }} />
              )}
            </div>
            <ul className={adminStyles.distributionList}>
              {sections.map((s) => (
                <li key={s.label}>
                  <span>
                    <i className={statusColors[s.color]} />
                    {s.label}
                  </span>
                  <b>{s.value}</b>
                </li>
              ))}
            </ul>
            {!total && data && (
              <p className={adminStyles.helper}>Phân bố sẽ được cập nhật khi có hồ sơ đăng ký.</p>
            )}
          </section>
        </div>
        <section className={adminStyles.reviewGuide}>
          <div>
            <span className={adminStyles.eyebrow}>NGUYÊN TẮC ĐỒNG HÀNH</span>
            <h2>Xét duyệt bằng sự cẩn trọng.</h2>
          </div>
          <div>
            <Icon name="search" />
            <h3>Đối chiếu thông tin</h3>
            <p>Kiểm tra tổ chức và người đại diện.</p>
          </div>
          <div>
            <Icon name="folder" />
            <h3>Đọc hồ sơ pháp lý</h3>
            <p>Xem đầy đủ các giấy tờ đính kèm.</p>
          </div>
          <div>
            <Icon name="edit" />
            <h3>Phản hồi rõ ràng</h3>
            <p>Ghi nhận lý do cho mỗi quyết định.</p>
          </div>
        </section>
      </>
    </LocalizedTree>
  );
}
