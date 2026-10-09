using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class RequestCharacterPickEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/request-character");

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
        if (member is null
            || member.Role != CampaignMemberRoles.Player
            || member.ApprovedCharacterId is not null
            || member.ProposalStatus == CharacterProposalStatuses.Pending)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var playerUserId = member.UserId;
        var displayName = member.User?.DisplayName ?? "Joueur";
        var message =
            $"Le MJ de « {campaign.Title} » vous invite à choisir un personnage existant ou à en créer un pour la table.";
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterPickRequested,
            new
            {
                displayName,
                memberUserId = playerUserId,
                campaignTitle = campaign.Title,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            playerUserId,
            "Choisissez votre personnage",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}
