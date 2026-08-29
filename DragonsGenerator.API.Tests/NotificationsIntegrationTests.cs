using System.Net.Http.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class NotificationsIntegrationTests
{
    private readonly HttpClient _client;

    public NotificationsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Notifications_empty_for_new_user()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notif");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", token);
        var res = await _client.SendAsync(req);
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.TotalCount);
        Assert.Empty(body.Notifications);
    }

    [Fact]
    public async Task Notifications_includes_incoming_friend_request()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notifa");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notifb");

        using (var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            var sent = await _client.SendAsync(requestReq);
            sent.EnsureSuccessStatusCode();
        }

        using var notifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", tokenB);
        var notif = await _client.SendAsync(notifReq);
        notif.EnsureSuccessStatusCode();

        var body = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.FriendsActionCount);
        Assert.Equal(1, body.TotalCount);
        Assert.Contains(body.Notifications, i => i.Type == "friend_request");
    }
}

internal sealed class NotificationsSummaryResponse
{
    public int FriendsActionCount { get; set; }
    public int CampaignsActionCount { get; set; }
    public int TotalCount { get; set; }
    public List<NotificationItemResponse> Notifications { get; set; } = [];
}

internal sealed class NotificationItemResponse
{
    public string Type { get; set; } = "";
}
