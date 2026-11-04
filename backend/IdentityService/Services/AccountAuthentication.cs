using IdentityService.Contracts;
using IdentityService.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace IdentityService.Services;

public sealed class AccountAuthentication(UserManager<Account> users, IdentityDb db, TokenIssuer tokens, SessionStore sessions)
{
    public async Task Register(RegisterRequest request)
    {
        var email = request.Email.Trim();
        var name = request.FullName.Trim();
        if (name.Length < 2) throw new ApiException(400, "Họ tên cần ít nhất 2 ký tự.");
        var account = new Account { Id = Guid.NewGuid(), Email = email, UserName = email, FullName = name, LockoutEnabled = true };
        // Create account and assign the fixed USER role atomically; client-supplied roles are ignored.
        await using var transaction = await db.Database.BeginTransactionAsync();
        IdentityResult created;
        try { created = await users.CreateAsync(account, request.Password); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        { throw new ApiException(409, "Không thể đăng ký với email này."); }
        if (!created.Succeeded) throw new ApiException(400, "Không thể đăng ký. Email có thể đã được sử dụng hoặc mật khẩu chưa đủ mạnh.");
        var assigned = await users.AddToRoleAsync(account, "USER");
        if (!assigned.Succeeded) throw new ApiException(500, "Không thể hoàn tất đăng ký.");
        await transaction.CommitAsync();
    }

    public async Task<SessionCredentials> Login(LoginRequest request)
    {
        var account = await users.FindByEmailAsync(request.Email.Trim());
        if (account is null || !account.IsActive || await users.IsLockedOutAsync(account))
            throw new ApiException(401, "Email hoặc mật khẩu không đúng, hoặc tài khoản tạm khóa.");
        if (!await users.CheckPasswordAsync(account, request.Password))
        {
            await users.AccessFailedAsync(account);
            throw new ApiException(401, "Email hoặc mật khẩu không đúng, hoặc tài khoản tạm khóa.");
        }
        await users.ResetAccessFailedCountAsync(account);
        var raw = TokenIssuer.RandomToken();
        var session = new RefreshSession { UserId = account.Id, User = account, TokenHash = TokenIssuer.Hash(raw), ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) };
        db.RefreshSessions.Add(session);
        await db.SaveChangesAsync();
        await sessions.Activate(session.Id, account.Id, session.ExpiresAt);
        return new SessionCredentials(raw, session.ExpiresAt, await ResponseFor(account, session.Id));
    }

    public async Task<SessionCredentials> Refresh(string? raw)
    {
        if (string.IsNullOrEmpty(raw) || raw.Length > 256) throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        var hash = TokenIssuer.Hash(raw);
        var session = await db.RefreshSessions.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash);
        if (session is null || session.Revoked || session.ExpiresAt <= DateTimeOffset.UtcNow || !session.User.IsActive || await users.IsLockedOutAsync(session.User))
            throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        if (!await sessions.Exists(session.Id, session.UserId)) throw new ApiException(401, "Phiên đăng nhập đã bị thu hồi.");
        // Rowversion ensures only one concurrent refresh can rotate this credential.
        var next = TokenIssuer.RandomToken();
        session.TokenHash = TokenIssuer.Hash(next);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(401, "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại."); }
        // Refresh never reactivates a revoked Redis marker, including concurrent logout.
        return new SessionCredentials(next, session.ExpiresAt, await ResponseFor(session.User, session.Id));
    }

    public async Task Logout(string? raw, Guid sid)
    {
        var hash = !string.IsNullOrEmpty(raw) && raw.Length <= 256 ? TokenIssuer.Hash(raw) : "";
        var ids = await db.RefreshSessions.Where(x => x.TokenHash == hash || x.Id == sid).Select(x => x.Id).ToListAsync();
        foreach (var id in ids) await sessions.Revoke(id);
        if (ids.Count > 0)
        {
            // A set-based revocation also wins against a concurrently rotating SQL rowversion.
            await db.RefreshSessions.Where(x => ids.Contains(x.Id)).ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Revoked, true));
        }
    }

    public async Task<AccountInfo?> Me(string userId)
    {
        var account = await users.FindByIdAsync(userId);
        return account is null || !account.IsActive ? null : await UserInfo(account);
    }

    public async Task ChangePassword(string userId, PasswordRequest request)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        var result = await users.ChangePasswordAsync(account, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded) throw new ApiException(400, "Mật khẩu hiện tại không đúng hoặc mật khẩu mới chưa đủ mạnh.");
        var active = await db.RefreshSessions.Where(x => x.UserId == account.Id && !x.Revoked).ToListAsync();
        foreach (var session in active) { await sessions.Revoke(session.Id); session.Revoked = true; }
        await db.SaveChangesAsync();
    }

    private async Task<AccountInfo> UserInfo(Account account) =>
        new(account.Id, account.Email, account.FullName, await users.GetRolesAsync(account));

    private async Task<AuthResponse> ResponseFor(Account account, Guid sid)
    {
        var user = await UserInfo(account);
        return new AuthResponse(tokens.Issue(account, sid, user.Roles), 300, user);
    }
}
