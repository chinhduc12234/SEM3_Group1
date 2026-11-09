using CampaignService.Data;

namespace CampaignService.Repositories;

public interface ISurveyRepository
{
    IQueryable<SurveyReport> Query { get; }
    IQueryable<SurveyNotification> Notifications { get; }
    Task<SurveyReport?> Find(Guid id, CancellationToken ct);
    void Add(SurveyReport report);
    void Notify(SurveyNotification notification);
    Task RemoveNotifications(Guid reportId, Guid recipientId, string messagePrefix, CancellationToken ct);
    void RemoveImage(SurveyReportImage image);
    IQueryable<SurveyReportImage> Images { get; }
    IQueryable<SurveyReportEvent> Events { get; }
    Task Save(CancellationToken ct);
}
