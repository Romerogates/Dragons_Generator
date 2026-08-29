using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class FriendSupportIntegrationTests
{
    private readonly HttpClient _client;

    public FriendSupportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
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

    [Fact]
    public async Task Support_create_and_list_ticket()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "support");

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", token);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Bug fiche PDF"), "subject" },
            { new StringContent("La dague manque sur ma fiche Lettré."), "message" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticket = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bug fiche PDF", ticket.GetProperty("subject").GetString());
        var ticketId = ticket.GetProperty("id").GetGuid();

        using var listReq = ApiTestAuth.Authed(HttpMethod.Get, "/support/tickets", token);
        var listResponse = await _client.SendAsync(listReq);
        listResponse.EnsureSuccessStatusCode();
        var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            list.EnumerateArray(),
            t => t.GetProperty("id").GetGuid() == ticketId
        );
    }

    [Fact]
    public async Task Support_admin_list_requires_admin_role()
    {
        var (_, userToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "notadmin");
        using var userReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/support/tickets", userToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(userReq)).StatusCode);

        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);
        using var adminReq = ApiTestAuth.Authed(HttpMethod.Get, "/admin/support/tickets", adminToken);
        var adminResponse = await _client.SendAsync(adminReq);
        adminResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Support_rejects_invalid_character_link()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "badchar");

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", token);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Perso cassé"), "subject" },
            { new StringContent("Export JSON incomplet."), "message" },
            { new StringContent(Guid.NewGuid().ToString()), "characterId" },
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(createReq)).StatusCode);
    }

    [Fact]
    public async Task Support_attachment_requires_auth_and_owner_or_admin()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "attachowner");
        var (_, otherToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "attachother");
        var adminToken = await ApiTestAuth.LoginAdminAsync(_client);

        var pngBytes = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        );

        using var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/support/tickets", ownerToken);
        createReq.Content = new MultipartFormDataContent
        {
            { new StringContent("Bug visuel"), "subject" },
            { new StringContent("Capture d'écran jointe."), "message" },
            { new ByteArrayContent(pngBytes), "file", "capture.png" },
        };
        var created = await _client.SendAsync(createReq);
        created.EnsureSuccessStatusCode();
        var ticket = await created.Content.ReadFromJsonAsync<JsonElement>();
        var ticketId = ticket.GetProperty("id").GetGuid();
        Assert.Contains(
            $"/support/tickets/{ticketId}/attachment",
            ticket.GetProperty("attachmentUrl").GetString(),
            StringComparison.Ordinal
        );

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await _client.GetAsync($"/support/tickets/{ticketId}/attachment")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await _client.GetAsync("/uploads/tickets/capture.png")).StatusCode
        );

        using var otherReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            otherToken
        );
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(otherReq)).StatusCode);

        using var ownerReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            ownerToken
        );
        var ownerResponse = await _client.SendAsync(ownerReq);
        ownerResponse.EnsureSuccessStatusCode();
        Assert.Equal("image/png", ownerResponse.Content.Headers.ContentType?.MediaType);

        using var adminReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/support/tickets/{ticketId}/attachment",
            adminToken
        );
        var adminResponse = await _client.SendAsync(adminReq);
        adminResponse.EnsureSuccessStatusCode();
    }
}
