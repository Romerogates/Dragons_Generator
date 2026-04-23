
namespace DragonsGenerator.API.Endpoints.Classes;

public record ClassSummary(
    string Id,
    string Name,
    int HitDie,
    List<string> PrimaryAbilities,
    bool HasSpellcasting
);

public class GetClassesSummaryEndpoint : EndpointWithoutRequest<List<ClassSummary>>
{
    public override void Configure()
    {
        Get("/classes/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var classes = await JsonDataLoader.LoadAsync<List<CharacterClass>>("classes.json", ct);

        var summaries = classes?
            .Select(c => new ClassSummary(
                Id: c.Id,
                Name: c.Name,
                HitDie: c.Data.GetProperty("hit_die").GetInt32(),
                PrimaryAbilities: c.Data.GetProperty("primary_abilities")
                    .EnumerateArray()
                    .Select(a => a.GetString() ?? string.Empty)
                    .ToList(),
                HasSpellcasting: c.Data.TryGetProperty("spellcasting", out _)
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}