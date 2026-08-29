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
        return await (
            from a in db.CampaignActivities.AsNoTracking()
            join u in db.Users.AsNoTracking() on a.ActorUserId equals u.Id
            where a.CampaignId == campaignId
            orderby a.CreatedAt descending
            select new CampaignActivityDto(
                a.Id,
                a.ActorUserId,
                u.DisplayName,
                a.Kind,
                a.PayloadJson,
                a.CreatedAt)
        ).Take(limit).ToListAsync(ct);
    }
}

public record CampaignActivityDto(
    Guid Id,
    Guid ActorUserId,
    string ActorDisplayName,
    string Kind,
    string PayloadJson,
    DateTimeOffset CreatedAt);
