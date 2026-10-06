using IdentityService.DTOs;
using IdentityService.Models;
using IdentityService.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace IdentityService.Services;

public sealed class AuthService(IUserRepository users, ISessionRepository sessions, IPasswordHasher<User> hasher, TokenService tokens)
{
    public async Task<UserDto> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await users.ByEmail(email) is not null) throw new ApiException(409, "Email đã được sử dụng.");
        var user = new User { Email = email, DisplayName = request.DisplayName.Trim() };
        if (user.DisplayName.Length < 2) throw new ApiException(400, "Tên hiển thị cần ít nhất 2 ký tự.");
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        users.Add(user);
        try { await users.Save(); }
        catch (DbUpdateException) { throw new ApiException(409, "Không thể tạo tài khoản với email này."); }
        return TokenService.ToDto(user);
    }

    public async Task<(AuthResponse Response, string Refresh)> Login(LoginRequest request)
    {
        var user = await users.ByEmail(request.Email.Trim().ToLowerInvariant());
        if (user is null || !user.IsActive || user.LockoutUntil > DateTimeOffset.UtcNow)
            throw new ApiException(401, "Thông tin đăng nhập không hợp lệ hoặc tài khoản tạm khóa.");
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            user.FailedAttempts++;
            if (user.FailedAttempts >= 5) { user.LockoutUntil = DateTimeOffset.UtcNow.AddMinutes(15); user.FailedAttempts = 0; }
            await SaveSession();
            throw new ApiException(401, "Thông tin đăng nhập không hợp lệ hoặc tài khoản tạm khóa.");
        }
        if (result == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, request.Password);
        user.FailedAttempts = 0;
        user.LockoutUntil = null;
        return await CreateSession(user);
    }

    public async Task<(AuthResponse Response, string Refresh)> Refresh(string? refresh)
    {
        var session = await sessions.Find(TokenService.Hash(refresh ?? ""));
        if (session is null || session.Revoked || session.ExpiresAt <= DateTimeOffset.UtcNow || !session.User.IsActive)
            throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        session.Revoked = true;
        return await CreateSession(session.User);
    }

    public async Task Logout(string? refresh)
    {
        var session = await sessions.Find(TokenService.Hash(refresh ?? ""));
        if (session is null) return;
        session.User.TokenVersion++;
        await sessions.RevokeAll(session.UserId);
        await SaveSession();
    }

    private async Task<(AuthResponse, string)> CreateSession(User user)
    {
        var refresh = TokenService.NewRefreshToken();
        sessions.Add(new RefreshSession { UserId = user.Id, TokenHash = TokenService.Hash(refresh), ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) });
        await SaveSession();
        return (tokens.Issue(user), refresh);
    }
    private async Task SaveSession()
    {
        try { await users.Save(); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(401, "Phiên đã thay đổi. Vui lòng đăng nhập lại."); }
    }
}
