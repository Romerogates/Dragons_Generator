using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class AwardCampaignXpEndpoint(AppDbContext db, PushNotificationService push, CampaignLivePublisher live)
    : Endpoint<AwardXpBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/award-xp");

    public override async Task HandleAsync(AwardXpBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (req.Xp <= 0)
        {
            AddError("XP invalide.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership, campaign))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == req.MemberId);
        if (member is null || member.Role != CampaignMemberRoles.Player)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        member.XpEarnedInCampaign += req.Xp;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var message = $"+{req.Xp} XP dans « {campaign.Title} »";
        await CampaignActivityService.LogAsync(
            db,
            campaign.Id,
            userId.Value,
            CampaignActivityKinds.XpAwarded,
            new
            {
                memberId = member.Id,
                memberUserId = member.UserId,
                xp = req.Xp,
                xpTotal = member.XpEarnedInCampaign,
                displayName = member.User?.DisplayName ?? "Joueur",
                message = $"+{req.Xp} XP",
            },
            ct);
        await push.NotifyUserAsync(
            member.UserId,
            "XP attribuée",
            message,
            member.ApprovedCharacterId is Guid charId
                ? $"/campaigns/{campaign.Id}?tab=players&levelUp=1&characterId={charId}"
                : $"/campaigns/{campaign.Id}?tab=players&levelUp=1",
            ct);
        await live.NotifyAsync(campaign.Id, campaign.UpdatedAt, CampaignLiveReasons.Xp, ct);
        await Send.OkAsync(new { member.XpEarnedInCampaign }, ct);
    }
}

