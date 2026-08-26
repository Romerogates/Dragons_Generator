using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentsEndpoint : EndpointWithoutRequest<List<Equipment>>
{
    private readonly GameDataRepository _repo;

    public GetEquipmentsEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await _repo.GetEquipmentsAsync(ct);
        await Send.OkAsync(equipments, ct);
    }
}
