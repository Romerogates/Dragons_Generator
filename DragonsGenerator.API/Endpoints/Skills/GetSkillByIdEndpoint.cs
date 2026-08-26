using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Skills;

public class GetSkillByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetSkillByIdEndpoint : Endpoint<GetSkillByIdRequest, Skill>
{
    private readonly GameDataRepository _repo;

    public GetSkillByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/skills/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSkillByIdRequest req, CancellationToken ct)
    {
        var skill = await _repo.GetSkillByIdAsync(req.Id, ct);

        if (skill is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(skill, ct);
    }
}
