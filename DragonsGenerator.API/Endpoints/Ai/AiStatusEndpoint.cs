using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Ai;

public record AiRouteInfo(
    string Primary,
    string? Fallback,
    string PrimaryLabel,
    string? FallbackLabel);

public record AiStatusResponse(
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
        var groqConfigured = !string.IsNullOrWhiteSpace(config["Groq:ApiKey"]);
        var geminiConfigured = !string.IsNullOrWhiteSpace(config["Gemini:ApiKey"]);

        var shortPrimary = geminiConfigured ? "gemini" : "groq";
        var shortFallback = geminiConfigured ? "groq" : null;

        await Send.OkAsync(
            new AiStatusResponse(
                groqConfigured,
                new AiRouteInfo(
                    shortPrimary,
                    shortFallback,
                    geminiConfigured ? "Gemini (cloud)" : "Groq (cloud)",
                    geminiConfigured ? "Groq (cloud)" : null),
                new AiRouteInfo(
                    "groq",
                    null,
                    "Groq (cloud)",
                    null)),
            ct);
    }
}
