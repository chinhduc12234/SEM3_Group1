using CampaignService.Contracts;
using CampaignService.Data;

namespace CampaignService.Services;

public interface ICampaignApplication
{
    Task<CampaignView> Create(CampaignRequest r, Guid actor, CancellationToken ct);
    Task<CampaignView> Update(Guid id, CampaignRequest r, Guid actor, CancellationToken ct);
    Task Delete(Guid id, string version, Guid actor, CancellationToken ct);
    Task<CampaignView> Submit(Guid id, string version, Guid actor, CancellationToken ct);
    Task<CampaignView> Review(Guid id, ReviewRequest r, Guid actor, CancellationToken ct);
    Task<CampaignView> SubmitFinal(Guid id, VersionRequest request, Guid actor, CancellationToken ct);
    Task<CampaignView> ReviewFinal(Guid id, FinalReviewRequest request, Guid actor, CancellationToken ct);
    Task<CampaignView> Publish(Guid id, VersionRequest request, Guid actor, CancellationToken ct);
    Task<CampaignMember[]> AssignmentCandidates(Guid id, Guid actor, CancellationToken ct);
    Task<CampaignView> Assign(Guid id, CampaignAssignmentRequest request, Guid actor, CancellationToken ct);
    Task<OperationsView> Operations(Guid id, Guid actor, CancellationToken ct);
    Task<ActivityPhotoReport[]> ActivityPhotoReports(Guid id, Guid actor, CancellationToken ct);
    Task<ActivityPhotoReport> SendActivityPhoto(Guid id, Guid activityId, Guid reportId, string? note, IFormFile file, Guid actor, CancellationToken ct);
    Task<OperationsView> SaveOperations(Guid id, CampaignOperationsRequest request, Guid actor, CancellationToken ct);
    Task<OperationsView> ApproveOperationsDay(Guid id, Guid dayId, VersionRequest request, Guid actor, CancellationToken ct);
    Task<OperationsView> SaveAttendance(Guid id, Guid activityId, SaveAttendanceRequest request, Guid actor, CancellationToken ct);
    Task<BudgetView> Budget(Guid id, Guid actor, CancellationToken ct);
    Task<BudgetView> SaveBudget(Guid id, SaveBudgetRequest request, Guid actor, CancellationToken ct);
    Task<BudgetView> SaveActualExpense(Guid id, Guid expenseId, SaveActualExpenseRequest request, Guid actor, CancellationToken ct);
    Task<object> RelatedCampaigns(Guid id, Guid actor, CancellationToken ct);
    Task<object> List(Guid? org, Guid? actor, int page, string? search, string? cause, CancellationToken ct, int pageSize = 20, string? status = null, bool assigned = false, string? assignedRole = null, string? campaignType = null);
    Task<object> ParentOptions(Guid organizationId, Guid actor, CancellationToken ct);
    Task<CampaignView> Detail(Guid id, Guid? actor, bool management, CancellationToken ct);
    Task<CampaignView> Upload(Guid id, string version, string kind, IFormFile file, Guid actor, CancellationToken ct, Guid? replaceId = null);
    Task<CampaignMedia> Download(Guid id, Guid mediaId, Guid? actor, CancellationToken ct);
}
