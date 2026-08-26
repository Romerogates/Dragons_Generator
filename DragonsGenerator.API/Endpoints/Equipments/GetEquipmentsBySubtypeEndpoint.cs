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
    private readonly GameDataRepository _repo;

    public GetEquipmentsBySubtypeEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments/subtype/{subtype}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEquipmentsBySubtypeRequest req, CancellationToken ct)
    {
        var equipments = await _repo.GetEquipmentsAsync(ct);
        var filtered = equipments
            .Where(e => string.Equals(e.Subtype, req.Subtype, StringComparison.OrdinalIgnoreCase))
            .ToList();
        await Send.OkAsync(filtered, ct);
    }
}
