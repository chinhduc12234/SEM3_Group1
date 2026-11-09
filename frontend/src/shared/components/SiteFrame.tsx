"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header, Footer } from "@/shared/components/SiteChrome";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
export default function SiteFrame({ children }: { children: ReactNode }) {
 const path = usePathname();
 if (/^\/organizations\/[^/]+\/manage(?:\/|$)/.test(path)) return <div className="ga-site ga-user"><LocalizedTree>{children}</LocalizedTree></div>;
 if (path.startsWith("/admin")) return <div className="ga-site">{children}</div>;
 const dashboard = path.startsWith("/organizations/") || path.startsWith("/admin") || path === "/account" || path === "/notifications";
 return <div className="ga-site ga-user"><Header/>{dashboard ? <main className="container ga-dashboard"><LocalizedTree>{children}</LocalizedTree></main> : <LocalizedTree>{children}</LocalizedTree>}<Footer/></div>;
}
