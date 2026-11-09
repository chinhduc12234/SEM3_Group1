using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using NotificationService.Contracts;
using NotificationService.Realtime;
using NotificationService.Repositories;
using Shared;

namespace NotificationService.Services;

public sealed class NotificationInbox(NotificationRepository repository, IDataProtectionProvider protection,
    IHubContext<NotificationHub> hub, IOptions<FirebaseOptions> options)
{
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Notification.PushToken.v1");
    public Task<NotificationPage> List(NotificationActor actor, int page, bool unread, CancellationToken ct) => repository.List(actor.UserId, page, unread, ct);
    public Task<int> Unread(NotificationActor actor, CancellationToken ct) => repository.Unread(actor.UserId, ct);
    public async Task Read(NotificationActor actor, Guid id, CancellationToken ct)
    {
        if (!await repository.Read(actor.UserId, id, ct)) throw new ApiException(404, "Không tìm thấy thông báo.");
        await Notify(actor.UserId, ct);
    }
    public async Task ReadAll(NotificationActor actor, DateTimeOffset through, CancellationToken ct)
    {
        if (through == default || through > DateTimeOffset.UtcNow.AddSeconds(5)) throw new ApiException(400, "Mốc thời gian không hợp lệ.");
        await repository.ReadAll(actor.UserId, through, ct);
        await Notify(actor.UserId, ct);
    }
    public Task Subscribe(NotificationActor actor, string token, CancellationToken ct)
    {
        if (!options.Value.Enabled) throw new ApiException(503, "Thông báo đẩy chưa được cấu hình.");
        if (token.Length is < 50 or > 4096 || token.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not ('-' or '_' or ':' or '.')))
            throw new ApiException(400, "Token trình duyệt không hợp lệ.");
        return repository.Subscribe(actor, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))), protector.Protect(token), ct);
    }
    public Task<int> Unsubscribe(NotificationActor actor, CancellationToken ct) => repository.Unsubscribe(actor, ct);
    private async Task Notify(Guid userId, CancellationToken ct)
    {
        // Read state already committed. Catch-up GET also synchronizes tabs if realtime is temporarily down.
        try { await hub.Clients.User(userId.ToString()).SendAsync("notificationsChanged", ct); }
        catch (Exception ex) when (ex is not OperationCanceledException) { }
    }
}
