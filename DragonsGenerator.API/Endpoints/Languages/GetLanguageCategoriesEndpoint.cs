using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguageCategoriesEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly GameDataRepository _repo;

    public GetLanguageCategoriesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/languages/categories");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await _repo.GetLanguagesAsync(ct);
        var categories = languages
            .Select(l => l.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToList();
        await Send.OkAsync(categories, ct);
    }
}
