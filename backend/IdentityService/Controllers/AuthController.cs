using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using IdentityService.Contracts;
using IdentityService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IdentityService.Controllers;

[ApiController, Route("api/auth"), EnableRateLimiting("auth")]
public sealed class AuthController(AccountAuthentication authentication, IWebHostEnvironment environment) : ControllerBase
{
    private const string CookieName = "giveaid_refresh";

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        await authentication.Register(request);
        return StatusCode(201, new { message = "Đăng ký thành công. Vui lòng đăng nhập." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request) =>
        SessionResponse(await authentication.Login(request));

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh() =>
        SessionResponse(await authentication.Refresh(Request.Cookies[CookieName]));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var sid = User.Identity?.IsAuthenticated == true && Guid.TryParse(User.FindFirstValue("sid"), out var value)
            ? value : Guid.Empty;
        await authentication.Logout(Request.Cookies[CookieName], sid);
        Response.Cookies.Delete(CookieName, CookieOptions());
        return NoContent();
    }

    [Authorize, HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var account = await authentication.Me(User.FindFirstValue("sub")!);
        return account is null ? Unauthorized() : Ok(account);
    }

    [Authorize, HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(ProfileRequest request)
    {
        var account = await authentication.UpdateProfile(User.FindFirstValue("sub")!, request);
        return Ok(account);
    }

    [Authorize, HttpGet("profile/details")]
    public async Task<IActionResult> UserProfile() => Ok(await authentication.GetUserProfile(User.FindFirstValue("sub")!));

    [Authorize, HttpPut("profile/details")]
    public async Task<IActionResult> UpdateUserProfile(UserProfileRequest request) =>
        Ok(await authentication.UpdateUserProfile(User.FindFirstValue("sub")!, request));

    [Authorize, HttpGet("profile/avatar")]
    public async Task<IActionResult> Avatar()
    {
        var avatar = await authentication.GetAvatar(User.FindFirstValue("sub")!);
        if (avatar is null) return NotFound();
        Response.Headers.CacheControl = "private, no-store";
        return File(avatar.Content, avatar.ContentType);
    }

    [Authorize, HttpPut("profile/avatar"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadAvatar([FromForm, Required] IFormFile avatar)
    {
        if (avatar.Length > 5 * 1024 * 1024) return BadRequest(new { title = "Ảnh đại diện phải nhỏ hơn 5 MB." });
        await using var stream = avatar.OpenReadStream();
        await authentication.UploadAvatar(User.FindFirstValue("sub")!, stream);
        return NoContent();
    }

    [Authorize, HttpDelete("profile/avatar")]
    public async Task<IActionResult> RemoveAvatar()
    {
        await authentication.RemoveAvatar(User.FindFirstValue("sub")!);
        return NoContent();
    }

    [Authorize, HttpPost("password")]
    public async Task<IActionResult> ChangePassword(PasswordRequest request)
    {
        await authentication.ChangePassword(User.FindFirstValue("sub")!, request);
        Response.Cookies.Delete(CookieName, CookieOptions());
        return NoContent();
    }

    private IActionResult SessionResponse(SessionCredentials session)
    {
        var options = CookieOptions();
        options.Expires = session.ExpiresAt;
        Response.Cookies.Append(CookieName, session.RefreshToken, options);
        return Ok(session.Response);
    }

    private CookieOptions CookieOptions() => new()
    {
        HttpOnly = true,
        Secure = !environment.IsDevelopment(),
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        IsEssential = true
    };
}
