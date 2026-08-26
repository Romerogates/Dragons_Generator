using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetRandomCivilisationEndpoint : EndpointWithoutRequest<Civilisation>
{
    private readonly GameDataRepository _repo;

    public GetRandomCivilisationEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/civilisations/random");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var civilisation = await _repo.GetRandomCivilisationAsync(ct);

        if (civilisation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(civilisation, ct);
    }
}
