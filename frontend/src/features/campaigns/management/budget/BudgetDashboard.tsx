import Link from "next/link";
import type { ReactNode } from "react";
import css from "./BudgetDashboard.module.css";

export function BudgetHero({ title, description, backHref, children }: {
  title: string; description: string; backHref?: string; children?: ReactNode;
}) {
  return <header className={css.hero}>
    {backHref && <Link className={css.back} href={backHref}>← Danh sách ngân sách</Link>}
    <div className={css.heroContent}>
      <div>
        {backHref && <p className={css.eyebrow}>Kế hoạch ngân sách</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  </header>;
}

export function BudgetRecordCard({ title, metadata, status, href }: {
  title: string; metadata: string; status: ReactNode; href: string;
}) {
  return <li className={css.record}>
    <div className={css.recordTop}><span>{metadata}</span>{status}</div>
    <h3>{title}</h3>
    <Link href={href} className={css.recordLink} aria-label={`Mở dự toán: ${title}`}>
      Mở dự toán <span aria-hidden="true">→</span>
    </Link>
  </li>;
}
