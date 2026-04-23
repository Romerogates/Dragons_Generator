
namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetCivilisationByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetCivilisationByIdEndpoint : Endpoint<GetCivilisationByIdRequest, Civilisation>
{
    public override void Configure()
    {
        Get("/civilisations/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetCivilisationByIdRequest req, CancellationToken ct)
    {
        var civilisations = await JsonDataLoader.LoadAsync<List<Civilisation>>("civilisations.json", ct);

        var civilisation = civilisations?.FirstOrDefault(c =>
            string.Equals(c.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (civilisation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(civilisation, ct);
    }
}