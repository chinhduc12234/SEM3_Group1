"use client";

import Link from "next/link";
import { useLocale } from "@/shared/i18n/LocaleProvider";

export default function NotFoundScreen() {
  const { locale } = useLocale();
  const english = locale === "en";
  return (
    <main
      className="container ga-dashboard"
      style={{ minHeight: "55vh", display: "grid", alignContent: "center", gap: 16 }}
    >
      <p className="eyebrow">404 · GIVE-AID</p>
      <h1>{english ? "We couldn't find this page." : "Không tìm thấy trang này."}</h1>
      <p>
        {english
          ? "The link may be outdated, or the page may have moved."
          : "Liên kết có thể đã cũ hoặc trang đã được chuyển."}
      </p>
      <Link className="button" href="/">
        {english ? "Back to home" : "Về trang chủ"}
      </Link>
    </main>
  );
}
