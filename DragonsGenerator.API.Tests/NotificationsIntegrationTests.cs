using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class NotificationsIntegrationTests
{
    private readonly HttpClient _client;

    public NotificationsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Notifications_empty_for_new_user()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notif");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", token);
        var res = await _client.SendAsync(req);
        var raw = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, raw);

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
        var raw = await notif.Content.ReadAsStringAsync();
        Assert.True(notif.IsSuccessStatusCode, raw);

        var body = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.FriendsActionCount);
        Assert.Equal(1, body.TotalCount);
        Assert.Contains(
            body.Notifications,
            i => i.Kind == "friend_request" && i.ActionPath == "/friends");
    }

    [Fact]
    public async Task Notifications_campaign_invite_points_to_invite_query()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notinvown");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notinvpl");

        using (var friendReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", ownerToken))
        {
            friendReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(friendReq)).EnsureSuccessStatusCode();
        }

        Guid friendRequestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", playerToken))
        {
            var list = await (await _client.SendAsync(pendingReq)).Content.ReadFromJsonAsync<JsonElement>();
            friendRequestId = list[0].GetProperty("id").GetGuid();
        }

        using (var acceptFriend = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{friendRequestId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptFriend)).EnsureSuccessStatusCode();
        }

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Notif invite",
                data = new
                {
                    setting = "Eana",
                    partyLevel = 1,
                    tone = "classic",
                    adventure = "",
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    notes = "",
                    pregenCharacters = Array.Empty<object>(),
                    sessions = Array.Empty<object>(),
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();
        }

        Guid inviteId;
        using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken))
        {
            var arr = await (await _client.SendAsync(listInv)).Content.ReadFromJsonAsync<JsonElement>();
            inviteId = arr[0].GetProperty("id").GetGuid();
        }

        using var notifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken);
        var notif = await _client.SendAsync(notifReq);
        notif.EnsureSuccessStatusCode();
        var body = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.Contains(
            body!.Notifications,
            i => i.Kind == "campaign_invite" && i.ActionPath == $"/campaigns?invite={inviteId}");
    }

    [Fact]
    public async Task Notifications_support_reply_points_to_ticket()
    {
        var (_, playerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notifdesk");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", playerToken);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Aide notif"), "subject" },
            { new StringContent("Le raccourci ticket."), "message" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticketId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        using var takeReq = ApiTestAuth.Authed(HttpMethod.Patch, $"/admin/support/tickets/{ticketId}", adminToken);
        takeReq.Content = JsonContent.Create(new { status = "in_progress" });
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(takeReq)).StatusCode);

        using var staffReq = ApiTestAuth.Authed(HttpMethod.Post, $"/support/tickets/{ticketId}/messages", adminToken);
        staffReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Voici la réponse staff."), "body" },
        };
        (await _client.SendAsync(staffReq)).EnsureSuccessStatusCode();

        using var notifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", playerToken);
        var notif = await _client.SendAsync(notifReq);
        notif.EnsureSuccessStatusCode();
        var body = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.Contains(
            body!.Notifications,
            i => i.Kind == "support_reply" && i.ActionPath == $"/support?ticket={ticketId}");
    }

    [Fact]
    public async Task Notifications_approved_omitted_when_not_a_member()
    {
        // Couvre le cas « quitté toutes les campagnes » : l’activité CharacterApproved
        // ne doit plus remonter si l’utilisateur n’est plus membre.
        var (_, tokenPlayer, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notifleave");

        using var notifReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/notifications", tokenPlayer);
        var notif = await _client.SendAsync(notifReq);
        notif.EnsureSuccessStatusCode();

        var body = await notif.Content.ReadFromJsonAsync<NotificationsSummaryResponse>();
        Assert.NotNull(body);
        Assert.DoesNotContain(body!.Notifications, i => i.Kind == "proposal_approved");
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
    public string Kind { get; set; } = "";
    public string ActionPath { get; set; } = "";
}
