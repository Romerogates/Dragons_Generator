using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Creatures;

public class GetCreaturesSummaryEndpoint : EndpointWithoutRequest<List<CreatureSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetCreaturesSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/creatures/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetCreaturesSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
