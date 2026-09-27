using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

/// <summary>Invite ou convertit un membre en spectateur (lecture table, pas de siège).</summary>
public class SetMemberSpectatorEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/campaigns/{id}/members/{memberId}/spectator");

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
        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campaignId, userId.Value, ct);
        if (campaign is null || !CampaignAccess.CanEdit(isOwner, membership, campaign))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var target = campaign.Members.FirstOrDefault(m => m.Id == memberId);
        if (target is null || target.UserId == campaign.OwnerUserId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        target.Role = CampaignMemberRoles.Spectator;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

/// <summary>Se déclarer spectateur via lien (ou rejoindre directement en spectateur).</summary>
public class JoinCampaignAsSpectatorEndpoint(AppDbContext db) : EndpointWithoutRequest<CampaignSummaryDto>
{
    public override void Configure() => Post("/me/join/{token}/spectator");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var token = Route<string>("token")?.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.JoinEnabled && c.JoinToken == token, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (campaign.ClosedAt is not null)
        {
            AddError("Cette campagne est fermée.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        if (campaign.OwnerUserId == userId)
        {
            await Send.OkAsync(
                new CampaignSummaryDto(
                    campaign.Id,
                    campaign.Title,
                    CampaignMemberRoles.Dm,
                    campaign.UpdatedAt,
                    campaign.Members.Count(CampaignHistoryHelpers.IsActivePlayer),
                    CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData)),
                ct);
            return;
        }

        var existing = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        if (existing is null)
        {
            db.CampaignMembers.Add(new CampaignMember
            {
                CampaignId = campaign.Id,
                UserId = userId.Value,
                Role = CampaignMemberRoles.Spectator,
                ProposalStatus = CharacterProposalStatuses.None,
            });
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        else if (existing.LeftAt is not null || existing.RemovedAt is not null)
        {
            CampaignHistoryHelpers.Reactivate(existing);
            existing.Role = CampaignMemberRoles.Spectator;
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        else if (existing.Role != CampaignMemberRoles.Spectator
                 && existing.ProposalStatus == CharacterProposalStatuses.None
                 && existing.ApprovedCharacterId is null)
        {
            // Membre sans perso validé → peut passer spectateur
            existing.Role = CampaignMemberRoles.Spectator;
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        var playerCount = campaign.Members.Count(CampaignHistoryHelpers.IsActivePlayer);
        await Send.OkAsync(
            new CampaignSummaryDto(
                campaign.Id,
                campaign.Title,
                CampaignMemberRoles.Spectator,
                campaign.UpdatedAt,
                playerCount,
                CampaignJsonHelpers.RegionNameFromJson(campaign.JsonData)),
            ct);
    }
}
