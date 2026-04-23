
namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetEquipmentByIdEndpoint : Endpoint<GetEquipmentByIdRequest, Equipment>
{
    public override void Configure()
    {
        Get("/equipments/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEquipmentByIdRequest req, CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);

        var equipment = equipments?.FirstOrDefault(e =>
            string.Equals(e.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (equipment is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(equipment, ct);
    }
}