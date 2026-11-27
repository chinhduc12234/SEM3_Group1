"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { api, ApiError } from "@/shared/api/api";
import { ProcessSteps, StatusPill } from "@/shared/ui/StatusVisuals";
import { formatCampaignDate } from "@/features/campaigns/formatCampaignDate";
import styles from "../Account.module.css";
import view from "./VolunteerActivity.module.css";
import { ActivityList, historyTime } from "../components/AccountActivity";
import { participationPath, registrationEndpoint, statuses, statusTone, type Registration } from "./VolunteerActivityData";

type Openings = {
  campaignTitle: string; location: string;
  groups: { id: string; name: string; date: string | null; dayId: string | null; activityId: string | null; teamName: string | null }[];
  days: { id: string; activities: { id: string; start: string | null; end: string | null; location: string }[] }[];
};
const stages = ["Gửi hồ sơ", "Xếp ca", "Xác nhận ca"];
const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "WAITLISTED", "APPROVED"];

function Details({ fields }: { fields: readonly (readonly [string, string | null])[] }) {
  const present = fields.filter(([, value]) => value?.trim());
  return present.length > 0 && <dl className={view.fields}>
    {present.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

function RegistrationDetail({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [registration, setRegistration] = useState<Registration>();
  const [openings, setOpenings] = useState<Openings>();
  const [loadError, setLoadError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `${registrationEndpoint}/${encodeURIComponent(registrationId)}`;
  const campaignId = registration?.campaignId;
  const profile = registration?.profile;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    api<Registration>(endpoint, { signal }).then((row) => {
      if (signal.aborted) return;
      if (row.status === "WITHDRAWN") setUnavailable(true);
      else setRegistration(row);
    }).catch((failure: unknown) => {
      if (signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 404) setUnavailable(true);
      else setLoadError((failure as Error).message);
    });
    return () => controller.abort();
  }, [endpoint, revision]);

  const [campaignTitle, setCampaignTitle] = useState("");
  useEffect(() => {
    if (!campaignId) return;
    const controller = new AbortController();
    const signal = controller.signal;
    api<Openings>(`/api/campaigns/${campaignId}/volunteer-openings`, { signal })
      .then((result) => { if (!signal.aborted) setOpenings(result); })
      .catch(() => {
        if (signal.aborted) return;
        void api<{ title: string }>(`/api/campaigns/${campaignId}`, { signal })
          .then(({ title }) => { if (!signal.aborted) setCampaignTitle(title); })
          .catch(() => undefined);
      });
    return () => controller.abort();
  }, [campaignId]);

  function returnToList() {
    setRegistration(undefined);
    router.replace(participationPath);
  }

  async function respond(path: string, accept?: boolean) {
    if (!registration || busy) return;
    if (accept !== true && !window.confirm(accept === false ? "Bạn muốn nhường suất này?" : "Bạn muốn rút hồ sơ và nhường các suất đã xếp?")) return;
    setBusy(true);
    setActionError("");
    try {
      const updated = await api<Registration>(endpoint + path, {
        method: "POST", body: accept === undefined ? undefined : JSON.stringify({ accept }),
      });
      if (updated.status === "WITHDRAWN") returnToList();
      else setRegistration({ ...updated, profile: updated.profile ?? profile });
    } catch (failure) {
      setActionError((failure as Error).message);
      try {
        const current = await api<Registration>(endpoint);
        if (current.status === "WITHDRAWN") returnToList();
        else setRegistration(current);
      } catch (reloadFailure) {
        if (reloadFailure instanceof ApiError && reloadFailure.status === 404) returnToList();
      }
    } finally { setBusy(false); }
  }

  const activeOffers = registration?.offers.filter((offer) => offer.status === "OFFERED" || offer.status === "CONFIRMED") ?? [];
  const allConfirmed = activeOffers.length > 0 && activeOffers.every((offer) => offer.status === "CONFIRMED");
  const selectedGroups = profile?.preferredGroupIds
    .map((id) => openings?.groups.find((group) => group.id === id)?.name).filter(Boolean) ?? [];
  const optionalFields = profile ? [
    ["Ngày sinh", profile.dateOfBirth ? formatCampaignDate(profile.dateOfBirth) : null],
    ["Nghề nghiệp", profile.occupation], ["Kỹ năng", profile.skills], ["Kinh nghiệm", profile.experience],
    ["Lý do tham gia", profile.motivation], ["Người liên hệ khẩn cấp", profile.emergencyContactName],
    ["Số điện thoại liên hệ khẩn cấp", profile.emergencyContactPhone],
  ] as const : [];

  return <div className={styles.accountSubpage}>
    <Link className={view.back} href={participationPath}>← Hồ sơ tham gia</Link>
    <header className={`${styles.accountPageHeading} ${styles.activityHero} ${view.detailHeader}`}>
      <h1>Chi tiết hồ sơ tình nguyện</h1>
      {registration && <div className={view.headerMeta}>
        <strong>{openings?.campaignTitle || campaignTitle || "Chiến dịch tình nguyện"}</strong>
        <StatusPill tone={statusTone(registration.status)}>{statuses[registration.status] ?? registration.status}</StatusPill>
        <span>Gửi lúc {historyTime(registration.submittedAt)}</span>
      </div>}
    </header>
    {unavailable && <ActivityList title="Hồ sơ không còn khả dụng">
      <p>Hãy quay lại danh sách để xem những hồ sơ hiện có của bạn.</p>
      <p><Link href={participationPath}>Về Hồ sơ tham gia</Link></p>
    </ActivityList>}
    {loadError && <ActivityList title="Chưa tải được hồ sơ">
      <p role="alert">{loadError}</p>
      <button type="button" onClick={() => { setLoadError(""); setRevision((value) => value + 1); }}>Tải lại</button>
    </ActivityList>}
    {!registration && !unavailable && !loadError && <p role="status">Đang tải chi tiết hồ sơ…</p>}

    {registration && <>
      {openStatuses.includes(registration.status) && <ActivityList title="Tiến độ hồ sơ">
        <ProcessSteps labels={stages} current={activeOffers.length > 0 ? 2 : 1} finished={allConfirmed} />
        {registration.note && <p>{registration.note}</p>}
      </ActivityList>}
      {!openStatuses.includes(registration.status) && registration.note &&
        <ActivityList title="Phản hồi của ban tổ chức"><p>{registration.note}</p></ActivityList>}
      {profile && (
        <div className={view.detailGrid}>
          <ActivityList title="Thông tin liên hệ">
            <Details fields={[["Họ và tên", profile.fullName], ["Email", profile.email], ["Số điện thoại", profile.phoneNumber]]} />
          </ActivityList>
          <ActivityList title="Ngày có thể tham gia">
            {profile.availableDates?.length ? <ul className={view.dates}>{profile.availableDates.map((date) => (
              <li key={date}><time dateTime={date}>{formatCampaignDate(date)}</time></li>
            ))}</ul> : <p>{profile.commitsToAllDays ? "Tất cả các ngày của chiến dịch." : "Chưa có ngày được ghi trong hồ sơ."}</p>}
            {selectedGroups.length > 0 && <p><strong>Nhóm quan tâm</strong><br />{selectedGroups.join(", ")}</p>}
            <p><Link href={`/chien-dich/${registration.campaignId}`}>Mở trang chiến dịch</Link></p>
          </ActivityList>
        </div>
      )}
      {optionalFields.some(([, value]) => value?.trim()) &&
        <ActivityList title="Thông tin bổ sung"><Details fields={optionalFields} /></ActivityList>}
      <ActivityList title="Ca tình nguyện">
        {!registration.offers.length && <p>Bạn chưa được xếp ca.</p>}
        {registration.offers.map((offer) => {
          const group = openings?.groups.find((item) => item.id === offer.groupId);
          const slot = openings?.days.find((day) => day.id === group?.dayId)?.activities.find((item) => item.id === group?.activityId);
          const active = offer.status === "OFFERED" || offer.status === "CONFIRMED";
          return <div key={offer.id}><strong>{group?.name || "Ca tình nguyện"}</strong>
            <span>{[group?.date && formatCampaignDate(group.date), slot?.start?.slice(0, 5), slot?.end?.slice(0, 5), slot?.location || openings?.location, group?.teamName].filter(Boolean).join(" · ")}</span>
            <StatusPill tone={offer.confirmedAt && active ? "positive" : active ? "warning" : "neutral"}>
              {!active ? offer.status === "EXPIRED" ? "Đã hết hạn xác nhận" : "Suất đã kết thúc" : offer.confirmedAt ? `Đã xác nhận lúc ${historyTime(offer.confirmedAt)}`
                : offer.confirmBy ? `Hạn xác nhận ${historyTime(offer.confirmBy)}` : "Chờ xác nhận"}
            </StatusPill>
            {active && registration.status === "APPROVED" && !offer.confirmedAt && <button type="button" disabled={busy} onClick={() => void respond(`/offers/${offer.id}`, true)}>Xác nhận ca</button>}
            {active && registration.status === "APPROVED" && <button type="button" disabled={busy} onClick={() => void respond(`/offers/${offer.id}`, false)}>Nhường ca</button>}
          </div>;
        })}
        {actionError && <p role="alert">{actionError}</p>}
      </ActivityList>
      {openStatuses.includes(registration.status) &&
        <div className={view.footer}><button className="secondary" type="button" disabled={busy} onClick={() => void respond("/withdraw")}>Rút hồ sơ</button></div>}
    </>}
  </div>;
}

export default function AccountRegistrationDetailScreen({ registrationId }: { registrationId: string }) {
  return <Protected><RegistrationDetail registrationId={registrationId} /></Protected>;
}
