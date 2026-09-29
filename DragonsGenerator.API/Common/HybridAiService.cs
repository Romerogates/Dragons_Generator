namespace DragonsGenerator.API.Common;

/// <summary>
/// Routage hybride : textes courts via Ollama local (budget), fallback Groq.
/// Aventures : Ollama en premier essai court, puis Groq — budget global ~85 s (évite 504).
/// </summary>
public sealed class HybridAiService
{
    private readonly OpenAiChatClient? _local;
    private readonly OpenAiChatClient _remote;
    private readonly IConfiguration _config;
    private readonly ILogger<HybridAiService> _logger;

    /// <summary>Budget global avant timeout passerelle nginx (~300s, on reste largement en dessous).</summary>
    private const int GlobalBudgetSeconds = 85;

    /// <summary>Temps max pour un essai Ollama court avant bascule Groq.</summary>
    private const int LocalShortBudgetSeconds = 45;

    /// <summary>Temps max pour un essai Ollama aventure avant bascule Groq.</summary>
    private const int LocalAdventureBudgetSeconds = 40;

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
    /// Ollama d’abord (budget), puis Groq. Si <paramref name="acceptText"/> rejette, bascule Groq.
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
                return await _remote.SendChatWithUserCredentialsAsync(
                    userPrompt,
                    systemPrompt,
                    maxTokens,
                    userCredentials,
                    byokBudget.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return TimeoutResult("La génération a dépassé le délai. Réessayez.");
            }
        }

        using var siteBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        siteBudget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
        var budgetCt = siteBudget.Token;

        try
        {
            if (_local is not null)
            {
                using var localBudget = CancellationTokenSource.CreateLinkedTokenSource(budgetCt);
                localBudget.CancelAfter(TimeSpan.FromSeconds(LocalShortBudgetSeconds));
                try
                {
                    var local = await _local.SendChatAsync(userPrompt, systemPrompt, maxTokens, localBudget.Token);
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
                catch (OperationCanceledException) when (!ct.IsCancellationRequested && !budgetCt.IsCancellationRequested)
                {
                    _logger.LogWarning(
                        "Ollama local trop lent (>{Seconds}s) — bascule Groq",
                        LocalShortBudgetSeconds);
                }
            }

            return await _remote.SendChatAsync(userPrompt, systemPrompt, maxTokens, budgetCt);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return TimeoutResult("La génération a dépassé le délai. Réessayez dans une minute.");
        }
    }

    /// <summary>
    /// Aventure structurée — Ollama en premier essai (budget court), puis chaîne Groq.
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
            budget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
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
                return TimeoutResult(
                    "La génération d'aventure a dépassé le délai. Réessayez, ou vérifiez votre fournisseur IA.");
            }
        }

        using var siteBudget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        siteBudget.CancelAfter(TimeSpan.FromSeconds(GlobalBudgetSeconds));
        var budgetCt = siteBudget.Token;

        GroqChatResult? last = null;
        try
        {
            if (_local is not null)
            {
                using var localBudget = CancellationTokenSource.CreateLinkedTokenSource(budgetCt);
                localBudget.CancelAfter(TimeSpan.FromSeconds(LocalAdventureBudgetSeconds));
                try
                {
                    var local = await _local.SendChatAsync(
                        userPrompt,
                        systemPrompt,
                        maxTokens,
                        localBudget.Token);
                    last = local;
                    if (local.Ok && !string.IsNullOrWhiteSpace(local.Text))
                    {
                        var finalized = FinalizeAdventure(local);
                        if (finalized.Ok)
                        {
                            _logger.LogInformation("Aventure servie par Ollama local");
                            return finalized;
                        }

                        _logger.LogWarning("Aventure Ollama rejetée après nettoyage — bascule Groq");
                        last = finalized;
                    }
                    else
                    {
                        _logger.LogWarning("Ollama aventure indisponible ({Error}) — bascule Groq", local.Error);
                    }
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested && !budgetCt.IsCancellationRequested)
                {
                    _logger.LogWarning(
                        "Ollama aventure trop lent (>{Seconds}s) — bascule Groq",
                        LocalAdventureBudgetSeconds);
                }
            }

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
            _logger.LogWarning("Aventure interrompue : budget {Seconds}s dépassé (évite 504 proxy)", GlobalBudgetSeconds);
            return TimeoutResult(
                "La génération d'aventure a dépassé le délai. Réessayez dans une minute, ou rédigez manuellement.");
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

    private static GroqChatResult TimeoutResult(string message) =>
        new(false, null, message, true);

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
