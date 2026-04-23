using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemTypesEndpoint : EndpointWithoutRequest<List<string>>
{
    public override void Configure()
    {
        Get("/writing-systems/types");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var writingSystems = await JsonDataLoader.LoadAsync<List<WritingSystem>>("writingSystems.json", ct);

        var types = writingSystems?
            .Select(w => w.Type)
            .Distinct()
            .OrderBy(t => t)
            .ToList() ?? [];

        await Send.OkAsync(types, ct);
    }
}