using System.Text;
using Microsoft.EntityFrameworkCore;
using Shared;
using VolunteerService.Data;

namespace VolunteerService.Services;

public sealed class VolunteerNotificationOutboxWorker(IServiceScopeFactory scopes, ILogger<VolunteerNotificationOutboxWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { if (await DeliverOne(stoppingToken)) continue; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Volunteer notification outbox unavailable ({ErrorType}).", ex.GetType().Name); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    public async Task<bool> DeliverOne(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<VolunteerDb>();
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Volunteer.NotificationOutbox");
        if (!await gate.Acquire(ct)) return false;
        var now = DateTimeOffset.UtcNow;
        var item = await db.NotificationOutbox.Where(x => x.DeliveredAt == null && x.NextAttemptAt <= now)
            .OrderBy(x => x.NextAttemptAt).FirstOrDefaultAsync(ct);
        if (item is null) return false;

        item.Attempts++;
        item.NextAttemptAt = now.AddSeconds(Math.Min(300, 5 * Math.Pow(2, Math.Min(6, item.Attempts - 1))));
        await db.SaveChangesAsync(ct);
        try
        {
            using var body = new StringContent(item.Payload, Encoding.UTF8, "application/json");
            using var response = await scope.ServiceProvider.GetRequiredService<IHttpClientFactory>()
                .CreateClient("notifications").PostAsync("internal/notifications/volunteer-registration-submitted", body, ct);
            response.EnsureSuccessStatusCode();
            item.DeliveredAt = DateTimeOffset.UtcNow;
            item.LastErrorCode = null;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            item.LastErrorCode = ex is HttpRequestException ? "NETWORK_ERROR" : "DELIVERY_FAILED";
            logger.LogWarning("Volunteer notification {Id} will retry ({ErrorType}), attempt {Attempt}.",
                item.Id, ex.GetType().Name, item.Attempts);
        }
        await db.SaveChangesAsync(ct);
        return true;
    }
}
