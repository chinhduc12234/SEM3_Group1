"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Locale, translateText } from "./translate";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
};
const LocaleContext = createContext<LocaleContextValue>({
  locale: "vi",
  setLocale: () => {},
  t: (text) => text,
});
export function LocaleProvider({
  children,
  initialLocale = "vi",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("giveaid-locale");
    } catch {
      /* Storage can be unavailable in restricted browsers. */
    }
    const hasServerPreference = document.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith("giveaid-locale="));
    if (!hasServerPreference && (saved === "en" || saved === "vi")) {
      setLocaleState(saved);
      try {
        document.cookie = `giveaid-locale=${saved}; Path=/; Max-Age=31536000; SameSite=Lax`;
      } catch {
        /* Keep the local preference for this session. */
      }
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale(next) {
        try {
          document.cookie = `giveaid-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        } catch {
          /* Still update this tab when cookie writes are blocked. */
        }
        try {
          window.localStorage.setItem("giveaid-locale", next);
        } catch {
          /* The cookie remains the server-readable preference. */
        }
        setLocaleState(next);
      },
      t(text) {
        return translateText(text, locale);
      },
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
