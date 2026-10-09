using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class ProposeCharacterEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<ProposeCharacterBody>
{
    public override void Configure() => Post("/me/campaigns/{id}/propose-character");

    public override async Task HandleAsync(ProposeCharacterBody req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var campaignId = Route<Guid>("id");
        var member = await db.CampaignMembers
            .Include(m => m.Campaign)
            .FirstOrDefaultAsync(m => m.CampaignId == campaignId && m.UserId == userId && m.Role == CampaignMemberRoles.Player, ct);
        if (member is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (member.Campaign.ClosedAt is not null
            || member.LeftAt is not null
            || member.RemovedAt is not null)
        {
            AddError("Campagne en historique — proposition impossible.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == req.CharacterId && c.UserId == userId, ct);
        if (character is null)
        {
            AddError("Personnage introuvable.");
            await Send.ErrorsAsync(StatusCodes.Status404NotFound, ct);
            return;
        }

        var level = CampaignJsonHelpers.LevelFromCharacterJson(character.JsonData);

        member.ProposedCharacterId = character.Id;
        member.ProposedCharacterName = character.Name;
        member.ProposedCharacterLevel = level;
        member.ProposalStatus = CharacterProposalStatuses.Pending;
        member.Campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var proposer = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var message = $"{proposer.DisplayName} propose {character.Name} dans « {member.Campaign.Title} »";
        await CampaignActivityService.LogAsync(
            db,
            campaignId,
            userId.Value,
            CampaignActivityKinds.CharacterProposed,
            new
            {
                characterId = character.Id,
                characterName = character.Name,
                level,
                displayName = proposer.DisplayName,
                memberUserId = userId.Value,
                message,
            },
            ct);
        await push.NotifyUserAsync(
            member.Campaign.OwnerUserId,
            "Personnage à valider",
            message,
            $"/campaigns/{campaignId}?tab=players",
            ct);

        await Send.NoContentAsync(ct);
    }
}
