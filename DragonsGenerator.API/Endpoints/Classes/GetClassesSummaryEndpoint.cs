using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Classes;

public class GetClassesSummaryEndpoint : EndpointWithoutRequest<List<ClassSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetClassesSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/classes/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetClassesSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
