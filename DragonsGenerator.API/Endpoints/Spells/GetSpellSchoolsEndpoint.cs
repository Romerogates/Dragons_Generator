using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellSchoolsEndpoint : EndpointWithoutRequest<List<string>>
{
    public override void Configure()
    {
        Get("/spells/schools");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);

        var schools = spells?
            .Select(s => s.School)
            .Distinct()
            .OrderBy(s => s)
            .ToList() ?? [];

        await Send.OkAsync(schools, ct);
    }
}