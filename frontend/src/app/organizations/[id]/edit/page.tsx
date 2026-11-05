"use client";
import { useParams } from "next/navigation";
import { Protected } from "@/features/auth/components/AuthProvider";
import OrganizationForm from "@/features/organizations/components/OrganizationForm";
export default function Page() { const id = useParams<{ id: string }>()?.id; return <Protected><OrganizationForm id={id} /></Protected>; }
