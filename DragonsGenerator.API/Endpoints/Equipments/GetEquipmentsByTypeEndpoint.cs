using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentsByTypeRequest
{
    public string Type { get; set; } = string.Empty;
}

public class GetEquipmentsByTypeEndpoint : Endpoint<GetEquipmentsByTypeRequest, List<Equipment>>
{
    private readonly GameDataRepository _repo;

    public GetEquipmentsByTypeEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments/type/{type}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEquipmentsByTypeRequest req, CancellationToken ct)
    {
        var equipments = await _repo.GetEquipmentsAsync(ct);
        var filtered = equipments
            .Where(e => string.Equals(e.Type, req.Type, StringComparison.OrdinalIgnoreCase))
            .ToList();
        await Send.OkAsync(filtered, ct);
    }
}
