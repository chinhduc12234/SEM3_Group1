import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./OperationsDashboard.module.css";

export function OperationsHero({ title, description, children }: {
  title: string; description: string; children?: ReactNode;
}) {
  return <header className={styles.hero}>
    <div>
      <p className={styles.eyebrow}>Give-AID / Vận hành</p>
      <h1>{title}</h1>
      <p className={styles.heroDescription}>{description}</p>
    </div>
    {children}
  </header>;
}

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

export function OperationsCard({ title, subtitle, status, href }: {
  title: string; subtitle: string; status: ReactNode; href: string;
}) {
  return <li className={styles.card}>
    <div className={styles.cardTop}><span>{subtitle}</span>{status}</div>
    <h3>{title}</h3>
    <Link className={styles.cardLink} href={href}>Mở kế hoạch <span aria-hidden="true">→</span></Link>
  </li>;
}
