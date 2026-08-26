using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetSpeciesByIdEndpoint : Endpoint<GetSpeciesByIdRequest, Models.Species>
{
    private readonly GameDataRepository _repo;

    public GetSpeciesByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/species/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpeciesByIdRequest req, CancellationToken ct)
    {
        var species = await _repo.GetSpeciesByIdAsync(req.Id, ct);

        if (species is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(species, ct);
    }
}
