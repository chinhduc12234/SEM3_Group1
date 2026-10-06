using CatalogService.Data;
using CatalogService.Models;
using CatalogService.Repositories;
using CatalogService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<CatalogDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddHttpClient("identity", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Identity:BaseUrl"] ?? "http://localhost:5101");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.Events.OnTokenValidated = async context =>
    {
        // Verify account status/version without accessing another service's database.
        var client = context.HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>().CreateClient("identity");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/internal/session");
        request.Headers.TryAddWithoutValidation("Authorization", context.Request.Headers.Authorization.ToString());
        try
        {
            using var response = await client.SendAsync(request, context.HttpContext.RequestAborted);
            if (!response.IsSuccessStatusCode) context.Fail("Session revoked or identity unavailable");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { context.Fail("Identity unavailable"); }
    };
});
var app = builder.Build();
if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    await db.Database.MigrateAsync();
    if (builder.Configuration.GetValue<bool>("Seed:SampleData") && !await db.Products.AnyAsync())
    {
        for (var i = 1; i <= 24; i++) db.Products.Add(new Product
        {
            Name = $"Sản phẩm mẫu {i:00}", Description = "Dữ liệu minh họa cho code base. Nhóm có thể thay thế khi nhận đề tài chính thức.",
            Category = i % 2 == 0 ? "Thiết bị" : "Phụ kiện", Price = i * 125000, IsPublished = i <= 22
        });
        await db.SaveChangesAsync();
    }
    return;
}
app.UseApi();
app.MapGet("/health", async (CatalogDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "healthy" }) : Results.StatusCode(503));
app.Run();

public partial class Program;
