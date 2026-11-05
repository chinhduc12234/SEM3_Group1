import type { Metadata } from "next";
import "./styles.css";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import SiteFrame from "@/shared/components/SiteFrame";
import "./giveaid.css";
import "./slideshow.css";

// Keep project identity at the app shell; feature pages can replace this starter screen.
export const metadata: Metadata = {
  title: "Give-AID",
  description: "Charity and volunteer management system",
};

// The root layout is the shared document shell for all public and dashboard pages.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><AuthProvider><SiteFrame>{children}</SiteFrame></AuthProvider></body>
    </html>
  );
}
