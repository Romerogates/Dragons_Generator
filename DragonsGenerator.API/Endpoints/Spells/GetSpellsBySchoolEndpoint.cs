using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellsBySchoolRequest
{
    public string School { get; set; } = string.Empty;
}

public class GetSpellsBySchoolEndpoint : Endpoint<GetSpellsBySchoolRequest, List<Spell>>
{
    private readonly GameDataRepository _repo;

    public GetSpellsBySchoolEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells/school/{school}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellsBySchoolRequest req, CancellationToken ct)
    {
        var spells = await _repo.GetSpellsAsync(ct);
        var filtered = spells
            .Where(s => string.Equals(s.School, req.School, StringComparison.OrdinalIgnoreCase))
            .ToList();
        await Send.OkAsync(filtered, ct);
    }
}
