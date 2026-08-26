using System.Text.Json;
using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Deities;

public record DeitySummaryDto(string Id, string Name, string? Tonality, List<string> Domains);

public class GetDeitiesSummaryEndpoint : EndpointWithoutRequest<List<DeitySummaryDto>>
{
    private readonly IndexedDataStore _store;

    public GetDeitiesSummaryEndpoint(IndexedDataStore store) => _store = store;

    public override void Configure()
    {
        Get("/deities/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var entries = await _store.GetIndexEntriesAsync("index/deities.json", "deities", ct);
        var summaries = entries.Select(e => new DeitySummaryDto(
            Id: e.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Name: e.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
            Tonality: e.TryGetProperty("tonality", out var ton) ? ton.GetString() : null,
            Domains: e.TryGetProperty("domains", out var domains) && domains.ValueKind == JsonValueKind.Array
                ? domains.EnumerateArray().Select(d => d.GetString() ?? "").ToList()
                : []
        )).ToList();
        await Send.OkAsync(summaries, ct);
    }
}
