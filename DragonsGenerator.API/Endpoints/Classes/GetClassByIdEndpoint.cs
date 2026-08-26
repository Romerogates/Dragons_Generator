

using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Classes;

public class GetClassByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetClassByIdEndpoint : Endpoint<GetClassByIdRequest, CharacterClass>
{
    private readonly GameDataRepository _repo;

    public GetClassByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/classes/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetClassByIdRequest req, CancellationToken ct)
    {
        var characterClass = await _repo.GetClassByIdAsync(req.Id, ct);

        if (characterClass is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(characterClass, ct);
    }
}
