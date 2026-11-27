import Link from "next/link";
import type { ReactNode } from "react";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { WorkspaceIcon } from "@/features/organizations/workspace/components/WorkspaceUI";
import styles from "./OperationsDashboard.module.css";

export function OperationsMetrics({ items }: { items: [string, number][] }) {
  return <dl className={styles.metrics}>
    {items.map(([label, count]) => <div key={label}>
      <dt>{label}</dt><dd>{count.toLocaleString()}</dd>
    </div>)}
  </dl>;
}

export function OperationsCards({ children }: { children: ReactNode }) {
  return <ul className={styles.cards}>{children}</ul>;
}

export function OperationsCard({ title, subtitle, status, href, actionLabel = "Mở kế hoạch" }: {
  title: string; subtitle: string; status: ReactNode; href: string; actionLabel?: string;
}) {
  return <LocalizedTree><li className={styles.card}>
    <div className={styles.cardTop}><span className={styles.cardType}><WorkspaceIcon name="folder" />{subtitle}</span>{status}</div>
    <h3>{title}</h3>
    <Link className={styles.cardLink} href={href}>{actionLabel} <WorkspaceIcon name="arrow" /></Link>
  </li></LocalizedTree>;
}
