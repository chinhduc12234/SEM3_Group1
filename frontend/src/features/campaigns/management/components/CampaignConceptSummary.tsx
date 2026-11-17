import { Fragment } from "react";
import Link from "next/link";
import { campaignTypes, causes, type PlannedCampaignAddress } from "../../types/campaigns";
import { formatCampaignDate } from "../../formatCampaignDate";
import { conceptSteps, eventFormats, fieldsForStep, formatPlannedAddress, type ConceptForm } from "../campaignConceptFields";
import styles from "../CampaignManagement.module.css";

export default function CampaignConceptSummary({
  values, address, parentTitle, parentHref, editStep,
}: {
  values: ConceptForm;
  address?: PlannedCampaignAddress | null;
  parentTitle?: string | null;
  parentHref?: string;
  editStep?: (index: number) => void;
}) {
  return (
    <div className={styles.conceptSummary}>
      {conceptSteps.map(({ title }, index) => {
        const rows = fieldsForStep(index, values).map(({ key, label, type }) => ({
          label,
          value: type === "date" && values[key] ? formatCampaignDate(values[key]) : values[key],
        }));
        if (index === 0) {
          rows.unshift(
            { label: "Loại hồ sơ", value: campaignTypes[values.campaignType] },
            { label: "Danh mục thiện nguyện", value: causes[values.cause] },
          );
          if (values.campaignType === "EVENT") {
            if (values.parentCampaignId) {
              rows.push({ label: "Chiến dịch cha", value: parentTitle || "Đã liên kết" });
            }
          }
        }
        if (index === 3) {
          const location = address ? formatPlannedAddress(address) : values.location;
          if (location) rows.unshift({ label: "Địa chỉ dự kiến", value: location });
          if (values.campaignType === "EVENT") {
            rows.unshift({ label: "Hình thức tổ chức", value: eventFormats[values.eventFormat] });
          }
        }
        return (
          <section className={styles.reviewBlock} key={title}>
            <div className={styles.conceptSummaryHeading}>
              <h4>{title}</h4>
              {editStep && (
                <button type="button" className="secondary" aria-label={`Sửa ${title}`} onClick={() => editStep(index)}>
                  Sửa
                </button>
              )}
            </div>
            <dl>
              {rows.filter(({ value }) => value?.trim()).map(({ label, value }) => (
                <Fragment key={label}><dt>{label}</dt><dd>
                  {label === "Chiến dịch cha" && parentHref ? <Link href={parentHref}>{value}</Link> : value}
                </dd></Fragment>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
