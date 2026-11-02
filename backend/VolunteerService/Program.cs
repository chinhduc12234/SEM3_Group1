using Shared;

// Volunteer owns registrations, schedules, tasks, assignments and attendance.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);

// Domain behavior is added inside this service instead of being spread across sibling services.
var app = builder.Build();
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "volunteers" }));
app.Run();
