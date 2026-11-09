using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Shared;

namespace NotificationService.Contracts;

public readonly record struct NotificationActor(Guid UserId, Guid SessionId)
{
    public static NotificationActor From(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var user) && Guid.TryParse(principal.FindFirstValue("sid"), out var session)
            ? new(user, session) : throw new ApiException(401, "Phiên đăng nhập không hợp lệ.");
}
public sealed record SubscribeRequest([Required, StringLength(4096, MinimumLength = 50)] string Token);
public sealed record ReadAllRequest(DateTimeOffset Through);
public sealed record NotificationDto(Guid Id, string Kind, string Title, string Message, string Url, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);
public sealed record NotificationPage(int TotalCount, int UnreadCount, int Page, int PageSize, DateTimeOffset AsOf, IReadOnlyList<NotificationDto> Items);
