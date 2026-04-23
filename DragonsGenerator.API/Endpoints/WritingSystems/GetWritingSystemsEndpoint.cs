using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemsEndpoint : EndpointWithoutRequest<List<WritingSystem>>
{
    public override void Configure()
    {
        Get("/writing-systems");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var writingSystems = await JsonDataLoader.LoadAsync<List<WritingSystem>>("writingSystems.json", ct);
        await Send.OkAsync(writingSystems ?? [], ct);
    }
}