using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsByLevelRequest
{
    public int Level { get; set; }
}

public class GetSpellsByLevelEndpoint : Endpoint<GetSpellsByLevelRequest, List<Spell>>
{
    private readonly GameDataRepository _repo;

    public GetSpellsByLevelEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells/level/{level}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellsByLevelRequest req, CancellationToken ct)
    {
        var spells = await _repo.GetSpellsAsync(ct);
        var filtered = spells.Where(s => s.Level == req.Level).ToList();
        await Send.OkAsync(filtered, ct);
    }
}
