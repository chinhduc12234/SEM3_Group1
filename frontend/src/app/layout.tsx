import type { Metadata } from "next";
import "./styles.css";

// Keep project identity at the app shell; feature pages can replace this starter screen.
export const metadata: Metadata = {
  title: "Give-AID",
  description: "Charity and volunteer management system",
};

// The root layout is the shared document shell for all public and dashboard pages.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
