using System.Text.Json;
using DragonsGenerator.API.Common;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.RateLimiting;

namespace Dragons.Api.Endpoints.Stories;

public record GenerateCreatureStoriesBatchRequest
{
    public required List<GenerateCreatureStoriesBatchItem> Creatures { get; init; }
    public string? Setting { get; init; }
}

public record GenerateCreatureStoriesBatchItem
{
    public required string CreatureId { get; init; }
    public required string CustomName { get; init; }
    public string? Role { get; init; }
}

public record GenerateCreatureStoriesBatchResponseItem(string CreatureId, string Backstory);

public record GenerateCreatureStoriesBatchResponse(
    List<GenerateCreatureStoriesBatchResponseItem> Backstories
);

public class GenerateCreatureStoriesBatchEndpoint
    : Endpoint<GenerateCreatureStoriesBatchRequest, GenerateCreatureStoriesBatchResponse>
{
    private const int ChunkSize = 5;

    private readonly GameDataRepository _repo;
    private readonly HybridAiService _ai;

    public GenerateCreatureStoriesBatchEndpoint(GameDataRepository repo, HybridAiService ai)
    {
        _repo = repo;
        _ai = ai;
    }

    public override void Configure()
    {
        Post("/generate-creature-stories-batch");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateCreatureStoriesBatchRequest req, CancellationToken ct)
    {
        var items = req.Creatures
            .Where(c => !string.IsNullOrWhiteSpace(c.CreatureId) && !string.IsNullOrWhiteSpace(c.CustomName))
            .ToList();
        if (items.Count == 0)
        {
            AddError("Aucune créature valide à générer.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var results = new List<GenerateCreatureStoriesBatchResponseItem>();
        foreach (var chunk in items.Chunk(ChunkSize))
        {
            var chunkResults = await GenerateChunkAsync(chunk, req.Setting, ct);
            if (chunkResults is null)
                return;
            results.AddRange(chunkResults);
        }

        await Send.OkAsync(new GenerateCreatureStoriesBatchResponse(results), ct);
    }

    private async Task<List<GenerateCreatureStoriesBatchResponseItem>?> GenerateChunkAsync(
        GenerateCreatureStoriesBatchItem[] chunk,
        string? setting,
        CancellationToken ct)
    {
        var blocks = new List<string>();
        foreach (var item in chunk)
        {
            var creature = await _repo.GetCreatureByIdAsync(item.CreatureId, ct);
            if (creature is null)
            {
                AddError($"Créature introuvable : {item.CreatureId}");
                await Send.NotFoundAsync(ct);
                return null;
            }

            var roleLabel = RoleLabel(item.Role);
            blocks.Add(
                $"""
                - creatureId: {item.CreatureId}
                  nom: {item.CustomName.Trim()}
                  type: {creature.Type}
                  rôle: {roleLabel}
                  description: {(string.IsNullOrWhiteSpace(creature.Description) ? "—" : creature.Description[..Math.Min(creature.Description.Length, 200)])}
                """
            );
        }

        var prompt =
            $"""
            Tu es un maître du jeu expert en jeux de rôle fantasy francophones (univers Eana / Dragons).
            Pour CHAQUE créature listée, rédige sa vie et son histoire personnelle (max 100 mots, un paragraphe dense, en français).
            {(setting != null ? $"Contexte de l'aventure: {setting}" : "")}

            CRÉATURES:
            {string.Join('\n', blocks)}

            Réponds UNIQUEMENT avec un JSON valide (tableau), sans markdown ni commentaire:
            """
            + "[{\"creatureId\":\"id\",\"backstory\":\"texte en français\"}]";

        var maxTokens = Math.Min(4096, 220 * chunk.Length + 200);
        var result = await _ai.SendShortGenerationAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones.",
            maxTokens,
            ct);

        if (!result.Ok)
        {
            AddError(result.Error!);
            await Send.ErrorsAsync(AiEndpointResponses.StatusCodeFor(result), ct);
            return null;
        }

        var parsed = TryParseBatchJson(result.Text!, chunk.Select(c => c.CreatureId).ToHashSet());
        if (parsed is null)
        {
            AddError("La génération IA n'a pas renvoyé un JSON exploitable.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return null;
        }

        return parsed;
    }

    private static List<GenerateCreatureStoriesBatchResponseItem>? TryParseBatchJson(
        string text,
        HashSet<string> expectedIds)
    {
        var json = ExtractJsonArray(text);
        if (json is null) return null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;

            var list = new List<GenerateCreatureStoriesBatchResponseItem>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;
                var id = el.TryGetProperty("creatureId", out var idEl) ? idEl.GetString() : null;
                var story = el.TryGetProperty("backstory", out var sEl) ? sEl.GetString()?.Trim() : null;
                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(story)) continue;
                if (!expectedIds.Contains(id)) continue;
                list.Add(new GenerateCreatureStoriesBatchResponseItem(id, story));
            }

            return list.Count > 0 ? list : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? ExtractJsonArray(string text)
    {
        text = text.Trim();
        var start = text.IndexOf('[');
        var end = text.LastIndexOf(']');
        if (start < 0 || end <= start) return null;
        return text[start..(end + 1)];
    }

    private static string RoleLabel(string? role) => role switch
    {
        "antagonist" => "antagoniste principal",
        "ally" => "allié des héros",
        "neutral" => "personnage neutre / ambigu",
        "wildcard" => "élément imprévisible",
        _ => "personnage secondaire",
    };
}
