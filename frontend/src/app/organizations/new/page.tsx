"use client";
import { Protected } from "@/features/auth/components/AuthProvider";
import OrganizationForm from "@/features/organizations/components/OrganizationForm";
export default function Page() { return <Protected><OrganizationForm /></Protected>; }
