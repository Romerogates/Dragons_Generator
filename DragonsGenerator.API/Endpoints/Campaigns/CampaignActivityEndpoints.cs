using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

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
        if (!isOwner)
        {
            items = items
                .Where(i => CampaignJsonHelpers.IsActivityVisibleToPlayer(i.Kind))
                .Select(i => i with
                {
                    PayloadJson = CampaignJsonHelpers.FilterActivityPayloadForPlayer(i.Kind, i.PayloadJson),
                })
                .ToList();
        }

        await Send.OkAsync(items, ct);
    }
}
