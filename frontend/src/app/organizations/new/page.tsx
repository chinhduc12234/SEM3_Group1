"use client";
import { Protected } from "@/components/AuthProvider";
import OrganizationForm from "@/components/OrganizationForm";
export default function Page() { return <Protected><OrganizationForm /></Protected>; }
