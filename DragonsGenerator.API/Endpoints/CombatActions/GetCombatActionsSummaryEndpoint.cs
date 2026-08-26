using System.Text.Json;
using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.CombatActions;

public record CombatActionSummaryDto(string Id, string Name, string ActionCost, string Category);

public class GetCombatActionsSummaryEndpoint : EndpointWithoutRequest<List<CombatActionSummaryDto>>
{
    private readonly IndexedDataStore _store;

    public GetCombatActionsSummaryEndpoint(IndexedDataStore store) => _store = store;

    public override void Configure()
    {
        Get("/combat-actions/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var entries = await _store.GetIndexEntriesAsync("index/combat-actions.json", "actions", ct);
        var summaries = entries.Select(e => new CombatActionSummaryDto(
            Id: e.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Name: e.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
            ActionCost: e.TryGetProperty("action_cost", out var ac) ? ac.GetString() ?? "" : "",
            Category: e.TryGetProperty("category", out var cat) ? cat.GetString() ?? "" : ""
        )).ToList();
        await Send.OkAsync(summaries, ct);
    }
}
