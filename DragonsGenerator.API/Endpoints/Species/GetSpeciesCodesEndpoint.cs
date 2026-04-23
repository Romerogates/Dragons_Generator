using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Species;

public record SpeciesCodesResponse(
    Dictionary<string, string> SizeCodes,
    Dictionary<string, string> AbilityCodes
);

public class GetSpeciesCodesEndpoint : EndpointWithoutRequest<SpeciesCodesResponse>
{
    public override void Configure()
    {
        Get("/species/codes");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = await JsonDataLoader.LoadAsync<SpeciesData>("species.json", ct);

        if (data is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new SpeciesCodesResponse(data.SizeCodes, data.AbilityCodes), ct);
    }
}