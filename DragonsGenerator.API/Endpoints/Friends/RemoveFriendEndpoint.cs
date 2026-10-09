using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;

namespace DragonsGenerator.API.Endpoints.Friends;

public class RemoveFriendEndpoint(AppDbContext db) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/friends/{userId}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendUserId = Route<Guid>("userId");
        var friendship = await FriendAccess.FindAcceptedFriendshipAsync(
            db,
            userId.Value,
            friendUserId,
            ct
        );
        if (friendship is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await FriendAccess.DeleteConversationAsync(db, userId.Value, friendUserId, ct);
        db.Friendships.Remove(friendship);
        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
