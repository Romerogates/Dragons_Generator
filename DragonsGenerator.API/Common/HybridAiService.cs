namespace DragonsGenerator.API.Common;

/// <summary>
/// Ollama d’abord (budget long, IA gratuite). Groq seulement si Ollama est mort, injoignable, ou a échoué.
/// </summary>
public sealed class HybridAiService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OpenAiChatClient? _local;
    private readonly OpenAiChatClient _remote;
    private readonly IConfiguration _config;
    private readonly ILogger<HybridAiService> _logger;
    private readonly AiGenerationTelemetry _telemetry;
    private readonly object _skipLock = new();
    private DateTimeOffset _skipLocalUntil = DateTimeOffset.MinValue;

    /// <summary>Budget global sous le timeout nginx generate (600 s) — Ollama long + Groq de secours.</summary>
    private const int GlobalBudgetSeconds = 540;

    /// <summary>Ollama a le temps de charger le modèle et d’écrire (vies, historiques).</summary>
    private const int LocalShortBudgetSeconds = 420;

    /// <summary>Ollama aventure — même ordre de grandeur, Groq garde ~2 min derrière.</summary>
    private const int LocalAdventureBudgetSeconds = 420;

    private static readonly TimeSpan LocalProbeTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan LocalSkipAfterFail = TimeSpan.FromMinutes(2);

    public HybridAiService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILoggerFactory loggerFactory,
        GroqRequestCoordinator coordinator,
        AiGenerationTelemetry telemetry)
    {
        _httpClientFactory = httpClientFactory;
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
        UserLlmCredentials? userCredentials = null,
        bool tryLocal = true)
    {
        return await SendShortGenerationCoreAsync(
            userPrompt, systemPrompt, maxTokens, ct, acceptText, userCredentials, tryLocal);
    }

    private async Task<GroqChatResult> SendShortGenerationCoreAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct,
        Func<string, bool>? acceptText,
        UserLlmCredentials? userCredentials,
        bool tryLocal)
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
            if (tryLocal)
            {
                var local = await TryOllamaAsync(userPrompt, systemPrompt, maxTokens, LocalShortBudgetSeconds, budgetCt);
                if (local is { Ok: true } && !string.IsNullOrWhiteSpace(local.Text))
                {
                    if (acceptText is null || acceptText(local.Text))
                    {
                        _logger.LogInformation("Génération courte servie par Ollama local");
                        return Done("short", "ollama", local);
                    }

                    _logger.LogWarning("Ollama local réponse rejetée (format) — bascule Groq (Ollama reste dispo)");
                }
            }

            return Done("short", "groq", await _remote.SendChatAsync(userPrompt, systemPrompt, maxTokens, budgetCt));
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Done("short", "timeout", TimeoutResult("La génération a dépassé le délai. Réessayez dans une minute."));
        }
    }

    /// <summary>
    /// Aventure structurée — Ollama d’abord (budget long), Groq si Ollama est mort ou la réponse inutilisable.
    /// </summary>
    public async Task<GroqChatResult> SendAdventureGenerationAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct,
        UserLlmCredentials? userCredentials = null)
    {
        return await SendAdventureGenerationCoreAsync(
            userPrompt, systemPrompt, maxTokens, ct, userCredentials);
    }

    private async Task<GroqChatResult> SendAdventureGenerationCoreAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct,
        UserLlmCredentials? userCredentials)
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
            var local = await TryOllamaAsync(
                userPrompt, systemPrompt, maxTokens, LocalAdventureBudgetSeconds, budgetCt);
            if (local is not null)
            {
                last = local;
                if (local.Ok && !string.IsNullOrWhiteSpace(local.Text))
                {
                    var finalized = FinalizeAdventure(local);
                    if (finalized.Ok)
                    {
                        _logger.LogInformation("Aventure servie par Ollama local");
                        return Done("adventure", "ollama", finalized);
                    }

                    _logger.LogWarning("Aventure Ollama rejetée après nettoyage — bascule Groq (Ollama reste dispo)");
                    last = finalized;
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

    private bool LocalReady
    {
        get
        {
            if (_local is null) return false;
            lock (_skipLock)
                return DateTimeOffset.UtcNow >= _skipLocalUntil;
        }
    }

    /// <summary>
    /// Probe 3 s : si Ollama est mort, Groq tout de suite.
    /// Sinon on lui laisse le budget long pour générer.
    /// </summary>
    private async Task<GroqChatResult?> TryOllamaAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        int budgetSeconds,
        CancellationToken budgetCt)
    {
        if (!LocalReady)
            return null;

        if (!await LocalIsReachableAsync(budgetCt))
        {
            SkipLocal("injoignable");
            return null;
        }

        using var localBudget = CancellationTokenSource.CreateLinkedTokenSource(budgetCt);
        localBudget.CancelAfter(TimeSpan.FromSeconds(budgetSeconds));
        try
        {
            var local = await _local!.SendChatAsync(userPrompt, systemPrompt, maxTokens, localBudget.Token);
            if (LooksDead(local))
            {
                SkipLocal(local.Error ?? "indisponible");
                return null;
            }

            return local;
        }
        catch (OperationCanceledException) when (!budgetCt.IsCancellationRequested)
        {
            SkipLocal($"aucune réponse après {budgetSeconds}s");
            return null;
        }
    }

    private async Task<bool> LocalIsReachableAsync(CancellationToken ct)
    {
        try
        {
            using var probe = CancellationTokenSource.CreateLinkedTokenSource(ct);
            probe.CancelAfter(LocalProbeTimeout);
            var client = _httpClientFactory.CreateClient("LocalLlm");
            var baseUrl = (_config["LocalLlm:BaseUrl"] ?? "http://ollama:11434/v1").TrimEnd('/');
            using var response = await client.GetAsync($"{baseUrl}/models", probe.Token);
            if (response.IsSuccessStatusCode)
                return true;

            _logger.LogWarning("Ollama probe HTTP {Status}", (int)response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama probe échoué");
            return false;
        }
    }

    private static bool LooksDead(GroqChatResult result)
    {
        if (result.Ok) return false;
        var error = result.Error ?? "";
        return error.Contains("Impossible de joindre", StringComparison.OrdinalIgnoreCase)
            || error.Contains("surchargé", StringComparison.OrdinalIgnoreCase)
            || error.Contains("erreur temporaire", StringComparison.OrdinalIgnoreCase)
            || error.Contains("met trop de temps", StringComparison.OrdinalIgnoreCase);
    }

    private void SkipLocal(string reason)
    {
        lock (_skipLock)
            _skipLocalUntil = DateTimeOffset.UtcNow.Add(LocalSkipAfterFail);
        _logger.LogWarning(
            "Ollama injoignable — Groq pendant {Minutes} min ({Reason})",
            LocalSkipAfterFail.TotalMinutes,
            reason);
    }

    private GroqChatResult Done(string kind, string provider, GroqChatResult result)
    {
        _telemetry.Record(kind, result.Ok, provider);
        return result;
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
