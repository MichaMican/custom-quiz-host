namespace CustomQuizHost.Server.Middleware;

/// <summary>
/// Middleware that captures the server send time just before the response body
/// is written to the network for the /api/buzzer/sync endpoint. This ensures
/// the timestamp accounts for JSON serialization overhead. The value is sent
/// as the X-Server-Send-Time response header (Unix ms) so the middleware does
/// not need to alter the response body.
/// </summary>
public class TimeSyncMiddleware
{
    private readonly RequestDelegate _next;

    public TimeSyncMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.Equals("/api/buzzer/sync", StringComparison.OrdinalIgnoreCase)
            && context.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase))
        {
            // Hook into the response start to capture send time as late as possible,
            // right before headers + body are flushed to the network.
            context.Response.OnStarting(() =>
            {
                var serverSendTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                context.Response.Headers["X-Server-Send-Time"] = serverSendTime.ToString();
                return Task.CompletedTask;
            });
        }

        await _next(context);
    }
}
