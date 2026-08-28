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
    private readonly GroqChatClient _groq;

    public GenerateAdventureEndpoint(GroqChatClient groq) => _groq = groq;

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
                lines.Add($"  Vie: {c.Backstory}");
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
            Tu es un maître du jeu expert en jeux de rôle fantasy francophones, spécialisé dans l'univers d'Eana (Dragons).
            Rédige une AVENTURE JDR complète et jouable, structurée et immersive.
            Longueur: 400 à 600 mots.

            Structure obligatoire (avec titres en gras markdown):
            **Accroche** — présentation du conflit
            **Contexte** — où et quand, ambiance
            **Personnages clés** — rappel bref de chaque créature nommée et son rôle
            **Acte 1** — découverte / enquête
            **Acte 2** — complications et confrontations
            **Acte 3** — climax et résolution possible
            **Pistes pour le MJ** — 2-3 idées de rebondissements

            L'aventure doit intégrer logiquement TOUTES les créatures listées avec leurs noms personnalisés et leurs vies.
            Réponds uniquement avec l'aventure, sans commentaire introductif.

            TITRE DE L'AVENTURE: {req.Title}
            {(req.Setting != null ? $"LIEU / CONTEXTE: {req.Setting}" : "")}
            {(req.PartyLevel != null ? $"NIVEAU DES HÉROS: {req.PartyLevel}" : "")}
            TON: {toneLabel}

            CRÉATURES DE L'HISTOIRE:
            {string.Join('\n', creatureBlocks)}
            """;

        var (ok, text, error) = await _groq.SendChatAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones.",
            1200,
            ct);

        if (!ok)
        {
            AddError(error!);
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        await Send.OkAsync(new GenerateAdventureResponse(text!), ct);
    }
}
