"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { focusAreas, labelsForRoles } from "@/features/organizations/types/workspace";
import WorkspaceImage from "@/features/organizations/workspace/components/WorkspaceImage";
import styles from "@/features/organizations/workspace/Workspace.module.css";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { ProgressTrack, Stat, StatGrid } from "@/shared/ui/StatusVisuals";

export default function WorkspaceOverviewScreen() {
  const { data } = useWorkspace();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const root = `/organizations/${id}/manage`;
  const isOwner = data.roles.includes("OWNER");
  useEffect(() => {
    if (!isOwner) router.replace(`${root}/${data.roles.some((role) =>
      ["CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"].includes(role)) ? "work" : "members"}`);
  }, [data.roles, isOwner, root, router]);
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
          <h1>Tổng quan tổ chức</h1>
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
          <h2>Hoạt động tổ chức</h2>
        </div>
        <span className={styles.ownerLive}><i aria-hidden="true" /> Đang hoạt động</span>
      </div>

      <StatGrid label="Thống kê tổ chức">
        <Stat label="Thành viên hoạt động" value={stats.activeMembers} detail={`${stats.staffCount} nhân sự`} tone="positive" />
        <Stat label="Lời mời đang chờ" value={stats.pendingInvitations} tone={stats.pendingInvitations ? "warning" : "neutral"} />
        <Stat label="Chiến dịch" value={stats.campaigns ?? "—"} detail={stats.campaigns == null ? "Chưa có dữ liệu" : undefined} tone="info" />
        <Stat label="Tổng quyên góp" value={money} detail={stats.donatedAmount == null ? "Chưa có dữ liệu" : "Tổng đã ghi nhận"} />
      </StatGrid>

      <div className={styles.ownerDashboardGrid}>
        <section className={styles.ownerPanel}>
          <div className={styles.ownerPanelHeading}>
            <h2>Việc cần theo dõi</h2>
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
            <Link href={`${root}/work`}>
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
            <h2>Hoàn thiện hồ sơ</h2>
            <Link className={styles.ownerTextLink} href={`${root}/profile`}>Chỉnh sửa</Link>
          </div>
          <div className={styles.ownerProfileCard}>
            <div className={styles.ownerProfileProgress}>
              <span>{missingDetails.length ? "Đang hoàn thiện" : "Hồ sơ cơ bản đã đủ"}</span>
              <strong>{missingDetails.length ? `${3 - missingDetails.length}/3` : "3/3"}</strong>
            </div>
            <ProgressTrack limit={3} segments={[{ value: 3 - missingDetails.length, tone: "positive" }]}
              label={`Hồ sơ cơ bản đã hoàn thiện ${3 - missingDetails.length} trên 3 mục`} />
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
