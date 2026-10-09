using System.Text.Json;
using System.Text.Json.Nodes;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Endpoints.Campaigns;


public class DeleteCampaignEndpoint(AppDbContext db, PushNotificationService push) : EndpointWithoutRequest
{
    public override void Configure() => Delete("/me/campaigns/{id}");

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = AuthHelpers.GetUserId(User);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var campaign = await db.Campaigns
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id && c.OwnerUserId == userId, ct);
        if (campaign is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var title = campaign.Title;
        var playerMembers = campaign.Members
            .Where(m => m.Role == CampaignMemberRoles.Player)
            .ToList();

        // Hard-delete seulement si aucun joueur n’a jamais été membre.
        if (playerMembers.Count == 0)
        {
            db.Campaigns.Remove(campaign);
            await db.SaveChangesAsync(ct);
            await Send.NoContentAsync(ct);
            return;
        }

        // Soft-close : historique conservé.
        var now = DateTimeOffset.UtcNow;
        campaign.ClosedAt = now;
        campaign.JoinEnabled = false;
        campaign.JoinToken = null;
        campaign.UpdatedAt = now;

        foreach (var m in playerMembers)
            CampaignHistoryHelpers.SealForClosure(m, campaign.JsonData);

        // Snapshot aussi pour le membership MJ (consultation figée optionnelle).
        var dmMember = campaign.Members.FirstOrDefault(m => m.UserId == userId);
        if (dmMember is not null)
            CampaignHistoryHelpers.SealForClosure(dmMember, campaign.JsonData);

        await db.SaveChangesAsync(ct);

        foreach (var playerId in playerMembers.Select(m => m.UserId).Distinct())
        {
            await push.NotifyUserAsync(
                playerId,
                "Campagne fermée",
                $"« {title} » a été fermée par le MJ. Votre historique reste accessible.",
                "/campaigns",
                ct);
        }

        await Send.NoContentAsync(ct);
    }
}
