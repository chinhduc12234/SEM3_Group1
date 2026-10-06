using System.ComponentModel.DataAnnotations;

namespace IdentityService.DTOs;

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(100, MinimumLength = 2)] string DisplayName,
    [Required, StringLength(128, MinimumLength = 10), RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$", ErrorMessage = "Mật khẩu cần chữ hoa, chữ thường, số và ký tự đặc biệt.")] string Password);
public sealed record LoginRequest([Required, EmailAddress, StringLength(254)] string Email, [Required, StringLength(128)] string Password);
public sealed record UserDto(Guid Id, string Email, string DisplayName, string Role, bool IsActive, DateTimeOffset CreatedAt);
public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
public sealed record UpdateUserRequest([Required, RegularExpression("^(Admin|Customer)$")] string Role, bool IsActive);
