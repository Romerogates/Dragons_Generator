

namespace DragonsGenerator.API.Endpoints.Languages;

public class GetLanguagesEndpoint : EndpointWithoutRequest<List<Language>>
{
    public override void Configure()
    {
        Get("/languages");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await JsonDataLoader.LoadAsync<List<Language>>("languages.json", ct);
        await Send.OkAsync(languages ?? [], ct);
    }
}