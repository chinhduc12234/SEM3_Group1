using System.Text;
using CampaignService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CampaignService.Services;

public sealed class AssignmentNotificationWorker(IServiceScopeFactory scopes, IHttpClientFactory clients,
    ILogger<AssignmentNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { if (await Deliver(ct)) continue; }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Campaign notifications unavailable ({ErrorType}).", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(2), ct);
        }
    }

    private async Task<bool> Deliver(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CampaignDb>();
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Campaign.AssignmentNotifications");
        if (!await gate.Acquire(ct)) return false;
        var now = DateTimeOffset.UtcNow;
        var item = await db.AssignmentNotifications.Where(x => x.NextAttemptAt <= now)
            .OrderBy(x => x.NextAttemptAt).FirstOrDefaultAsync(ct);
        if (item is null) return false;
        try
        {
            using var body = new StringContent(item.Payload, Encoding.UTF8, "application/json");
            using var response = await clients.CreateClient("notifications").PostAsync("internal/notifications/campaign-assignments", body, ct);
            response.EnsureSuccessStatusCode();
            db.AssignmentNotifications.Remove(item);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            item.Attempts++;
            item.NextAttemptAt = now.AddSeconds(Math.Min(300, 5 * Math.Pow(2, Math.Min(6, item.Attempts - 1))));
            logger.LogWarning("Campaign notification {Id} will retry ({ErrorType}).", item.Id, ex.GetType().Name);
        }
        await db.SaveChangesAsync(ct);
        return true;
    }
}
