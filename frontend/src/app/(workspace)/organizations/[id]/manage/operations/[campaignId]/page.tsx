import { redirect } from "next/navigation";
import OperationsPage from "../page";

export default async function OperationsDetailPage({ params, searchParams }: {
  params: Promise<{ id: string; campaignId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  if (tab === "volunteers") {
    const { id, campaignId } = await params;
    redirect(`/organizations/${encodeURIComponent(id)}/manage/volunteers/${encodeURIComponent(campaignId)}`);
  }
  return <OperationsPage />;
}
