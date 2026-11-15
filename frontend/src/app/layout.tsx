import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./styles.css";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import SiteFrame from "@/shared/components/SiteFrame";
import NotificationProvider from "@/features/notifications/components/NotificationProvider";
import "./notifications.css";
import "./giveaid.css";
import "./slideshow.css";
import "./info-pages.css";
import "./design-polish.css";
import { LocaleProvider } from "@/shared/i18n/LocaleProvider";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const isEnglish = cookieStore.get("giveaid-locale")?.value === "en";
  return {
  title: "Give-AID",
  description: isEnglish
    ? "Give-AID connects caring people with community organizations and causes."
    : "Give-AID kết nối những tấm lòng với các tổ chức và hoạt động vì cộng đồng.",
  openGraph: {
    title: "Give-AID",
    description: isEnglish
      ? "Discover community campaigns, organizations, and ways to get involved."
      : "Khám phá chiến dịch cộng đồng, tổ chức và những cách cùng chung tay.",
  },
  icons: {
    icon: "/giveaid-favicon.png",
  },
  };
}

// The root layout is the shared document shell for all public and dashboard pages.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get("giveaid-locale")?.value === "en" ? "en" : "vi";
  return (
    <html lang={initialLocale}>
      <body><LocaleProvider initialLocale={initialLocale}><AuthProvider><NotificationProvider><SiteFrame>{children}</SiteFrame></NotificationProvider></AuthProvider></LocaleProvider></body>
    </html>
  );
}
