import AccountParticipationScreen from "@/features/account/participation/AccountParticipationScreen";

export default async function AccountParticipationPage({ searchParams }: {
  searchParams: Promise<{ campaignId?: string | string[] }>;
}) {
  const { campaignId } = await searchParams;
  return <AccountParticipationScreen campaignFilter={typeof campaignId === "string" ? campaignId : undefined} />;
}
