using System.Text;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class NotificationEventWorker(IServiceScopeFactory scopes, IConfiguration config, ILogger<NotificationEventWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue<bool>("Notifications:Enabled")) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try { if (await ProcessOne(stoppingToken)) continue; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Notification event worker unavailable ({ErrorType}).", ex.GetType().Name); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
    public async Task<bool> ProcessOne(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDb>();
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Organization.NotificationEvents");
        if (!await gate.Acquire(ct)) return false;
        var now = DateTimeOffset.UtcNow;
        var item = await db.NotificationEvents.Where(x => x.DeliveredAt == null && x.NextAttemptAt <= now &&
            !db.NotificationEvents.Any(e => e.OrganizationId == x.OrganizationId && e.Sequence < x.Sequence && e.DeliveredAt == null))
            .OrderBy(x => x.Sequence).FirstOrDefaultAsync(ct);
        if (item is null) return false;
        item.Attempts++;
        item.NextAttemptAt = now.AddMinutes(2);
        await db.SaveChangesAsync(ct);
        try
        {
            using var body = new StringContent(item.Payload, Encoding.UTF8, "application/json");
            using var response = await scope.ServiceProvider.GetRequiredService<IHttpClientFactory>().CreateClient("notifications")
                .PostAsync("internal/notifications/organization-events", body, ct);
            if (response.IsSuccessStatusCode)
            { item.DeliveredAt = DateTimeOffset.UtcNow; item.LastErrorCode = null; item.Payload = ""; }
            else item.LastErrorCode = "HTTP_" + (int)response.StatusCode;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { item.LastErrorCode = ex is OperationCanceledException ? "TIMEOUT" : "NETWORK_ERROR"; }
        if (item.DeliveredAt is null)
        {
            // Keep durable work until accepted. Persistent failures remain visible for operators.
            item.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(300, 5 * Math.Pow(2, Math.Min(6, item.Attempts - 1))));
            logger.LogWarning("Notification event {Id}: {Code}, attempt {Attempt}.", item.Id, item.LastErrorCode, item.Attempts);
        }
        await db.SaveChangesAsync(ct);
        return true;
    }
}
