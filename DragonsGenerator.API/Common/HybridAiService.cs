namespace DragonsGenerator.API.Common;

/// <summary>
/// Routage hybride : textes courts via Ollama local, aventures longues via Groq cloud.
/// </summary>
public sealed class HybridAiService
{
    private readonly OpenAiChatClient? _local;
    private readonly OpenAiChatClient _remote;
    private readonly IConfiguration _config;
    private readonly ILogger<HybridAiService> _logger;

    public HybridAiService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILoggerFactory loggerFactory,
        GroqRequestCoordinator coordinator)
    {
        _config = config;
        _logger = loggerFactory.CreateLogger<HybridAiService>();

        _remote = new OpenAiChatClient(
            httpClientFactory,
            config,
            loggerFactory.CreateLogger<OpenAiChatClient>(),
            "Groq",
            "Groq",
            coordinator);

        if (config.GetValue("LocalLlm:Enabled", false))
        {
            _local = new OpenAiChatClient(
                httpClientFactory,
                config,
                loggerFactory.CreateLogger<OpenAiChatClient>(),
                "LocalLlm",
                "LocalLlm");
        }
    }

    /// <summary>Backstory personnage, vie de créature, batch court.</summary>
    public async Task<GroqChatResult> SendShortGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        if (_local is not null)
        {
            var local = await _local.SendChatAsync(userPrompt, systemPrompt, maxTokens, ct);
            if (local.Ok)
            {
                _logger.LogInformation("Génération courte servie par Ollama local");
                return local;
            }

            _logger.LogWarning("Ollama local indisponible ({Error}) — bascule Groq", local.Error);
        }

        return await _remote.SendChatAsync(userPrompt, systemPrompt, maxTokens, ct);
    }

    /// <summary>Aventure structurée — qwen/Groq d'abord, Ollama local en secours.</summary>
    public async Task<GroqChatResult> SendAdventureGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        var remote = await _remote.SendChatAsync(
            userPrompt,
            systemPrompt,
            maxTokens,
            ct,
            GetAdventureModelChain());

        if (remote.Ok)
            return FinalizeAdventure(remote);

        if (_local is null)
            return remote;

        _logger.LogWarning("Groq aventure indisponible ({Error}) — bascule Ollama local", remote.Error);
        var localMaxTokens = Math.Max(maxTokens, 3500);
        var local = await _local.SendChatAsync(userPrompt, systemPrompt, localMaxTokens, ct);
        if (local.Ok)
        {
            _logger.LogInformation("Aventure servie par Ollama local (secours)");
            return FinalizeAdventure(local);
        }

        return remote;
    }

    private IReadOnlyList<string> GetAdventureModelChain()
    {
        var primary = _config["Groq:AdventureModel"];
        if (string.IsNullOrWhiteSpace(primary))
            primary = _config["Groq:FallbackModel"] ?? "qwen/qwen3.6-27b";

        var fallback = _config["Groq:Model"] ?? "groq/compound";
        if (string.Equals(primary, fallback, StringComparison.Ordinal))
            return [primary];

        return [primary, fallback];
    }

    private GroqChatResult FinalizeAdventure(GroqChatResult result)
    {
        var cleaned = AdventureOutputCleaner.Clean(result.Text);
        if (!string.IsNullOrWhiteSpace(cleaned))
            return result with { Text = cleaned };

        _logger.LogWarning("Aventure brute non exploitable après nettoyage ({Length} car.)", result.Text?.Length ?? 0);
        return result with
        {
            Ok = false,
            Error = "La génération IA n'a renvoyé aucun texte en français.",
            Retryable = true,
        };
    }
}
