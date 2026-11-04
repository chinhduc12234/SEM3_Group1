using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class EmailNotificationService(OrganizationDb db)
{
    public async Task<object> List(int page,
        string state, Guid? organizationId = null)
    {
        var query = db.EmailNotifications.AsNoTracking();
        if (state != "") query = query.Where(x => x.State == state);
        if (organizationId.HasValue) query = query.Where(x => x.OrganizationId == organizationId);
        return new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.Sequence).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.OrganizationId, x.EventId, x.Action, x.State, x.Attempts, x.CreatedAt, x.NextAttemptAt, x.SentAt, x.LastErrorCode }).ToListAsync() };
    }

    public async Task Retry(Guid id)
    {
        var changed = await db.EmailNotifications.Where(x => x.Id == id && x.State == "FAILED")
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.State, "PENDING").SetProperty(x => x.Attempts, 0)
                .SetProperty(x => x.NextAttemptAt, DateTimeOffset.UtcNow).SetProperty(x => x.LastErrorCode, (string?)null));
        if (changed == 0) throw new ApiException(409, "Chỉ có thể gửi lại thông báo đã thất bại.");
    }

}
