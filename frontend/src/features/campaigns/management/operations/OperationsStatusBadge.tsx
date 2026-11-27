import styles from "../CampaignManagement.module.css";

export default function OperationsStatusBadge({ confirmedAt }: { confirmedAt: string | null }) {
  return <span className={styles.operationsBadge} data-confirmed={!!confirmedAt}>
    {confirmedAt ? "Vận hành đã xác nhận" : "Bản nháp vận hành"}
  </span>;
}
