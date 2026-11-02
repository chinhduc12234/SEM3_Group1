using System.Security.Cryptography;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Shared;

public static class ApiSetup
{
    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration config)
    {
        var publicKeyPath = config["Jwt:PublicKeyPath"] ?? throw new InvalidOperationException("Configure Jwt:PublicKeyPath.");
        using var publicKeyFile = File.OpenText(publicKeyPath);
        var publicKey = RSA.Create();
        publicKey.ImportFromPem(publicKeyFile.ReadToEnd());
        var redis = config.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
        services.AddControllers();
        services.AddProblemDetails();
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = config["Jwt:Issuer"] ?? "give-aid-identity",
                ValidAudience = config["Jwt:Audience"] ?? "give-aid-api",
                IssuerSigningKey = new RsaSecurityKey(publicKey),
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(10)
            };
        });
        services.AddAuthorization();
        services.AddStackExchangeRedisCache(options => options.Configuration = redis);
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = 429;
            // Global to the service instance: no trust in caller-supplied forwarding headers.
            options.AddPolicy("auth", _ => RateLimitPartition.GetFixedWindowLimiter("auth", _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        return services;
    }

    public static WebApplication UseApi(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        return app;
    }
}
