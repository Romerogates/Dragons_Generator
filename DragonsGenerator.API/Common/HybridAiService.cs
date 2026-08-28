namespace DragonsGenerator.API.Common;

/// <summary>
/// Routage hybride : textes courts via Ollama local, aventures longues via Groq cloud.
/// </summary>
public sealed class HybridAiService
{
    private readonly OpenAiChatClient? _local;
    private readonly OpenAiChatClient _remote;
    private readonly ILogger<HybridAiService> _logger;
    private readonly bool _localEnabled;

    public HybridAiService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILoggerFactory loggerFactory,
        GroqRequestCoordinator coordinator)
    {
        _logger = loggerFactory.CreateLogger<HybridAiService>();
        _localEnabled = config.GetValue("LocalLlm:Enabled", false);

        _remote = new OpenAiChatClient(
            httpClientFactory,
            config,
            loggerFactory.CreateLogger<OpenAiChatClient>(),
            "Groq",
            "Groq",
            coordinator);

        if (_localEnabled)
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

    /// <summary>Aventure structurée — Groq d'abord, Ollama local en secours.</summary>
    public async Task<GroqChatResult> SendAdventureGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        var remote = await _remote.SendChatAsync(userPrompt, systemPrompt, maxTokens, ct);
        if (remote.Ok)
            return remote;

        if (_local is null)
            return remote;

        _logger.LogWarning("Groq aventure indisponible ({Error}) — bascule Ollama local", remote.Error);
        var localMaxTokens = Math.Max(maxTokens, 3500);
        var local = await _local.SendChatAsync(userPrompt, systemPrompt, localMaxTokens, ct);
        if (local.Ok)
        {
            _logger.LogInformation("Aventure servie par Ollama local (secours)");
            return local;
        }

        return remote;
    }
}
