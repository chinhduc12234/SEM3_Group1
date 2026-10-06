using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using IdentityService.DTOs;
using IdentityService.Models;
using Microsoft.IdentityModel.Tokens;

namespace IdentityService.Services;

public sealed class TokenService(IConfiguration config)
{
    public AuthResponse Issue(User user)
    {
        var expires = DateTimeOffset.UtcNow.AddMinutes(5);
        var claims = new[] { new Claim("sub", user.Id.ToString()), new Claim("role", user.Role),
            new Claim("ver", user.TokenVersion.ToString()), new Claim("jti", Guid.NewGuid().ToString()) };
        var token = new JwtSecurityToken(config["Jwt:Issuer"] ?? "sem3-identity", config["Jwt:Audience"] ?? "sem3-api", claims,
            expires: expires.UtcDateTime, signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), expires, ToDto(user));
    }
    public static UserDto ToDto(User user) => new(user.Id, user.Email, user.DisplayName, user.Role, user.IsActive, user.CreatedAt);
    public static string NewRefreshToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(48));
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
