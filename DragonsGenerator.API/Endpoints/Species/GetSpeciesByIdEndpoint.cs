

namespace DragonsGenerator.API.Endpoints.Species;

public class GetSpeciesByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetSpeciesByIdEndpoint : Endpoint<GetSpeciesByIdRequest, Models.Species>
{
    public override void Configure()
    {
        Get("/species/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpeciesByIdRequest req, CancellationToken ct)
    {
        var data = await JsonDataLoader.LoadAsync<SpeciesData>("species.json", ct);

        var species = data?.Species.FirstOrDefault(s =>
            string.Equals(s.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (species is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(species, ct);
    }
}