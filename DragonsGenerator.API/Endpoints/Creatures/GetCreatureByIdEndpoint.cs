using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Creatures;

public class GetCreatureByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetCreatureByIdEndpoint : Endpoint<GetCreatureByIdRequest, Creature>
{
    private readonly GameDataRepository _repo;

    public GetCreatureByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/creatures/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetCreatureByIdRequest req, CancellationToken ct)
    {
        var creature = await _repo.GetCreatureByIdAsync(req.Id, ct);

        if (creature is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(creature, ct);
    }
}
