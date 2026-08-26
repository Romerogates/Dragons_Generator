using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesCodesEndpoint : EndpointWithoutRequest<SpeciesCodesDto>
{
    private readonly GameDataRepository _repo;

    public GetSpeciesCodesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/species/codes");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var codes = await _repo.GetSpeciesCodesAsync(ct);
        await Send.OkAsync(codes, ct);
    }
}
