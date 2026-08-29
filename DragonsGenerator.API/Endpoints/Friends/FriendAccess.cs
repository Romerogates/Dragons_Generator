using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

internal static class FriendAccess
{
    internal static async Task<bool> AreFriendsAsync(
        AppDbContext db,
        Guid userId,
        Guid otherUserId,
        CancellationToken ct
    )
    {
        return await db.Friendships.AsNoTracking().AnyAsync(
            f =>
                f.Status == FriendStatuses.Accepted
                && (
                    (f.RequesterId == userId && f.AddresseeId == otherUserId)
                    || (f.RequesterId == otherUserId && f.AddresseeId == userId)
                ),
            ct
        );
    }

    internal static async Task<Friendship?> FindAcceptedFriendshipAsync(
        AppDbContext db,
        Guid userId,
        Guid otherUserId,
        CancellationToken ct
    )
    {
        return await db.Friendships.FirstOrDefaultAsync(
            f =>
                f.Status == FriendStatuses.Accepted
                && (
                    (f.RequesterId == userId && f.AddresseeId == otherUserId)
                    || (f.RequesterId == otherUserId && f.AddresseeId == userId)
                ),
            ct
        );
    }

    internal static IQueryable<FriendMessage> ConversationQuery(
        AppDbContext db,
        Guid userA,
        Guid userB
    ) =>
        db.FriendMessages.AsNoTracking().Where(m =>
            (m.SenderId == userA && m.RecipientId == userB)
            || (m.SenderId == userB && m.RecipientId == userA)
        );

    internal static async Task DeleteConversationAsync(
        AppDbContext db,
        Guid userA,
        Guid userB,
        CancellationToken ct
    )
    {
        var messages = await db.FriendMessages
            .Where(m =>
                (m.SenderId == userA && m.RecipientId == userB)
                || (m.SenderId == userB && m.RecipientId == userA)
            )
            .ToListAsync(ct);
        if (messages.Count > 0)
            db.FriendMessages.RemoveRange(messages);

        var reads = await db.FriendChatReads
            .Where(r =>
                (r.UserId == userA && r.FriendUserId == userB)
                || (r.UserId == userB && r.FriendUserId == userA)
            )
            .ToListAsync(ct);
        if (reads.Count > 0)
            db.FriendChatReads.RemoveRange(reads);
    }
}
