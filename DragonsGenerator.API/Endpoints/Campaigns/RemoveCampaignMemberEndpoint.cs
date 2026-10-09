using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class RemoveCampaignMemberEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}/members/{memberId}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var memberId = Route<Guid>("memberId");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.Role != CampaignMemberRoles.Player)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (member.LeftAt is not null || member.RemovedAt is not null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        var displayName = member.User?.DisplayName ?? "Joueur";
        var removedUserId = member.UserId;

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        if (data["pregenCharacters"] is System.Text.Json.Nodes.JsonArray)
        {
            CampaignPregenHelpers.UnassignUser(data, removedUserId.ToString());
            campaign.JsonData = data.ToJsonString();
        }

        CampaignHistoryHelpers.SealRemoved(member, campaign.JsonData);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.MemberRemoved,
            new { displayName, userId = removedUserId },
            ct);

        await Send.NoContentAsync(ct);
    }
}
