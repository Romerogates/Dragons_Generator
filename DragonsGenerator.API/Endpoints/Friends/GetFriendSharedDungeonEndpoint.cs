using System.Text.Json;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public class GetFriendSharedDungeonEndpoint(AppDbContext db)
    : EndpointWithoutRequest<DragonsGenerator.API.Endpoints.Dungeons.DungeonDto>
{
    public override void Configure() => Get("/me/friends/{friendUserId}/dungeons/{dungeonId}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendUserId = Route<Guid>("friendUserId");
        var dungeonId = Route<Guid>("dungeonId");

        if (!await FriendAccess.AreFriendsAsync(db, userId.Value, friendUserId, ct))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var dungeon = await db.Dungeons.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == dungeonId && d.UserId == friendUserId, ct);
        if (dungeon is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(dungeon.JsonData) ? "{}" : dungeon.JsonData);
        await Send.OkAsync(
            new DragonsGenerator.API.Endpoints.Dungeons.DungeonDto(
                dungeon.Id,
                dungeon.Name,
                doc.RootElement.Clone(),
                dungeon.UpdatedAt
            ),
            ct
        );
    }
}
