using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Backgrounds;

public class GetBackgroundByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetBackgroundByIdEndpoint : Endpoint<GetBackgroundByIdRequest, Background>
{
    public override void Configure()
    {
        Get("/backgrounds/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetBackgroundByIdRequest req, CancellationToken ct)
    {
        var backgrounds = await JsonDataLoader.LoadAsync<List<Background>>("backgrounds.json", ct);

        var background = backgrounds?.FirstOrDefault(b =>
            string.Equals(b.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (background is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(background, ct);
    }
}