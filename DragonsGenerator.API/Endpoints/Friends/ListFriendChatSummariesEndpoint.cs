using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public class ListFriendChatSummariesEndpoint(AppDbContext db)
    : EndpointWithoutRequest<List<FriendChatSummaryDto>>
{
    public override void Configure() => Get("/me/friends/messages/summaries");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendships = await db.Friendships.AsNoTracking()
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

        var friendIds = friendships
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Distinct()
            .ToList();
        var messages = await db.FriendMessages.AsNoTracking()
            .Where(m =>
                (m.RecipientId == userId && friendIds.Contains(m.SenderId))
                || (m.SenderId == userId && friendIds.Contains(m.RecipientId)))
            .Select(m => new
            {
                m.SenderId,
                m.RecipientId,
                m.Body,
                m.AttachmentKind,
                m.AttachmentPayload,
                m.CreatedAt,
            })
            .ToListAsync(ct);

        var summaries = new List<FriendChatSummaryDto>();
        foreach (var f in friendships)
        {
            var friend = f.RequesterId == userId ? f.Addressee : f.Requester;
            var conv = messages.Where(m =>
                (m.SenderId == userId && m.RecipientId == friend.Id)
                || (m.SenderId == friend.Id && m.RecipientId == userId));
            var last = conv.OrderByDescending(m => m.CreatedAt).FirstOrDefault();
            var lastRead = readMarkers.GetValueOrDefault(friend.Id, DateTimeOffset.MinValue);
            var unread = conv.Count(m =>
                m.RecipientId == userId && m.SenderId == friend.Id && m.CreatedAt > lastRead);

            summaries.Add(
                new FriendChatSummaryDto(
                    friend.Id,
                    friend.DisplayName,
                    last is null
                        ? null
                        : FriendChatAttachmentHelper.Preview(last.Body, last.AttachmentKind, last.AttachmentPayload),
                    last?.CreatedAt,
                    unread
                )
            );
        }

        summaries = summaries
            .OrderByDescending(s => s.LastMessageAt ?? DateTimeOffset.MinValue)
            .ThenBy(s => s.FriendDisplayName)
            .ToList();

        await Send.OkAsync(summaries, ct);
    }
}
