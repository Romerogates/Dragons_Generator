using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Skills;

public class GetSkillsEndpoint : EndpointWithoutRequest<List<Skill>>
{
    private readonly GameDataRepository _repo;

    public GetSkillsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/skills");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var skills = await _repo.GetSkillsAsync(ct);
        await Send.OkAsync(skills, ct);
    }
}
