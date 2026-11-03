namespace OrganizationService.Data;

public sealed class EmailNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public long Sequence { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid EventId { get; set; }
    public string Action { get; set; } = "";
    public string ProtectedPayload { get; set; } = "";
    public string State { get; set; } = "PENDING";
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SentAt { get; set; }
    public string? LastErrorCode { get; set; }
}
