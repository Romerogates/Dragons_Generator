using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public static class CampaignAccess
{
    public static async Task<(CampaignRecord? Campaign, CampaignMember? Membership, bool IsOwner)> LoadAsync(
        AppDbContext db, Guid campaignId, Guid userId, CancellationToken ct)
    {
        var campaign = await db.Campaigns
            .Include(c => c.Members).ThenInclude(m => m.User)
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null) return (null, null, false);

        var isOwner = campaign.OwnerUserId == userId;
        var membership = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        if (!isOwner && membership is null)
            membership = await TrySupportInspectMembershipAsync(db, campaignId, userId, ct);
        return (campaign, membership, isOwner);
    }

    public static bool IsSupportInspect(CampaignMember? membership) =>
        membership is not null && membership.Role == CampaignMemberRoles.Support;

    public static bool CanView(bool isOwner, CampaignMember? membership) =>
        isOwner || membership is not null;

    /// <summary>Édition live : owner/DM actif, campagne non fermée, membership non scellé.</summary>
    public static bool CanEdit(bool isOwner, CampaignMember? membership, CampaignRecord? campaign = null)
    {
        if (IsSupportInspect(membership)) return false;
        if (campaign?.ClosedAt is not null) return false;
        if (membership is not null && CampaignHistoryHelpers.IsFormerOrHistory(membership)) return false;
        return isOwner || membership?.Role == CampaignMemberRoles.Dm;
    }

    public static bool CanPlay(bool isOwner, CampaignMember? membership, CampaignRecord campaign)
    {
        if (IsSupportInspect(membership)) return false;
        if (campaign.ClosedAt is not null) return false;
        if (membership is not null && CampaignHistoryHelpers.IsFormerOrHistory(membership)) return false;
        if (membership?.Role == CampaignMemberRoles.Spectator) return false;
        return isOwner || (membership is not null && membership.Role == CampaignMemberRoles.Player);
    }

    public static bool IsSpectator(bool isOwner, CampaignMember? membership) =>
        !isOwner && membership?.Role == CampaignMemberRoles.Spectator && !IsSupportInspect(membership);

    /// <summary>MJ ou joueur actif — pour joindre une campagne à un ticket.</summary>
    public static bool CanAttachToTicket(bool isOwner, CampaignMember? membership)
    {
        if (isOwner) return true;
        if (membership is null || IsSupportInspect(membership)) return false;
        if (CampaignHistoryHelpers.IsFormerOrHistory(membership)) return false;
        return membership.Role is CampaignMemberRoles.Dm or CampaignMemberRoles.Player;
    }

    public static async Task<(Guid? Id, string? Name, string? Error)> ResolveAttachableAsync(
        AppDbContext db, Guid userId, Guid campaignId, CancellationToken ct)
    {
        var campaign = await db.Campaigns.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null)
            return (null, null, "Campagne invalide.");

        var isOwner = campaign.OwnerUserId == userId;
        var membership = await db.CampaignMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.CampaignId == campaignId && m.UserId == userId, ct);
        if (!CanAttachToTicket(isOwner, membership))
            return (null, null, "Campagne invalide.");

        return (campaign.Id, campaign.Title, null);
    }

    private static async Task<CampaignMember?> TrySupportInspectMembershipAsync(
        AppDbContext db, Guid campaignId, Guid userId, CancellationToken ct)
    {
        var isAdmin = await db.Users.AsNoTracking()
            .AnyAsync(u => u.Id == userId && u.Role == AppRoles.Admin, ct);
        if (!isAdmin) return null;

        var onTicket = await db.SupportTickets.AsNoTracking()
            .AnyAsync(t => t.CampaignId == campaignId, ct);
        if (!onTicket)
        {
            onTicket = await db.SupportTicketMessages.AsNoTracking()
                .AnyAsync(m => m.CampaignId == campaignId, ct);
        }
        if (!onTicket) return null;

        return new CampaignMember
        {
            Id = Guid.Empty,
            CampaignId = campaignId,
            UserId = userId,
            Role = CampaignMemberRoles.Support,
            ProposalStatus = CharacterProposalStatuses.None,
        };
    }
}
