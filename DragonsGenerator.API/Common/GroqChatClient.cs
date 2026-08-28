using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace DragonsGenerator.API.Common;

public sealed class GroqChatClient
{
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
            model = "openai/gpt-oss-120b";

        var client = _httpClientFactory.CreateClient("Groq");
        var groqRequest = new
        {
            model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
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
                404 => "Modèle Groq indisponible. Configurez Groq:Model (ex. openai/gpt-oss-120b).",
                429 => "Quota Groq dépassé. Réessayez dans quelques instants.",
                _ => "Le service de génération IA a renvoyé une erreur."
            };

            return (false, null, message);
        }

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var groqMessage = result?.Choices?.FirstOrDefault()?.Message;
        var text = groqMessage?.Content?.Trim();
        if (string.IsNullOrWhiteSpace(text))
            text = groqMessage?.Reasoning?.Trim();

        if (string.IsNullOrWhiteSpace(text))
            return (false, null, "La génération IA n'a renvoyé aucun texte.");

        return (true, text, null);
    }

    private sealed record GroqResponse(List<GroqChoice>? Choices);
    private sealed record GroqChoice(GroqMessage? Message);
    private sealed record GroqMessage(
        string? Content,
        [property: JsonPropertyName("reasoning")] string? Reasoning);
}
