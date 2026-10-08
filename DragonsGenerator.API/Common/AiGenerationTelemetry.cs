using DragonsGenerator.API.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DragonsGenerator.API.Common;

public sealed class AiGenerationTelemetry(IServiceScopeFactory scopes, ILogger<AiGenerationTelemetry> logger)
{
    public void Record(string kind, bool ok, string? provider)
    {
        _ = PersistAsync(kind, ok, provider);
    }

    private async Task PersistAsync(string kind, bool ok, string? provider)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AiGenerationLogs.Add(new AiGenerationLog
            {
                Kind = kind.Length > 32 ? kind[..32] : kind,
                Ok = ok,
                Provider = string.IsNullOrWhiteSpace(provider)
                    ? null
                    : (provider.Length > 64 ? provider[..64] : provider),
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Journal génération IA non persisté");
        }
    }
}
