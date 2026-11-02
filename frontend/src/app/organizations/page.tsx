"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { statuses } from "@/lib/organizations";
type Summary = { id: string; legalName: string; status: string; createdAt: string };
function Mine() {
  const [items, setItems] = useState<Summary[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { api<Summary[]>("/api/organizations/mine").then(setItems).catch(ex => setError(ex.message)).finally(() => setLoading(false)); }, []);
  return <><div className="page-title"><div><p className="eyebrow">Hành trình của tổ chức</p><h1>Tổ chức của tôi</h1><p className="muted">Theo dõi hồ sơ, bổ sung giấy tờ và nhận phản hồi xét duyệt.</p></div><Link className="button" href="/organizations/new">+ Đăng ký tổ chức</Link></div>
  {error && <p className="notice error" role="alert">{error}</p>}{loading ? <p>Đang tải hồ sơ…</p> : items.length === 0 ? <div className="empty"><h2>Bắt đầu từ một hồ sơ minh bạch</h2><p>Bạn chưa có hồ sơ tổ chức. Chuẩn bị giấy đăng ký và thông tin người đại diện để bắt đầu.</p><Link href="/organizations/new">Tạo hồ sơ đầu tiên →</Link></div> :
  <div className="cards">{items.map(item => <article className="card" key={item.id}><span className={"badge " + item.status}>{statuses[item.status]}</span><h2>{item.legalName}</h2><p className="muted">Tạo ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p><Link href={"/organizations/" + item.id}>Xem hồ sơ →</Link></article>)}</div>}</>;
}
export default function Page() { return <Protected><Mine /></Protected>; }
