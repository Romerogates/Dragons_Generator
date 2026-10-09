using DragonsGenerator.API.Endpoints.Support;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Notifications;

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
                    $"/campaigns?invite={inv.Id}",
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

            var proposedAtByMember = await NotificationsInboxHelper.LatestActivityTimesAsync(
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
        var rejectedAtByMember = await NotificationsInboxHelper.LatestActivityTimesAsync(
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
        var pickAtByMember = await NotificationsInboxHelper.LatestActivityTimesAsync(
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

        var approvedSince = DateTimeOffset.UtcNow - NotificationsInboxHelper.ApprovedNotificationWindow;
        var memberCampaignIds = await db.CampaignMembers.AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.CampaignId)
            .ToListAsync(ct);

        var approvedActs = await NotificationsInboxHelper.LoadScopedActivitiesAsync(
            db, memberCampaignIds, CampaignActivityKinds.CharacterApproved, approvedSince, 100, ct);
        var xpActs = await NotificationsInboxHelper.LoadScopedActivitiesAsync(
            db, memberCampaignIds, CampaignActivityKinds.XpAwarded, approvedSince, 100, ct);
        var rsvpSince = DateTimeOffset.UtcNow - TimeSpan.FromDays(14);
        var rsvpActs = await NotificationsInboxHelper.LoadScopedActivitiesAsync(
            db, ownedCampaignIds, CampaignActivityKinds.ScheduleRsvp, rsvpSince, 40, ct);

        var titles = await NotificationsInboxHelper.CampaignTitlesAsync(
            db,
            approvedActs.Select(a => a.CampaignId)
                .Concat(xpActs.Select(a => a.CampaignId))
                .Concat(rsvpActs.Select(a => a.CampaignId)),
            ct);

        foreach (var act in approvedActs)
        {
            if (!NotificationsInboxHelper.TryGetMemberUserId(act.PayloadJson, out var memberUserId) || memberUserId != userId)
                continue;

            var characterName = NotificationsInboxHelper.TryGetString(act.PayloadJson, "characterName") ?? "votre personnage";
            var campaignTitle = titles.GetValueOrDefault(act.CampaignId, "campagne");

            items.Add(
                new NotificationItemDto(
                    $"approved-{act.Id}",
                    "proposal_approved",
                    "Personnage approuvé",
                    $"{characterName} est accepté dans « {campaignTitle} ».",
                    $"/campaigns/{act.CampaignId}?tab=players",
                    act.CreatedAt
                )
            );
        }

        foreach (var act in xpActs)
        {
            if (!NotificationsInboxHelper.TryGetMemberUserId(act.PayloadJson, out var memberUserId) || memberUserId != userId)
                continue;

            var xpLabel = NotificationsInboxHelper.TryGetString(act.PayloadJson, "message") ?? "+XP";
            var campaignTitle = titles.GetValueOrDefault(act.CampaignId, "campagne");

            items.Add(
                new NotificationItemDto(
                    $"xp-{act.Id}",
                    "xp_awarded",
                    "XP attribuée",
                    $"{xpLabel} dans « {campaignTitle} ».",
                    $"/campaigns/{act.CampaignId}?tab=players&levelUp=1",
                    act.CreatedAt
                )
            );
        }

        foreach (var act in rsvpActs)
        {
            var msg = NotificationsInboxHelper.TryGetString(act.PayloadJson, "message") ?? "Nouvelle réponse RSVP";
            var campaignTitle = titles.GetValueOrDefault(act.CampaignId, "campagne");

            items.Add(
                new NotificationItemDto(
                    $"rsvp-{act.Id}",
                    "schedule_rsvp",
                    "RSVP agenda",
                    $"{msg} (« {campaignTitle} »).",
                    $"/campaigns/{act.CampaignId}?tab=calendar",
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

        var friendIds = acceptedFriendships
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Distinct()
            .ToList();
        var inboundMessages = await db.FriendMessages.AsNoTracking()
            .Where(m => m.RecipientId == userId && friendIds.Contains(m.SenderId))
            .Select(m => new { m.Id, m.SenderId, m.Body, m.CreatedAt })
            .ToListAsync(ct);

        foreach (var f in acceptedFriendships)
        {
            var friend = f.RequesterId == userId ? f.Addressee : f.Requester;
            var lastRead = readMarkers.GetValueOrDefault(friend.Id, DateTimeOffset.MinValue);
            var unreadMsg = inboundMessages
                .Where(m => m.SenderId == friend.Id && m.CreatedAt > lastRead)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefault();
            if (unreadMsg is null)
                continue;

            items.Add(
                new NotificationItemDto(
                    $"chat-{friend.Id}-{unreadMsg.Id}",
                    "friend_message",
                    "Message d'un ami",
                    $"{friend.DisplayName} : {NotificationsInboxHelper.Preview(unreadMsg.Body, 60)}",
                    $"/friends/chat/{friend.Id}",
                    unreadMsg.CreatedAt
                )
            );
        }

        var myTickets = await db.SupportTickets.AsNoTracking()
            .Where(t => t.UserId == userId && t.Status != "closed")
            .ToListAsync(ct);
        var myTicketIds = myTickets.Select(t => t.Id).ToList();
        var lastByTicket = await SupportInboxHelper.LastFromStaffByTicketAsync(db, myTicketIds, ct);
        var staffMsgs = myTicketIds.Count == 0
            ? []
            : await db.SupportTicketMessages.AsNoTracking()
                .Where(m => myTicketIds.Contains(m.TicketId) && m.FromStaff)
                .ToListAsync(ct);
        foreach (var ticket in myTickets)
        {
            lastByTicket.TryGetValue(ticket.Id, out var lastFromStaff);
            if (!SupportTicketRules.PlayerHasUnreadStaffReply(ticket.Status, lastFromStaff))
                continue;

            var lastMsg = staffMsgs
                .Where(m => m.TicketId == ticket.Id)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefault();
            if (lastMsg is null)
                continue;

            items.Add(
                new NotificationItemDto(
                    $"support-{ticket.Id}-{lastMsg.Id}",
                    "support_reply",
                    "Réponse du support",
                    $"{ticket.Subject} : {NotificationsInboxHelper.Preview(lastMsg.Body, 80)}",
                    $"/support?ticket={ticket.Id}",
                    lastMsg.CreatedAt
                )
            );
        }

        items = items.OrderByDescending(i => i.CreatedAt).ToList();

        var (friendsCount, campaignsCount, _, totalCount) = NotificationsInboxHelper.CountActionBadges(items);
        var supportInboxCount = AuthHelpers.IsAdmin(User)
            ? await SupportInboxHelper.CountWaitingOnStaffAsync(db, ct)
            : 0;

        await Send.OkAsync(
            new NotificationsSummaryDto(friendsCount, campaignsCount, totalCount, items, supportInboxCount),
            ct
        );
    }
}
