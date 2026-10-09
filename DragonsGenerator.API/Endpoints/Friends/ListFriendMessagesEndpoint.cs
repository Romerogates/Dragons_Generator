using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public class ListFriendMessagesEndpoint(AppDbContext db) : EndpointWithoutRequest<List<FriendMessageDto>>
{
    public override void Configure() => Get("/me/friends/{userId}/messages");

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

        var afterRaw = Query<string>("after", false);
        DateTimeOffset? after = null;
        if (
            !string.IsNullOrWhiteSpace(afterRaw)
            && DateTimeOffset.TryParse(afterRaw, out var parsedAfter)
        )
        {
            after = parsedAfter;
        }

        var limit = Query<int?>("limit", false) ?? 100;
        if (limit < 1) limit = 1;
        if (limit > 200) limit = 200;

        var query = FriendAccess.ConversationQuery(db, userId.Value, friendUserId);
        var rows = await query.Include(m => m.Sender).ToListAsync(ct);
        if (after is not null)
            rows = rows.Where(m => m.CreatedAt > after).ToList();
        var messages = rows
            .OrderBy(m => m.CreatedAt)
            .Take(limit)
            .Select(m => new FriendMessageDto(
                m.Id,
                m.SenderId,
                m.Sender.DisplayName,
                m.RecipientId,
                m.Body,
                m.AttachmentKind,
                m.AttachmentPayload,
                m.CreatedAt,
                m.SenderId == userId
            ))
            .ToList();

        await Send.OkAsync(messages, ct);
    }
}
