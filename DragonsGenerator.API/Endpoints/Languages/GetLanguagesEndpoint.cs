using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguagesEndpoint : EndpointWithoutRequest<List<Language>>
{
    private readonly GameDataRepository _repo;

    public GetLanguagesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/languages");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await _repo.GetLanguagesAsync(ct);
        await Send.OkAsync(languages, ct);
    }
}
