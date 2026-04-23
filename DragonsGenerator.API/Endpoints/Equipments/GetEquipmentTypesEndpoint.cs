using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentTypesEndpoint : EndpointWithoutRequest<List<string>>
{
    public override void Configure()
    {
        Get("/equipments/types");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);

        var types = equipments?
            .Select(e => e.Type)
            .Distinct()
            .OrderBy(t => t)
            .ToList() ?? [];

        await Send.OkAsync(types, ct);
    }
}