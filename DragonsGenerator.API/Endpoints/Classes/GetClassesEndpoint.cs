using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Classes;

public class GetClassesEndpoint : EndpointWithoutRequest<List<CharacterClass>>
{
    public override void Configure()
    {
        Get("/classes");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var classes = await JsonDataLoader.LoadAsync<List<CharacterClass>>("classes.json", ct);
        await Send.OkAsync(classes ?? [], ct);
    }
}