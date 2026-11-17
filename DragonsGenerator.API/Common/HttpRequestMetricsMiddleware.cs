using System.Diagnostics;

namespace DragonsGenerator.API.Common;

public sealed class HttpRequestMetricsMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, HttpRequestMetrics metrics)
    {
        metrics.Begin();
        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            sw.Stop();
            metrics.Complete(
                context.Request.Method,
                context.Request.Path.Value,
                context.Response.StatusCode,
                (int)Math.Min(int.MaxValue, sw.ElapsedMilliseconds));
        }
    }
}
