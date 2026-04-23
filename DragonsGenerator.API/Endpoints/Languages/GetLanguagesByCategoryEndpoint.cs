

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguagesByCategoryRequest
{
    public string Category { get; set; } = string.Empty;
}

public class GetLanguagesByCategoryEndpoint : Endpoint<GetLanguagesByCategoryRequest, List<Language>>
{
    public override void Configure()
    {
        Get("/languages/category/{category}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetLanguagesByCategoryRequest req, CancellationToken ct)
    {
        var languages = await JsonDataLoader.LoadAsync<List<Language>>("languages.json", ct);

        var filtered = languages?
            .Where(l => string.Equals(l.Category, req.Category, StringComparison.OrdinalIgnoreCase))
            .ToList() ?? [];

        await Send.OkAsync(filtered, ct);
    }
}