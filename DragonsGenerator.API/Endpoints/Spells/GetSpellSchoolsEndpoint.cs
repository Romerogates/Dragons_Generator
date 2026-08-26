using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellSchoolsEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly GameDataRepository _repo;

    public GetSpellSchoolsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/spells/schools");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var spells = await _repo.GetSpellsAsync(ct);
        var schools = spells
            .Select(s => s.School)
            .Distinct()
            .OrderBy(s => s)
            .ToList();
        await Send.OkAsync(schools, ct);
    }
}
