using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesEndpoint : EndpointWithoutRequest<List<Models.Species>>
{
    private readonly GameDataRepository _repo;

    public GetSpeciesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/species");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var species = await _repo.GetSpeciesAsync(ct);
        await Send.OkAsync(species, ct);
    }
}
