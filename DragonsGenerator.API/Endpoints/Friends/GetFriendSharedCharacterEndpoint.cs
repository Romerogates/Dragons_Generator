using System.Text.Json;
using DragonsGenerator.API.Endpoints.Characters;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public class GetFriendSharedCharacterEndpoint(AppDbContext db) : EndpointWithoutRequest<CharacterDto>
{
    public override void Configure() => Get("/me/friends/{friendUserId}/characters/{characterId}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var friendUserId = Route<Guid>("friendUserId");
        var characterId = Route<Guid>("characterId");

        if (!await FriendAccess.AreFriendsAsync(db, userId.Value, friendUserId, ct))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var character = await db.Characters.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == characterId && c.UserId == friendUserId, ct);
        if (character is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(character.JsonData) ? "{}" : character.JsonData);
        await Send.OkAsync(
            new CharacterDto(character.Id, character.Name, doc.RootElement.Clone(), character.UpdatedAt),
            ct);
    }
}
