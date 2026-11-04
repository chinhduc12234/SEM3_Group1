using IdentityService.Data;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Services;

public sealed class AccountDirectory(IdentityDb db)
{
    public async Task<object?> Recipient(Guid id, CancellationToken cancellationToken)
    {
        var account = await db.Users.AsNoTracking().Where(x => x.Id == id && x.IsActive)
            .Select(x => new { x.Email, x.FullName }).SingleOrDefaultAsync(cancellationToken);
        return account;
    }

    public async Task<object?> Lookup(string email, CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToUpperInvariant();
        var account = await db.Users.AsNoTracking().Where(x => x.NormalizedEmail == normalized && x.IsActive)
            .Select(x => new { x.Id, x.Email, x.FullName,
                IsAdmin = db.UserRoles.Any(ur => ur.UserId == x.Id && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == "ADMIN")) })
            .SingleOrDefaultAsync(cancellationToken);
        return account;
    }

    public async Task<object?> Directory(Guid[] ids, CancellationToken cancellationToken)
    {
        return await db.Users.AsNoTracking().Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName, x.Email, x.IsActive }).ToListAsync(cancellationToken);
    }
}
