using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Shared;

public sealed class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception is ApiException api ? api.Status : 500;
        if (status == 500) logger.LogError(exception, "Unhandled request failure {TraceId}", context.TraceIdentifier);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status, Title = status == 500 ? "Có lỗi hệ thống. Vui lòng thử lại." : exception.Message,
            Extensions = { ["traceId"] = context.TraceIdentifier }
        }, cancellationToken);
        return true;
    }
}
