"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/shared/api/api";
import { Workspace } from "@/features/organizations/types/workspace";
import WorkspaceSummary from "@/features/organizations/components/WorkspaceSummary";
import WorkspaceMembers from "@/features/organizations/components/WorkspaceMembers";
import OrganizationLegalChanges from "@/features/organizations/components/OrganizationLegalChanges";
export default function Page(){const {id}=useParams<{id:string}>();const [data,setData]=useState<Workspace|null>(null);const [error,setError]=useState("");useEffect(()=>{api<Workspace>(`/api/organizations/${id}/workspace`).then(setData).catch(ex=>setError(ex.message));},[id]);return <><Link href="/admin/organization-directory">← Danh bạ tổ chức</Link>{data?<><p className="notice">Góc nhìn giám sát của admin. Việc quản lý nhân sự và thông tin vận hành thuộc OWNER của tổ chức.</p><WorkspaceSummary data={data}/><WorkspaceMembers id={id}/><div className="actions"><Link className="button secondary" href={`/admin/organizations/${id}`}>Xem hồ sơ đăng ký và giấy tờ</Link></div><OrganizationLegalChanges id={id} canReview/></>:error?<p className="notice error">{error}</p>:<p>Đang tải tổ chức…</p>}</>;}
