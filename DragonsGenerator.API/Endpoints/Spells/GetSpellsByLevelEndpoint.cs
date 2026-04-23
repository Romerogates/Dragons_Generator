
namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsByLevelRequest
{
    public int Level { get; set; }
}

public class GetSpellsByLevelEndpoint : Endpoint<GetSpellsByLevelRequest, List<Spell>>
{
    public override void Configure()
    {
        Get("/spells/level/{level}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellsByLevelRequest req, CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);

        var filtered = spells?
            .Where(s => s.Level == req.Level)
            .ToList() ?? [];

        await Send.OkAsync(filtered, ct);
    }
}