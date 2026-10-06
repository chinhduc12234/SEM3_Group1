using IdentityService.Data;
using IdentityService.Models;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace IdentityService.Repositories;

public interface IUserRepository
{
    Task<User?> ByEmail(string email);
    Task<User?> ById(Guid id);
    Task<PageResult<User>> List(PageQuery query);
    void Add(User user);
    Task Save();
}
public sealed class UserRepository(IdentityDbContext db) : IUserRepository
{
    public Task<User?> ByEmail(string email) => db.Users.SingleOrDefaultAsync(x => x.Email == email);
    public Task<User?> ById(Guid id) => db.Users.FindAsync(id).AsTask();
    public void Add(User user) => db.Users.Add(user);
    public Task Save() => db.SaveChangesAsync();
    public async Task<PageResult<User>> List(PageQuery query)
    {
        var users = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search)) users = users.Where(x => x.Email.Contains(query.Search) || x.DisplayName.Contains(query.Search));
        var count = await users.CountAsync();
        var items = await users.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync();
        return new(items, count, query.Page, query.PageSize);
    }
}
