using IdentityService.Data;
using IdentityService.Models;
using IdentityService.Repositories;
using IdentityService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<IdentityDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddSingleton<TokenService>();
builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.Events.OnTokenValidated = async context =>
    {
        var db = context.HttpContext.RequestServices.GetRequiredService<IdentityDbContext>();
        if (!Guid.TryParse(context.Principal?.FindFirst("sub")?.Value, out var id)) { context.Fail("Invalid subject"); return; }
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (user is null || !user.IsActive || context.Principal?.FindFirst("ver")?.Value != user.TokenVersion.ToString()) context.Fail("Session revoked");
    };
});
var app = builder.Build();
if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    await db.Database.MigrateAsync();
    var email = builder.Configuration["Seed:AdminEmail"]?.Trim().ToLowerInvariant();
    var password = builder.Configuration["Seed:AdminPassword"];
    if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password) && !await db.Users.AnyAsync(x => x.Email == email))
    {
        if (password.Length < 12 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit) || password.All(char.IsLetterOrDigit))
            throw new InvalidOperationException("Seed admin password must have 12+ characters, uppercase, lowercase, digit and symbol.");
        var admin = new User { Email = email, DisplayName = "Quản trị viên", Role = "Admin" };
        admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
    return;
}
app.UseApi();
app.MapGet("/health", async (IdentityDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "healthy" }) : Results.StatusCode(503));
app.Run();

public partial class Program;
