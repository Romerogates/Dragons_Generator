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
    /// <summary>Lots trop gros → JSON tronqué / 502. 3 = bon compromis fiabilité / latence.</summary>
    private const int ChunkSize = 3;

    private readonly GameDataRepository _repo;
    private readonly HybridAiService _ai;
    private readonly UserAiCredentialResolver _userAi;
    private readonly ILogger<GenerateCreatureStoriesBatchEndpoint> _logger;
    private UserLlmCredentials? _userCreds;

    public GenerateCreatureStoriesBatchEndpoint(
        GameDataRepository repo,
        HybridAiService ai,
        UserAiCredentialResolver userAi,
        ILogger<GenerateCreatureStoriesBatchEndpoint> logger)
    {
        _repo = repo;
        _ai = ai;
        _userAi = userAi;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/generate-creature-stories-batch");
        AllowAnonymous();
        Options(b => b.RequireRateLimiting(RateLimitPolicies.AiGeneration));
    }

    public override async Task HandleAsync(GenerateCreatureStoriesBatchRequest req, CancellationToken ct)
    {
        _userCreds = await _userAi.ResolveAsync(AuthHelpers.GetUserId(User), ct);
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
                return; // 404 déjà envoyé (créature introuvable)
            results.AddRange(chunkResults);
        }

        if (results.Count == 0)
        {
            AddError("La génération IA n'a renvoyé aucune vie exploitable.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        await Send.OkAsync(new GenerateCreatureStoriesBatchResponse(results), ct);
    }

    private async Task<List<GenerateCreatureStoriesBatchResponseItem>?> GenerateChunkAsync(
        GenerateCreatureStoriesBatchItem[] chunk,
        string? setting,
        CancellationToken ct)
    {
        var prepared = new List<(GenerateCreatureStoriesBatchItem Item, string Type, string Description)>();
        foreach (var item in chunk)
        {
            var creature = await _repo.GetCreatureByIdAsync(item.CreatureId, ct);
            if (creature is null)
            {
                AddError($"Créature introuvable : {item.CreatureId}");
                await Send.NotFoundAsync(ct);
                return null;
            }

            var desc = string.IsNullOrWhiteSpace(creature.Description)
                ? "—"
                : creature.Description[..Math.Min(creature.Description.Length, 200)];
            prepared.Add((item, creature.Type, desc));
        }

        var expectedIds = chunk.Select(c => c.CreatureId).ToHashSet(StringComparer.Ordinal);
        var byId = new Dictionary<string, string>(StringComparer.Ordinal);

        var batchOk = await TryGenerateBatchJsonAsync(prepared, setting, expectedIds, byId, ct);
        if (!batchOk)
            _logger.LogWarning("Lot JSON créatures échoué — secours une par une ({Count})", chunk.Length);

        var missing = chunk.Where(c => !byId.ContainsKey(c.CreatureId)).ToArray();
        foreach (var item in missing)
        {
            var prep = prepared.First(p => p.Item.CreatureId == item.CreatureId);
            var story = await GenerateSingleAsync(item, prep.Type, prep.Description, setting, ct);
            if (!string.IsNullOrWhiteSpace(story))
                byId[item.CreatureId] = story.Trim();
        }

        return byId
            .Select(kv => new GenerateCreatureStoriesBatchResponseItem(kv.Key, kv.Value))
            .ToList();
    }

    private async Task<bool> TryGenerateBatchJsonAsync(
        List<(GenerateCreatureStoriesBatchItem Item, string Type, string Description)> prepared,
        string? setting,
        HashSet<string> expectedIds,
        Dictionary<string, string> byId,
        CancellationToken ct)
    {
        var blocks = prepared.Select(p =>
            $"""
            - creatureId: {p.Item.CreatureId}
              nom: {p.Item.CustomName.Trim()}
              type: {p.Type}
              rôle: {RoleLabel(p.Item.Role)}
              description: {p.Description}
            """);

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

        var maxTokens = Math.Min(4096, 280 * prepared.Count + 200);
        var result = await _ai.SendShortGenerationAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones. Réponds uniquement en JSON valide.",
            maxTokens,
            ct,
            text => CreatureStoriesBatchJson.LooksLikeBatchJson(text, expectedIds),
            _userCreds);

        if (!result.Ok || string.IsNullOrWhiteSpace(result.Text))
            return false;

        var parsed = CreatureStoriesBatchJson.TryParse(result.Text, expectedIds);
        if (parsed is null)
            return false;

        foreach (var (id, story) in parsed)
            byId[id] = story;

        return byId.Count > 0;
    }

    private async Task<string?> GenerateSingleAsync(
        GenerateCreatureStoriesBatchItem item,
        string type,
        string description,
        string? setting,
        CancellationToken ct)
    {
        var prompt =
            $"""
            Tu es un maître du jeu expert en jeux de rôle fantasy francophones, spécialisé dans l'univers d'Eana (Dragons).
            Génère la VIE et l'HISTOIRE PERSONNELLE (background) d'une créature du bestiaire, sous le nom qu'on lui a donné.
            Maximum 120 mots, un seul paragraphe dense et immersif.
            L'histoire doit expliquer qui il/elle est, son passé, ses motivations, et un hook pour une aventure.
            Réponds uniquement avec l'histoire, sans introduction ni commentaire.

            CRÉATURE:
            - Nom dans l'histoire: {item.CustomName.Trim()}
            - Type: {type}
            - Rôle narratif: {RoleLabel(item.Role)}
            {(setting != null ? $"- Contexte de l'aventure: {setting}" : "")}
            - Description: {description}
            """;

        var result = await _ai.SendShortGenerationAsync(
            prompt,
            "Tu es un maître du jeu expert en jeux de rôle fantasy francophones.",
            500,
            ct,
            userCredentials: _userCreds);

        return result.Ok ? result.Text : null;
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
