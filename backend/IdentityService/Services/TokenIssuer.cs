using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using IdentityService.Data;
using Microsoft.IdentityModel.Tokens;
namespace IdentityService.Services;

// Only Identity receives the RSA private key. Access tokens expire after five minutes.
public sealed class TokenIssuer : IDisposable
{
    private readonly RSA key = RSA.Create();
    private readonly IConfiguration config;
    public TokenIssuer(IConfiguration configuration)
    {
        config = configuration;
        key.ImportFromPem(File.ReadAllText(config["Jwt:PrivateKeyPath"] ?? throw new InvalidOperationException("Missing private key.")));
    }
    public string Issue(Account user, Guid sessionId, IEnumerable<string> roles)
    {
        var claims = new List<Claim> { new("sub", user.Id.ToString()), new("sid", sessionId.ToString()), new("jti", Guid.NewGuid().ToString()) };
        claims.AddRange(roles.Select(role => new Claim("role", role)));
        var token = new JwtSecurityToken(config["Jwt:Issuer"] ?? "give-aid-identity", config["Jwt:Audience"] ?? "give-aid-api",
            claims, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(5), new SigningCredentials(new RsaSecurityKey(key), SecurityAlgorithms.RsaSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    public static string RandomToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(48));
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
    public void Dispose() => key.Dispose();
}
