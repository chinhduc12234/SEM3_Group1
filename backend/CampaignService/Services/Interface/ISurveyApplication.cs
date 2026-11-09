using CampaignService.Contracts;
using CampaignService.Data;

namespace CampaignService.Services;

public interface ISurveyApplication
{
    Task<object> Dashboard(Guid org, Guid actor, string mode, CancellationToken ct);
    Task<object> List(Guid org, Guid actor, string mode, string? status, int page, CancellationToken ct);
    Task<object> Detail(Guid id, Guid actor, CancellationToken ct);
    Task<Guid> Create(Guid org, SurveyRequest request, Guid actor, CancellationToken ct);
    Task Update(Guid id, SurveyRequest request, Guid actor, CancellationToken ct);
    Task Delete(Guid id, string version, Guid actor, CancellationToken ct);
    Task Submit(Guid id, string version, Guid actor, CancellationToken ct);
    Task Review(Guid id, SurveyReviewRequest request, Guid actor, CancellationToken ct);
    Task Upload(Guid id, string version, List<IFormFile> files, Guid actor, CancellationToken ct);
    Task RemoveImage(Guid id, Guid imageId, string version, Guid actor, CancellationToken ct);
    Task<SurveyReportImage> Image(Guid id, Guid imageId, Guid actor, CancellationToken ct);
    Task<object> Notifications(Guid org, Guid actor, int page, CancellationToken ct);
    Task ReadNotification(Guid notificationId, Guid actor, CancellationToken ct);
}
