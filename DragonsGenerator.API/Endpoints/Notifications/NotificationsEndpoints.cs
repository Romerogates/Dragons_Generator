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
            pendingProposals = pendingProposals.OrderByDescending(m => m.JoinedAt).ToList();

            foreach (var m in pendingProposals)
            {
                var name = m.ProposedCharacterName ?? "un personnage";
                items.Add(
                    new NotificationItemDto(
                        $"proposal-{m.Id}",
                        "character_proposal",
                        "Personnage à valider",
                        $"{m.User.DisplayName} propose {name} dans « {m.Campaign.Title} ».",
                        $"/campaigns/{m.CampaignId}",
                        m.JoinedAt
                    )
                );
            }
        }

        var rejected = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.ProposalStatus == CharacterProposalStatuses.Rejected)
            .Include(m => m.Campaign)
            .ToListAsync(ct);
        rejected = rejected.OrderByDescending(m => m.JoinedAt).ToList();

        foreach (var m in rejected)
        {
            items.Add(
                new NotificationItemDto(
                    $"rejected-{m.Id}",
                    "proposal_rejected",
                    "Personnage refusé",
                    $"Votre proposition dans « {m.Campaign.Title} » a été refusée — proposez-en un autre.",
                    $"/campaigns/{m.CampaignId}",
                    m.JoinedAt
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
}

