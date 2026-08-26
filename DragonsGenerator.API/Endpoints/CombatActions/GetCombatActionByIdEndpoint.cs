using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.CombatActions;

public class GetCombatActionByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetCombatActionByIdEndpoint : Endpoint<GetCombatActionByIdRequest, CombatAction>
{
    private readonly GameDataRepository _repo;

    public GetCombatActionByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/combat-actions/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetCombatActionByIdRequest req, CancellationToken ct)
    {
        var action = await _repo.GetCombatActionByIdAsync(req.Id, ct);

        if (action is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(action, ct);
    }
}
