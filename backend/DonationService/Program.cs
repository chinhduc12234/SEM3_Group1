using Shared;

// Donation owns mock payment records and financial entries; it never stores card verification data.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Payment processing remains a replaceable adapter behind this service boundary.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "donations" }));
app.Run();
