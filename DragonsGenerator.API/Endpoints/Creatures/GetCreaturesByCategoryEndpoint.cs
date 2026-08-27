using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Creatures;

public class GetCreaturesByCategoryRequest
{
    public string Category { get; set; } = string.Empty;
}

public class GetCreaturesByCategoryEndpoint : Endpoint<GetCreaturesByCategoryRequest, List<Creature>>
{
    private readonly GameDataRepository _repo;

    public GetCreaturesByCategoryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/creatures/category/{category}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetCreaturesByCategoryRequest req, CancellationToken ct)
    {
        var creatures = await _repo.GetCreaturesAsync(ct);
        var filtered = creatures
            .Where(c => string.Equals(c.Category, req.Category, StringComparison.OrdinalIgnoreCase))
            .ToList();

        await Send.OkAsync(filtered, ct);
    }
}
