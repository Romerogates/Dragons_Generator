using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetHandicapByIdEndpoint : Endpoint<GetHandicapByIdRequest, Handicap>
{
    public override void Configure()
    {
        Get("/handicaps/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetHandicapByIdRequest req, CancellationToken ct)
    {
        var handicaps = await JsonDataLoader.LoadAsync<List<Handicap>>("handicaps.json", ct);

        var handicap = handicaps?.FirstOrDefault(h =>
            string.Equals(h.Id, req.Id, StringComparison.OrdinalIgnoreCase));

        if (handicap is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(handicap, ct);
    }

}