namespace IdentityService.Models;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "Customer";
    public bool IsActive { get; set; } = true;
    public int FailedAttempts { get; set; }
    public DateTimeOffset? LockoutUntil { get; set; }
    public int TokenVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] RowVersion { get; set; } = [];
}
