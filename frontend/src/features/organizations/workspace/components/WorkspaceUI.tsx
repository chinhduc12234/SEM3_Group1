import type { ReactNode } from "react";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "./WorkspaceUI.module.css";

const paths = {
  work: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  calendar: "M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 14h2m4 0h2m-8 3h2",
  people: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M13.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  operations: "M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-6 3v4",
  inbox: "M4 14l3-8h10l3 8v5H4zM4 14h5l1 2h4l1-2h5",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  pin: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  refresh: "M20 7v5h-5m-11 5v-5h5m-4-3a7.5 7.5 0 0 1 13-4l2 3m-16 8 2 3a7.5 7.5 0 0 0 13-4",
  check: "m5 12 5 5L20 7",
  search: "m21 21-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  building: "M3 21h18M6 21V5l12-2v18M10 8h.01M14 8h.01M10 12h.01M14 12h.01M10 16h.01M14 16h.01",
  folder: "M3 6h7l2 2h9v11H3z",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  logout: "M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4",
};

export type WorkspaceIconName = keyof typeof paths;

export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}

export function WorkspaceHero({ title, description, icon, children }: {
  title: string; description: string; icon: WorkspaceIconName; children?: ReactNode;
}) {
  return <LocalizedTree><header className={styles.hero}>
    <div className={styles.heroCopy}>
      <h1>{title}</h1>
      <p>{description}</p>
      {children && <div className={styles.heroActions}>{children}</div>}
    </div>
    <span className={styles.heroMark}><WorkspaceIcon name={icon} /></span>
  </header></LocalizedTree>;
}

export function WorkspaceEmpty({ title, detail, icon = "inbox", compact = false }: {
  title: string; detail?: string; icon?: WorkspaceIconName; compact?: boolean;
}) {
  return <LocalizedTree><div className={compact ? `${styles.empty} ${styles.emptyCompact}` : styles.empty}>
    <span className={styles.iconTile}><WorkspaceIcon name={icon} /></span>
    <strong>{title}</strong>
    {detail && <p>{detail}</p>}
  </div></LocalizedTree>;
}

export function WorkspaceLoading({ children }: { children: ReactNode }) {
  return <LocalizedTree><p className={styles.loading} role="status"><span aria-hidden="true" />{children}</p></LocalizedTree>;
}
