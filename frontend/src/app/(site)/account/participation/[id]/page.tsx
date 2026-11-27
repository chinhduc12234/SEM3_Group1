import AccountRegistrationDetailScreen from "@/features/account/participation/AccountRegistrationDetailScreen";

export default async function AccountRegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountRegistrationDetailScreen key={id} registrationId={id} />;
}
