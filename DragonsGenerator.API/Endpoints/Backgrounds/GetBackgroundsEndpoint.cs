using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Backgrounds;

public class GetBackgroundsEndpoint : EndpointWithoutRequest<List<Background>>
{
    private readonly GameDataRepository _repo;

    public GetBackgroundsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/backgrounds");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var backgrounds = await _repo.GetBackgroundsAsync(ct);
        await Send.OkAsync(backgrounds, ct);
    }
}
