namespace IdentityService.Models;

public sealed class RefreshSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
