"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Account, acceptSession, api, forgetSession, refreshSession } from "@/shared/api/api";
const AuthContext = createContext<{ user: Account | null; loading: boolean; login(email: string, password: string): Promise<Account>; logout(): Promise<void> }>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    refreshSession().then(session => setUser(session?.user ?? null)).catch(() => setUser(null)).finally(() => setLoading(false));
    const expired = () => { forgetSession(); setUser(null); };
    window.addEventListener("giveaid-session-expired", expired);
    return () => window.removeEventListener("giveaid-session-expired", expired);
  }, []);
  async function login(email: string, password: string) {
    const session = await api<{ accessToken: string; user: Account }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    acceptSession(session); setUser(session.user); return session.user;
  }
  async function logout() {
    const execute = async () => { await api("/api/auth/logout", { method: "POST" }); };
    if ("locks" in navigator) await navigator.locks.request("giveaid-refresh", execute);
    else await execute();
    forgetSession(); setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth(); const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  if (loading || !user) return <div className="notice">Đang kiểm tra phiên đăng nhập…</div>;
  if (admin && !user.roles.includes("ADMIN")) return <div className="notice error">Bạn không có quyền truy cập trang quản trị. <Link href="/organizations">Quay lại</Link></div>;
  return <>{children}</>;
}
export function Navigation() {
  const { user, loading, logout } = useAuth(); const router = useRouter();
  const [error, setError] = useState("");
  return <><header className="topbar"><Link className="brand" href="/">Give<span>AID</span><small>Kết nối những điều tốt đẹp</small></Link>
    <nav>{user ? <><Link href="/organizations/mine">Hồ sơ tổ chức</Link>{user.roles.includes("ADMIN") && <Link href="/admin/organizations">Quản trị tổ chức</Link>}
    <Link href="/account">{user.fullName}</Link><button className="quiet" onClick={async () => { try { await logout(); router.push("/"); } catch { setError("Chưa đăng xuất được. Vui lòng thử lại."); } }}>Đăng xuất</button></>
    : !loading && <><Link href="/login">Đăng nhập</Link><Link className="button small" href="/register">Tạo tài khoản</Link></>}</nav></header>
    {error && <div className="notice error" role="alert">{error}<button className="quiet" onClick={() => setError("")}>Đóng</button></div>}</>;
}
