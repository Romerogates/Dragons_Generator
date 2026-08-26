using DragonsGenerator.API.Common;
using DragonsGenerator.API.Models;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Civilisations;

public class GetCivilisationByIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public class GetCivilisationByIdEndpoint : Endpoint<GetCivilisationByIdRequest, Civilisation>
{
    private readonly GameDataRepository _repo;

    public GetCivilisationByIdEndpoint(GameDataRepository repo) => _repo = repo;

    public override void Configure()
    {
        Get("/civilisations/{id}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetCivilisationByIdRequest req, CancellationToken ct)
    {
        var civilisation = await _repo.GetCivilisationByIdAsync(req.Id, ct);

        if (civilisation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(civilisation, ct);
    }
}
