using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Feats;

public class GetFeatByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetFeatByIdEndpoint : Endpoint<GetFeatByIdRequest, Feat>
{
    private readonly GameDataRepository _repo;

    public GetFeatByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/feats/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetFeatByIdRequest req, CancellationToken ct)
    {
        var feat = await _repo.GetFeatByIdAsync(req.Id, ct);

        if (feat is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(feat, ct);
    }
}
