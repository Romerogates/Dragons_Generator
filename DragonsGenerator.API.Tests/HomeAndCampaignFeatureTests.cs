using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public partial class HomeAndCampaignFeatureTests
{
    private readonly HttpClient _client;

    public HomeAndCampaignFeatureTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    private async Task<Guid> CreateEmptyCampaignAsync(string ownerToken, string title)
    {
        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken);
        createReq.Content = JsonContent.Create(new
        {
            title,
            data = JsonDocument.Parse("{}").RootElement,
        });
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var body = await created.Content.ReadFromJsonAsync<JsonElement>();
        return body!.GetProperty("id").GetGuid();
    }

    private async Task EnsureFriendsAsync(string ownerToken, string playerToken, Guid playerId)
    {
        using (var friendReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", ownerToken))
        {
            friendReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(friendReq)).EnsureSuccessStatusCode();
        }

        Guid friendRequestId;
        using (var pendingFriend = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", playerToken))
        {
            var pending = await _client.SendAsync(pendingFriend);
            pending.EnsureSuccessStatusCode();
            var p = await pending.Content.ReadFromJsonAsync<JsonElement>();
            friendRequestId = p![0].GetProperty("id").GetGuid();
        }

        using (var acceptFriend = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{friendRequestId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptFriend)).EnsureSuccessStatusCode();
        }
    }

    private async Task<Guid> SendCampaignInviteAsync(
        string ownerToken,
        string playerToken,
        Guid playerId,
        Guid campaignId)
    {
        using (var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();
        }

        using var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken);
        var inv = await _client.SendAsync(listInv);
        inv.EnsureSuccessStatusCode();
        var arr = await inv.Content.ReadFromJsonAsync<JsonElement>();
        return arr![0].GetProperty("id").GetGuid();
    }

    private async Task InvitePlayerToCampaignAsync(
        string ownerToken,
        string playerToken,
        Guid playerId,
        Guid campaignId)
    {
        await EnsureFriendsAsync(ownerToken, playerToken, playerId);
        var inviteId = await SendCampaignInviteAsync(ownerToken, playerToken, playerId, campaignId);

        using var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerToken);
        (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
    }

}

