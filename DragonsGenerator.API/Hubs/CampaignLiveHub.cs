using System.Collections.Concurrent;
using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Hubs;

/// <summary>
/// Sync temps réel table (combat / fog / initiative / XP) + présence des sièges.
/// </summary>
[Authorize]
public sealed class CampaignLiveHub(AppDbContext db) : Hub
{
    private static readonly ConcurrentDictionary<string, LiveSeat> Seats = new();

    public static string GroupName(Guid campaignId) => $"campaign:{campaignId:D}";

    public async Task JoinCampaign(Guid campaignId, string surface)
    {
        var userId = AuthHelpers.GetUserId(Context.User!);
        if (userId is null)
            throw new HubException("Non authentifié.");

        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(
            db, campaignId, userId.Value, Context.ConnectionAborted);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
            throw new HubException("Campagne introuvable.");

        var surf = string.Equals(surface, "play", StringComparison.OrdinalIgnoreCase) ? "play" : "hub";

        if (Seats.TryGetValue(Context.ConnectionId, out var prev) && prev.CampaignId != campaignId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(prev.CampaignId));
            Seats.TryRemove(Context.ConnectionId, out _);
            await BroadcastPresenceAsync(prev.CampaignId);
        }

        Seats[Context.ConnectionId] = new LiveSeat(campaignId, userId.Value, surf);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(campaignId));
        await BroadcastPresenceAsync(campaignId);
    }

    public async Task LeaveCampaign(Guid campaignId)
    {
        Seats.TryRemove(Context.ConnectionId, out _);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(campaignId));
        await BroadcastPresenceAsync(campaignId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Seats.TryRemove(Context.ConnectionId, out var seat))
            await BroadcastPresenceAsync(seat.CampaignId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task BroadcastPresenceAsync(Guid campaignId)
    {
        var seats = Seats.Values.Where(s => s.CampaignId == campaignId).ToList();
        var userIds = seats.Select(s => s.UserId).Distinct().ToList();
        var names = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(Context.ConnectionAborted);
        var nameMap = names.ToDictionary(x => x.Id, x => x.DisplayName);
        var ownerId = await db.Campaigns.AsNoTracking()
            .Where(c => c.Id == campaignId)
            .Select(c => (Guid?)c.OwnerUserId)
            .FirstOrDefaultAsync(Context.ConnectionAborted);

        var users = userIds
            .Select(id => new
            {
                userId = id.ToString("D"),
                displayName = string.IsNullOrWhiteSpace(nameMap.GetValueOrDefault(id))
                    ? "Joueur"
                    : nameMap[id],
                role = ownerId is Guid oid && id == oid ? "mj" : "player",
                atPlay = seats.Any(s => s.UserId == id && s.Surface == "play"),
            })
            .OrderBy(u => u.role == "mj" ? 0 : 1)
            .ThenBy(u => u.displayName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        await Clients.Group(GroupName(campaignId)).SendAsync(
            "presenceUpdated",
            new { campaignId = campaignId.ToString("D"), users },
            Context.ConnectionAborted);
    }

    private sealed record LiveSeat(Guid CampaignId, Guid UserId, string Surface);
}
