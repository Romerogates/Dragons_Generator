using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapsEndpoint : EndpointWithoutRequest<List<Handicap>>
{
    private readonly GameDataRepository _repo;

    public GetHandicapsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/handicaps");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var handicaps = await _repo.GetHandicapsAsync(ct);
        await Send.OkAsync(handicaps, ct);
    }
}
