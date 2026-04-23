

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguageCategoriesEndpoint : EndpointWithoutRequest<List<string>>
{
    public override void Configure()
    {
        Get("/languages/categories");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await JsonDataLoader.LoadAsync<List<Language>>("languages.json", ct);

        var categories = languages?
            .Select(l => l.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToList() ?? [];

        await Send.OkAsync(categories, ct);
    }
}