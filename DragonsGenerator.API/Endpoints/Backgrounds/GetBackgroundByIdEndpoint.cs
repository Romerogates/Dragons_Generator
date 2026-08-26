using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Backgrounds;

public class GetBackgroundByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetBackgroundByIdEndpoint : Endpoint<GetBackgroundByIdRequest, Background>
{
    private readonly GameDataRepository _repo;

    public GetBackgroundByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/backgrounds/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetBackgroundByIdRequest req, CancellationToken ct)
    {
        var background = await _repo.GetBackgroundByIdAsync(req.Id, ct);

        if (background is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(background, ct);
    }
}
