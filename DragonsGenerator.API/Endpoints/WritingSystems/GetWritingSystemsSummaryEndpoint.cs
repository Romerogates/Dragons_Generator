

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public record WritingSystemSummary(
    string Id,
    string Name,
    string Type,
    int LanguagesCount,
    bool HasReadingDifficulty
);

public class GetWritingSystemsSummaryEndpoint : EndpointWithoutRequest<List<WritingSystemSummary>>
{
    public override void Configure()
    {
        Get("/writing-systems/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var writingSystems = await JsonDataLoader.LoadAsync<List<WritingSystem>>("writingSystems.json", ct);

        var summaries = writingSystems?
            .Select(w => new WritingSystemSummary(
                Id: w.Id,
                Name: w.Name,
                Type: w.Type,
                LanguagesCount: w.UsedByLanguages.Count,
                HasReadingDifficulty: w.ReadingDifficulty is not null
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}