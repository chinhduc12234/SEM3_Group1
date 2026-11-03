using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed class EmailOutboxWorker(IServiceScopeFactory scopes, IOptions<EmailOptions> options, ILogger<EmailOutboxWorker> logger) : BackgroundService
{
    public const int MaxAttempts = 10;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            logger.LogInformation("Email delivery disabled; organization notifications remain queued in SQL.");
            return;
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await ProcessOne(stoppingToken)) continue;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                // No exception message/stack: it may include connection strings or provider payloads.
                logger.LogError("Email worker unavailable ({ErrorType}); retrying shortly.", ex.GetType().Name);
            }
            try { await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    public async Task<bool> ProcessOne(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDb>();
        await db.Database.OpenConnectionAsync(cancellationToken);
        var connection = db.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        // Session-owned SQL lock serializes senders across organization replicas, including rate limiting.
        command.CommandText = "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='GiveAid.EmailJS.Send', @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0; SELECT @r;";
        var acquired = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken)) >= 0;
        if (!acquired) return false;
        var attempted = false;
        try
        {
            var now = DateTimeOffset.UtcNow;
            var item = await db.EmailNotifications.Where(x => x.State == "PENDING" && x.NextAttemptAt <= now &&
                !db.EmailNotifications.Any(earlier => earlier.OrganizationId == x.OrganizationId && earlier.Sequence < x.Sequence && earlier.State == "PENDING"))
                .OrderBy(x => x.Sequence).FirstOrDefaultAsync(cancellationToken);
            if (item is null) return false;
            if (item.Attempts >= MaxAttempts)
            {
                item.State = "FAILED";
                item.LastErrorCode = "ATTEMPTS_EXHAUSTED";
                await db.SaveChangesAsync(cancellationToken);
                return true;
            }
            item.Attempts++;
            item.NextAttemptAt = now.AddMinutes(2); // Recovery after process termination during an HTTP request.
            await db.SaveChangesAsync(cancellationToken);
            attempted = true;
            try
            {
                await scope.ServiceProvider.GetRequiredService<EmailDelivery>().Send(item, cancellationToken);
                item.State = "SENT";
                item.SentAt = DateTimeOffset.UtcNow;
                item.LastErrorCode = null;
                // Success no longer needs the encrypted event snapshot containing names/review text.
                item.ProtectedPayload = "";
                logger.LogInformation("Email notification {NotificationId} accepted by EmailJS ({Action}).", item.Id, item.Action);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                item.LastErrorCode = ex switch
                {
                    EmailDeliveryException failure => failure.Code,
                    OperationCanceledException => "DELIVERY_TIMEOUT",
                    HttpRequestException => "NETWORK_ERROR",
                    System.Security.Cryptography.CryptographicException => "PAYLOAD_DECRYPTION_FAILED",
                    _ => "DELIVERY_ERROR"
                };
                if (ex is EmailDeliveryException { Permanent: true } || item.Attempts >= MaxAttempts) item.State = "FAILED";
                item.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(3600, 30 * Math.Pow(2, item.Attempts - 1)));
                logger.LogWarning("Email notification {NotificationId}: {Code}, attempt {Attempt}, state {State}.",
                    item.Id, item.LastErrorCode, item.Attempts, item.State);
            }
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        finally
        {
            // Even on failure, allow at most one outbound send per 1.2 seconds for this database.
            if (attempted) await Task.Delay(TimeSpan.FromMilliseconds(1200), CancellationToken.None);
            command.CommandText = "EXEC sys.sp_releaseapplock @Resource='GiveAid.EmailJS.Send', @LockOwner='Session';";
            await command.ExecuteNonQueryAsync(CancellationToken.None);
            await db.Database.CloseConnectionAsync();
        }
    }
}
