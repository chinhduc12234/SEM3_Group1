using Microsoft.EntityFrameworkCore;
using NotificationService.Contracts;
using NotificationService.Data;
using NotificationService.Models;
using Shared;

namespace NotificationService.Repositories;

// All queries that expose user data are scoped here. No caller-provided recipient IDs in public APIs.
public sealed class NotificationRepository(NotificationDb db)
{
    public async Task<NotificationPage> List(Guid userId, int page, bool unread, CancellationToken ct)
    {
        var asOf = DateTimeOffset.UtcNow;
        var own = db.Notifications.AsNoTracking().Where(x => x.UserId == userId && x.CreatedAt <= asOf);
        var query = unread ? own.Where(x => x.ReadAt == null) : own;
        return new(await query.CountAsync(ct), await own.CountAsync(x => x.ReadAt == null, ct), page, 20, asOf,
            await query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new NotificationDto(x.Id, x.Kind, x.Title, x.Message, x.Url, x.CreatedAt, x.ReadAt)).ToListAsync(ct));
    }
    public Task<int> Unread(Guid user, CancellationToken ct) => db.Notifications.CountAsync(x => x.UserId == user && x.ReadAt == null, ct);
    public async Task<bool> Read(Guid user, Guid id, CancellationToken ct)
    {
        if (!await db.Notifications.AnyAsync(x => x.UserId == user && x.Id == id, ct)) return false;
        await db.Notifications.Where(x => x.UserId == user && x.Id == id && x.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTimeOffset.UtcNow), ct);
        return true;
    }
    public Task<int> ReadAll(Guid user, DateTimeOffset through, CancellationToken ct) => db.Notifications
        .Where(x => x.UserId == user && x.ReadAt == null && x.CreatedAt <= through)
        .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTimeOffset.UtcNow), ct);
    public Task<int> Unsubscribe(NotificationActor actor, CancellationToken ct) => db.Subscriptions
        .Where(x => x.UserId == actor.UserId && x.SessionId == actor.SessionId && x.IsActive)
        .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, false).SetProperty(x => x.ProtectedToken, ""), ct);

    public async Task Subscribe(NotificationActor actor, string hash, string protectedToken, CancellationToken ct)
    {
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Subscribe");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Đăng ký thiết bị đang bận. Vui lòng thử lại.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var subscription = await db.Subscriptions.SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (subscription is null) { subscription = new PushSubscription { TokenHash = hash }; db.Subscriptions.Add(subscription); }
        subscription.UserId = actor.UserId;
        subscription.SessionId = actor.SessionId;
        subscription.ProtectedToken = protectedToken;
        subscription.IsActive = true;
        subscription.UpdatedAt = DateTimeOffset.UtcNow;
        // Bound device storage per account; browser re-registration rotates ownership atomically.
        var old = await db.Subscriptions.Where(x => x.UserId == actor.UserId && x.Id != subscription.Id && x.IsActive)
            .OrderByDescending(x => x.UpdatedAt).Skip(9).ToListAsync(ct);
        foreach (var item in old) { item.IsActive = false; item.ProtectedToken = ""; }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
