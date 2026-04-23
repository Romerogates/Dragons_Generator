

namespace DragonsGenerator.API.Endpoints.Classes;

public class GetClassByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetClassByIdEndpoint : Endpoint<GetClassByIdRequest, CharacterClass>
{
    public override void Configure()
    {
        Get("/classes/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetClassByIdRequest req, CancellationToken ct)
    {
        var classes = await JsonDataLoader.LoadAsync<List<CharacterClass>>("classes.json", ct);

        var characterClass = classes?.FirstOrDefault(c =>
            string.Equals(c.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (characterClass is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(characterClass, ct);
    }
}