using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetCivilisationsSummaryEndpoint : EndpointWithoutRequest<List<CivilisationSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetCivilisationsSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/civilisations/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetCivilisationsSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
