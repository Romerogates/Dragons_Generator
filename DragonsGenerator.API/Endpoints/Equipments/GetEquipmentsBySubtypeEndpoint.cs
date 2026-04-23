using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentsBySubtypeRequest
{
    public string Subtype { get; set; } = string.Empty;
}

public class GetEquipmentsBySubtypeEndpoint : Endpoint<GetEquipmentsBySubtypeRequest, List<Equipment>>
{
    public override void Configure()
    {
        Get("/equipments/subtype/{subtype}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEquipmentsBySubtypeRequest req, CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);

        var filtered = equipments?
            .Where(e => string.Equals(e.Subtype, req.Subtype, StringComparison.OrdinalIgnoreCase))
            .ToList() ?? [];

        await Send.OkAsync(filtered, ct);
    }
}