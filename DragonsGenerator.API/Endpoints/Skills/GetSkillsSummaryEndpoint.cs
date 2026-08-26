using System.Text.Json;
using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Skills;

public record SkillSummaryDto(string Id, string Name, string Ability);

public class GetSkillsSummaryEndpoint : EndpointWithoutRequest<List<SkillSummaryDto>>
{
    private readonly IndexedDataStore _store;

    public GetSkillsSummaryEndpoint(IndexedDataStore store) => _store = store;

    public override void Configure()
    {
        Get("/skills/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var entries = await _store.GetIndexEntriesAsync("index/skills.json", "entries", ct);
        var summaries = entries.Select(e => new SkillSummaryDto(
            Id: e.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Name: e.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
            Ability: e.TryGetProperty("ability", out var ability) ? ability.GetString() ?? "" : ""
        )).ToList();
        await Send.OkAsync(summaries, ct);
    }
}
