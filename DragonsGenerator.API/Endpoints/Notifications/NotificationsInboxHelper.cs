using System.Text.Json;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Notifications;

public static class NotificationsInboxHelper
{
    public static readonly TimeSpan ApprovedNotificationWindow = TimeSpan.FromDays(14);

    public static string Preview(string body, int maxLen)
    {
        var preview = (body ?? "").Trim();
        if (preview.Length <= maxLen) return preview;
        var cut = Math.Max(0, maxLen - 3);
        return preview[..cut] + "…";
    }

    public static bool TryGetMemberUserId(string payloadJson, out Guid memberUserId)
    {
        memberUserId = default;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            if (!doc.RootElement.TryGetProperty("memberUserId", out var prop))
                return false;
            if (prop.ValueKind == JsonValueKind.String && Guid.TryParse(prop.GetString(), out memberUserId))
                return true;
            return false;
        }
        catch
        {
            return false;
        }
    }

    public static string? TryGetString(string payloadJson, string propertyName)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            if (doc.RootElement.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String)
                return prop.GetString();
        }
        catch
        {
            /* ignore */
        }

        return null;
    }

    public static (int Friends, int Campaigns, int Support, int Total) CountActionBadges(
        IEnumerable<NotificationItemDto> items)
    {
        var friendsCount = items.Count(i => i.Kind is "friend_request" or "friend_message");
        var campaignsCount = items.Count(i =>
            i.Kind is "campaign_invite"
                or "character_proposal"
                or "character_pick_requested"
                or "proposal_rejected");
        var supportCount = items.Count(i => i.Kind == "support_reply");
        return (friendsCount, campaignsCount, supportCount, friendsCount + campaignsCount + supportCount);
    }

    public static async Task<List<CampaignActivity>> LoadScopedActivitiesAsync(
        AppDbContext db,
        IReadOnlyCollection<Guid> campaignIds,
        string kind,
        DateTimeOffset since,
        int take,
        CancellationToken ct)
    {
        if (campaignIds.Count == 0)
            return [];

        var acts = await db.CampaignActivities.AsNoTracking()
            .Where(a => a.Kind == kind && campaignIds.Contains(a.CampaignId))
            .ToListAsync(ct);

        return acts
            .Where(a => a.CreatedAt >= since)
            .OrderByDescending(a => a.CreatedAt)
            .Take(take)
            .ToList();
    }

    public static async Task<Dictionary<Guid, string>> CampaignTitlesAsync(
        AppDbContext db,
        IEnumerable<Guid> campaignIds,
        CancellationToken ct)
    {
        var ids = campaignIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, string>();

        return await db.Campaigns.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Title, ct);
    }

    public static async Task<Dictionary<(Guid CampaignId, Guid MemberUserId), DateTimeOffset>> LatestActivityTimesAsync(
        AppDbContext db,
        List<Guid> campaignIds,
        string kind,
        bool matchActorUserId,
        List<Guid> memberUserIds,
        CancellationToken ct)
    {
        var result = new Dictionary<(Guid, Guid), DateTimeOffset>();
        if (campaignIds.Count == 0 || memberUserIds.Count == 0)
            return result;

        var acts = (await db.CampaignActivities.AsNoTracking()
                .Where(a => campaignIds.Contains(a.CampaignId) && a.Kind == kind)
                .ToListAsync(ct))
            .OrderByDescending(a => a.CreatedAt)
            .Take(200)
            .ToList();

        var memberSet = memberUserIds.ToHashSet();
        foreach (var act in acts)
        {
            Guid? memberUserId = null;
            if (matchActorUserId && memberSet.Contains(act.ActorUserId))
                memberUserId = act.ActorUserId;
            else if (TryGetMemberUserId(act.PayloadJson, out var fromPayload) && memberSet.Contains(fromPayload))
                memberUserId = fromPayload;

            if (memberUserId is null)
                continue;

            var key = (act.CampaignId, memberUserId.Value);
            if (!result.ContainsKey(key))
                result[key] = act.CreatedAt;
        }

        return result;
    }
}
