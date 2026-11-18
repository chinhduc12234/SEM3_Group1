import { useEffect, useRef, useState } from "react";
import { api, apiBlob } from "@/shared/api/api";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "./ActivityPhotoReports.module.css";

type Report = {
  id: string; activityId: string; activityTitle: string; dayTitle: string;
  dayDate: string | null; sender: string; note: string; sentAt: string;
};

export function useActivityPhotoReports(campaignId: string, enabled = true) {
  const [reports, setReports] = useState<Report[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api<Report[]>(`/api/campaigns/${campaignId}/operations/photo-reports`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setReports(result);
      }).catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [campaignId, enabled, attempt]);
  return { reports, error, reload: () => { setError(""); setAttempt((value) => value + 1); },
    add: (report: Report) => setReports((current) => [report, ...(current ?? []).filter((item) => item.id !== report.id)]) };
}

function usePreview(file: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => { URL.revokeObjectURL(nextUrl); setUrl(""); };
  }, [file]);
  return url;
}

function ReportImage({ campaignId, reportId }: { campaignId: string; reportId: string }) {
  const [image, setImage] = useState<Blob | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const url = usePreview(image);
  async function openImage() {
    setState("loading");
    try {
      setImage(await apiBlob(`/api/campaigns/${campaignId}/media/${reportId}`));
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return url ? <a href={url} target="_blank" rel="noreferrer">
    <img className={styles.preview} src={url} alt="Ảnh báo cáo hoạt động" />
  </a> : <button type="button" className="secondary" disabled={state === "loading"} onClick={() => void openImage()}>
    {state === "loading" ? "Đang tải ảnh…" : state === "error" ? "Tải lại ảnh" : "Xem ảnh báo cáo"}
  </button>;
}

export function ActivityPhotoReportList({ campaignId, reports, showActivity }: {
  campaignId: string; reports: Report[]; showActivity?: boolean;
}) {
  return reports.length > 0 && <ul className={styles.history}>
    {reports.map((report) => <li key={report.id}>
      {showActivity && <strong>{report.activityTitle || "Hoạt động"}</strong>}
      {showActivity && <p>{[formatCampaignDate(report.dayDate), report.dayTitle].filter(Boolean).join(" · ")}</p>}
      <p>{report.sender} · <time dateTime={report.sentAt}>{new Date(report.sentAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time></p>
      {report.note && <p>{report.note}</p>}
      <ReportImage campaignId={campaignId} reportId={report.id} />
    </li>)}
  </ul>;
}

export function ActivityPhotoComposer({ campaignId, activityId, onSent, expanded }: {
  campaignId: string; activityId: string; onSent: (report: Report) => void; expanded: boolean;
}) {
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "loading" | "on">("off");
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reportId, setReportId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const preview = usePreview(file);

  useEffect(() => () => {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (camera === "on" && video.current) video.current.srcObject = stream.current;
  }, [camera]);
  useEffect(() => {
    if (!expanded) closeCamera();
  }, [expanded]);

  function closeCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera("off");
    setReady(false);
  }

  async function openCamera() {
    setError("");
    setMessage("");
    setCamera("loading");
    const request = ++cameraRequest.current;
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (request !== cameraRequest.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = next;
      setCamera("on");
    } catch {
      if (request !== cameraRequest.current) return;
      setError("Không mở được camera. Bạn có thể chọn ảnh có sẵn.");
      closeCamera();
    }
  }

  function choose(next: File) {
    setError("");
    setMessage("");
    if (!["image/png", "image/jpeg"].includes(next.type) || next.size > 5 * 1024 * 1024) {
      setError("Chọn ảnh JPG hoặc PNG có dung lượng tối đa 5 MB.");
      return;
    }
    closeCamera();
    setFile(next);
    setReportId(crypto.randomUUID());
  }

  function capture() {
    const source = video.current;
    if (!source?.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight));
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) choose(new File([blob], "anh-hoat-dong.jpg", { type: "image/jpeg" }));
      else setError("Không chụp được ảnh. Vui lòng thử lại.");
    }, "image/jpeg", 0.88);
  }

  async function send() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("note", note);
    body.set("reportId", reportId);
    try {
      onSent(await api<Report>(`/api/campaigns/${campaignId}/operations/activities/${activityId}/photo-reports`, { method: "POST", body }));
      setFile(null);
      setNote("");
      setMessage("Đã gửi báo cáo ảnh cho Owner.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.composer}>
    <div className={styles.actions}>
      {camera === "off" ? <button type="button" className="secondary" disabled={busy} onClick={() => void openCamera()}>Mở camera</button> :
        <button type="button" className="secondary" onClick={closeCamera}>Đóng camera</button>}
      <label className={styles.file}>Chọn ảnh JPG / PNG
        <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(event) => {
          if (event.target.files?.[0]) choose(event.target.files[0]);
          event.target.value = "";
        }} />
      </label>
    </div>
    {camera === "loading" && <p role="status">Đang mở camera…</p>}
    {camera === "on" && <div className={styles.capture}>
      <video ref={video} autoPlay muted playsInline onPlaying={() => setReady(true)} aria-label="Xem trước camera" />
      <button type="button" className="secondary" disabled={!ready} onClick={capture}>Chụp ảnh</button>
    </div>}
    {file && <>
      {preview && <img className={styles.preview} src={preview} alt="Ảnh sẽ gửi cho Owner" />}
      <label>Ghi chú báo cáo (không bắt buộc)
        <textarea rows={2} maxLength={500} disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className={styles.actions}>
        <button type="button" disabled={busy || camera !== "off"} onClick={() => void send()}>
          {busy ? "Đang gửi báo cáo…" : "Gửi ảnh cho Owner"}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setFile(null)}>Bỏ ảnh đã chọn</button>
      </div>
    </>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
  </div>;
}

export function ActivityPhotoSection({ campaignId, activityId, saved, reports, error, reload, onSent }: {
  campaignId: string; activityId: string; saved: boolean; reports: Report[];
  error: string; reload: () => void; onSent: (report: Report) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return <details className={styles.section} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>Báo cáo ảnh {reports.length > 0 && `(${reports.length})`}</summary>
    {error && <p role="alert">{error} <button type="button" className="quiet" onClick={reload}>Tải lại</button></p>}
    {saved ? <ActivityPhotoComposer campaignId={campaignId} activityId={activityId} onSent={onSent} expanded={expanded} /> :
      <p className="muted">Lưu bản nháp vận hành để gửi ảnh cho hoạt động này.</p>}
    <ActivityPhotoReportList campaignId={campaignId} reports={reports} />
  </details>;
}
