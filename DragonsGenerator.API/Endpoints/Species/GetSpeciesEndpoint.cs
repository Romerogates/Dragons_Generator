using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesEndpoint : EndpointWithoutRequest<List<Models.Species>>
{
    public override void Configure()
    {
        Get("/species");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = await JsonDataLoader.LoadAsync<SpeciesData>("species.json", ct);
        await Send.OkAsync(data?.Species ?? [], ct);
    }
}