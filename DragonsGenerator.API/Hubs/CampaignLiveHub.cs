using DragonsGenerator.API.Endpoints.Campaigns;
using DragonsGenerator.API.Persistence;
using DragonsGenerator.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DragonsGenerator.API.Hubs;

/// <summary>
/// Sync temps réel table (combat / fog / initiative / XP).
/// Clients rejoignent le groupe campagne ; le serveur pousse <c>campaignUpdated</c>.
/// </summary>
[Authorize]
public sealed class CampaignLiveHub(AppDbContext db) : Hub
{
    public static string GroupName(Guid campaignId) => $"campaign:{campaignId:D}";

    public async Task JoinCampaign(Guid campaignId)
    {
        var userId = AuthHelpers.GetUserId(Context.User!);
        if (userId is null)
            throw new HubException("Non authentifié.");

        var (campaign, membership, isOwner) = await CampaignAccess.LoadAsync(
            db, campaignId, userId.Value, Context.ConnectionAborted);
        if (campaign is null || !CampaignAccess.CanView(isOwner, membership))
            throw new HubException("Campagne introuvable.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(campaignId));
    }

    public Task LeaveCampaign(Guid campaignId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(campaignId));
}
