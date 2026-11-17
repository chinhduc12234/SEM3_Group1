import CampaignManagementScreen from "@/features/campaigns/management/CampaignManagementScreen";

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <CampaignManagementScreen key={campaignId} campaignId={campaignId} />;
}
