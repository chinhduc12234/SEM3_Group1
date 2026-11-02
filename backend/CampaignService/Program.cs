using Shared;

// Campaign owns campaigns, beneficiaries and their review lifecycle.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Keep cross-service calls out of this bootstrap; use explicit API contracts or events as features arrive.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "campaigns" }));
app.Run();
