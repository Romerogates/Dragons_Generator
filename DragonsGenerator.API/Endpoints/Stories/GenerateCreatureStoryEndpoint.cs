using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;

namespace Dragons.Api.Endpoints.Stories;

public record GenerateCreatureStoryRequest
{
    public required string CreatureId { get; init; }
    public required string CustomName { get; init; }
    public string? Role { get; init; }
    public string? Setting { get; init; }
}

public record GenerateCreatureStoryResponse(string Backstory);

public class GenerateCreatureStoryEndpoint : Endpoint<GenerateCreatureStoryRequest, GenerateCreatureStoryResponse>
{
    private readonly GameDataRepository _repo;
    private readonly GroqChatClient _groq;

    public GenerateCreatureStoryEndpoint(GameDataRepository repo, GroqChatClient groq)
    {
        _repo = repo;
        _groq = groq;
    }

    public override void Configure()
    {
        Post("/generate-creature-story");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateCreatureStoryRequest req, CancellationToken ct)
    {
        var creature = await _repo.GetCreatureByIdAsync(req.CreatureId, ct);
        if (creature is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var roleLabel = req.Role switch
        {
            "antagonist" => "antagoniste principal",
            "ally" => "allié des héros",
            "neutral" => "personnage neutre / ambigu",
            "wildcard" => "élément imprévisible",
            _ => "personnage secondaire"
        };

        var traitsSummary = string.Join("; ", creature.Traits.Take(4).Select(t => t.Name));
        var actionsSummary = string.Join("; ", creature.Actions.Take(3).Select(a => a.Name));

        var prompt = $"""
            Tu es un maître du jeu expert en jeux de rôle fantasy francophones, spécialisé dans l'univers d'Eana (Dragons).
            Génère la VIE et l'HISTOIRE PERSONNELLE (background) d'une créature du bestiaire, sous le nom qu'on lui a donné.
            Maximum 120 mots, un seul paragraphe dense et immersif.
            L'histoire doit expliquer qui il/elle est, son passé, ses motivations, et un hook pour une aventure.
            Réponds uniquement avec l'histoire, sans introduction ni commentaire.

            CRÉATURE DU BESTIAIRE:
            - Nom officiel: {creature.Name}
            - Nom dans l'histoire: {req.CustomName}
            - Type: {creature.Type}
            - Catégorie: {creature.Category}
            - Facteur de puissance: {creature.ChallengeRating}
            - Rôle narratif: {roleLabel}
            {(req.Setting != null ? $"- Contexte de l'aventure: {req.Setting}" : "")}
            - Description: {(string.IsNullOrWhiteSpace(creature.Description) ? "Non renseignée" : creature.Description[..Math.Min(creature.Description.Length, 400)])}
            {(traitsSummary.Length > 0 ? $"- Traits notables: {traitsSummary}" : "")}
            {(actionsSummary.Length > 0 ? $"- Capacités marquantes: {actionsSummary}" : "")}
            """;

        var result = await _groq.SendChatAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones.",
            500,
            ct);

        if (!result.Ok)
        {
            AddError(result.Error!);
            await Send.ErrorsAsync(AiEndpointResponses.StatusCodeFor(result), ct);
            return;
        }

        await Send.OkAsync(new GenerateCreatureStoryResponse(result.Text!), ct);
    }
}
