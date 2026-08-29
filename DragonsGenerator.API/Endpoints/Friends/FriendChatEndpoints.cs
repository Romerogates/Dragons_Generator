using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

public record FriendMessageDto(
    Guid Id,
    Guid SenderId,
    string SenderDisplayName,
    Guid RecipientId,
    string Body,
    string? AttachmentKind,
    string? AttachmentPayload,
    DateTimeOffset CreatedAt,
    bool IsMine
);

public record SendFriendMessageBody(string? Body, string? AttachmentKind, string? AttachmentPayload);

public record FriendChatSummaryDto(
    Guid FriendUserId,
    string FriendDisplayName,
    string? LastMessagePreview,
    DateTimeOffset? LastMessageAt,
    int UnreadCount
);

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

public class SendFriendMessageEndpoint(AppDbContext db, PushNotificationService push) : Endpoint<SendFriendMessageBody, FriendMessageDto>
{
    public override void Configure() => Post("/me/friends/{userId}/messages");

    public override async Task HandleAsync(SendFriendMessageBody req, CancellationToken ct)
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

        if (!FriendChatAttachmentHelper.TryValidate(
                req.AttachmentKind, req.AttachmentPayload, out var kind, out var payload, out var attachError))
        {
            AddError(attachError!);
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var body = (req.Body ?? "").Trim();
        if (body.Length < 1 && kind is null)
        {
            AddError("Message vide.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        if (body.Length > 2000)
        {
            AddError("Message trop long (2000 caractères max).");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        if (kind == FriendChatAttachmentHelper.Character && payload is not null)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var charId = Guid.Parse(doc.RootElement.GetProperty("characterId").GetString()!);
            var owns = await db.Characters.AnyAsync(c => c.Id == charId && c.UserId == userId, ct);
            if (!owns)
            {
                AddError("Fiche personnage inaccessible.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }
        }

        if (kind == FriendChatAttachmentHelper.Campaign && payload is not null)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var campId = Guid.Parse(doc.RootElement.GetProperty("campaignId").GetString()!);
            var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, campId, userId.Value, ct);
            if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
            {
                AddError("Campagne inaccessible.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }
        }

        var sender = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var message = new FriendMessage
        {
            SenderId = userId.Value,
            RecipientId = friendUserId,
            Body = body,
            AttachmentKind = kind,
            AttachmentPayload = payload,
        };
        db.FriendMessages.Add(message);
        await db.SaveChangesAsync(ct);

        await push.NotifyUserAsync(
            friendUserId,
            sender.DisplayName,
            FriendChatAttachmentHelper.Preview(body, kind, payload),
            $"/friends/chat/{userId}",
            ct);

        await Send.OkAsync(
            new FriendMessageDto(
                message.Id,
                message.SenderId,
                sender.DisplayName,
                message.RecipientId,
                message.Body,
                message.AttachmentKind,
                message.AttachmentPayload,
                message.CreatedAt,
                true
            ),
            ct
        );
    }
}

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

        var summaries = new List<FriendChatSummaryDto>();
        foreach (var f in friendships)
        {
            var friend = f.RequesterId == userId ? f.Addressee : f.Requester;
            var last = (await FriendAccess
                .ConversationQuery(db, userId.Value, friend.Id)
                .ToListAsync(ct))
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefault();

            var lastRead = readMarkers.GetValueOrDefault(friend.Id, DateTimeOffset.MinValue);
            var unread = (await FriendAccess
                .ConversationQuery(db, userId.Value, friend.Id)
                .ToListAsync(ct))
                .Count(m => m.RecipientId == userId && m.SenderId == friend.Id && m.CreatedAt > lastRead);

            summaries.Add(
                new FriendChatSummaryDto(
                    friend.Id,
                    friend.DisplayName,
                    last is null ? null : FriendChatAttachmentHelper.Preview(last.Body, last.AttachmentKind, last.AttachmentPayload),
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
