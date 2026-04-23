

namespace DragonsGenerator.API.Endpoints.Civilisations;

public record CivilisationSummary(
    string Id,
    string Name,
    int DiceMin,
    int DiceMax,
    bool IsCosmopolitan,
    List<string> PrimarySpecies
);

public class GetCivilisationsSummaryEndpoint : EndpointWithoutRequest<List<CivilisationSummary>>
{
    public override void Configure()
    {
        Get("/civilisations/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var civilisations = await JsonDataLoader.LoadAsync<List<Civilisation>>("civilisations.json", ct);

        var summaries = civilisations?
            .Select(c => new CivilisationSummary(
                Id: c.Id,
                Name: c.Name,
                DiceMin: c.Randomization.DiceMin,
                DiceMax: c.Randomization.DiceMax,
                IsCosmopolitan: c.Demographics.IsCosmopolitan,
                PrimarySpecies: c.Demographics.PrimarySpecies.Select(s => s.Label).ToList()
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}