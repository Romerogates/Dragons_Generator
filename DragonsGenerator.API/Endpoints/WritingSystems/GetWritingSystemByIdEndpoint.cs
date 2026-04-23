using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.WritingSystems;

public class GetWritingSystemByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetWritingSystemByIdEndpoint : Endpoint<GetWritingSystemByIdRequest, WritingSystem>
{
    public override void Configure()
    {
        Get("/writing-systems/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetWritingSystemByIdRequest req, CancellationToken ct)
    {
        var writingSystems = await JsonDataLoader.LoadAsync<List<WritingSystem>>("writingSystems.json", ct);

        var writingSystem = writingSystems?.FirstOrDefault(w =>
            string.Equals(w.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (writingSystem is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(writingSystem, ct);
    }
}