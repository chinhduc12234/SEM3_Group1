using System.Security.Claims;
using IdentityService.DTOs;
using IdentityService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IdentityService.Controllers;

[ApiController, Route("api/auth"), EnableRateLimiting("auth")]
public sealed class AuthController(AuthService auth, UserService users, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request) => StatusCode(201, await auth.Register(request));
    [HttpPost("login")]
    public async Task<AuthResponse> Login(LoginRequest request)
    {
        var result = await auth.Login(request);
        SetRefresh(result.Refresh);
        return result.Response;
    }
    [HttpPost("refresh")]
    public async Task<AuthResponse> Refresh()
    {
        var result = await auth.Refresh(Request.Cookies["sem3.refresh"]);
        SetRefresh(result.Refresh);
        return result.Response;
    }
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await auth.Logout(Request.Cookies["sem3.refresh"]);
        Response.Cookies.Delete("sem3.refresh", CookieOptions());
        return NoContent();
    }
    [Authorize, HttpGet("me")]
    public Task<UserDto> Me() => users.Get(Guid.Parse(User.FindFirstValue("sub")!));
    private CookieOptions CookieOptions() => new() { HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Strict, Path = "/api/auth" };
    private void SetRefresh(string token)
    {
        var options = CookieOptions();
        options.Expires = DateTimeOffset.UtcNow.AddDays(7);
        Response.Cookies.Append("sem3.refresh", token, options);
        Response.Headers.CacheControl = "no-store";
    }
}
