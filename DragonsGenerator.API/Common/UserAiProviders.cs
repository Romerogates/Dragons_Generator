namespace DragonsGenerator.API.Common;

/// <summary>Identifiants LLM fournis par l’utilisateur (BYOK), API OpenAI-compatible.</summary>
public sealed record UserLlmCredentials(
    string Provider,
    string ApiKey,
    string BaseUrl,
    string Model
);

public static class UserAiProviders
{
    public const string OpenAi = "openai";
    public const string Groq = "groq";
    public const string Xai = "xai";
    public const string OpenRouter = "openrouter";

    public static IReadOnlyList<UserAiProviderInfo> All { get; } =
    [
        new(OpenAi, "ChatGPT (OpenAI)", "https://api.openai.com/v1", "gpt-4o-mini"),
        new(Groq, "Groq", "https://api.groq.com/openai/v1", "qwen/qwen3.6-27b"),
        new(Xai, "Grok (xAI)", "https://api.x.ai/v1", "grok-2-latest"),
        new(
            OpenRouter,
            "OpenRouter (Claude, GPT, etc.)",
            "https://openrouter.ai/api/v1",
            "anthropic/claude-sonnet-4"
        ),
    ];

    public static bool TryGet(string? providerId, out UserAiProviderInfo info)
    {
        info = default!;
        if (string.IsNullOrWhiteSpace(providerId)) return false;
        var match = All.FirstOrDefault(p =>
            string.Equals(p.Id, providerId.Trim(), StringComparison.OrdinalIgnoreCase)
        );
        if (match is null) return false;
        info = match;
        return true;
    }

    public static string? NormalizeProvider(string? providerId)
    {
        if (!TryGet(providerId, out var info)) return null;
        return info.Id;
    }

    public static string NormalizeModel(string? model, UserAiProviderInfo provider)
    {
        var m = (model ?? "").Trim();
        if (m.Length is 0 or > 120) return provider.DefaultModel;
        return m;
    }
}

public sealed record UserAiProviderInfo(
    string Id,
    string Label,
    string BaseUrl,
    string DefaultModel
);
