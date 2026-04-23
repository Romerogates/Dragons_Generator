using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentSubtypesEndpoint : EndpointWithoutRequest<Dictionary<string, List<string>>>
{
    public override void Configure()
    {
        Get("/equipments/subtypes");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);

        var grouped = equipments?
            .Where(e => e.Subtype is not null)
            .GroupBy(e => e.Type)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.Subtype!)
                      .Distinct()
                      .OrderBy(s => s)
                      .ToList()
            ) ?? [];

        await Send.OkAsync(grouped, ct);
    }
}