"use client";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useParams } from "next/navigation";
import Link from "next/link";
import OrganizationLegalChanges from "@/features/organizations/legal/OrganizationLegalChanges";
export default function OrganizationLegalReviewScreen() {
  const { id, changeId } = useParams<{ id: string; changeId: string }>();
  return (
    <LocalizedTree>
      <>
        <Link href="/admin/organization-directory">← Danh bạ tổ chức</Link>
        <h1>Xét duyệt thay đổi pháp lý</h1>
        <OrganizationLegalChanges id={id} canReview initialChangeId={changeId} />
      </>
    </LocalizedTree>
  );
}
