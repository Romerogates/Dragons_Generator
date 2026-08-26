using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Deities;

public class GetDeitiesEndpoint : EndpointWithoutRequest<List<Deity>>
{
    private readonly GameDataRepository _repo;

    public GetDeitiesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/deities");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var deities = await _repo.GetDeitiesAsync(ct);
        await Send.OkAsync(deities, ct);
    }
}
