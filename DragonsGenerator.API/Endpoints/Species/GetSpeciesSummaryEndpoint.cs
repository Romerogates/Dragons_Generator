using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesSummaryEndpoint : EndpointWithoutRequest<List<SpeciesSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetSpeciesSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/species/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetSpeciesSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
