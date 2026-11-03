"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import OrganizationLegalChanges from "@/components/OrganizationLegalChanges";
export default function Page(){const {id,changeId}=useParams<{id:string;changeId:string}>();return <><Link href="/admin/organization-directory">← Danh bạ tổ chức</Link><h1>Xét duyệt thay đổi pháp lý</h1><OrganizationLegalChanges id={id} canReview initialChangeId={changeId}/></>;}
