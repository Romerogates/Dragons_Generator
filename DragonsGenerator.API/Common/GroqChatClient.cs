using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

public sealed record GroqChatResult(bool Ok, string? Text, string? Error, bool RateLimited = false, bool Retryable = false);

public sealed class GroqChatClient
{
    private const string DefaultModel = "groq/compound";
    private const string FrenchSystemSuffix =
        " Tu réponds UNIQUEMENT en français. Pas de commentaire méta, pas de texte en anglais, pas d'explication sur ta tâche.";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<GroqChatClient> _logger;

    public GroqChatClient(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<GroqChatClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public string? GetApiKey() => _config["Groq:ApiKey"];

    public async Task<GroqChatResult> SendChatAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        const int maxAttempts = 4;
        GroqChatResult? last = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            last = await SendChatOnceAsync(userPrompt, systemPrompt, maxTokens, ct);
            if (last.Ok)
                return last;

            if (!last.Retryable || attempt >= maxAttempts)
                return last;

            var delayMs = 400 * (1 << (attempt - 1));
            _logger.LogInformation(
                "Groq temporairement indisponible (tentative {Attempt}/{Max}), nouvel essai dans {DelayMs} ms",
                attempt,
                maxAttempts,
                delayMs);
            await Task.Delay(delayMs, ct);
        }

        return last ?? new GroqChatResult(false, null, "La génération IA a échoué.", false);
    }

    private async Task<GroqChatResult> SendChatOnceAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        var apiKey = GetApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
            return new GroqChatResult(
                false,
                null,
                "Clé API Groq manquante. Configurez Groq:ApiKey (appsettings) ou la variable d'environnement Groq__ApiKey.");

        var model = _config["Groq:Model"];
        if (string.IsNullOrWhiteSpace(model))
            model = DefaultModel;

        var client = _httpClientFactory.CreateClient("Groq");
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

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        httpRequest.Headers.Add("Authorization", $"Bearer {apiKey}");
        httpRequest.Content = JsonContent.Create(groqRequest);

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(httpRequest, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Échec d'appel à l'API Groq");
            return new GroqChatResult(false, null, "Impossible de joindre le service de génération IA.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Groq a répondu {Status}: {Body}", (int)response.StatusCode, body);

            var status = (int)response.StatusCode;
            var rateLimited = status == 429;
            var retryable = rateLimited || status is 502 or 503;
            var message = status switch
            {
                401 or 403 => "Clé API Groq invalide ou expirée. Vérifiez Groq:ApiKey.",
                404 => "Modèle Groq indisponible. Configurez Groq:Model (ex. groq/compound).",
                429 => "Quota Groq dépassé. Réessayez dans quelques instants.",
                _ => "Le service de génération IA a renvoyé une erreur."
            };

            return new GroqChatResult(false, null, message, rateLimited, retryable);
        }

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var groqMessage = result?.Choices?.FirstOrDefault()?.Message;
        var text = SanitizeModelOutput(groqMessage?.Content?.Trim());

        if (string.IsNullOrWhiteSpace(text))
            return new GroqChatResult(false, null, "La génération IA n'a renvoyé aucun texte en français.");

        return new GroqChatResult(true, text, null);
    }

    internal static string? SanitizeModelOutput(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        if (text.Contains("<think>", StringComparison.OrdinalIgnoreCase))
        {
            var afterThinking = Regex.Replace(
                text,
                @"(?is)<think>.*?(?:</think>|$)",
                string.Empty);
            text = afterThinking.Trim();
        }

        if (Regex.IsMatch(text, @"^\s*We need to\b", RegexOptions.IgnoreCase))
        {
            var quoted = Regex.Matches(text, "\"([^\"]{40,})\"")
                .Select(m => m.Groups[1].Value.Trim())
                .LastOrDefault();
            if (!string.IsNullOrWhiteSpace(quoted))
                text = quoted;
        }

        text = text.Trim().Trim('"');
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private sealed record GroqResponse(List<GroqChoice>? Choices);
    private sealed record GroqChoice(GroqMessage? Message);
    private sealed record GroqMessage(string? Content);
}
