import type { ReactNode } from "react";
import { Header, Footer } from "./SiteChrome";

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ga-site ga-user">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
