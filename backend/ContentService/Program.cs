using Shared;

// Content owns public pages, support queries and notification delivery adapters.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Email is represented by a replaceable adapter and receives credentials through configuration.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "content" }));
app.Run();
