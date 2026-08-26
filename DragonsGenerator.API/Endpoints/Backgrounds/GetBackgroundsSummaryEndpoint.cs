using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Backgrounds;

public class GetBackgroundsSummaryEndpoint : EndpointWithoutRequest<List<BackgroundSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetBackgroundsSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/backgrounds/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetBackgroundsSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
