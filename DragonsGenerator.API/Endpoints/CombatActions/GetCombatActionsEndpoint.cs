using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.CombatActions;

public class GetCombatActionsEndpoint : EndpointWithoutRequest<List<CombatAction>>
{
    private readonly GameDataRepository _repo;

    public GetCombatActionsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/combat-actions");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var actions = await _repo.GetCombatActionsAsync(ct);
        await Send.OkAsync(actions, ct);
    }
}
