"use client";
import { useEffect, useState } from "react";
import { apiBlob } from "@/shared/api/api";

export default function AccountAvatar({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener("giveaid-profile-avatar-updated", refresh);
    return () => window.removeEventListener("giveaid-profile-avatar-updated", refresh);
  }, []);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    apiBlob(`/api/auth/profile/avatar?v=${version}`).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setUrl(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [userId, version]);
  const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
  return <span className="ga-account-avatar" aria-hidden="true">{url ? <img src={url} alt="" /> : <span>{initials || "U"}</span>}</span>;
}
