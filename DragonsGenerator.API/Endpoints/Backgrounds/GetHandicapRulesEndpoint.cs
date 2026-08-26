using System.Text.Json;
using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapRulesEndpoint : EndpointWithoutRequest<JsonElement>
{
    private readonly GameDataRepository _repo;

    public GetHandicapRulesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/handicaps/rules");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var rules = await _repo.GetHandicapRulesAsync(ct);
        await Send.OkAsync(rules, ct);
    }
}
