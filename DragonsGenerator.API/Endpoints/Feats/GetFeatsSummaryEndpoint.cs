using System.Text.Json;
using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Feats;

public record FeatSummaryDto(string Id, string Name, string? Category, bool RequiresMagic, bool Repeatable);

public class GetFeatsSummaryEndpoint : EndpointWithoutRequest<List<FeatSummaryDto>>
{
    private readonly IndexedDataStore _store;

    public GetFeatsSummaryEndpoint(IndexedDataStore store) => _store = store;

    public override void Configure()
    {
        Get("/feats/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var entries = await _store.GetIndexEntriesAsync("index/feats.json", "feats", ct);
        var summaries = entries.Select(e => new FeatSummaryDto(
            Id: e.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Name: e.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
            Category: e.TryGetProperty("category", out var cat) ? cat.GetString() : null,
            RequiresMagic: e.TryGetProperty("requires_magic", out var rm) && rm.GetBoolean(),
            Repeatable: e.TryGetProperty("repeatable", out var rep) && rep.GetBoolean()
        )).ToList();
        await Send.OkAsync(summaries, ct);
    }
}
