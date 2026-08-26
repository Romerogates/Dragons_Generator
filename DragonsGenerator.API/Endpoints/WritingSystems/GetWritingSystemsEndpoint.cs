using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemsEndpoint : EndpointWithoutRequest<List<WritingSystem>>
{
    private readonly GameDataRepository _repo;

    public GetWritingSystemsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/writing-systems");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var writingSystems = await _repo.GetWritingSystemsAsync(ct);
        await Send.OkAsync(writingSystems, ct);
    }
}
