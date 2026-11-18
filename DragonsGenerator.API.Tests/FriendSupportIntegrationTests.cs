using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public partial class FriendSupportIntegrationTests
{
    private readonly HttpClient _client;

    public FriendSupportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Friends_search_requires_auth()
    {
        var response = await _client.GetAsync("/users/search?q=hero");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Friends_search_returns_display_name_only()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "search");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=Hero", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@dragons.local", body);
        Assert.Contains("displayName", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Friends_search_returns_empty_for_short_query()
    {
        var token = await ApiTestAuth.LoginAdminAsync(_client);
        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=a", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Empty(body.EnumerateArray());
    }

    [Fact]
    public async Task Friends_search_returns_enriched_fields_for_valid_query()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "enriched");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/users/search?q=Hero", token);
        var response = await _client.SendAsync(req);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        if (body.GetArrayLength() > 0)
        {
            var first = body[0];
            Assert.True(first.TryGetProperty("relationshipStatus", out _));
            Assert.True(first.TryGetProperty("memberSince", out _));
        }
    }

    [Fact]
    public async Task Friends_suggestions_returns_campaign_teammates()
    {
        var (_, ownerToken, ownerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugplayer");
        var (_, teammateToken, teammateId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sugmate");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Camp Suggestions",
                data = new { setting = "Eana", partyLevel = 1, tone = "classic", adventure = "", creatures = Array.Empty<object>(), encounters = Array.Empty<object>(), notes = "", pregenCharacters = Array.Empty<object>(), sessions = Array.Empty<object>() },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        async Task BecomeFriendsAsync(string requesterTok, string addresseeTok, Guid addresseeId)
        {
            using (var friendReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", requesterTok))
            {
                friendReq.Content = JsonContent.Create(new { userId = addresseeId });
                (await _client.SendAsync(friendReq)).EnsureSuccessStatusCode();
            }

            Guid requestId;
            using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", addresseeTok))
            {
                var list = await (await _client.SendAsync(pendingReq)).Content.ReadFromJsonAsync<JsonElement>();
                requestId = list![0].GetProperty("id").GetGuid();
            }

            using var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{requestId}/accept", addresseeTok);
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        async Task InviteAndAcceptAsync(string ownerTok, string playerTok, Guid uid)
        {
            using var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerTok);
            inviteReq.Content = JsonContent.Create(new { userId = uid });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();

            Guid inviteId;
            using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerTok))
            {
                var arr = await (await _client.SendAsync(listInv)).Content.ReadFromJsonAsync<JsonElement>();
                inviteId = arr![0].GetProperty("id").GetGuid();
            }

            using var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerTok);
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        await BecomeFriendsAsync(ownerToken, playerToken, playerId);
        await BecomeFriendsAsync(ownerToken, teammateToken, teammateId);
        await InviteAndAcceptAsync(ownerToken, playerToken, playerId);
        await InviteAndAcceptAsync(ownerToken, teammateToken, teammateId);

        using var sugReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/suggestions", playerToken);
        var sugRes = await _client.SendAsync(sugReq);
        sugRes.EnsureSuccessStatusCode();
        var suggestions = await sugRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            suggestions.EnumerateArray(),
            s => s.GetProperty("id").GetGuid() == teammateId
        );
        var mate = suggestions.EnumerateArray().First(s => s.GetProperty("id").GetGuid() == teammateId);
        Assert.Equal("Coéquipier de campagne", mate.GetProperty("suggestionReason").GetString());
        Assert.Equal("none", mate.GetProperty("relationshipStatus").GetString());
        Assert.DoesNotContain(
            suggestions.EnumerateArray(),
            s => s.GetProperty("id").GetGuid() == ownerId
        );
    }

    [Fact]
    public async Task Friends_list_includes_friend_since()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sincea");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sinceb");

        using (var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            (await _client.SendAsync(requestReq)).EnsureSuccessStatusCode();
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", tokenB))
        {
            var list = await (await _client.SendAsync(pendingReq)).Content.ReadFromJsonAsync<JsonElement>();
            requestId = list![0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{requestId}/accept", tokenB))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using var friendsReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends", tokenA);
        var friends = await (await _client.SendAsync(friendsReq)).Content.ReadFromJsonAsync<JsonElement>();
        var friend = friends.EnumerateArray().First(f => f.GetProperty("id").GetGuid() == userBId);
        Assert.True(friend.TryGetProperty("friendSince", out _));
    }

    [Fact]
    public async Task Friends_send_accept_and_list_flow()
    {
        var (_, tokenA, userAId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "a");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "b");

        using (var selfReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            "/me/friends/request",
            tokenA))
        {
            selfReq.Content = JsonContent.Create(new { userId = userAId });
            var self = await _client.SendAsync(selfReq);
            Assert.Equal(HttpStatusCode.BadRequest, self.StatusCode);
        }

        using (var requestReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            "/me/friends/request",
            tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            var sent = await _client.SendAsync(requestReq);
            Assert.Equal(HttpStatusCode.NoContent, sent.StatusCode);
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", tokenB))
        {
            var pending = await _client.SendAsync(pendingReq);
            pending.EnsureSuccessStatusCode();
            var list = await pending.Content.ReadFromJsonAsync<JsonElement>();
            requestId = list[0].GetProperty("id").GetGuid();
            Assert.Equal(userAId, list[0].GetProperty("userId").GetGuid());
        }

        using (var acceptReq = ApiTestAuth.Authed(
            HttpMethod.Post,
            $"/me/friends/requests/{requestId}/accept",
            tokenB))
        {
            var accept = await _client.SendAsync(acceptReq);
            Assert.Equal(HttpStatusCode.NoContent, accept.StatusCode);
        }

        using (var friendsReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends", tokenA))
        {
            var friends = await _client.SendAsync(friendsReq);
            friends.EnsureSuccessStatusCode();
            var body = await friends.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(
                body.EnumerateArray(),
                u => u.GetProperty("id").GetGuid() == userBId
            );
        }
    }

    [Fact]
    public async Task Friends_duplicate_request_returns_conflict()
    {
        var (_, tokenA, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupa");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dupb");

        using var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA);
        requestReq.Content = JsonContent.Create(new { userId = userBId });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(requestReq)).StatusCode);

        using var dupReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA);
        dupReq.Content = JsonContent.Create(new { userId = userBId });
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(dupReq)).StatusCode);
    }

}
