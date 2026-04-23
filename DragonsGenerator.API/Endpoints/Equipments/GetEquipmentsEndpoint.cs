

namespace DragonsGenerator.API.Endpoints.Equipments;

public class GetEquipmentsEndpoint : EndpointWithoutRequest<List<Equipment>>
{
    public override void Configure()
    {
        Get("/equipments");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var equipments = await JsonDataLoader.LoadAsync<List<Equipment>>("equipments.json", ct);
        await Send.OkAsync(equipments ?? [], ct);
    }
}