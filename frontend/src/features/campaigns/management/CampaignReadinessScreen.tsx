"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { Legend, ProgressTrack, Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import CampaignScheduleChangePanel from "./CampaignScheduleChangePanel";
import styles from "./CampaignReadinessScreen.module.css";

type Check = { code: string; level: "BLOCK" | "WARNING" | "PASS"; message: string; department: string; path: string };
type Started = { startedAt: string; submissionId: string };
type Confirmation = { section: string; current: boolean; confirmedAt: string | null };
type Readiness = { organizationId: string; title: string; version: string; readinessStamp: string;
  ready: boolean; canStart: boolean; allowedConfirmations: string[]; checks: Check[]; confirmations: Confirmation[]; started: Started | null };

const names: Record<string, string> = { CAMPAIGN: "Chiến dịch", OPERATIONS: "Vận hành", FINANCE: "Tài chính" };
const levels = { BLOCK: "Chặn", WARNING: "Cảnh báo", PASS: "Đạt" };
const tones = { BLOCK: "danger", WARNING: "warning", PASS: "positive" } as const;
const order = ["BLOCK", "WARNING", "PASS"] as const;

export default function CampaignReadinessScreen() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const path = `/api/launch/campaigns/${campaignId}`;
  const detail = `/organizations/${id}/manage/campaigns/${campaignId}`;
  const [view, setView] = useState<Readiness>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<Readiness>(path, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.organizationId !== id) throw new Error("Hồ sơ không thuộc tổ chức này.");
      setView(result);
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, path, revision]);

  async function action(section?: string) {
    if (!view || loading || busy) return;
    if (!section && !window.confirm("Bạn muốn ghi mốc bắt đầu cho chương trình này?")) return;
    setBusy(true);
    setError("");
    try {
      const suffix = section ? `confirmations/${section.toLowerCase()}` : "start";
      await api(path + "/" + suffix, { method: "POST", body: JSON.stringify({ version: view.version, readinessStamp: view.readinessStamp }) });
    } catch (reason) { setError((reason as Error).message); }
    finally { setRevision((value) => value + 1); setBusy(false); }
  }

  const checks = view?.checks ?? [];
  const blocks = checks.filter((check) => check.level === "BLOCK").length;
  const warnings = checks.filter((check) => check.level === "WARNING").length;
  const passed = checks.length - blocks - warnings;
  const confirmations = view?.confirmations ?? [];
  const confirmed = confirmations.filter((section) => section.current).length;
  const state = view?.started ? "Đã bắt đầu" : view?.ready ? "Sẵn sàng" : blocks ? "Đang bị chặn" : "Chờ xác nhận";
  const stateTone = view?.started || view?.ready ? "positive" : blocks ? "danger" : "warning";

  return <div className={styles.dashboard}>
    <Link href={detail} className={styles.back}>← Hồ sơ chiến dịch</Link>
    <header className={styles.hero}>
      <div>
        {view && <StatusPill tone={stateTone}>{state}</StatusPill>}
        <h1>Sẵn sàng bắt đầu</h1>{view && <p>{view.title}</p>}
      </div>
      <div className={styles.actions}>
        <button className="secondary" type="button" disabled={busy || loading} onClick={() => {
          setError(""); setRevision((value) => value + 1);
        }}>Kiểm tra lại</button>
        {view?.canStart && !view.started && <button className="primary" type="button" disabled={!view.ready || busy || loading}
          onClick={() => void action()}>Bắt đầu chương trình</button>}
      </div>
    </header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading && <p role="status">Đang kiểm tra điều kiện…</p>}
    {view?.started ? <section className={styles.started} role="status">
      <span aria-hidden="true">✓</span>
      <div><h2>Chương trình đã bắt đầu</h2><p>Đã bắt đầu lúc {new Date(view.started.startedAt).toLocaleString("vi-VN")}.</p></div>
    </section> : view && <>
      <StatGrid label="Tóm tắt mức sẵn sàng">
        <Stat label="Điều kiện đạt" value={`${passed}/${checks.length}`} tone="positive" />
        <Stat label="Điều kiện đang chặn" value={blocks} tone={blocks ? "danger" : "neutral"} />
        <Stat label="Cảnh báo" value={warnings} tone={warnings ? "warning" : "neutral"} />
        <Stat label="Bộ phận đã xác nhận" value={`${confirmed}/${confirmations.length}`} tone="info" />
      </StatGrid>
      <section className={styles.panel} aria-labelledby="launch-checks-title">
        <h2 id="launch-checks-title">Điều kiện bắt đầu</h2>
        <div className={styles.distribution}>
          <ProgressTrack limit={checks.length}
            segments={[{ value: passed, tone: "positive" }, { value: warnings, tone: "warning" }, { value: blocks, tone: "danger" }]}
            label={`${passed} đạt, ${warnings} cảnh báo, ${blocks} đang chặn`} />
          <Legend items={[{ label: "Đạt", tone: "positive" }, { label: "Cảnh báo", tone: "warning" }, { label: "Chặn", tone: "danger" }]} />
        </div>
        <ul className={styles.checkList}>{order.flatMap((level) => checks.filter((check) => check.level === level)).map((check) =>
          <li key={check.code} data-level={check.level}>
            <div><strong>{names[check.department] ?? check.department}</strong><p>{check.message}</p></div>
            <StatusPill tone={tones[check.level]}>{levels[check.level]}</StatusPill>
            {(view.canStart || check.department === "CAMPAIGN" || view.allowedConfirmations.includes(check.department)) &&
              <Link href={check.path}>Mở hồ sơ liên quan <span aria-hidden="true">↗</span></Link>}
          </li>)}</ul>
      </section>
      <section className={styles.panel}>
        <h2>Xác nhận của bộ phận</h2>
        <div className={styles.departments}>{confirmations.map((section) => {
          const name = names[section.section] ?? section.section;
          const blocked = checks.some((check) => check.department === section.section && check.level === "BLOCK");
          return <article key={section.section}>
            <h3>{name}</h3>
            <StatusPill tone={section.current ? "positive" : "warning"}>
              {section.current ? "Đã xác nhận" : section.confirmedAt ? "Cần xác nhận lại" : "Chờ xác nhận"}
            </StatusPill>
            {view.allowedConfirmations.includes(section.section) && !section.current && <button className="secondary" type="button"
              disabled={busy || loading || blocked} onClick={() => void action(section.section)}>Xác nhận {name.toLowerCase()}</button>}
          </article>;
        })}</div>
      </section>
      {view.canStart && checks.some((check) => check.code === "PUBLICATION" && check.level === "PASS") &&
        <CampaignScheduleChangePanel campaignId={campaignId} reload={() => setRevision((value) => value + 1)} />}
    </>}
  </div>;
}
