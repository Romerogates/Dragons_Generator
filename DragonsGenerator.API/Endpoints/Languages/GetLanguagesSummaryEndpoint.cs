

namespace DragonsGenerator.API.Endpoints.Languages;

public record LanguageSummary(
    string Id,
    string Name,
    string Category,
    bool IsOralOnly,
    int WritingSystemsCount
);

public class GetLanguagesSummaryEndpoint : EndpointWithoutRequest<List<LanguageSummary>>
{
    public override void Configure()
    {
        Get("/languages/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await JsonDataLoader.LoadAsync<List<Language>>("languages.json", ct);

        var summaries = languages?
            .Select(l => new LanguageSummary(
                Id: l.Id,
                Name: l.Name,
                Category: l.Category,
                IsOralOnly: l.Linguistics.IsOralOnly,
                WritingSystemsCount: l.Linguistics.WritingSystems.Count
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}