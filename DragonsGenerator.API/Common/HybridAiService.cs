namespace DragonsGenerator.API.Common;

/// <summary>
/// Génération IA cloud : Gemini si une clé est configurée, sinon Groq. BYOK inchangé.
/// </summary>
public sealed class HybridAiService
{
    private readonly OpenAiChatClient? _gemini;
    private readonly OpenAiChatClient _remote;
    private readonly IConfiguration _config;
    private readonly ILogger<HybridAiService> _logger;
    private readonly AiGenerationTelemetry _telemetry;

    /// <summary>Budget global sous le timeout nginx generate (600 s).</summary>
    private const int GlobalBudgetSeconds = 540;

    public HybridAiService(
        IConfiguration config,
        ILoggerFactory loggerFactory,
        IHttpClientFactory httpClientFactory,
        GroqRequestCoordinator coordinator,
        AiGenerationTelemetry telemetry)
    {
        _config = config;
        _logger = loggerFactory.CreateLogger<HybridAiService>();
        _telemetry = telemetry;

        _remote = new OpenAiChatClient(
            httpClientFactory,
            config,
            loggerFactory.CreateLogger<OpenAiChatClient>(),
            "Groq",
            "Groq",
            coordinator);

        if (!string.IsNullOrWhiteSpace(config["Gemini:ApiKey"]))
        {
            _gemini = new OpenAiChatClient(
                httpClientFactory,
                config,
                loggerFactory.CreateLogger<OpenAiChatClient>(),
                "Gemini",
                "Gemini");
        }
    }

    /// <summary>
    /// Backstory personnage, vie de créature, batch court.
    /// Gemini (si configuré) puis Groq. Si <paramref name="acceptText"/> rejette, on enchaîne.
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
            using var byokBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            byokBudget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
            try
            {
                return Done(
                    "short",
                    "byok",
                    await _remote.SendChatWithUserCredentialsAsync(
                        userPrompt,
                        systemPrompt,
                        maxTokens,
                        userCredentials,
                        byokBudget.Token));
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return Done("short", "timeout", TimeoutResult("La génération a dépassé le délai. Réessayez."));
            }
        }

        using var siteBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        siteBudget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
        var budgetCt = siteBudget.Token;

        try
        {
            if (_gemini is not null)
            {
                var gemini = await _gemini.SendChatAsync(
                    userPrompt,
                    systemPrompt,
                    maxTokens,
                    budgetCt,
                    GetGeminiModelChain());
                var geminiOk = AcceptShort(gemini, acceptText);
                if (geminiOk is not null)
                {
                    _logger.LogInformation("Génération courte servie par Gemini");
                    return Done("short", "gemini", geminiOk);
                }
            }

            var groq = await _remote.SendChatAsync(
                userPrompt,
                systemPrompt,
                maxTokens,
                budgetCt,
                GetShortModelChain());
            var groqOk = AcceptShort(groq, acceptText);
            if (groqOk is not null)
                return Done("short", "groq", groqOk);

            if (groq.Ok)
            {
                return Done(
                    "short",
                    "groq",
                    new GroqChatResult(
                        false,
                        null,
                        "La génération IA n'a renvoyé aucun texte en français.",
                        Retryable: true));
            }

            return Done("short", "groq", groq);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Done("short", "timeout", TimeoutResult("La génération a dépassé le délai. Réessayez dans une minute."));
        }
    }

    /// <summary>Aventure structurée — Groq (chaîne de modèles).</summary>
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
            budget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
            try
            {
                var attempt = await _remote.SendChatWithUserCredentialsAsync(
                    userPrompt,
                    systemPrompt,
                    maxTokens,
                    userCredentials,
                    budget.Token);
                if (!attempt.Ok) return Done("adventure", "byok", attempt);
                return Done("adventure", "byok", FinalizeAdventure(attempt));
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return Done(
                    "adventure",
                    "timeout",
                    TimeoutResult(
                        "La génération d'aventure a dépassé le délai. Réessayez, ou vérifiez votre fournisseur IA."));
            }
        }

        using var siteBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        siteBudget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
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
                    return Done("adventure", "groq", finalized);
                }

                _logger.LogWarning("Réponse aventure rejetée après nettoyage ({Model})", model);
                last = finalized;
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("Aventure interrompue : budget {Seconds}s dépassé (évite 504 proxy)", GlobalBudgetSeconds);
            return Done(
                "adventure",
                "timeout",
                TimeoutResult(
                    "La génération d'aventure a dépassé le délai. Réessayez dans une minute, ou rédigez manuellement."));
        }

        return Done(
            "adventure",
            "fail",
            last ?? new GroqChatResult(false, null, "La génération IA a échoué.", false));
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

        var result = await _remote.SendVisionChatAsync(
            imageDataUrl,
            user,
            system,
            maxTokens: 1200,
            ct,
            [visionModel]);
        return Done("transcribe", "groq", result);
    }

    private static GroqChatResult? AcceptShort(GroqChatResult? result, Func<string, bool>? acceptText)
    {
        if (result is not { Ok: true } || string.IsNullOrWhiteSpace(result.Text))
            return null;

        var cleaned = ShortOutputCleaner.Clean(result.Text);
        if (string.IsNullOrWhiteSpace(cleaned))
            return null;
        if (acceptText is not null && !acceptText(cleaned))
            return null;

        return result with { Text = cleaned };
    }

    private GroqChatResult Done(string kind, string provider, GroqChatResult result)
    {
        _telemetry.Record(kind, result.Ok, provider);
        return result;
    }

    private static GroqChatResult TimeoutResult(string message) =>
        new(false, null, message, true);

    private IReadOnlyList<string> GetShortModelChain()
    {
        var primary = _config["Groq:ShortModel"];
        if (string.IsNullOrWhiteSpace(primary))
            primary = "qwen/qwen3.8-27b";

        var fallback = _config["Groq:FallbackModel"];
        return new[] { primary, fallback }
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private IReadOnlyList<string> GetGeminiModelChain()
    {
        var model = _config["Gemini:Model"];
        if (string.IsNullOrWhiteSpace(model))
            model = "gemini-3.8-flash";
        return new[] { model, "gemini-3.8-flash" }
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    private IReadOnlyList<string> GetAdventureModelChain()
    {
        var primary = _config["Groq:AdventureModel"];
        if (string.IsNullOrWhiteSpace(primary))
            primary = "qwen/qwen3.8-27b";

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
