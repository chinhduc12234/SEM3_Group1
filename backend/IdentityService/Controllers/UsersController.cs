using System.Security.Claims;
using IdentityService.DTOs;
using IdentityService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared;

namespace IdentityService.Controllers;

[ApiController, Route("api/users"), Authorize(Roles = "Admin")]
public sealed class UsersController(UserService users) : ControllerBase
{
    [HttpGet] public Task<PageResult<UserDto>> List([FromQuery] PageQuery query) => users.List(query);
    [HttpPatch("{id:guid}")] public Task<UserDto> Update(Guid id, UpdateUserRequest request) => users.Update(Guid.Parse(User.FindFirstValue("sub")!), id, request);
}
