

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsBySchoolRequest
{
    public string School { get; set; } = string.Empty;
}

public class GetSpellsBySchoolEndpoint : Endpoint<GetSpellsBySchoolRequest, List<Spell>>
{
    public override void Configure()
    {
        Get("/spells/school/{school}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellsBySchoolRequest req, CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);

        var filtered = spells?
            .Where(s => string.Equals(s.School, req.School, StringComparison.OrdinalIgnoreCase))
            .ToList() ?? [];

        await Send.OkAsync(filtered, ct);
    }
}