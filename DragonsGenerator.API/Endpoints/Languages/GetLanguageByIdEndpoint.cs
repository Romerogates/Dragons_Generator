using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguageByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetLanguageByIdEndpoint : Endpoint<GetLanguageByIdRequest, Language>
{
    private readonly GameDataRepository _repo;

    public GetLanguageByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/languages/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetLanguageByIdRequest req, CancellationToken ct)
    {
        var language = await _repo.GetLanguageByIdAsync(req.Id, ct);

        if (language is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(language, ct);
    }
}
