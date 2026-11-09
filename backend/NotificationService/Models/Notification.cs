namespace NotificationService.Models;

public sealed class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EventId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Url { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset? BroadcastAt { get; set; }
}

public sealed class ReceivedEvent
{
    public Guid Id { get; set; }
    public string PayloadHash { get; set; } = "";
    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid SessionId { get; set; }
    public string TokenHash { get; set; } = "";
    public string ProtectedToken { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class PushDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid NotificationId { get; set; }
    public Notification Notification { get; set; } = null!;
    public Guid SubscriptionId { get; set; }
    public PushSubscription Subscription { get; set; } = null!;
    // Capture ownership at event time. A shared browser switching accounts must not receive old work.
    public Guid UserId { get; set; }
    public Guid SessionId { get; set; }
    public string State { get; set; } = "PENDING";
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SentAt { get; set; }
    public string? LastErrorCode { get; set; }
}
