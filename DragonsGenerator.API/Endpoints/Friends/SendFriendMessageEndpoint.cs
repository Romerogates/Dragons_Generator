using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Friends;

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

        if (kind == FriendChatAttachmentHelper.Invite && payload is not null)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var token = doc.RootElement.GetProperty("joinToken").GetString()!;
            var owned = await db.Campaigns.AsNoTracking()
                .AnyAsync(c => c.OwnerUserId == userId && c.JoinEnabled && c.JoinToken == token, ct);
            if (!owned)
            {
                AddError("Lien d'invitation inaccessible.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }
        }

        if (kind == FriendChatAttachmentHelper.Dungeon && payload is not null)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var dungeonId = Guid.Parse(doc.RootElement.GetProperty("dungeonId").GetString()!);
            var owns = await db.Dungeons.AnyAsync(d => d.Id == dungeonId && d.UserId == userId, ct);
            if (!owns)
            {
                AddError("Donjon inaccessible.");
                await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
                return;
            }
        }

        if (kind == FriendChatAttachmentHelper.Schedule && payload is not null)
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
