

namespace DragonsGenerator.API.Endpoints.Species;

public record SpeciesSummary(
    string Id,
    string Name,
    string Size,
    double SpeedM,
    double DarkvisionM,
    int PlayableSubspeciesCount
);

public class GetSpeciesSummaryEndpoint : EndpointWithoutRequest<List<SpeciesSummary>>
{
    public override void Configure()
    {
        Get("/species/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = await JsonDataLoader.LoadAsync<SpeciesData>("species.json", ct);

        var summaries = data?.Species
            .Select(s => new SpeciesSummary(
                Id: s.Id,
                Name: s.Name,
                Size: s.BaseStats.Size,
                SpeedM: s.BaseStats.SpeedM,
                DarkvisionM: s.BaseStats.DarkvisionM,
                PlayableSubspeciesCount: s.Subspecies.Count(sub => sub.Playable)
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}