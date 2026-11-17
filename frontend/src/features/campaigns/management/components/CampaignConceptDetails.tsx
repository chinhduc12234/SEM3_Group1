import { useEffect, useState } from "react";
import Link from "next/link";
import { api, downloadDocument } from "@/shared/api/api";
import { campaignStatuses, type Campaign } from "../../types/campaigns";
import { conceptForm } from "../campaignConceptFields";
import CampaignConceptSummary from "./CampaignConceptSummary";
import styles from "../CampaignManagement.module.css";
import { formatCampaignDate } from "../../formatCampaignDate";

type RelatedRecord = { id: string; title: string; status: string; startDate: string | null };
type RelatedCampaigns = { parent: RelatedRecord | null; children: RelatedRecord[] };

const reviewActions: Record<string, string> = {
  SUBMIT: "Gửi duyệt ý tưởng",
  APPROVE: "Chấp thuận chủ trương",
  REQUEST_CHANGES: "Yêu cầu chỉnh sửa",
  REJECT: "Từ chối ý tưởng",
};

export function CampaignConceptHistory({ campaign }: { campaign: Campaign }) {
  const history = campaign.reviews.filter(({ action }) => action in reviewActions);
  if (!history.length) return null;
  return (
    <section className={styles.reviewBlock}>
      <h4>Lịch sử duyệt ý tưởng</h4>
      <ol className={styles.conceptHistory}>
        {[...history].reverse().map(({ id, action, note, createdAt }) => (
          <li key={id}>
            <strong>{reviewActions[action]}</strong>{" "}
            <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("vi-VN")}</time>
            {note && <p>{note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function CampaignConceptDetails({
  campaign, mediaPreviews,
}: {
  campaign: Campaign;
  mediaPreviews: Record<string, { url?: string; error?: string }>;
}) {
  const [error, setError] = useState("");
  const [related, setRelated] = useState<RelatedCampaigns>();
  const [relatedError, setRelatedError] = useState("");
  const base = `/organizations/${campaign.organizationId}/manage/campaigns`;
  useEffect(() => {
    const controller = new AbortController();
    api<RelatedCampaigns>(`/api/campaigns/${campaign.id}/related`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setRelated(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setRelatedError(failure.message); });
    return () => controller.abort();
  }, [campaign.id]);
  const cover = campaign.media.find(({ kind }) => kind === "COVER");
  const gallery = campaign.media.filter(({ kind }) => kind === "GALLERY");
  const documents = campaign.media.filter(({ kind }) => kind === "DOCUMENT");

  async function download(id: string, name: string) {
    setError("");
    try {
      await downloadDocument(`/api/campaigns/${campaign.id}/media/${id}`, name);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className={`actions ${styles.conceptStatus}`}>
        <span className={`badge ${campaign.status}`}>{campaignStatuses[campaign.status]}</span>
      </div>
      {campaign.code && <p className="muted">Mã hồ sơ {campaign.code}</p>}
      <CampaignConceptSummary values={conceptForm(campaign)} address={campaign.concept?.plannedAddress}
        parentTitle={campaign.parentCampaignTitle} parentHref={related?.parent ? `${base}/${related.parent.id}` : undefined} />
      {!!related?.children.length && <section className={styles.reviewBlock}>
        <h4>Sự kiện trực thuộc</h4>
        <ul>{related.children.map((event) => <li key={event.id}>
          <Link href={`${base}/${event.id}`}>{event.title}</Link>
          {" · "}{[event.startDate && formatCampaignDate(event.startDate), campaignStatuses[event.status]].filter(Boolean).join(" · ")}
        </li>)}</ul>
      </section>}
      {relatedError && <p className="notice error" role="alert">{relatedError}</p>}
      {(cover || gallery.length > 0 || documents.length > 0) && (
        <section className={styles.reviewBlock}>
          <h4>Ảnh và tài liệu minh họa</h4>
          {cover && <div className={styles.conceptFiles}>
            {
            mediaPreviews[cover.id]?.url
              ? <img src={mediaPreviews[cover.id].url} alt={`Ảnh đại diện của ${campaign.title}`} />
              : <p>{mediaPreviews[cover.id]?.error || cover.fileName}</p>
            }
          </div>}
          {gallery.length > 0 && <>
            <h5>Ảnh phụ ({gallery.length})</h5>
            <div className={styles.reviewImages}>
              {gallery.map(({ id, fileName }) => (
                <figure key={id}>
                  {mediaPreviews[id]?.url
                    ? <img src={mediaPreviews[id].url} alt={fileName} />
                    : <p>{mediaPreviews[id]?.error || "Đang tải ảnh…"}</p>}
                  <figcaption>{fileName}</figcaption>
                </figure>
              ))}
            </div>
          </>}
          <div className="actions">
            {documents.map(({ id, fileName }) => (
              <button key={id} type="button" className="secondary" onClick={() => void download(id, fileName)}>
                Tải {fileName}
              </button>
            ))}
          </div>
          {error && <p className="notice error" role="alert">{error}</p>}
        </section>
      )}
      <CampaignConceptHistory campaign={campaign} />
    </>
  );
}
