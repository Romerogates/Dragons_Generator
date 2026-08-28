using System.Net.Http.Json;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;

namespace Dragons.Api.Endpoints.Characters;

public record GenerateBackstoryRequest
{
    public required string Name { get; init; }
    public required string Sex { get; init; }

    public required string SpeciesName { get; init; }
    public string? SubspeciesName { get; init; }
    public required string CivilizationName { get; init; }
    public required string ClassName { get; init; }
    public string? Traits { get; init; }
    public string? Bonds { get; init; }
    public string? Flaws { get; init; }
    public string? Alignment { get; init; }
    public string? Background { get; init; }
}

public record GenerateBackstoryResponse(string Story);

public class GenerateBackstoryEndpoint : Endpoint<GenerateBackstoryRequest, GenerateBackstoryResponse>
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<GenerateBackstoryEndpoint> _logger;

    public GenerateBackstoryEndpoint(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<GenerateBackstoryEndpoint> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/generate-backstory");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateBackstoryRequest req, CancellationToken ct)
    {
        var apiKey = _config["Groq:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            AddError("Clé API Groq manquante. Configurez Groq:ApiKey (appsettings) ou la variable d'environnement Groq__ApiKey.");
            await Send.ErrorsAsync(StatusCodes.Status503ServiceUnavailable, ct);
            return;
        }

        var client = _httpClientFactory.CreateClient();
        var sexLabel = req.Sex switch
        {
            "M" => "Masculin",
            "F" => "Féminin",
            _ => "Non défini"
        };

        var prompt = $"""
    Tu es un maître du jeu expert en jeux de rôle fantasy.
    Génère une histoire de background TRÈS CONCISE (maximum 100 mots, un seul paragraphe dense) pour ce personnage.
    L'histoire doit être complète et immersive, avec une accroche finale pour de futures aventures.
    Réponds uniquement avec l'histoire, sans introduction ni commentaire.
    
    PERSONNAGE:
    - Nom: {req.Name}
    - Sexe: {sexLabel}
    - Espèce: {req.SpeciesName}{(req.SubspeciesName != null ? $" ({req.SubspeciesName})" : "")}
    - Civilisation: {req.CivilizationName}
    - Classe: {req.ClassName}
    {(req.Background != null ? $"- Historique: {req.Background}" : "")}
    {(req.Alignment != null ? $"- Alignement: {req.Alignment}" : "")}
    {(req.Traits != null ? $"- Traits de personnalité: {req.Traits}" : "")}
    {(req.Bonds != null ? $"- Liens: {req.Bonds}" : "")}
    {(req.Flaws != null ? $"- Défauts: {req.Flaws}" : "")}
    """;

        var groqRequest = new
        {
            model = "groq/compound",
            messages = new object[]
            {
                new { role = "system", content = "Tu es un maître du jeu expert en jeux de rôle fantasy francophones." },
                new { role = "user", content = prompt }
            },
            temperature = 0.8,
            max_tokens = 400
        };

        var httpRequest = new HttpRequestMessage(System.Net.Http.HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
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
            AddError("Impossible de joindre le service de génération IA.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Groq a répondu {Status}: {Body}", (int)response.StatusCode, body);

            var message = (int)response.StatusCode switch
            {
                401 or 403 => "Clé API Groq invalide ou expirée. Vérifiez Groq:ApiKey.",
                429 => "Quota Groq dépassé. Réessayez dans quelques instants.",
                _ => "Le service de génération IA a renvoyé une erreur."
            };

            AddError(message);
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var groqMessage = result?.Choices?.FirstOrDefault()?.Message;
        var story = groqMessage?.Content?.Trim();
        // Certains modèles (gpt-oss) mettent le texte dans "reasoning" et laissent content vide
        if (string.IsNullOrWhiteSpace(story))
            story = groqMessage?.Reasoning?.Trim();

        if (string.IsNullOrWhiteSpace(story))
        {
            AddError("La génération IA n'a renvoyé aucun texte.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        await Send.OkAsync(new GenerateBackstoryResponse(story), ct);
    }

    private record GroqResponse(List<GroqChoice>? Choices);
    private record GroqChoice(GroqMessage? Message);
    private record GroqMessage(string? Content, string? Reasoning);
}
