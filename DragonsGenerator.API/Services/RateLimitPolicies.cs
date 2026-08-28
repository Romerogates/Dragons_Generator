using System.Security.Claims;
using System.Threading.RateLimiting;

namespace DragonsGenerator.API.Services;

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string AiGeneration = "ai-generation";

    public static IServiceCollection AddDragonsRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment
    )
    {
        var enabled = configuration.GetValue("RateLimit:Enabled", !environment.IsDevelopment());
        if (!enabled)
        {
            services.AddRateLimiter(options =>
            {
                options.AddPolicy(Auth, _ => RateLimitPartition.GetNoLimiter(Auth));
                options.AddPolicy(AiGeneration, _ => RateLimitPartition.GetNoLimiter(AiGeneration));
            });
            return services;
        }

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                }

                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { message = "Trop de requêtes. Réessayez dans quelques instants." },
                    token
                );
            };

            options.AddPolicy(
                Auth,
                context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            Window = TimeSpan.FromMinutes(1),
                            PermitLimit = 15,
                            QueueLimit = 0,
                        }
                    )
            );

            options.AddPolicy(
                AiGeneration,
                context =>
                {
                    var userId = context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
                    var key = !string.IsNullOrEmpty(userId)
                        ? $"user:{userId}"
                        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
                    var permitLimit = !string.IsNullOrEmpty(userId) ? 30 : 5;

                    return RateLimitPartition.GetFixedWindowLimiter(
                        key,
                        _ => new FixedWindowRateLimiterOptions
                        {
                            Window = TimeSpan.FromHours(1),
                            PermitLimit = permitLimit,
                            QueueLimit = 0,
                        }
                    );
                }
            );
        });

        return services;
    }
}
