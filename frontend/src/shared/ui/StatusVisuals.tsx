import type { ReactNode } from "react";
import styles from "./StatusVisuals.module.css";

type Tone = "positive" | "info" | "warning" | "danger" | "neutral";

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={styles.pill} data-tone={tone}>{children}</span>;
}

export function StatGrid({ children, label }: { children: ReactNode; label: string }) {
  return <dl className={styles.stats} aria-label={label}>{children}</dl>;
}

export function Stat({ label, value, detail, icon, tone = "neutral" }: {
  label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; tone?: Tone;
}) {
  return <div className={icon ? `${styles.stat} ${styles.statWithIcon}` : styles.stat} data-tone={tone}>
    <dt>{label}{icon && <span aria-hidden="true" className={styles.statIcon}>{icon}</span>}</dt>
    <dd><span>{value}</span>{detail && <small>{detail}</small>}</dd>
  </div>;
}

export function ProgressTrack({ limit, segments, label }: {
  limit: number; segments: { value: number; tone: Tone }[]; label: string;
}) {
  const maximum = Math.max(0, Number.isFinite(limit) ? limit : 0);
  let available = maximum;
  const parts = segments.map(({ value, tone }) => {
    const shown = Math.min(available, Math.max(0, Number.isFinite(value) ? value : 0));
    available -= shown;
    return { width: maximum > 0 ? shown / maximum * 100 : 0, tone };
  });

  return <span className={styles.track} role="img" aria-label={label}>
    {parts.map(({ width, tone }, index) => width > 0 && <span key={index} data-tone={tone} style={{ width: width + "%" }} />)}
  </span>;
}

export function Legend({ items }: { items: { label: ReactNode; tone: Tone }[] }) {
  return <ul className={styles.legend}>{items.map(({ label, tone }, index) =>
    <li key={index}><span data-tone={tone} aria-hidden="true" />{label}</li>)}</ul>;
}

export function ProcessSteps({ labels, current, finished = false }: {
  labels: string[]; current: number; finished?: boolean;
}) {
  return <ol className={styles.steps} aria-label="Các bước thực hiện">
    {labels.map((label, index) => {
      const done = finished || index < current;
      return <li key={label} data-state={done ? "done" : index === current ? "current" : "upcoming"}
        aria-current={!finished && index === current ? "step" : undefined}>
        <span aria-hidden="true">{done ? "✓" : index + 1}</span>{label}
      </li>;
    })}
  </ol>;
}
