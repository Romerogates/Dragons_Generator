using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class RejectCharacterProposalEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/reject");

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
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var member = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (member is null || member.ProposalStatus != CharacterProposalStatuses.Pending)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var characterId = member.ProposedCharacterId;
        var characterName = member.ProposedCharacterName ?? "votre personnage";
        var playerUserId = member.UserId;

        member.ProposalStatus = CharacterProposalStatuses.Rejected;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var player = await db.Users.AsNoTracking().FirstAsync(u => u.Id == playerUserId, ct);
        var message = $"{characterName} a été refusé dans « {campaign.Title} » — proposez-en un autre";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterRejected,
            new
            {
                characterId,
                characterName,
                displayName = player.DisplayName,
                memberUserId = playerUserId,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            playerUserId,
            "Personnage refusé",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}
