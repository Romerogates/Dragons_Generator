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

    /// <summary>Aventure structurée — essaie chaque modèle Groq puis Ollama local.</summary>
    public async Task<GroqChatResult> SendAdventureGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        GroqChatResult? last = null;
        foreach (var model in GetAdventureModelChain())
        {
            var attempt = await _remote.SendChatAsync(
                userPrompt,
                systemPrompt,
                maxTokens,
                ct,
                [model]);

            last = attempt;
            if (!attempt.Ok)
                continue;

            var finalized = FinalizeAdventure(attempt);
            if (finalized.Ok)
            {
                _logger.LogInformation("Aventure Groq servie par {Model}", model);
                return finalized;
            }

            _logger.LogWarning("Réponse aventure rejetée après nettoyage ({Model})", model);
        }

        if (_local is not null)
        {
            _logger.LogWarning("Groq aventure insatisfaisante — bascule Ollama local");
            var localMaxTokens = Math.Max(maxTokens, 3500);
            var local = await _local.SendChatAsync(userPrompt, systemPrompt, localMaxTokens, ct);
            if (local.Ok)
            {
                var finalized = FinalizeAdventure(local);
                if (finalized.Ok)
                {
                    _logger.LogInformation("Aventure servie par Ollama local (secours)");
                    return finalized;
                }

                last = finalized;
            }
            else
            {
                last = local;
            }
        }

        return last ?? new GroqChatResult(false, null, "La génération IA a échoué.", false);
    }

    private IReadOnlyList<string> GetAdventureModelChain()
    {
        var primary = _config["Groq:AdventureModel"];
        if (string.IsNullOrWhiteSpace(primary))
            primary = "qwen/qwen3.6-27b";

        var secondary = _config["Groq:FallbackModel"];
        var tertiary = _config["Groq:Model"] ?? "groq/compound";

        return new[] { primary, secondary, tertiary }
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private GroqChatResult FinalizeAdventure(GroqChatResult result)
    {
        var cleaned = AdventureOutputCleaner.Clean(result.Text);
        if (AdventureOutputCleaner.LooksProfessional(cleaned))
            return result with { Text = cleaned! };

        _logger.LogWarning("Aventure brute non exploitable après nettoyage ({Length} car.)", result.Text?.Length ?? 0);
        return result with
        {
            Ok = false,
            Text = null,
            Error = "La génération IA n'a renvoyé aucun texte en français.",
            Retryable = true,
        };
    }
}
