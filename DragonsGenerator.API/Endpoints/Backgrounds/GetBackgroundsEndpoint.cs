using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Backgrounds;

public class GetBackgroundsEndpoint : EndpointWithoutRequest<List<Background>>
{
    public override void Configure()
    {
        Get("/backgrounds");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var backgrounds = await JsonDataLoader.LoadAsync<List<Background>>("backgrounds.json", ct);
        await Send.OkAsync(backgrounds ?? [], ct);
    }
}