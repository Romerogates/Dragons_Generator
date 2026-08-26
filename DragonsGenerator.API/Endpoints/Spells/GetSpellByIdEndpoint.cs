using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetSpellByIdEndpoint : Endpoint<GetSpellByIdRequest, Spell>
{
    private readonly GameDataRepository _repo;

    public GetSpellByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellByIdRequest req, CancellationToken ct)
    {
        var spell = await _repo.GetSpellByIdAsync(req.Id, ct);

        if (spell is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(spell, ct);
    }
}
