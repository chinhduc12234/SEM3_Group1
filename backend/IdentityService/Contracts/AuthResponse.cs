namespace IdentityService.Contracts;

public sealed record AccountInfo(Guid Id, string? Email, string FullName, IList<string> Roles);
public sealed record AuthResponse(string AccessToken, int ExpiresIn, AccountInfo User);
public sealed record SessionCredentials(string RefreshToken, DateTimeOffset ExpiresAt, AuthResponse Response);
