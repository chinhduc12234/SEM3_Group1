using Shared;

// Identity owns authentication and account data; business APIs validate signed access tokens locally.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Keep the service host independent from its persistence model until the domain is implemented.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health; database readiness is added with the service's DbContext.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "identity" }));
app.Run();
