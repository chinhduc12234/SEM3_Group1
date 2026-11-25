namespace Shared;

public sealed record LaunchGroup(Guid Id, string Name, int Minimum);
public sealed record LaunchRoster(string Revision, Dictionary<Guid, int> Confirmed);
public sealed record HoldLaunchRoster(string Revision, Guid Token);
public sealed record LaunchGoodsTarget(Guid BudgetItemId, decimal ReceivedQuantity, decimal TargetQuantity);
public sealed record LaunchGoodsSnapshot(string Revision, LaunchGoodsTarget[] InKindTargets);
public sealed record HoldLaunchGoods(string Revision, Guid Token);
public sealed record LaunchConfirmation(string Section, Guid UserId, string Stamp, DateTimeOffset ConfirmedAt);
public sealed record CampaignStarted(Guid CampaignId, Guid SubmissionId, Guid StartedBy, DateTimeOffset StartedAt);
public sealed record LaunchContext(Guid CampaignId, Guid OrganizationId, string Title, string Status, string Version,
    Guid? SubmissionId, DateOnly? FirstDay, DateOnly? LastDay, string Timezone, bool HasLocation, bool HasActiveLeads, bool HasPendingChange,
    LaunchGroup[] Groups, decimal MinimumFunds, decimal VerifiedFunds, bool HasGoodsIntake, bool HasGoodsReceiver,
    string[] AllowedConfirmations, bool CanStart, LaunchConfirmation[] Confirmations, CampaignStarted? Started);
public sealed record LaunchConfirmCommand(Guid UserId, string Version, Guid SubmissionId, string Section, string Stamp);
public sealed record LaunchStartCommand(Guid UserId, string Version, Guid SubmissionId, string OperationsStamp,
    string FinanceStamp, string Evidence);
