using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class ListCampaignActivityEndpoint(AppDbContext db) : EndpointWithoutRequest<List<CampaignActivityDto>>
{
    public override void Configure() => Get("/me/campaigns/{id}/activity");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var limit = Query<int?>("limit", false) ?? 50;
        var items = await CampaignActivityService.ListForCampaignAsync(db, id, limit, ct);
        await Send.OkAsync(items, ct);
    }
}
