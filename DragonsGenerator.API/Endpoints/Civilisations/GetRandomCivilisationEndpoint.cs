
namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetRandomCivilisationEndpoint : EndpointWithoutRequest<Civilisation>
{
    public override void Configure()
    {
        Get("/civilisations/random");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var civilisations = await JsonDataLoader.LoadAsync<List<Civilisation>>("civilisations.json", ct);

        if (civilisations is null || civilisations.Count == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var roll = Random.Shared.Next(1, 101);

        var civilisation = civilisations.FirstOrDefault(c =>
            roll >= c.Randomization.DiceMin && roll <= c.Randomization.DiceMax);

        civilisation ??= civilisations[Random.Shared.Next(civilisations.Count)];

        await Send.OkAsync(civilisation, ct);
    }
}