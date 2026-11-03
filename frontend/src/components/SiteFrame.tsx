"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header, Footer } from "./SiteChrome";
export default function SiteFrame({ children }: { children: ReactNode }) {
 const path = usePathname();
 if (/^\/organizations\/[^/]+\/manage(?:\/|$)/.test(path)) return <div className="ga-site">{children}</div>;
 if (path.startsWith("/admin")) return <div className="ga-site">{children}</div>;
 const dashboard = path.startsWith("/organizations/") || path.startsWith("/admin") || path === "/account";
 return <div className="ga-site"><Header/>{dashboard ? <main className="container ga-dashboard">{children}</main> : children}<Footer/></div>;
}
