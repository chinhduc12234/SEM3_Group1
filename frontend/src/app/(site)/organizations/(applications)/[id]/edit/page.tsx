"use client";
import { useParams } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import OrganizationForm from "@/features/organizations/applications/OrganizationForm";
export default function Page() {
  const id = useParams<{ id: string }>()?.id;
  return (
    <Protected>
      <OrganizationForm id={id} />
    </Protected>
  );
}
