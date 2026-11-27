import { redirect } from "next/navigation";
import AccountHistoryScreen from "@/features/account/participation/AccountHistoryScreen";

export default async function AccountHistoryPage({ searchParams }: {
  searchParams: Promise<{ campaignId?: string | string[]; registration?: string | string[]; removal?: string | string[] }>;
}) {
  const { campaignId, registration, removal } = await searchParams;
  if (typeof registration === "string") redirect(`/account/participation/${encodeURIComponent(registration)}`);
  if (typeof campaignId === "string") redirect(`/account/participation?${new URLSearchParams({ campaignId })}`);
  return <AccountHistoryScreen removalId={typeof removal === "string" && /^[a-f0-9-]{36}$/i.test(removal) ? removal : undefined} />;
}
