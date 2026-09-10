using DragonsGenerator.API.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace DragonsGenerator.API.Services;

public static class CampaignLiveReasons
{
    public const string Campaign = "campaign";
    public const string Initiative = "initiative";
    public const string Combat = "combat";
    public const string Xp = "xp";
}

public sealed class CampaignLivePublisher(IHubContext<CampaignLiveHub> hub)
{
    public Task NotifyAsync(
        Guid campaignId,
        DateTimeOffset updatedAt,
        string reason,
        CancellationToken ct = default)
    {
        var payload = new
        {
            campaignId = campaignId.ToString("D"),
            updatedAt = updatedAt.ToString("O"),
            reason,
        };
        return hub.Clients
            .Group(CampaignLiveHub.GroupName(campaignId))
            .SendAsync("campaignUpdated", payload, ct);
    }
}
