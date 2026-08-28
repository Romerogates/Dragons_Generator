using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace DragonsGenerator.API.Common;

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

    public async Task<(bool Ok, string? Text, string? Error)> SendChatAsync(
        string userPrompt,
        string systemPrompt,
        int maxTokens,
        CancellationToken ct)
    {
        var apiKey = GetApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
            return (false, null, "Clé API Groq manquante. Configurez Groq:ApiKey (appsettings) ou la variable d'environnement Groq__ApiKey.");

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
            return (false, null, "Impossible de joindre le service de génération IA.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Groq a répondu {Status}: {Body}", (int)response.StatusCode, body);

            var message = (int)response.StatusCode switch
            {
                401 or 403 => "Clé API Groq invalide ou expirée. Vérifiez Groq:ApiKey.",
                404 => "Modèle Groq indisponible. Configurez Groq:Model (ex. groq/compound).",
                429 => "Quota Groq dépassé. Réessayez dans quelques instants.",
                _ => "Le service de génération IA a renvoyé une erreur."
            };

            return (false, null, message);
        }

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var groqMessage = result?.Choices?.FirstOrDefault()?.Message;
        var text = SanitizeModelOutput(groqMessage?.Content?.Trim());

        if (string.IsNullOrWhiteSpace(text))
            return (false, null, "La génération IA n'a renvoyé aucun texte en français.");

        return (true, text, null);
    }

    internal static string? SanitizeModelOutput(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // Certains modèles renvoient des blocs de réflexion dans content
        if (text.Contains("<think>", StringComparison.OrdinalIgnoreCase))
        {
            var afterThinking = Regex.Replace(
                text,
                @"(?is)<think>.*?(?:</think>|$)",
                string.Empty);
            text = afterThinking.Trim();
        }

        // Meta anglais type "We need to produce..." suivi d'un paragraphe français entre guillemets
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
