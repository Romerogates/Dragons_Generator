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

    public static bool CanEdit(bool isOwner, CampaignMember? membership) =>
        isOwner || membership?.Role == CampaignMemberRoles.Dm;
}
