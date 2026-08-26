using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetEquipmentByIdEndpoint : Endpoint<GetEquipmentByIdRequest, Equipment>
{
    private readonly GameDataRepository _repo;

    public GetEquipmentByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEquipmentByIdRequest req, CancellationToken ct)
    {
        var equipment = await _repo.GetEquipmentByIdAsync(req.Id, ct);

        if (equipment is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(equipment, ct);
    }
}
