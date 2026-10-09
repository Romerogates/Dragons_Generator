using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class LeaveCampaignEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}/leave");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (campaign.OwnerUserId == userId)
        {
            AddError("Le MJ ne peut pas quitter sa propre campagne. Supprimez-la si besoin.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(
            m => m.UserId == userId && m.Role == CampaignMemberRoles.Player);
        if (member is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (member.LeftAt is not null || member.RemovedAt is not null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        if (campaign.ClosedAt is not null)
        {
            AddError("Cette campagne est déjà fermée — consultez l’historique.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var displayName = member.User?.DisplayName ?? "Joueur";

        var data = CampaignPregenHelpers.ParseDataObject(campaign.JsonData);
        if (data["pregenCharacters"] is System.Text.Json.Nodes.JsonArray)
        {
            CampaignPregenHelpers.UnassignUser(data, userId.Value.ToString());
            campaign.JsonData = data.ToJsonString();
        }

        CampaignHistoryHelpers.SealLeft(member, campaign.JsonData);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.MemberLeft,
            new { displayName, userId = userId.Value },
            ct);

        await Send.NoContentAsync(ct);
    }
}
