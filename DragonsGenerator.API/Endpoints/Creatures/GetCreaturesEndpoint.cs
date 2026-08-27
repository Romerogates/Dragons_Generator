using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Creatures;

public class GetCreaturesEndpoint : EndpointWithoutRequest<List<Creature>>
{
    private readonly GameDataRepository _repo;

    public GetCreaturesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/creatures");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var creatures = await _repo.GetCreaturesAsync(ct);
        await Send.OkAsync(creatures, ct);
    }
}
