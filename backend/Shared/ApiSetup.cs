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
        services.AddSingleton<SessionStore>();
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    // Fail closed if the shared revocation registry is unavailable.
                    var sessions = context.HttpContext.RequestServices.GetRequiredService<SessionStore>();
                    try
                    {
                        if (!await sessions.IsActive(context.Principal!, context.HttpContext.RequestAborted)) context.Fail("Session expired.");
                    }
                    catch (Exception ex) when (ex is StackExchange.Redis.RedisException or TimeoutException)
                    { context.Fail("Session verification unavailable."); }
                }
            };
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
            options.AddPolicy("organization", context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("sub")?.Value ?? "anonymous", _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        return services;
    }

    public static WebApplication UseApi(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.Use(async (context, next) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            // No CORS plus a non-simple header protects cookie endpoints from browser CSRF.
            if (context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method)
                && !HttpMethods.IsHead(context.Request.Method) &&
                (context.Request.Headers["X-Requested-With"] != "GiveAid" || context.Request.Headers["Sec-Fetch-Site"] == "cross-site"))
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { title = "Yêu cầu không hợp lệ." });
                return;
            }
            await next();
        });
        app.UseAuthentication();
        app.UseRateLimiter();
        app.UseAuthorization();
        app.MapControllers();
        return app;
    }
}
