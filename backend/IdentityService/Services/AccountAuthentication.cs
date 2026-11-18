using IdentityService.Contracts;
using IdentityService.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace IdentityService.Services;

public sealed class AccountAuthentication(UserManager<Account> users, IdentityDb db, TokenIssuer tokens, SessionStore sessions)
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(12);

    public async Task Register(RegisterRequest request)
    {
        var email = request.Email.Trim();
        var name = request.FullName.Trim();
        if (name.Length < 2) throw new ApiException(400, "Họ tên cần ít nhất 2 ký tự.");
        try
        {
            await CreateUser(email, name, request.Password);
        }
        catch (Exception ex) when (ex is SqlException { Number: 1205 } or DbUpdateException { InnerException: SqlException { Number: 1205 } })
        {
            // SQL rolled back the entire transaction. Retry with a clean change tracker.
            db.ChangeTracker.Clear();
            await CreateUser(email, name, request.Password);
        }
    }

    private async Task CreateUser(string email, string name, string password)
    {
        var account = new Account { Id = Guid.NewGuid(), Email = email, UserName = email, FullName = name, LockoutEnabled = true };
        // Create account and assign the fixed USER role atomically; client-supplied roles are ignored.
        await using var transaction = await db.Database.BeginTransactionAsync();
        IdentityResult created;
        try { created = await users.CreateAsync(account, password); }
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
        var session = new RefreshSession { UserId = account.Id, User = account, TokenHash = TokenIssuer.Hash(raw), ExpiresAt = DateTimeOffset.UtcNow.Add(SessionLifetime) };
        db.RefreshSessions.Add(session);
        await db.SaveChangesAsync();
        await sessions.Activate(session.Id, account.Id, session.ExpiresAt);
        // A password change may have committed while this request was checking the old password.
        if (!await db.Users.AnyAsync(x => x.Id == account.Id && x.IsActive && x.SecurityStamp == account.SecurityStamp))
        {
            await sessions.Revoke(session.Id);
            throw new ApiException(401, "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.");
        }
        return new SessionCredentials(raw, await ResponseFor(account, session.Id));
    }

    public async Task<SessionCredentials> Refresh(string? raw)
    {
        if (string.IsNullOrEmpty(raw) || raw.Length > 256) throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        var hash = TokenIssuer.Hash(raw);
        var session = await db.RefreshSessions.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash);
        if (session is null || session.Revoked)
            throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        if (session.ExpiresAt <= DateTimeOffset.UtcNow || !session.User.IsActive || await users.IsLockedOutAsync(session.User))
        {
            await sessions.Revoke(session.Id);
            throw new ApiException(401, "Phiên đăng nhập đã hết hạn.");
        }
        if (!await sessions.Exists(session.Id, session.UserId)) throw new ApiException(401, "Phiên đăng nhập đã bị thu hồi.");
        // Rowversion ensures only one concurrent refresh can rotate this credential.
        var next = TokenIssuer.RandomToken();
        session.TokenHash = TokenIssuer.Hash(next);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(401, "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại."); }
        // Refresh never reactivates a revoked Redis marker, including concurrent logout.
        return new SessionCredentials(next, await ResponseFor(session.User, session.Id));
    }

    public async Task Logout(string? raw, Guid sid)
    {
        // The cookie identifies the current browser session. Fall back to the verified JWT
        // when the cookie is absent or has already been rotated.
        var id = sid;
        if (!string.IsNullOrEmpty(raw) && raw.Length <= 256)
        {
            var hash = TokenIssuer.Hash(raw);
            id = await db.RefreshSessions.Where(x => x.TokenHash == hash).Select(x => (Guid?)x.Id).SingleOrDefaultAsync() ?? sid;
        }
        if (id == Guid.Empty) return;

        await sessions.Revoke(id);
        // Set-based revocation also wins against a concurrently rotating SQL rowversion.
        await db.RefreshSessions.Where(x => x.Id == id).ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Revoked, true));
    }

    public async Task<AccountInfo?> Me(string userId)
    {
        var account = await users.FindByIdAsync(userId);
        return account is null || !account.IsActive ? null : await UserInfo(account);
    }

    public async Task<AccountInfo> UpdateProfile(string userId, ProfileRequest request)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        var email = request.Email.Trim();
        var name = request.FullName.Trim();
        if (name.Length < 2) throw new ApiException(400, "Họ tên cần ít nhất 2 ký tự.");
        var existing = await users.FindByEmailAsync(email);
        if (existing is not null && existing.Id != account.Id) throw new ApiException(409, "Email này đã được tài khoản khác sử dụng.");
        account.FullName = name;
        account.Email = email;
        account.UserName = email;
        var result = await users.UpdateAsync(account);
        if (!result.Succeeded) throw new ApiException(400, "Không thể cập nhật hồ sơ tài khoản.");
        return await UserInfo(account);
    }

    public async Task<UserProfileInfo> GetUserProfile(string userId)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        return ProfileInfo(account, await db.AccountAvatars.AnyAsync(x => x.UserId == account.Id));
    }

    public async Task<UserProfileInfo> UpdateUserProfile(string userId, UserProfileRequest request)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        var email = request.Email.Trim();
        var name = request.FullName.Trim();
        if (name.Length < 2) throw new ApiException(400, "Họ tên cần ít nhất 2 ký tự.");
        if (request.DateOfBirth is { } birth && (birth > DateOnly.FromDateTime(DateTime.UtcNow) || birth < DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-120)))
            throw new ApiException(400, "Ngày sinh không hợp lệ.");
        var existing = await users.FindByEmailAsync(email);
        if (existing is not null && existing.Id != account.Id) throw new ApiException(409, "Email này đã được tài khoản khác sử dụng.");
        account.FullName = name;
        account.Email = email;
        account.UserName = email;
        account.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        account.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        account.DateOfBirth = request.DateOfBirth;
        var result = await users.UpdateAsync(account);
        if (!result.Succeeded) throw new ApiException(400, "Không thể cập nhật hồ sơ tài khoản.");
        return ProfileInfo(account, await db.AccountAvatars.AnyAsync(x => x.UserId == account.Id));
    }

    public async Task UploadAvatar(string userId, Stream source)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        await using var buffer = new MemoryStream();
        await source.CopyToAsync(buffer);
        var bytes = buffer.ToArray();
        if (bytes.Length is 0 or > 5 * 1024 * 1024) throw new ApiException(400, "Ảnh đại diện phải nhỏ hơn 5 MB.");
        var type = AvatarType(bytes);
        if (type is null) throw new ApiException(400, "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ.");
        var avatar = await db.AccountAvatars.SingleOrDefaultAsync(x => x.UserId == account.Id);
        if (avatar is null) db.AccountAvatars.Add(new AccountAvatar { UserId = account.Id, Content = bytes, ContentType = type });
        else { avatar.Content = bytes; avatar.ContentType = type; }
        await db.SaveChangesAsync();
    }

    public async Task<AvatarContent?> GetAvatar(string userId)
    {
        if (!Guid.TryParse(userId, out var id)) return null;
        var avatar = await db.AccountAvatars.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == id);
        return avatar is null ? null : new AvatarContent(avatar.Content, avatar.ContentType);
    }

    public async Task RemoveAvatar(string userId)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        var avatar = await db.AccountAvatars.SingleOrDefaultAsync(x => x.UserId == account.Id);
        if (avatar is not null) { db.AccountAvatars.Remove(avatar); await db.SaveChangesAsync(); }
    }

    private static UserProfileInfo ProfileInfo(Account account, bool hasAvatar) =>
        new(account.Id, account.Email, account.FullName, account.PhoneNumber, account.Address, account.DateOfBirth, hasAvatar);

    private static string? AvatarType(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff) return "image/jpeg";
        if (bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "image/png";
        if (bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8)) return "image/webp";
        return null;
    }

    public async Task ChangePassword(string userId, PasswordRequest request)
    {
        var account = await users.FindByIdAsync(userId) ?? throw new ApiException(401, "Tài khoản không tồn tại.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        var result = await users.ChangePasswordAsync(account, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded) throw new ApiException(400, "Mật khẩu hiện tại không đúng hoặc mật khẩu mới chưa đủ mạnh.");
        var active = db.RefreshSessions.Where(x => x.UserId == account.Id && !x.Revoked && x.ExpiresAt > DateTimeOffset.UtcNow);
        foreach (var id in await active.Select(x => x.Id).ToListAsync()) await sessions.Revoke(id);
        await active.ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Revoked, true));
        await transaction.CommitAsync();
    }

    private async Task<AccountInfo> UserInfo(Account account) =>
        new(account.Id, account.Email, account.FullName, await users.GetRolesAsync(account));

    private async Task<AuthResponse> ResponseFor(Account account, Guid sid)
    {
        var user = await UserInfo(account);
        return new AuthResponse(tokens.Issue(account, sid, user.Roles), 300, user);
    }
}
