using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsEndpoint : EndpointWithoutRequest<List<Spell>>
{
    public override void Configure()
    {
        Get("/spells");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);
        await Send.OkAsync(spells ?? [], ct);
    }
}