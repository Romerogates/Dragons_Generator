using System.Text.Json;
using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Services;

public static class CampaignActivityKinds
{
    public const string InviteSent = "invite_sent";
    public const string InviteAccepted = "invite_accepted";
    public const string MemberJoined = "member_joined";
    public const string CharacterProposed = "character_proposed";
    public const string CharacterApproved = "character_approved";
    public const string CharacterRejected = "character_rejected";
    public const string XpAwarded = "xp_awarded";
    public const string SessionScheduled = "session_scheduled";
    public const string SessionUpdated = "session_updated";
    public const string PregenAssigned = "pregen_assigned";
    public const string HandoutPublished = "handout_published";
}

public static class CampaignActivityService
{
    public static async Task LogAsync(
        AppDbContext db,
        Guid campaignId,
        Guid actorUserId,
        string kind,
        object payload,
        CancellationToken ct = default)
    {
        db.CampaignActivities.Add(new CampaignActivity
        {
            CampaignId = campaignId,
            ActorUserId = actorUserId,
            Kind = kind,
            PayloadJson = JsonSerializer.Serialize(payload),
        });
        await db.SaveChangesAsync(ct);
    }

    public static async Task<List<CampaignActivityDto>> ListForCampaignAsync(
        AppDbContext db,
        Guid campaignId,
        int limit,
        CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 100);
        var rows = await db.CampaignActivities
            .AsNoTracking()
            .Where(a => a.CampaignId == campaignId)
            .ToListAsync(ct);

        rows = rows
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .ToList();

        if (rows.Count == 0)
            return [];

        var actorIds = rows.Select(r => r.ActorUserId).Distinct().ToList();
        var actors = await db.Users
            .AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        return rows.Select(r => new CampaignActivityDto(
            r.Id,
            r.ActorUserId,
            actors.GetValueOrDefault(r.ActorUserId, ""),
            r.Kind,
            r.PayloadJson,
            r.CreatedAt)).ToList();
    }
}

public record CampaignActivityDto(
    Guid Id,
    Guid ActorUserId,
    string ActorDisplayName,
    string Kind,
    string PayloadJson,
    DateTimeOffset CreatedAt);
