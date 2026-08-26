using DragonsGenerator.API.Common;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentsSummaryEndpoint : EndpointWithoutRequest<List<EquipmentSummaryDto>>
{
    private readonly GameDataRepository _repo;

    public GetEquipmentsSummaryEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/equipments/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var summaries = await _repo.GetEquipmentsSummaryAsync(ct);
        await Send.OkAsync(summaries, ct);
    }
}
