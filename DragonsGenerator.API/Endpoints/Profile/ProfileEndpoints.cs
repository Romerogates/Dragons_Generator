using DragonsGenerator.API.Endpoints.Friends;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Profile;

public class GetUserProfileEndpoint(AppDbContext db) : EndpointWithoutRequest<PublicUserProfileDto>
{
    public override void Configure()
    {
        Get("/users/{userId}/profile");
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var viewerId = AuthHelpers.GetUserId(User);
        if (viewerId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (!Guid.TryParse(Route<string>("userId"), out var targetId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == targetId, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var isSelf = viewerId.Value == targetId;
        var isFriend = isSelf
            || await FriendAccess.AreFriendsAsync(db, viewerId.Value, targetId, ct);

        await Send.OkAsync(UserProfileHelper.ToPublicProfile(user, isSelf, isFriend), ct);
    }
}
