namespace OrganizationService.Data;

public sealed class NotificationEvent
{
    public Guid Id { get; set; }
    public long Sequence { get; set; }
    public Guid OrganizationId { get; set; }
    public string Payload { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeliveredAt { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public string? LastErrorCode { get; set; }
}
