using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapsEndpoint : EndpointWithoutRequest<List<Handicap>>
{
    public override void Configure()
    {
        Get("/handicaps");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var handicaps = await JsonDataLoader.LoadAsync<List<Handicap>>("handicaps.json", ct);
        await Send.OkAsync(handicaps ?? [], ct);
    }
}