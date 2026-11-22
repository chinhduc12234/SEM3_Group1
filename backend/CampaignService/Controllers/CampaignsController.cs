using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using CampaignService.Contracts;
using CampaignService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CampaignService.Controllers;

[ApiController, Route("api/campaigns")]
public sealed class CampaignsController(ICampaignApplication service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private Guid? OptionalActor => User.Identity?.IsAuthenticated == true ? Actor : null;
    [HttpGet] public Task<object> Public([Range(1, 100000)] int page = 1, [MaxLength(200)] string? search = null, [MaxLength(50)] string? cause = null, CancellationToken ct = default)
        => service.List(null, null, page, search, cause, ct);
    [Authorize, HttpGet("organization/{org:guid}")]
    public Task<object> Organization(Guid org, [Range(1, 100000)] int page = 1,
        [Range(1, 100)] int pageSize = 5, [MaxLength(200)] string? search = null,
        [MaxLength(30)] string? status = null, bool assigned = false, [MaxLength(30)] string? assignedRole = null,
        [RegularExpression("^(CAMPAIGN|EVENT)$")] string? campaignType = null, CancellationToken ct = default)
        => service.List(org, Actor, page, search, null, ct, pageSize, status, assigned, assignedRole, campaignType);
    [Authorize, HttpGet("organization/{org:guid}/parent-options")]
    public Task<object> ParentOptions(Guid org, CancellationToken ct) => service.ParentOptions(org, Actor, ct);
    [HttpGet("{id:guid}")] public Task<CampaignView> Detail(Guid id, CancellationToken ct) => service.Detail(id, OptionalActor, false, ct);
    [Authorize, HttpGet("{id:guid}/manage")] public Task<CampaignView> Manage(Guid id, CancellationToken ct) => service.Detail(id, Actor, true, ct);
    [Authorize, HttpGet("{id:guid}/related")] public Task<object> Related(Guid id, CancellationToken ct) => service.RelatedCampaigns(id, Actor, ct);
    [Authorize, HttpPost] public async Task<IActionResult> Create(CampaignRequest request, CancellationToken ct)
    { var result = await service.Create(request, Actor, ct); return Created($"/api/campaigns/{result.Id}/manage", result); }
    [Authorize, HttpPut("{id:guid}")] public Task<CampaignView> Update(Guid id, CampaignRequest request, CancellationToken ct) => service.Update(id, request, Actor, ct);
    [Authorize, HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, VersionRequest request, CancellationToken ct)
    { await service.Delete(id, request.Version, Actor, ct); return NoContent(); }
    [Authorize, HttpPost("{id:guid}/submit")] public Task<CampaignView> Submit(Guid id, VersionRequest request, CancellationToken ct) => service.Submit(id, request.Version, Actor, ct);
    [Authorize, HttpPost("{id:guid}/review")] public Task<CampaignView> Review(Guid id, ReviewRequest request, CancellationToken ct) => service.Review(id, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/final/submit")]
    public Task<CampaignView> SubmitFinal(Guid id, VersionRequest request, CancellationToken ct) => service.SubmitFinal(id, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/final/review")]
    public Task<CampaignView> ReviewFinal(Guid id, FinalReviewRequest request, CancellationToken ct) => service.ReviewFinal(id, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/publish")]
    public Task<CampaignView> Publish(Guid id, VersionRequest request, CancellationToken ct) => service.Publish(id, request, Actor, ct);
    [Authorize, HttpGet("{id:guid}/assignment-candidates")]
    public Task<CampaignMember[]> AssignmentCandidates(Guid id, CancellationToken ct) => service.AssignmentCandidates(id, Actor, ct);
    [Authorize, HttpPut("{id:guid}/assignments")]
    public Task<CampaignView> Assign(Guid id, CampaignAssignmentRequest request, CancellationToken ct) => service.Assign(id, request, Actor, ct);
    [Authorize, HttpGet("{id:guid}/operations")]
    public Task<OperationsView> Operations(Guid id, CancellationToken ct) => service.Operations(id, Actor, ct);
    [HttpGet("{id:guid}/volunteer-openings")]
    public Task<CampaignVolunteerOpenings> VolunteerOpenings(Guid id, CancellationToken ct) => service.VolunteerOpenings(id, ct);
    [Authorize, HttpGet("{id:guid}/operations/photo-reports")]
    public Task<ActivityPhotoReport[]> ActivityPhotoReports(Guid id, CancellationToken ct) => service.ActivityPhotoReports(id, Actor, ct);
    [Authorize, HttpPost("{id:guid}/operations/activities/{activityId:guid}/photo-reports"), RequestSizeLimit(5600000)]
    public Task<ActivityPhotoReport> SendActivityPhoto(Guid id, Guid activityId, [FromForm] Guid reportId,
        [FromForm] string? note, IFormFile file, CancellationToken ct) => service.SendActivityPhoto(id, activityId, reportId, note, file, Actor, ct);
    [Authorize, HttpPut("{id:guid}/operations")]
    public Task<OperationsView> SaveOperations(Guid id, CampaignOperationsRequest request, CancellationToken ct) => service.SaveOperations(id, request, Actor, ct);
    [Authorize, HttpPut("{id:guid}/operations/activities/{activityId:guid}/attendance")]
    public Task<OperationsView> SaveAttendance(Guid id, Guid activityId, SaveAttendanceRequest request, CancellationToken ct) =>
        service.SaveAttendance(id, activityId, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/operations/extra-days/{dayId:guid}/approve")]
    public Task<OperationsView> ApproveOperationsDay(Guid id, Guid dayId, VersionRequest request, CancellationToken ct) =>
        service.ApproveOperationsDay(id, dayId, request, Actor, ct);
    [Authorize, HttpGet("{id:guid}/budget")]
    public Task<BudgetView> Budget(Guid id, CancellationToken ct) => service.Budget(id, Actor, ct);
    [Authorize, HttpPut("{id:guid}/budget")]
    public Task<BudgetView> SaveBudget(Guid id, SaveBudgetRequest request, CancellationToken ct) => service.SaveBudget(id, request, Actor, ct);
    [Authorize, HttpPut("{id:guid}/budget/expenses/{expenseId:guid}/actual")]
    public Task<BudgetView> SaveActualExpense(Guid id, Guid expenseId, SaveActualExpenseRequest request, CancellationToken ct) =>
        service.SaveActualExpense(id, expenseId, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/media"), RequestSizeLimit(11000000)]
    public Task<CampaignView> Upload(Guid id, [FromForm] string version, [FromForm] string kind, IFormFile file, CancellationToken ct, [FromForm] Guid? replaceId = null) => service.Upload(id, version, kind, file, Actor, ct, replaceId);
    [HttpGet("{id:guid}/media/{mediaId:guid}")]
    public async Task<IActionResult> Media(Guid id, Guid mediaId, CancellationToken ct)
    {
        var media = await service.Download(id, mediaId, OptionalActor, ct);
        if (media.Kind == "ACTIVITY_REPORT") Response.Headers.CacheControl = "private, no-store";
        Response.Headers.ContentDisposition = media.Kind == "DOCUMENT" ? "attachment" : "inline";
        return File(media.Content, media.ContentType);
    }
}
