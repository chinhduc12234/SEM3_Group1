using Shared;

// Organization owns NGO profiles, organization membership and organization-scoped roles.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Persistence and domain endpoints are introduced with the first Organization feature.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "organizations" }));
app.Run();
