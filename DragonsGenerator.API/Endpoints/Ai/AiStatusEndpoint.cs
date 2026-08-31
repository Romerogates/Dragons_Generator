using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Ai;

public record AiRouteInfo(
    string Primary,
    string? Fallback,
    string PrimaryLabel,
    string? FallbackLabel);

public record AiStatusResponse(
    bool LocalLlmEnabled,
    bool GroqConfigured,
    AiRouteInfo ShortGeneration,
    AiRouteInfo AdventureGeneration);

public class AiStatusEndpoint(IConfiguration config) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/ai/status");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var localEnabled = config.GetValue("LocalLlm:Enabled", false);
        var groqConfigured = !string.IsNullOrWhiteSpace(config["Groq:ApiKey"]);

        var shortPrimary = localEnabled ? "ollama" : "groq";
        var shortFallback = localEnabled ? "groq" : null;

        await Send.OkAsync(
            new AiStatusResponse(
                localEnabled,
                groqConfigured,
                new AiRouteInfo(
                    shortPrimary,
                    shortFallback,
                    localEnabled ? "Ollama (local)" : "Groq (cloud)",
                    localEnabled ? "Groq (cloud)" : null),
                new AiRouteInfo(
                    "groq",
                    localEnabled ? "ollama" : null,
                    "Groq (cloud)",
                    localEnabled ? "Ollama (local)" : null)),
            ct);
    }
}
