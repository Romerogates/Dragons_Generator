using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public static class CampaignMembershipStatuses
{
    public const string Active = "active";
    public const string Left = "left";
    public const string Removed = "removed";
    public const string Closed = "closed";
}

public static class CampaignHistoryHelpers
{
    public static bool IsActivePlayer(CampaignMember m) =>
        m.Role == CampaignMemberRoles.Player
        && m.LeftAt is null
        && m.RemovedAt is null;

    public static bool IsFormerOrHistory(CampaignMember m) =>
        m.LeftAt is not null || m.RemovedAt is not null;

    public static string ResolveMembershipStatus(CampaignRecord campaign, CampaignMember? membership, bool isOwner)
    {
        if (campaign.ClosedAt is not null)
            return CampaignMembershipStatuses.Closed;
        if (membership?.RemovedAt is not null)
            return CampaignMembershipStatuses.Removed;
        if (membership?.LeftAt is not null)
            return CampaignMembershipStatuses.Left;
        if (isOwner || membership is not null)
            return CampaignMembershipStatuses.Active;
        return CampaignMembershipStatuses.Active;
    }

    public static bool IsHistoryView(CampaignRecord campaign, CampaignMember? membership) =>
        campaign.ClosedAt is not null
        || membership?.LeftAt is not null
        || membership?.RemovedAt is not null;

    /// <summary>Fige la vue joueur et marque départ volontaire.</summary>
    public static void SealLeft(CampaignMember member, string campaignJson)
    {
        member.HistorySnapshotJson = BuildPlayerSnapshot(campaignJson, member.UserId);
        member.LeftAt = DateTimeOffset.UtcNow;
        member.RemovedAt = null;
        member.ArchivedAt = null;
    }

    /// <summary>Fige la vue joueur et marque retrait MJ.</summary>
    public static void SealRemoved(CampaignMember member, string campaignJson)
    {
        member.HistorySnapshotJson = BuildPlayerSnapshot(campaignJson, member.UserId);
        member.RemovedAt = DateTimeOffset.UtcNow;
        member.LeftAt = null;
        member.ArchivedAt = null;
    }

    /// <summary>Snapshot pour un membre encore actif au moment de la fermeture MJ.</summary>
    public static void SealForClosure(CampaignMember member, string campaignJson)
    {
        if (!string.IsNullOrWhiteSpace(member.HistorySnapshotJson))
            return;
        member.HistorySnapshotJson = BuildPlayerSnapshot(campaignJson, member.UserId);
    }

    public static void Reactivate(CampaignMember member)
    {
        member.LeftAt = null;
        member.RemovedAt = null;
        member.HistorySnapshotJson = null;
        member.ArchivedAt = null;
        member.JoinedAt = DateTimeOffset.UtcNow;
    }

    public static string BuildPlayerSnapshot(string campaignJson, Guid playerUserId)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(campaignJson) ? "{}" : campaignJson);
        var filtered = CampaignJsonHelpers.FilterForPlayerView(doc.RootElement, playerUserId);
        return filtered.GetRawText();
    }

    public static JsonElement ParseSnapshotOrEmpty(string? snapshotJson)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(snapshotJson) ? "{}" : snapshotJson);
        return doc.RootElement.Clone();
    }
}
