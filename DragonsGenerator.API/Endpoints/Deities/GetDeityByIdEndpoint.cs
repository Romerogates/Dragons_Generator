using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Deities;

public class GetDeityByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetDeityByIdEndpoint : Endpoint<GetDeityByIdRequest, Deity>
{
    private readonly GameDataRepository _repo;

    public GetDeityByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/deities/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetDeityByIdRequest req, CancellationToken ct)
    {
        var deity = await _repo.GetDeityByIdAsync(req.Id, ct);

        if (deity is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(deity, ct);
    }
}
