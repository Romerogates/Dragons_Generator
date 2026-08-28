using DragonsGenerator.API.Common;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;

namespace Dragons.Api.Endpoints.Stories;

public record AdventureCreatureInput
{
    public required string CreatureId { get; init; }
    public required string CreatureName { get; init; }
    public required string CustomName { get; init; }
    public string? Role { get; init; }
    public string? Backstory { get; init; }
}

public record GenerateAdventureRequest
{
    public required string Title { get; init; }
    public string? Setting { get; init; }
    public int? PartyLevel { get; init; }
    public string? Tone { get; init; }
    public required List<AdventureCreatureInput> Creatures { get; init; }
}

public record GenerateAdventureResponse(string Adventure);

public class GenerateAdventureEndpoint : Endpoint<GenerateAdventureRequest, GenerateAdventureResponse>
{
    private readonly HybridAiService _ai;

    public GenerateAdventureEndpoint(HybridAiService ai) => _ai = ai;

    public override void Configure()
    {
        Post("/generate-adventure");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateAdventureRequest req, CancellationToken ct)
    {
        if (req.Creatures.Count == 0)
        {
            AddError("Au moins une créature est requise.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        static string RoleLabel(string? role) => role switch
        {
            "antagonist" => "antagoniste",
            "ally" => "allié",
            "neutral" => "neutre",
            "wildcard" => "imprévisible",
            _ => "secondaire"
        };

        var creatureBlocks = req.Creatures.Select(c =>
        {
            var lines = new List<string>
            {
                $"- {c.CustomName} (bestiaire: {c.CreatureName}, rôle: {RoleLabel(c.Role)})"
            };
            if (!string.IsNullOrWhiteSpace(c.Backstory))
            {
                var life = c.Backstory.Trim();
                if (life.Length > 400)
                    life = life[..397] + "...";
                lines.Add($"  Vie: {life}");
            }
            return string.Join('\n', lines);
        });

        var toneLabel = req.Tone switch
        {
            "dark" => "sombre et tendu",
            "heroic" => "héroïque et épique",
            "humorous" => "léger avec touches d'humour",
            "mysterious" => "mystérieux et intrigant",
            _ => "classique fantasy"
        };

        var prompt = $"""
            Rédige une AVENTURE JDR complète en français (400 à 600 mots) pour l'univers fantasy Eana (Dragons).
            Commence directement par **Accroche** — suivi du texte. Ne répète pas les consignes. Pas d'anglais. Pas de plan, pas de comptage de mots.

            Titres obligatoires (markdown gras), chacun suivi d'un paragraphe narratif :
            **Accroche**
            **Contexte**
            **Personnages clés**
            **Acte 1**
            **Acte 2**
            **Acte 3**
            **Pistes pour le MJ**

            Intègre TOUTES les créatures avec leurs noms et leurs vies.

            TITRE: {req.Title}
            {(req.Setting != null ? $"LIEU: {req.Setting}" : "")}
            {(req.PartyLevel != null ? $"NIVEAU HÉROS: {req.PartyLevel}" : "")}
            TON: {toneLabel}

            CRÉATURES:
            {string.Join('\n', creatureBlocks)}
            """;

        var result = await _ai.SendAdventureGenerationAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones. Tu livres uniquement l'aventure finale en français, prête à lire aux joueurs.",
            2500,
            ct);

        if (!result.Ok)
        {
            AddError(result.Error!);
            await Send.ErrorsAsync(AiEndpointResponses.StatusCodeFor(result), ct);
            return;
        }

        await Send.OkAsync(new GenerateAdventureResponse(result.Text!), ct);
    }
}
