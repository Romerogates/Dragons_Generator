using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetHandicapByIdEndpoint : Endpoint<GetHandicapByIdRequest, Handicap>
{
    private readonly GameDataRepository _repo;

    public GetHandicapByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/handicaps/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetHandicapByIdRequest req, CancellationToken ct)
    {
        var handicap = await _repo.GetHandicapByIdAsync(req.Id, ct);

        if (handicap is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(handicap, ct);
    }
}
