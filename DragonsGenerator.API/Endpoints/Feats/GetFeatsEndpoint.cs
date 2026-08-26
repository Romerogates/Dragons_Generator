using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Feats;

public class GetFeatsEndpoint : EndpointWithoutRequest<List<Feat>>
{
    private readonly GameDataRepository _repo;

    public GetFeatsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/feats");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var feats = await _repo.GetFeatsAsync(ct);
        await Send.OkAsync(feats, ct);
    }
}
