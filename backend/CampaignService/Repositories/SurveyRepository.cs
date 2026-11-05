using CampaignService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CampaignService.Repositories;

public sealed class SurveyRepository(CampaignDb db)
{
    public IQueryable<SurveyReport> Query => db.Set<SurveyReport>().Where(x => !x.IsDeleted);
    public IQueryable<SurveyNotification> Notifications => db.Set<SurveyNotification>();
    public Task<SurveyReport?> Find(Guid id, CancellationToken ct) => Query.SingleOrDefaultAsync(x => x.Id == id, ct);
    public void Add(SurveyReport report) => db.Add(report);
    public void Notify(SurveyNotification notification) => db.Add(notification);
    public void RemoveImage(SurveyReportImage image) => db.Remove(image);
    public IQueryable<SurveyReportImage> Images => db.Set<SurveyReportImage>();
    public IQueryable<SurveyReportEvent> Events => db.Set<SurveyReportEvent>();
    public async Task Save(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "Báo cáo vừa được cập nhật. Vui lòng tải lại."); }
    }
}
