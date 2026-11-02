"use client";
import { useParams } from "next/navigation";
import { Protected } from "@/components/AuthProvider";
import OrganizationForm from "@/components/OrganizationForm";
export default function Page() { const id = useParams<{ id: string }>()?.id; return <Protected><OrganizationForm id={id} /></Protected>; }
