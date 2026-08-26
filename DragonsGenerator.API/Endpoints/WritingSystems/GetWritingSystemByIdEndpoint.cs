using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetWritingSystemByIdEndpoint : Endpoint<GetWritingSystemByIdRequest, WritingSystem>
{
    private readonly GameDataRepository _repo;

    public GetWritingSystemByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/writing-systems/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetWritingSystemByIdRequest req, CancellationToken ct)
    {
        var writingSystem = await _repo.GetWritingSystemByIdAsync(req.Id, ct);

        if (writingSystem is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(writingSystem, ct);
    }
}
