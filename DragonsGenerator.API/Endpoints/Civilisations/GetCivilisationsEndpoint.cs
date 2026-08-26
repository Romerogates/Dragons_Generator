using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetCivilisationsEndpoint : EndpointWithoutRequest<List<Civilisation>>
{
    private readonly GameDataRepository _repo;

    public GetCivilisationsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/civilisations");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var civilisations = await _repo.GetCivilisationsAsync(ct);
        await Send.OkAsync(civilisations, ct);
    }
}
