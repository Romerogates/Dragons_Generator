using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentTypesEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly GameDataRepository _repo;

    public GetEquipmentTypesEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments/types");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await _repo.GetEquipmentsAsync(ct);
        var types = equipments
            .Select(e => e.Type)
            .Distinct()
            .OrderBy(t => t)
            .ToList();
        await Send.OkAsync(types, ct);
    }
}
