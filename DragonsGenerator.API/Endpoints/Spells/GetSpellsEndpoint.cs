using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsEndpoint : EndpointWithoutRequest<List<Spell>>
{
    private readonly GameDataRepository _repo;

    public GetSpellsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var spells = await _repo.GetSpellsAsync(ct);
        await Send.OkAsync(spells, ct);
    }
}
