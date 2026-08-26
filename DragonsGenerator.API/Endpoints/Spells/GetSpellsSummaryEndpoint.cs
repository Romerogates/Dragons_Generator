using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsSummaryEndpoint : EndpointWithoutRequest<List<SpellSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetSpellsSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetSpellsSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
