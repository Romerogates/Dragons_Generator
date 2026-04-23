using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemsByTypeRequest
{
    public string Type { get; set; } = string.Empty;
}

public class GetWritingSystemsByTypeEndpoint : Endpoint<GetWritingSystemsByTypeRequest, List<WritingSystem>>
{
    public override void Configure()
    {
        Get("/writing-systems/type/{type}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetWritingSystemsByTypeRequest req, CancellationToken ct)
    {
        var writingSystems = await JsonDataLoader.LoadAsync<List<WritingSystem>>("writingSystems.json", ct);

        var filtered = writingSystems?
            .Where(w => string.Equals(w.Type, req.Type, StringComparison.OrdinalIgnoreCase))
            .ToList() ?? [];

        await Send.OkAsync(filtered, ct);
    }
}