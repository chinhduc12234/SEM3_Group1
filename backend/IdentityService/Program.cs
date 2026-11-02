using IdentityService.Data;
using IdentityService.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<IdentityDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddIdentityCore<Account>(o =>
{
    o.User.RequireUniqueEmail = true;
    o.Password.RequiredLength = 12;
    o.Password.RequiredUniqueChars = 4;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<IdentityDb>();
// Identity's PBKDF2 hash includes a random salt; plaintext passwords are never persisted.
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210000);
builder.Services.AddSingleton<TokenIssuer>();
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<IdentityDb>();
    await db.Database.MigrateAsync();
    var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { "USER", "ADMIN" })
        if (!await roles.RoleExistsAsync(role))
        {
            var result = await roles.CreateAsync(new IdentityRole<Guid>(role));
            if (!result.Succeeded) throw new InvalidOperationException("Role initialization failed.");
        }
    var users = scope.ServiceProvider.GetRequiredService<UserManager<Account>>();
    // Bootstrap never resets a password or promotes an existing ordinary user.
    if (!(await users.GetUsersInRoleAsync("ADMIN")).Any())
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var email = builder.Configuration["Bootstrap:AdminEmail"] ?? throw new InvalidOperationException("Configure admin email.");
        var password = builder.Configuration["Bootstrap:AdminPassword"] ?? throw new InvalidOperationException("Configure admin password.");
        if (await users.FindByEmailAsync(email) is not null) throw new InvalidOperationException("Admin email already belongs to an account.");
        var admin = new Account { Id = Guid.NewGuid(), Email = email, UserName = email, FullName = "Quản trị viên", LockoutEnabled = true };
        var created = await users.CreateAsync(admin, password);
        if (!created.Succeeded) throw new InvalidOperationException("Admin password does not satisfy the password policy.");
        var assigned = await users.AddToRoleAsync(admin, "ADMIN");
        if (!assigned.Succeeded) throw new InvalidOperationException("Admin initialization failed.");
        await transaction.CommitAsync();
    }
    return;
}
app.UseApi();
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "identity" }));
app.MapGet("/health/ready", async (IdentityDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();
