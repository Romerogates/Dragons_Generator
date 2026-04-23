

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguageByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetLanguageByIdEndpoint : Endpoint<GetLanguageByIdRequest, Language>
{
    public override void Configure()
    {
        Get("/languages/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetLanguageByIdRequest req, CancellationToken ct)
    {
        var languages = await JsonDataLoader.LoadAsync<List<Language>>("languages.json", ct);

        var language = languages?.FirstOrDefault(l =>
            string.Equals(l.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (language is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(language, ct);
    }
}