using IdentityService.DTOs;
using IdentityService.Repositories;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace IdentityService.Services;

public sealed class UserService(IUserRepository users, ISessionRepository sessions)
{
    public async Task<UserDto> Get(Guid id) => TokenService.ToDto(await users.ById(id) ?? throw new ApiException(404, "Không tìm thấy người dùng."));
    public async Task<PageResult<UserDto>> List(PageQuery query)
    {
        var page = await users.List(query);
        return new(page.Items.Select(TokenService.ToDto).ToList(), page.TotalCount, page.Page, page.PageSize);
    }
    public async Task<UserDto> Update(Guid actor, Guid id, UpdateUserRequest request)
    {
        if (actor == id) throw new ApiException(400, "Không thể tự đổi quyền hoặc khóa tài khoản của mình.");
        var user = await users.ById(id) ?? throw new ApiException(404, "Không tìm thấy người dùng.");
        user.Role = request.Role;
        user.IsActive = request.IsActive;
        user.TokenVersion++;
        await sessions.RevokeAll(user.Id);
        try { await users.Save(); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "Người dùng vừa được cập nhật. Vui lòng tải lại."); }
        return TokenService.ToDto(user);
    }
}
