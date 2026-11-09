import type { Metadata } from "next";
import "./styles.css";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import SiteFrame from "@/shared/components/SiteFrame";
import NotificationProvider from "@/features/notifications/components/NotificationProvider";
import "./notifications.css";
import "./giveaid.css";
import "./slideshow.css";
import "./info-pages.css";
import { LocaleProvider } from "@/shared/i18n/LocaleProvider";

// Keep project identity at the app shell; feature pages can replace this starter screen.
export const metadata: Metadata = {
  title: "Give-AID",
  description: "Give-AID kết nối những tấm lòng với các hoạt động vì cộng đồng.",
  icons: {
    icon: "/giveaid-favicon.png",
  },
};

// The root layout is the shared document shell for all public and dashboard pages.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><LocaleProvider><AuthProvider><NotificationProvider><SiteFrame>{children}</SiteFrame></NotificationProvider></AuthProvider></LocaleProvider></body>
    </html>
  );
}
