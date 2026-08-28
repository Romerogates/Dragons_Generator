using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

public sealed class OpenAiChatClient
{
    private const string DefaultRemoteBaseUrl = "https://api.groq.com/openai/v1";
    private const string FrenchSystemSuffix =
        " Tu réponds UNIQUEMENT en français. Pas de commentaire méta, pas de texte en anglais, pas d'explication sur ta tâche.";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<OpenAiChatClient> _logger;
    private readonly GroqRequestCoordinator? _coordinator;
    private readonly string _configSection;
    private readonly string _httpClientName;

    public OpenAiChatClient(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<OpenAiChatClient> logger,
        string configSection,
        string httpClientName,
        GroqRequestCoordinator? coordinator = null)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
        _configSection = configSection;
        _httpClientName = httpClientName;
        _coordinator = coordinator;
    }

    public async Task<GroqChatResult> SendChatAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        var maxAttempts = Math.Clamp(_config.GetValue($"{_configSection}:MaxAttempts", 5), 1, 8);
        var maxRetryWindowMs = Math.Clamp(_config.GetValue($"{_configSection}:MaxRetryWindowMs", 90_000), 10_000, 240_000);
        var startedUtc = DateTime.UtcNow;
        GroqChatResult? last = null;

        foreach (var model in GetModelChain())
        {
            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                if ((DateTime.UtcNow - startedUtc).TotalMilliseconds >= maxRetryWindowMs)
                {
                    _logger.LogWarning(
                        "{Section}: fenêtre de retry ({MaxRetryWindowMs} ms) dépassée sur {Model}",
                        _configSection,
                        maxRetryWindowMs,
                        model);
                    return last ?? new GroqChatResult(
                        false,
                        null,
                        "Le service de génération IA met trop de temps à répondre. Réessayez dans une minute.",
                        false);
                }

                if (_coordinator is not null)
                    await _coordinator.WaitTurnAsync(ct);

                last = await SendChatOnceAsync(userPrompt, systemPrompt, maxTokens, model, ct);
                if (last.Ok)
                    return last;

                if (!last.Retryable || attempt >= maxAttempts)
                    break;

                var minDelay = _coordinator is null ? 500 : 2600;
                var delayMs = last.RetryAfterMs ?? Math.Min(30_000, 800 * (1 << (attempt - 1)));
                delayMs = Math.Max(delayMs, minDelay);
                _logger.LogInformation(
                    "{Section} temporairement indisponible ({Model}, tentative {Attempt}/{Max}), retry dans {DelayMs} ms",
                    _configSection,
                    model,
                    attempt,
                    maxAttempts,
                    delayMs);

                if (_coordinator is not null)
                    await _coordinator.DelayForRetryAsync(delayMs, ct);
                else
                    await Task.Delay(delayMs, ct);
            }

            if (last is { Ok: false, Retryable: true })
            {
                _logger.LogWarning("{Section}: bascule vers le modèle de secours après échec de {Model}", _configSection, model);
            }
        }

        return last ?? new GroqChatResult(false, null, "La génération IA a échoué.", false);
    }

    private IReadOnlyList<string> GetModelChain()
    {
        var primary = _config[$"{_configSection}:Model"];
        if (string.IsNullOrWhiteSpace(primary))
        {
            primary = string.Equals(_configSection, "Groq", StringComparison.Ordinal)
                ? "groq/compound"
                : "qwen2.5:3b";
        }

        var fallback = _config[$"{_configSection}:FallbackModel"];
        if (string.IsNullOrWhiteSpace(fallback) || string.Equals(fallback, primary, StringComparison.Ordinal))
            return [primary];

        return [primary, fallback];
    }

    private async Task<GroqChatResult> SendChatOnceAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        string model,
        CancellationToken ct)
    {
        var apiKey = _config[$"{_configSection}:ApiKey"];
        var baseUrl = _config[$"{_configSection}:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            baseUrl = DefaultRemoteBaseUrl;

        var requiresKey = string.Equals(_configSection, "Groq", StringComparison.Ordinal);
        if (requiresKey && string.IsNullOrWhiteSpace(apiKey))
        {
            return new GroqChatResult(
                false,
                null,
                "Clé API Groq manquante. Configurez Groq:ApiKey (appsettings) ou la variable d'environnement Groq__ApiKey.");
        }

        var client = _httpClientFactory.CreateClient(_httpClientName);
        var groqRequest = new
        {
            model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt.Trim() + FrenchSystemSuffix },
                new { role = "user", content = userPrompt }
            },
            temperature = 0.8,
            max_tokens = maxTokens
        };

        var endpoint = baseUrl.TrimEnd('/') + "/chat/completions";
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint);
        if (!string.IsNullOrWhiteSpace(apiKey))
            httpRequest.Headers.Add("Authorization", $"Bearer {apiKey}");
        httpRequest.Content = JsonContent.Create(groqRequest);

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(httpRequest, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Échec d'appel au backend IA ({Section}, {Endpoint})", _configSection, endpoint);
            return new GroqChatResult(false, null, "Impossible de joindre le service de génération IA.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("{Section} a répondu {Status}: {Body}", _configSection, (int)response.StatusCode, body);

            var status = (int)response.StatusCode;
            var rateLimited = status == 429;
            var retryable = rateLimited || status is 502 or 503;
            var retryAfterMs = ParseRetryAfterMs(response);
            var message = status switch
            {
                401 or 403 => "Clé API Groq invalide ou expirée. Vérifiez Groq:ApiKey.",
                404 => "Modèle IA indisponible. Vérifiez la configuration du modèle.",
                429 => "Quota Groq dépassé. Réessayez dans quelques instants.",
                502 or 503 => "Service IA temporairement surchargé. Réessayez dans une minute.",
                >= 500 => "Le service IA rencontre une erreur temporaire. Réessayez dans une minute.",
                _ => "Le service de génération IA a renvoyé une erreur."
            };

            return new GroqChatResult(false, null, message, rateLimited, retryable, retryAfterMs);
        }

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var groqMessage = result?.Choices?.FirstOrDefault()?.Message;
        var text = GroqChatClient.SanitizeModelOutput(groqMessage?.Content?.Trim());

        if (string.IsNullOrWhiteSpace(text))
            return new GroqChatResult(false, null, "La génération IA n'a renvoyé aucun texte en français.");

        return new GroqChatResult(true, text, null);
    }

    private static int? ParseRetryAfterMs(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Retry-After", out var values))
            return null;
        var raw = values.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        if (int.TryParse(raw, out var seconds) && seconds > 0)
            return seconds * 1000;
        return null;
    }

    private sealed record GroqResponse(List<GroqChoice>? Choices);
    private sealed record GroqChoice(GroqMessage? Message);
    private sealed record GroqMessage(string? Content);
}
