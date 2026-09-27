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

    /// <summary>
    /// Backstory personnage, vie de créature, batch court.
    /// Si <paramref name="acceptText"/> est fourni et que Ollama local répond OK mais
    /// le texte est rejeté (ex. JSON invalide), bascule Groq avant d’échouer.
    /// </summary>
    public async Task<GroqChatResult> SendShortGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct,
        Func<string, bool>? acceptText = null,
        UserLlmCredentials? userCredentials = null)
    {
        if (userCredentials is not null)
        {
            _logger.LogInformation("Génération courte via BYOK ({Provider}/{Model})", userCredentials.Provider, userCredentials.Model);
            return await _remote.SendChatWithUserCredentialsAsync(
                userPrompt,
                systemPrompt,
                maxTokens,
                userCredentials,
                ct);
        }

        if (_local is not null)
        {
            var local = await _local.SendChatAsync(userPrompt, systemPrompt, maxTokens, ct);
            if (local.Ok && !string.IsNullOrWhiteSpace(local.Text))
            {
                if (acceptText is null || acceptText(local.Text))
                {
                    _logger.LogInformation("Génération courte servie par Ollama local");
                    return local;
                }

                _logger.LogWarning("Ollama local réponse rejetée (format) — bascule Groq");
            }
            else
            {
                _logger.LogWarning("Ollama local indisponible ({Error}) — bascule Groq", local.Error);
            }
        }

        return await _remote.SendChatAsync(userPrompt, systemPrompt, maxTokens, ct);
    }

    /// <summary>
    /// Aventure structurée — BYOK si fourni, sinon modèles Groq site (pas Ollama : trop lent → 504 proxy).
    /// Budget global ~85 s pour répondre avant le timeout passerelle.
    /// </summary>
    public async Task<GroqChatResult> SendAdventureGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct,
        UserLlmCredentials? userCredentials = null)
    {
        if (userCredentials is not null)
        {
            _logger.LogInformation("Aventure via BYOK ({Provider}/{Model})", userCredentials.Provider, userCredentials.Model);
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            budget.CancelAfter(TimeSpan.FromSeconds(85));
            try
            {
                var attempt = await _remote.SendChatWithUserCredentialsAsync(
                    userPrompt,
                    systemPrompt,
                    maxTokens,
                    userCredentials,
                    budget.Token);
                if (!attempt.Ok) return attempt;
                var finalized = FinalizeAdventure(attempt);
                return finalized.Ok ? finalized : finalized;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return new GroqChatResult(
                    false,
                    null,
                    "La génération d'aventure a dépassé le délai. Réessayez, ou vérifiez votre fournisseur IA.",
                    true);
            }
        }

        using var siteBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        siteBudget.CancelAfter(TimeSpan.FromSeconds(85));
        var budgetCt = siteBudget.Token;

        GroqChatResult? last = null;
        try
        {
            foreach (var model in GetAdventureModelChain())
            {
                budgetCt.ThrowIfCancellationRequested();

                var attempt = await _remote.SendChatAsync(
                    userPrompt,
                    systemPrompt,
                    maxTokens,
                    budgetCt,
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
                last = finalized;
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("Aventure interrompue : budget 85 s dépassé (évite 504 proxy)");
            return new GroqChatResult(
                false,
                null,
                "La génération d'aventure a dépassé le délai. Réessayez dans une minute, ou rédigez manuellement.",
                true);
        }

        return last ?? new GroqChatResult(false, null, "La génération IA a échoué.", false);
    }

    /// <summary>OCR manuscrit FR via modèle vision Groq.</summary>
    public async Task<GroqChatResult> TranscribeInkAsync(string imageDataUrl, CancellationToken ct)
    {
        var visionModel = _config["Groq:VisionModel"];
        if (string.IsNullOrWhiteSpace(visionModel))
            visionModel = "meta-llama/llama-4-scout-17b-16e-instruct";

        const string system =
            "Tu es un outil d'OCR pour notes manuscrites de jeu de rôle. " +
            "Tu transcris uniquement le texte visible, en français, sans inventer. " +
            "Si rien n'est lisible, réponds exactement : (illisible).";

        const string user =
            "Transcris ces notes manuscrites. Texte brut uniquement, pas de markdown ni de commentaire.";

        return await _remote.SendVisionChatAsync(
            imageDataUrl,
            user,
            system,
            maxTokens: 1200,
            ct,
            [visionModel]);
    }

    private IReadOnlyList<string> GetAdventureModelChain()
    {
        var primary = _config["Groq:AdventureModel"];
        if (string.IsNullOrWhiteSpace(primary))
            primary = "groq/compound";

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
