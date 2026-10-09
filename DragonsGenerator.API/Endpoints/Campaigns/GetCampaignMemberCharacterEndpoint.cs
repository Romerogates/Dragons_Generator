using System.Text.Json;
using DragonsGenerator.API.Endpoints.Characters;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class GetCampaignMemberCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/campaigns/{id}/members/{memberId}/character");

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
        var scope = (Query<string>("scope", false) ?? "approved").Trim().ToLowerInvariant();

        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
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

        if (!isOwner && scope == "proposed")
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        Guid? characterId;
        string? displayName;

        if (scope == "proposed")
        {
            if (member.ProposalStatus != CharacterProposalStatuses.Pending || member.ProposedCharacterId is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            characterId = member.ProposedCharacterId;
            displayName = member.ProposedCharacterName;
        }
        else
        {
            if (member.ApprovedCharacterId is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            characterId = member.ApprovedCharacterId;
            displayName = member.ApprovedCharacterName;
        }

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == characterId, ct);
        if (character is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var name = displayName?.Trim() ?? character.Name;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(character.JsonData) ? "{}" : character.JsonData);
        await Send.OkAsync(new CharacterDto(character.Id, name, doc.RootElement.Clone(), character.UpdatedAt), ct);
    }
}
