using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class ApproveCharacterProposalEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/approve");

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

        member.ApprovedCharacterId = member.ProposedCharacterId;
        member.ApprovedCharacterName = member.ProposedCharacterName;
        member.ApprovedCharacterLevel = member.ProposedCharacterLevel;
        member.ProposalStatus = CharacterProposalStatuses.Approved;
        member.ProposedCharacterId = null;
        member.ProposedCharacterName = null;
        member.ProposedCharacterLevel = null;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var player = await db.Users.AsNoTracking().FirstAsync(u => u.Id == playerUserId, ct);
        var message = $"{characterName} est accepté dans « {campaign.Title} »";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterApproved,
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
            "Personnage approuvé",
            message,
            $"/campaigns/{campaignId}",
            ct);

        await Send.NoContentAsync(ct);
    }
}
