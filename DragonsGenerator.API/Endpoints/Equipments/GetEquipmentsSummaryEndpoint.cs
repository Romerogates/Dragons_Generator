

namespace DragonsGenerator.API.Endpoints.Equipments;

public record EquipmentSummary(
    string Id,
    string Name,
    string Type,
    string? Subtype,
    Cost Cost,
    double? WKg
);

public class GetEquipmentsSummaryEndpoint : EndpointWithoutRequest<List<EquipmentSummary>>
{
    public override void Configure()
    {
        Get("/equipments/summary");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);

        var summaries = equipments?
            .Select(e => new EquipmentSummary(
                Id: e.Id,
                Name: e.Name,
                Type: e.Type,
                Subtype: e.Subtype,
                Cost: e.Cost,
                WKg: e.WKg
            ))
            .ToList() ?? [];

        await Send.OkAsync(summaries, ct);
    }
}