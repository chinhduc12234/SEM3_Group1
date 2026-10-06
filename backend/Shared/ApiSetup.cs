using System.Text;
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
        var key = config["Jwt:Key"] ?? throw new InvalidOperationException("Configure Jwt:Key.");
        if (Encoding.UTF8.GetByteCount(key) < 32) throw new InvalidOperationException("Jwt:Key must be at least 32 bytes.");
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
                ValidIssuer = config["Jwt:Issuer"] ?? "sem3-identity",
                ValidAudience = config["Jwt:Audience"] ?? "sem3-api",
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(10)
            };
        });
        services.AddAuthorization();
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
        app.Use(async (context, next) =>
        {
            // Cookies are used only for refresh/logout. Same-origin custom header prevents form CSRF.
            if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)
                && context.Request.Headers["X-Requested-With"] != "SEM3")
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { title = "Missing request protection header." });
                return;
            }
            await next();
        });
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        return app;
    }
}
