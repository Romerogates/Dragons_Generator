using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Creatures;

public class GetCreatureCategoriesEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly GameDataRepository _repo;

    public GetCreatureCategoriesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/creatures/categories");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var categories = await _repo.GetCreatureCategoriesAsync(ct);
        await Send.OkAsync(categories, ct);
    }
}
