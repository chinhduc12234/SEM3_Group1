using System.Security.Claims;
using Microsoft.Extensions.Caching.Distributed;
namespace Shared;

// Shared revocation registry contains identifiers, never passwords or refresh credentials.
public sealed class SessionStore(IDistributedCache cache)
{
    public Task Activate(Guid id, Guid userId, DateTimeOffset expires, CancellationToken ct = default) =>
        cache.SetStringAsync($"auth:session:{id:N}", userId.ToString(), new DistributedCacheEntryOptions { AbsoluteExpiration = expires }, ct);
    public Task Revoke(Guid id, CancellationToken ct = default) => cache.RemoveAsync($"auth:session:{id:N}", ct);
    public async Task<bool> Exists(Guid id, Guid userId) => await cache.GetStringAsync($"auth:session:{id:N}") == userId.ToString();
    public async Task<bool> IsActive(ClaimsPrincipal principal, CancellationToken ct)
    {
        if (!Guid.TryParse(principal.FindFirstValue("sid"), out var id)) return false;
        return await cache.GetStringAsync($"auth:session:{id:N}", ct) == principal.FindFirstValue("sub");
    }
}
