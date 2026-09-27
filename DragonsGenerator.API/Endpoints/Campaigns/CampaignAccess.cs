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
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign is null) return (null, null, false);

        var isOwner = campaign.OwnerUserId == userId;
        var membership = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        return (campaign, membership, isOwner);
    }

    public static bool CanView(bool isOwner, CampaignMember? membership) =>
        isOwner || membership is not null;

    /// <summary>Édition live : owner/DM actif, campagne non fermée, membership non scellé.</summary>
    public static bool CanEdit(bool isOwner, CampaignMember? membership, CampaignRecord? campaign = null)
    {
        if (campaign?.ClosedAt is not null) return false;
        if (membership is not null && CampaignHistoryHelpers.IsFormerOrHistory(membership)) return false;
        return isOwner || membership?.Role == CampaignMemberRoles.Dm;
    }

    public static bool CanPlay(bool isOwner, CampaignMember? membership, CampaignRecord campaign)
    {
        if (campaign.ClosedAt is not null) return false;
        if (membership is not null && CampaignHistoryHelpers.IsFormerOrHistory(membership)) return false;
        if (membership?.Role == CampaignMemberRoles.Spectator) return false;
        return isOwner || (membership is not null && membership.Role == CampaignMemberRoles.Player);
    }

    public static bool IsSpectator(bool isOwner, CampaignMember? membership) =>
        !isOwner && membership?.Role == CampaignMemberRoles.Spectator;
}
