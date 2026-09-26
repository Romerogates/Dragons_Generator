using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;

public class PostTableChatEndpoint(AppDbContext db, CampaignLivePublisher live)
    : Endpoint<PostTableChatRequest>
{
    public override void Configure() => Post("/me/campaigns/{id}/table-chat");

    public override async Task HandleAsync(PostTableChatRequest req, CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        if (string.IsNullOrWhiteSpace(req.SessionId))
        {
            AddError("Session requise.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        string? lastError = null;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(db, id, userId.Value, ct);
            if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var author =
                membership?.User?.DisplayName
                ?? (await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct))?.DisplayName
                ?? "Joueur";

            var newJson = CampaignJsonHelpers.TryAppendTableChat(
                campaign.JsonData,
                req.SessionId.Trim(),
                userId.Value.ToString("D"),
                author,
                req.Body ?? "",
                out var error);

            if (newJson is null)
            {
                lastError = error;
                break;
            }

            campaign.JsonData = newJson;
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            try
            {
                await db.SaveChangesAsync(ct);
                await live.NotifyAsync(campaign.Id, campaign.UpdatedAt, CampaignLiveReasons.Campaign, ct);
                await Send.NoContentAsync(ct);
                return;
            }
            catch (DbUpdateConcurrencyException)
            {
                foreach (var entry in db.ChangeTracker.Entries())
                    await entry.ReloadAsync(ct);
            }
        }

        AddError(lastError ?? "Impossible d'envoyer le message (concurrence).");
        await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
    }
}

public record PostTableChatRequest(string SessionId, string Body);
