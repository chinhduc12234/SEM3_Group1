namespace CampaignService.Contracts;

public sealed record AssignedFieldWork(AssignedCampaign[] Items, int TotalCount, int Page, int PageSize);
public sealed record AssignedCampaign(Guid Id, string Title, AssignedShift[] Shifts, bool CanReceiveGoods);
public sealed record AssignedShift(DateOnly? Date, Guid ActivityId, string Activity, TimeOnly? Start, TimeOnly? End,
    string Location, string Team, Guid? TeamLeadId, AssignedTaskGroup[] Groups);
public sealed record AssignedTaskGroup(Guid Id, string Name, int Target);
