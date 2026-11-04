using System.ComponentModel.DataAnnotations;

namespace IdentityService.Contracts;

public sealed record RegisterRequest([Required, EmailAddress, MaxLength(256)] string Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password, [Required, StringLength(200, MinimumLength = 2)] string FullName);
public sealed record LoginRequest([Required, EmailAddress, MaxLength(256)] string Email, [Required, MaxLength(128)] string Password);
public sealed record PasswordRequest([Required, MaxLength(128)] string CurrentPassword, [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
