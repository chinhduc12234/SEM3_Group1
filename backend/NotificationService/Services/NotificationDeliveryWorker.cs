using System.Security.Cryptography;
using FirebaseAdmin.Messaging;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotificationService.Data;
using NotificationService.Realtime;
using Shared;

namespace NotificationService.Services;

public sealed class NotificationDeliveryWorker(IServiceScopeFactory scopes, ILogger<NotificationDeliveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { if (await ProcessOne(stoppingToken)) continue; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Notification delivery unavailable ({ErrorType}).", ex.GetType().Name); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
    public async Task<bool> ProcessOne(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<NotificationDb>();
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Deliver");
        if (!await gate.Acquire(ct)) return false;
        var pending = await db.Notifications.Where(x => x.BroadcastAt == null).OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (pending is not null)
        {
            // Only an invalidation event crosses the socket. REST rechecks current session/ownership.
            await scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>().Clients.User(pending.UserId.ToString()).SendAsync("notificationsChanged", ct);
            pending.BroadcastAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return true;
        }
        if (!scope.ServiceProvider.GetRequiredService<IOptions<FirebaseOptions>>().Value.Enabled) return false;
        var now = DateTimeOffset.UtcNow;
        var delivery = await db.Deliveries.Include(x => x.Subscription).Include(x => x.Notification)
            .Where(x => x.State == "PENDING" && x.NextAttemptAt <= now).OrderBy(x => x.NextAttemptAt).FirstOrDefaultAsync(ct);
        if (delivery is null) return false;
        var subscription = delivery.Subscription;
        if (!subscription.IsActive || subscription.UserId != delivery.UserId || subscription.SessionId != delivery.SessionId || delivery.Notification.ReadAt != null)
        { delivery.State = "SKIPPED"; await db.SaveChangesAsync(ct); return true; }
        if (!await scope.ServiceProvider.GetRequiredService<SessionStore>().Exists(delivery.SessionId, delivery.UserId))
        {
            subscription.IsActive = false; subscription.ProtectedToken = "";
            delivery.State = "SKIPPED"; await db.SaveChangesAsync(ct); return true;
        }
        delivery.Attempts++;
        delivery.NextAttemptAt = now.AddMinutes(2);
        await db.SaveChangesAsync(ct);
        try
        {
            var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector("GiveAid.Notification.PushToken.v1");
            await scope.ServiceProvider.GetRequiredService<IPushSender>().Send(protector.Unprotect(subscription.ProtectedToken), delivery.NotificationId, ct);
            delivery.State = "SENT"; delivery.SentAt = DateTimeOffset.UtcNow; delivery.LastErrorCode = null;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            delivery.LastErrorCode = ex is FirebaseMessagingException failure ? failure.MessagingErrorCode?.ToString() ?? "FCM_ERROR" : ex is CryptographicException ? "TOKEN_DECRYPTION_FAILED" : "PROVIDER_UNAVAILABLE";
            if (ex is FirebaseMessagingException { MessagingErrorCode: MessagingErrorCode.Unregistered })
            { subscription.IsActive = false; subscription.ProtectedToken = ""; delivery.State = "SKIPPED"; }
            else if (ex is CryptographicException || delivery.Attempts >= 10) delivery.State = "FAILED";
            delivery.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(3600, 15 * Math.Pow(2, Math.Min(8, delivery.Attempts - 1))));
            logger.LogWarning("Push delivery {Id}: {Code}, attempt {Attempt}.", delivery.Id, delivery.LastErrorCode, delivery.Attempts);
        }
        await db.SaveChangesAsync(ct);
        return true;
    }
}
