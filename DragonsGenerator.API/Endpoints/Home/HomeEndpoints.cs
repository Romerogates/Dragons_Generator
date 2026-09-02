using DragonsGenerator.API.Endpoints.Friends;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Home;

public record HomeSummaryDto(
    int SavedCharactersCount,
    int UnreadChatCount,
    int PendingFriendRequests,
    int PendingCampaignInvites,
    int CampaignCount,
    HomeCampaignPreviewDto? RecentCampaign,
    HomeSessionPreviewDto? NextSession);

public record HomeCampaignPreviewDto(Guid Id, string Title, string Role, DateTimeOffset UpdatedAt);

public record HomeSessionPreviewDto(
    Guid CampaignId,
    string CampaignTitle,
    string SessionTitle,
    DateTimeOffset ScheduledAt);

public class GetHomeSummaryEndpoint(AppDbContext db, ILogger<GetHomeSummaryEndpoint> logger)
    : EndpointWithoutRequest<HomeSummaryDto>
{
    public override void Configure() => Get("/me/home-summary");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        try
        {
            await Send.OkAsync(await BuildSummaryAsync(userId.Value, ct), ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "home-summary failed for user {UserId}", userId);
            await Send.ErrorsAsync(500, ct);
        }
    }

    internal static async Task<HomeSummaryDto> BuildSummaryAsync(Guid userId, CancellationToken ct)
    {
        var charCount = await db.Characters.CountAsync(c => c.UserId == userId, ct);

        var pendingFriends = await db.Friendships.CountAsync(
            f => f.AddresseeId == userId && f.Status == FriendStatuses.Pending, ct);

        var pendingInvites = await db.CampaignInvites.CountAsync(
            i => i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending, ct);

        var owned = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .Select(c => new { c.Id, c.Title, c.UpdatedAt, c.JsonData, Role = CampaignMemberRoles.Dm })
            .ToListAsync(ct);

        var joined = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.Role == CampaignMemberRoles.Player)
            .Select(m => new
            {
                m.CampaignId,
                m.Campaign.Title,
                m.Campaign.UpdatedAt,
                m.Campaign.JsonData,
                Role = CampaignMemberRoles.Player,
            })
            .ToListAsync(ct);

        var allCampaigns = owned
            .Select(c => new { c.Id, c.Title, c.UpdatedAt, c.JsonData, c.Role })
            .Concat(joined.Select(c => new { Id = c.CampaignId, c.Title, c.UpdatedAt, c.JsonData, c.Role }))
            .OrderByDescending(c => c.UpdatedAt)
            .ToList();

        var recent = allCampaigns.FirstOrDefault();
        HomeCampaignPreviewDto? recentDto = recent is null
            ? null
            : new HomeCampaignPreviewDto(recent.Id, recent.Title, recent.Role, recent.UpdatedAt);

        HomeSessionPreviewDto? nextSession = null;
        foreach (var c in allCampaigns)
        {
            var when = CampaignJsonHelpers.NextSessionFromJson(c.JsonData);
            if (when is null) continue;
            if (nextSession is null || when < nextSession.ScheduledAt)
            {
                nextSession = new HomeSessionPreviewDto(
                    c.Id, c.Title, SessionTitleFromJson(c.JsonData, when.Value), when.Value);
            }
        }

        var friendships = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendStatuses.Accepted &&
                (f.RequesterId == userId || f.AddresseeId == userId))
            .ToListAsync(ct);

        var friendIds = friendships
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Distinct()
            .ToList();

        var readMarkers = new Dictionary<Guid, DateTimeOffset>();
        var unreadTotal = 0;
        try
        {
            readMarkers = await db.FriendChatReads.AsNoTracking()
                .Where(r => r.UserId == userId)
                .ToDictionaryAsync(r => r.FriendUserId, r => r.LastReadAt, ct);

            if (friendIds.Count > 0)
            {
                var inbound = await db.FriendMessages.AsNoTracking()
                    .Where(m => m.RecipientId == userId && friendIds.Contains(m.SenderId))
                    .Select(m => new { m.SenderId, m.CreatedAt })
                    .ToListAsync(ct);

                foreach (var friendId in friendIds)
                {
                    var lastRead = readMarkers.GetValueOrDefault(friendId, DateTimeOffset.MinValue);
                    unreadTotal += inbound.Count(m => m.SenderId == friendId && m.CreatedAt > lastRead);
                }
            }
        }
        catch
        {
            unreadTotal = 0;
        }

        return new HomeSummaryDto(
            charCount,
            unreadTotal,
            pendingFriends,
            pendingInvites,
            allCampaigns.Count,
            recentDto,
            nextSession);
    }

    private static string SessionTitleFromJson(string json, DateTimeOffset when)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (!doc.RootElement.TryGetProperty("sessions", out var sessions) || sessions.ValueKind != System.Text.Json.JsonValueKind.Array)
                return "Prochaine session";

            foreach (var session in sessions.EnumerateArray())
            {
                if (!session.TryGetProperty("scheduledAt", out var at)) continue;
                if (!DateTimeOffset.TryParse(at.GetString(), out var parsed)) continue;
                if (parsed != when) continue;
                if (session.TryGetProperty("title", out var title))
                {
                    var t = title.GetString();
                    if (!string.IsNullOrWhiteSpace(t)) return t!;
                }
            }
        }
        catch { /* ignore */ }

        return "Prochaine session";
    }
}
