"use client";
import languageStyles from "@/shared/i18n/LanguageSwitch.module.css";

import { useLocale } from "./LocaleProvider";

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className={languageStyles.languageSwitch}
      data-ga-language-switch=""
      role="group"
      aria-label={locale === "vi" ? "Chọn ngôn ngữ" : "Choose language"}
    >
      <button
        type="button"
        className={locale === "vi" ? languageStyles.isActive : ""}
        aria-label="Tiếng Việt"
        aria-pressed={locale === "vi"}
        onClick={() => setLocale("vi")}
      >
        VI
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        className={locale === "en" ? languageStyles.isActive : ""}
        aria-label="English"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
