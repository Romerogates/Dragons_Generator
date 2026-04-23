using System.Net.Http.Json;
using FastEndpoints;

namespace Dragons.Api.Endpoints.Characters;

public record GenerateBackstoryRequest
{
    public required string Name { get; init; }
    public required string SpeciesName { get; init; }
    public string? SubspeciesName { get; init; }
    public required string CivilizationName { get; init; }
    public required string ClassName { get; init; }
    public string? Traits { get; init; }
    public string? Bonds { get; init; }
    public string? Flaws { get; init; }
    public string? Alignment { get; init; }
    public string? Background { get; init; }  // <-- AJOUTÉ
}

public record GenerateBackstoryResponse(string Story); // <-- Changé

public class GenerateBackstoryEndpoint : Endpoint<GenerateBackstoryRequest, GenerateBackstoryResponse>
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;

    public GenerateBackstoryEndpoint(IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    public override void Configure()
    {
        Post("/generate-backstory");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GenerateBackstoryRequest req, CancellationToken ct)
    {
        var apiKey = _config["Groq:ApiKey"];
        var client = _httpClientFactory.CreateClient();

        var prompt = $"""
    Tu es un maître du jeu expert en jeux de rôle fantasy.
    Génère une histoire de background TRÈS CONCISE (maximum 100 mots, un seul paragraphe dense) pour ce personnage.
    L'histoire doit être complète et immersive, avec une accroche finale pour de futures aventures.
    Réponds uniquement avec l'histoire, sans introduction ni commentaire.
    
    PERSONNAGE:
    - Nom: {req.Name}
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
            model = "llama-3.1-8b-instant",
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

        var response = await client.SendAsync(httpRequest, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(ct);
        var story = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "Erreur de génération."; // <-- Renommé

        await Send.OkAsync(new GenerateBackstoryResponse(story), ct); // <-- Corrigé (pas de point)
    }

    private record GroqResponse(List<GroqChoice>? Choices);
    private record GroqChoice(GroqMessage? Message);
    private record GroqMessage(string? Content);
}