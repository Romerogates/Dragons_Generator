using DragonsGenerator.API.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

internal static class FriendDiscoveryHelper
{
    internal const int MinSearchLength = 4;

    internal static string ResolveRelationship(
        Guid currentUserId,
        Guid otherUserId,
        IReadOnlyList<Friendship> friendships
    )
    {
        var f = friendships.FirstOrDefault(x =>
            (x.RequesterId == currentUserId && x.AddresseeId == otherUserId)
            || (x.RequesterId == otherUserId && x.AddresseeId == currentUserId));

        if (f is null) return "none";
        if (f.Status == FriendStatuses.Accepted) return "friend";
        if (f.Status == FriendStatuses.Pending && f.RequesterId == currentUserId) return "pending_sent";
        if (f.Status == FriendStatuses.Pending && f.AddresseeId == currentUserId) return "pending_received";
        return "none";
    }

    internal static async Task<List<Friendship>> LoadRelationshipsAsync(
        AppDbContext db,
        Guid userId,
        IEnumerable<Guid> otherUserIds,
        CancellationToken ct
    )
    {
        var ids = otherUserIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        return await db.Friendships.AsNoTracking()
            .Where(f =>
                (f.RequesterId == userId && ids.Contains(f.AddresseeId))
                || (f.AddresseeId == userId && ids.Contains(f.RequesterId)))
            .ToListAsync(ct);
    }
}
