"use client";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function JoinButton({ className, children }: { className: string; children: React.ReactNode }) {
 const { user, loading } = useAuth();
 const href = loading ? "/cach-tham-gia" : user ? "/organizations/new" : "/register";
 return <Link className={className} href={href} aria-disabled={loading}>{children}</Link>;
}
