using DragonsGenerator.API.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DragonsGenerator.API.Common;

public sealed class AiGenerationTelemetry(IServiceScopeFactory scopes, ILogger<AiGenerationTelemetry> logger)
{
    public void Record(string kind, bool ok, string? provider, GroqChatResult? result = null)
    {
        _ = PersistAsync(kind, ok, provider, result);
    }

    private async Task PersistAsync(string kind, bool ok, string? provider, GroqChatResult? result)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var model = result?.Model;
            db.AiGenerationLogs.Add(new AiGenerationLog
            {
                Kind = kind.Length > 32 ? kind[..32] : kind,
                Ok = ok,
                Provider = string.IsNullOrWhiteSpace(provider)
                    ? null
                    : (provider.Length > 64 ? provider[..64] : provider),
                Model = string.IsNullOrWhiteSpace(model)
                    ? null
                    : (model.Length > 128 ? model[..128] : model),
                PromptTokens = Math.Max(0, result?.PromptTokens ?? 0),
                CompletionTokens = Math.Max(0, result?.CompletionTokens ?? 0),
                TotalTokens = Math.Max(0, result?.TotalTokens ?? 0),
                LatencyMs = Math.Max(0, result?.LatencyMs ?? 0),
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
