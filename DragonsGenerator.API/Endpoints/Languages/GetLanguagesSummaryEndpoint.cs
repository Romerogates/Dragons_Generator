using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguagesSummaryEndpoint : EndpointWithoutRequest<List<LanguageSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetLanguagesSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/languages/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetLanguagesSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
