using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Classes;

public class GetClassesEndpoint : EndpointWithoutRequest<List<CharacterClass>>
{
    private readonly GameDataRepository _repo;

    public GetClassesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/classes");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var classes = await _repo.GetClassesAsync(ct);
        await Send.OkAsync(classes, ct);
    }
}
