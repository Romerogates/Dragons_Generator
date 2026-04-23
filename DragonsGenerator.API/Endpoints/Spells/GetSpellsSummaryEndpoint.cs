

namespace DragonsGenerator.API.Endpoints.Spells;

public record SpellSummary(
    string Id,
    string Name,
    int Level,
    string School,
    bool IsRitual,
    bool IsConcentration,
    bool IsCorrupted
);

public class GetSpellsSummaryEndpoint : EndpointWithoutRequest<List<SpellSummary>>
{
    public override void Configure()
    {
        Get("/spells/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);

        var summaries = spells?
            .Select(s => new SpellSummary(
                Id: s.Id,
                Name: s.Name,
                Level: s.Level,
                School: s.School,
                IsRitual: s.IsRitual,
                IsConcentration: s.IsConcentration,
                IsCorrupted: s.IsCorrupted
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}