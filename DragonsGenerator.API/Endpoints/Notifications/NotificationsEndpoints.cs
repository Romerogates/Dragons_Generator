using System.Text.Json;
using DragonsGenerator.API.Endpoints.Friends;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Notifications;

public record NotificationItemDto(
    string Key,
    string Kind,
    string Title,
    string Message,
    string ActionPath,
    DateTimeOffset CreatedAt
);

public record NotificationsSummaryDto(
    int FriendsActionCount,
    int CampaignsActionCount,
    int TotalCount,
    List<NotificationItemDto> Notifications
);

public class ListNotificationsEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    private static readonly TimeSpan ApprovedNotificationWindow = TimeSpan.FromDays(14);

    public override void Configure() => Get("/me/notifications");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var items = new List<NotificationItemDto>();

        var friendRequests = await db.Friendships.AsNoTracking()
            .Where(f => f.AddresseeId == userId && f.Status == FriendStatuses.Pending)
            .Include(f => f.Requester)
            .ToListAsync(ct);
        friendRequests = friendRequests.OrderByDescending(f => f.CreatedAt).ToList();

        foreach (var f in friendRequests)
        {
            items.Add(
                new NotificationItemDto(
                    $"friend-{f.Id}",
                    "friend_request",
                    "Demande d'ami",
                    $"{f.Requester.DisplayName} souhaite vous ajouter.",
                    "/friends",
                    f.CreatedAt
                )
            );
        }

        var inviteRows = await (
            from i in db.CampaignInvites.AsNoTracking()
            join c in db.Campaigns.AsNoTracking() on i.CampaignId equals c.Id
            join u in db.Users.AsNoTracking() on i.InvitedByUserId equals u.Id
            where i.InvitedUserId == userId && i.Status == CampaignInviteStatuses.Pending
            select new { i.Id, i.CampaignId, c.Title, u.DisplayName, i.CreatedAt }
        ).ToListAsync(ct);

        foreach (var inv in inviteRows.OrderByDescending(x => x.CreatedAt))
        {
            items.Add(
                new NotificationItemDto(
                    $"invite-{inv.Id}",
                    "campaign_invite",
                    "Invitation campagne",
                    $"{inv.DisplayName} vous invite à « {inv.Title} ».",
                    "/campaigns",
                    inv.CreatedAt
                )
            );
        }

        var ownedCampaignIds = await db.Campaigns.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .Select(c => c.Id)
            .ToListAsync(ct);
        var dmCampaignIds = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.Role == CampaignMemberRoles.Dm)
            .Select(m => m.CampaignId)
            .ToListAsync(ct);
        var reviewCampaignIds = ownedCampaignIds.Concat(dmCampaignIds).Distinct().ToList();

        if (reviewCampaignIds.Count > 0)
        {
            var pendingProposals = await db.CampaignMembers.AsNoTracking()
                .Where(m =>
                    reviewCampaignIds.Contains(m.CampaignId)
                    && m.UserId != userId
                    && m.ProposalStatus == CharacterProposalStatuses.Pending
                )
                .Include(m => m.User)
                .Include(m => m.Campaign)
                .ToListAsync(ct);

            var proposedAtByMember = await LatestActivityTimesAsync(
                db,
                reviewCampaignIds,
                CampaignActivityKinds.CharacterProposed,
                matchActorUserId: true,
                memberUserIds: pendingProposals.Select(m => m.UserId).ToList(),
                ct);

            foreach (var m in pendingProposals.OrderByDescending(m =>
                         proposedAtByMember.GetValueOrDefault((m.CampaignId, m.UserId), m.JoinedAt)))
            {
                var name = m.ProposedCharacterName ?? "un personnage";
                var createdAt = proposedAtByMember.GetValueOrDefault((m.CampaignId, m.UserId), m.JoinedAt);
                items.Add(
                    new NotificationItemDto(
                        $"proposal-{m.Id}",
                        "character_proposal",
                        "Personnage à valider",
                        $"{m.User.DisplayName} propose {name} dans « {m.Campaign.Title} ».",
                        $"/campaigns/{m.CampaignId}?tab=players",
                        createdAt
                    )
                );
            }
        }

        var rejected = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.ProposalStatus == CharacterProposalStatuses.Rejected)
            .Include(m => m.Campaign)
            .ToListAsync(ct);

        var rejectedCampaignIds = rejected.Select(m => m.CampaignId).Distinct().ToList();
        var rejectedAtByMember = await LatestActivityTimesAsync(
            db,
            rejectedCampaignIds,
            CampaignActivityKinds.CharacterRejected,
            matchActorUserId: false,
            memberUserIds: [userId.Value],
            ct);

        foreach (var m in rejected.OrderByDescending(m =>
                     rejectedAtByMember.GetValueOrDefault((m.CampaignId, userId.Value), m.JoinedAt)))
        {
            var createdAt = rejectedAtByMember.GetValueOrDefault((m.CampaignId, userId.Value), m.JoinedAt);
            items.Add(
                new NotificationItemDto(
                    $"rejected-{m.Id}",
                    "proposal_rejected",
                    "Personnage refusé",
                    $"Votre proposition dans « {m.Campaign.Title} » a été refusée — proposez-en un autre.",
                    $"/campaigns/{m.CampaignId}?tab=players",
                    createdAt
                )
            );
        }

        var needsCharacter = await db.CampaignMembers.AsNoTracking()
            .Where(m =>
                m.UserId == userId
                && m.Role == CampaignMemberRoles.Player
                && m.ApprovedCharacterId == null
                && m.ProposalStatus != CharacterProposalStatuses.Pending)
            .Include(m => m.Campaign)
            .ToListAsync(ct);

        var pickCampaignIds = needsCharacter.Select(m => m.CampaignId).Distinct().ToList();
        var pickAtByMember = await LatestActivityTimesAsync(
            db,
            pickCampaignIds,
            CampaignActivityKinds.CharacterPickRequested,
            matchActorUserId: false,
            memberUserIds: [userId.Value],
            ct);

        foreach (var m in needsCharacter.OrderByDescending(m =>
                     pickAtByMember.GetValueOrDefault((m.CampaignId, userId.Value), DateTimeOffset.MinValue)))
        {
            var createdAt = pickAtByMember.GetValueOrDefault((m.CampaignId, userId.Value), DateTimeOffset.MinValue);
            if (createdAt == DateTimeOffset.MinValue)
                continue;

            items.Add(
                new NotificationItemDto(
                    $"pick-{m.Id}",
                    "character_pick_requested",
                    "Personnage à choisir",
                    $"Dans « {m.Campaign.Title} », choisissez un héros existant ou créez-en un.",
                    $"/campaigns/{m.CampaignId}?tab=players",
                    createdAt
                )
            );
        }

        var approvedSince = DateTimeOffset.UtcNow - ApprovedNotificationWindow;
        var approvedActs = (await db.CampaignActivities.AsNoTracking()
                .Where(a => a.Kind == CampaignActivityKinds.CharacterApproved)
                .ToListAsync(ct))
            .Where(a => a.CreatedAt >= approvedSince)
            .OrderByDescending(a => a.CreatedAt)
            .Take(100)
            .ToList();

        foreach (var act in approvedActs)
        {
            if (!TryGetMemberUserId(act.PayloadJson, out var memberUserId) || memberUserId != userId)
                continue;

            var characterName = TryGetString(act.PayloadJson, "characterName") ?? "votre personnage";
            var campaignTitle = await db.Campaigns.AsNoTracking()
                .Where(c => c.Id == act.CampaignId)
                .Select(c => c.Title)
                .FirstOrDefaultAsync(ct) ?? "campagne";

            items.Add(
                new NotificationItemDto(
                    $"approved-{act.Id}",
                    "proposal_approved",
                    "Personnage approuvé",
                    $"{characterName} est accepté dans « {campaignTitle} ».",
                    $"/campaigns/{act.CampaignId}",
                    act.CreatedAt
                )
            );
        }

        var acceptedFriendships = await db.Friendships.AsNoTracking()
            .Where(f =>
                f.Status == FriendStatuses.Accepted
                && (f.RequesterId == userId || f.AddresseeId == userId)
            )
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .ToListAsync(ct);
        var readMarkers = await db.FriendChatReads.AsNoTracking()
            .Where(r => r.UserId == userId)
            .ToDictionaryAsync(r => r.FriendUserId, r => r.LastReadAt, ct);

        foreach (var f in acceptedFriendships)
        {
            var friend = f.RequesterId == userId ? f.Addressee : f.Requester;
            var lastRead = readMarkers.GetValueOrDefault(friend.Id, DateTimeOffset.MinValue);
            var unreadMsg = (await FriendAccess
                    .ConversationQuery(db, userId.Value, friend.Id)
                    .Include(m => m.Sender)
                    .ToListAsync(ct))
                .Where(m => m.RecipientId == userId && m.CreatedAt > lastRead)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefault();
            if (unreadMsg is null)
                continue;

            var preview = unreadMsg.Body.Trim();
            if (preview.Length > 60)
                preview = preview[..57] + "…";

            items.Add(
                new NotificationItemDto(
                    $"chat-{friend.Id}-{unreadMsg.Id}",
                    "friend_message",
                    "Message d'un ami",
                    $"{friend.DisplayName} : {preview}",
                    $"/friends/chat/{friend.Id}",
                    unreadMsg.CreatedAt
                )
            );
        }

        items = items.OrderByDescending(i => i.CreatedAt).ToList();

        var friendsCount = items.Count(i => i.Kind is "friend_request" or "friend_message");
        var campaignsCount = items.Count - friendsCount;

        await Send.OkAsync(
            new NotificationsSummaryDto(friendsCount, campaignsCount, items.Count, items),
            ct
        );
    }

    private static async Task<Dictionary<(Guid CampaignId, Guid MemberUserId), DateTimeOffset>> LatestActivityTimesAsync(
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

    private static bool TryGetMemberUserId(string payloadJson, out Guid memberUserId)
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

    private static string? TryGetString(string payloadJson, string propertyName)
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
}
