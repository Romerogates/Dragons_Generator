

namespace DragonsGenerator.API.Endpoints.Spells;

public class GetSpellByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetSpellByIdEndpoint : Endpoint<GetSpellByIdRequest, Spell>
{
    public override void Configure()
    {
        Get("/spells/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetSpellByIdRequest req, CancellationToken ct)
    {
        var spells = await JsonDataLoader.LoadAsync<List<Spell>>("spells.json", ct);

        var spell = spells?.FirstOrDefault(s =>
            string.Equals(s.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (spell is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(spell, ct);
    }
}