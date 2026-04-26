using System.Text.Json;
using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Handicaps;

public class GetHandicapRulesEndpoint : EndpointWithoutRequest<JsonElement>
{
    public override void Configure()
    {
        Get("/handicaps/rules");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var rules = await JsonDataLoader.LoadAsync<JsonElement>("handicap-rules.json", ct);
        await Send.OkAsync(rules, ct);
    }
}