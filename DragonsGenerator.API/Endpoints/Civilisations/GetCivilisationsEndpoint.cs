
namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetCivilisationsEndpoint : EndpointWithoutRequest<List<Civilisation>>
{
    public override void Configure()
    {
        Get("/civilisations");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var civilisations = await JsonDataLoader.LoadAsync<List<Civilisation>>("civilisations.json", ct);
        await Send.OkAsync(civilisations ?? [], ct);
    }
}