"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { focusAreas, labelsForRoles } from "@/features/organizations/types/workspace";
import WorkspaceImage from "@/features/organizations/workspace/components/WorkspaceImage";
import styles from "@/features/organizations/workspace/Workspace.module.css";
import { useLocale } from "@/shared/i18n/LocaleProvider";

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className={styles.ownerStat}>
      <span className={styles.ownerStatMark} aria-hidden="true" />
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function WorkspaceOverviewScreen() {
  const { data } = useWorkspace();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const root = `/organizations/${id}/manage`;
  const isOwner = data.roles.includes("OWNER");
  useEffect(() => {
    if (!isOwner) router.replace(`${root}/members`);
  }, [isOwner, root, router]);
  if (!isOwner) return null;
  const stats = data.statistics;
  const money = stats.donatedAmount == null
    ? "—"
    : new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(stats.donatedAmount);
  const missingDetails = [
    !data.profile.hasLogo && "Thêm logo tổ chức",
    !data.profile.hasCover && "Thêm ảnh bìa",
    !data.profile.website && "Bổ sung website",
  ].filter(Boolean) as string[];

  return (
    <div className={styles.ownerDashboard}>
      <header className={styles.ownerWelcome}>
        <div className={styles.ownerWelcomeCopy}>
          <p className="eyebrow">KHÔNG GIAN TỔ CHỨC</p>
          <h1>Xin chào, {data.profile.displayName}</h1>
          <p>Đây là nơi bạn theo dõi đội ngũ và điều phối các hoạt động của tổ chức.</p>
        </div>
        <div className={styles.ownerWelcomeBrand}>
          {data.profile.hasLogo ? (
            <WorkspaceImage id={data.id} kind="logo" version={data.profile.version} />
          ) : (
            <span aria-hidden="true">{data.profile.displayName.slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <strong>{data.profile.displayName}</strong>
            <small>{labelsForRoles(data.roles)}</small>
          </div>
        </div>
      </header>

      <div className={styles.ownerSectionHeading}>
        <div>
          <p className="eyebrow">TỔNG QUAN</p>
          <h2>Hoạt động tổ chức</h2>
        </div>
        <span className={styles.ownerLive}><i aria-hidden="true" /> Đang hoạt động</span>
      </div>

      <section className={styles.ownerStats} aria-label="Thống kê tổ chức">
        <StatCard label="Thành viên hoạt động" value={String(stats.activeMembers)} detail="Đang đồng hành cùng tổ chức" />
        <StatCard label="Nhân sự" value={String(stats.staffCount)} detail="Thành viên ngoài chủ tổ chức" />
        <StatCard label="Chiến dịch" value={stats.campaigns == null ? "—" : String(stats.campaigns)} detail={stats.campaigns == null ? "Chưa có dữ liệu" : "Chiến dịch của tổ chức"} />
        <StatCard label="Tổng quyên góp" value={money} detail={stats.donatedAmount == null ? "Chưa có dữ liệu" : "Tổng số tiền đã ghi nhận"} />
      </section>

      <div className={styles.ownerDashboardGrid}>
        <section className={styles.ownerPanel}>
          <div className={styles.ownerPanelHeading}>
            <div><p className="eyebrow">LỐI TẮT</p><h2>Việc bạn có thể làm</h2></div>
          </div>
          <div className={styles.ownerQuickLinks}>
            <Link href={`${root}/members`}>
              <span className={styles.ownerQuickIcon} aria-hidden="true">NS</span>
              <span><strong>Quản lý nhân sự</strong><small>Mời thành viên và cập nhật vai trò</small></span>
              <span className={styles.ownerArrow} aria-hidden="true">→</span>
            </Link>
            <Link href={`${root}/profile`}>
              <span className={styles.ownerQuickIcon} aria-hidden="true">TT</span>
              <span><strong>Cập nhật thông tin</strong><small>Chỉnh sửa hồ sơ và nhận diện tổ chức</small></span>
              <span className={styles.ownerArrow} aria-hidden="true">→</span>
            </Link>
            <Link href={`${root}/campaigns`}>
              <span className={styles.ownerQuickIcon} aria-hidden="true">CD</span>
              <span><strong>Duyệt chiến dịch</strong><small>Xem xét nội dung và phân công phụ trách</small></span>
              <span className={styles.ownerArrow} aria-hidden="true">→</span>
            </Link>
            {data.pendingLegalChange && (
              <Link href={`${root}/legal`}>
                <span className={styles.ownerQuickIcon} aria-hidden="true">HS</span>
                <span><strong>Yêu cầu pháp lý đang chờ</strong><small>Mở hồ sơ để xem và xử lý thay đổi</small></span>
                <span className={styles.ownerArrow} aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </section>

        <aside className={styles.ownerPanel}>
          <div className={styles.ownerPanelHeading}>
            <div><p className="eyebrow">HỒ SƠ</p><h2>Hoàn thiện tổ chức</h2></div>
            <Link className={styles.ownerTextLink} href={`${root}/profile`}>Chỉnh sửa</Link>
          </div>
          <div className={styles.ownerProfileCard}>
            <div className={styles.ownerProfileProgress}>
              <span>{missingDetails.length ? "Đang hoàn thiện" : "Hồ sơ cơ bản đã đủ"}</span>
              <strong>{missingDetails.length ? `${3 - missingDetails.length}/3` : "3/3"}</strong>
            </div>
            <div className={styles.ownerProgressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={3 - missingDetails.length} aria-label="Mức độ hoàn thiện hồ sơ cơ bản">
              <span style={{ width: `${((3 - missingDetails.length) / 3) * 100}%` }} />
            </div>
            {missingDetails.length ? (
              <ul>{missingDetails.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p className={styles.ownerProfileComplete}>Tên hiển thị, logo và ảnh bìa đã sẵn sàng để giới thiệu tổ chức.</p>
            )}
          </div>
          <div className={styles.ownerFocusAreas}>
            <span>Lĩnh vực hoạt động</span>
            <div>{data.profile.focusAreas.length ? data.profile.focusAreas.map((area) => <span key={area}>{focusAreas[area] || area}</span>) : <small>Chưa cập nhật</small>}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
