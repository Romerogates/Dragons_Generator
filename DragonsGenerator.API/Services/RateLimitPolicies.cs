using System.Security.Claims;
using System.Threading.RateLimiting;
using DragonsGenerator.API.Persistence;

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
                var retryAfterSeconds = 60;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
                    context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
                }

                context.HttpContext.Response.ContentType = "application/json";
                var path = context.HttpContext.Request.Path.Value ?? string.Empty;
                var isAiGeneration = path.Contains("generate-", StringComparison.OrdinalIgnoreCase);
                var isAuthenticated = context.HttpContext.User?.Identity?.IsAuthenticated == true;

                if (isAiGeneration)
                {
                    await context.HttpContext.Response.WriteAsJsonAsync(
                        new
                        {
                            message = "Limite de génération IA atteinte pour le moment.",
                            code = "ai_rate_limit",
                            retryAfterSeconds,
                            suggestLogin = !isAuthenticated,
                        },
                        token
                    );
                    return;
                }

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
                    if (context.User?.Identity?.IsAuthenticated == true
                        && context.User.IsInRole(AppRoles.Admin))
                    {
                        return RateLimitPartition.GetNoLimiter($"{AiGeneration}-admin");
                    }

                    var userId = context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
                    var key = !string.IsNullOrEmpty(userId)
                        ? $"user:{userId}"
                        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
                    var permitLimit = !string.IsNullOrEmpty(userId)
                        ? configuration.GetValue("RateLimit:AiGenerationAuthenticatedPerHour", 60)
                        : configuration.GetValue("RateLimit:AiGenerationAnonymousPerHour", 30);

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
