"use client";
import { useEffect, useState } from "react";
import { apiBlob } from "@/lib/api";

export default function WorkspaceImage({ id, kind, version }: { id: string; kind: "logo" | "cover"; version: string }) {
  const [source, setSource] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true; let objectUrl = "";
    setSource(""); setError(false);
    apiBlob(`/api/organizations/${id}/workspace/media/${kind}`).then(blob => {
      if (!live) return; objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, kind, version]);
  return source ? <img className={"ow-image ow-" + kind} src={source} alt={kind === "logo" ? "Logo tổ chức" : "Ảnh bìa tổ chức"} /> : <span className="muted">{error ? "Chưa tải được ảnh" : "Đang tải ảnh…"}</span>;
}
