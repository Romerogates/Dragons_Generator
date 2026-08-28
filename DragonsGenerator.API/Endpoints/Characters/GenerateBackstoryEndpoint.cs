using DragonsGenerator.API.Common;
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
    private readonly HybridAiService _ai;

    public GenerateBackstoryEndpoint(HybridAiService ai) => _ai = ai;

    public override void Configure()
    {
        Post("/generate-backstory");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateBackstoryRequest req, CancellationToken ct)
    {
        var sexLabel = req.Sex switch
        {
            "M" => "Masculin",
            "F" => "Féminin",
            _ => "Non défini"
        };

        var prompt = $"""
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

        var result = await _ai.SendShortGenerationAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones, spécialisé dans l'univers d'Eana (Dragons).",
            400,
            ct);

        if (!result.Ok)
        {
            AddError(result.Error!);
            await Send.ErrorsAsync(AiEndpointResponses.StatusCodeFor(result), ct);
            return;
        }

        await Send.OkAsync(new GenerateBackstoryResponse(result.Text!), ct);
    }
}
