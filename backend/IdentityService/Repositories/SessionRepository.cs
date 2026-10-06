using IdentityService.Data;
using IdentityService.Models;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Repositories;

public interface ISessionRepository
{
    Task<RefreshSession?> Find(string hash);
    void Add(RefreshSession session);
    Task RevokeAll(Guid userId);
}
public sealed class SessionRepository(IdentityDbContext db) : ISessionRepository
{
    public Task<RefreshSession?> Find(string hash) => db.RefreshSessions.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash);
    public void Add(RefreshSession session) => db.RefreshSessions.Add(session);
    public async Task RevokeAll(Guid userId)
    {
        var sessions = await db.RefreshSessions.Where(x => x.UserId == userId && !x.Revoked).ToListAsync();
        foreach (var session in sessions) session.Revoked = true;
    }
}
