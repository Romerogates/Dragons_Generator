using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public class MarkFriendChatReadEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Post("/me/friends/{userId}/messages/read");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendUserId = Route<Guid>("userId");
        if (!await FriendAccess.AreFriendsAsync(db, userId.Value, friendUserId, ct))
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var existing = await db.FriendChatReads.FirstOrDefaultAsync(
            r => r.UserId == userId && r.FriendUserId == friendUserId,
            ct
        );
        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            db.FriendChatReads.Add(
                new FriendChatRead
                {
                    UserId = userId.Value,
                    FriendUserId = friendUserId,
                    LastReadAt = now,
                }
            );
        }
        else
        {
            existing.LastReadAt = now;
        }

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
