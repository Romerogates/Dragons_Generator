using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class DungeonLibraryIntegrationTests
{
    private readonly HttpClient _client;

    public DungeonLibraryIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    private static object SampleMap(string name = "Crypte test") =>
        new
        {
            id = Guid.NewGuid().ToString(),
            name,
            theme = "crypt",
            gridWidth = 8,
            gridHeight = 8,
            tiles = Array.Empty<object>(),
            rooms = Array.Empty<object>(),
            markers = Array.Empty<object>(),
            createdAt = DateTimeOffset.UtcNow,
            updatedAt = DateTimeOffset.UtcNow,
        };

    [Fact]
    public async Task Dungeon_crud_roundtrip()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dungeonlib");

        Guid id;
        using (var create = ApiTestAuth.Authed(HttpMethod.Post, "/me/dungeons", token))
        {
            create.Content = JsonContent.Create(new { name = "Crypte test", data = SampleMap() });
            var res = await _client.SendAsync(create);
            Assert.True(
                res.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Unexpected create status {res.StatusCode}");
            id = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var get = ApiTestAuth.Authed(HttpMethod.Get, $"/me/dungeons/{id}", token))
        {
            var detail = await _client.SendAsync(get);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Crypte test", body.GetProperty("name").GetString());
        }

        using (var put = ApiTestAuth.Authed(HttpMethod.Put, $"/me/dungeons/{id}", token))
        {
            put.Content = JsonContent.Create(new { name = "Crypte v2", data = SampleMap("Crypte v2") });
            (await _client.SendAsync(put)).EnsureSuccessStatusCode();
        }

        using (var list = ApiTestAuth.Authed(HttpMethod.Get, "/me/dungeons", token))
        {
            var listRes = await _client.SendAsync(list);
            listRes.EnsureSuccessStatusCode();
            var items = await listRes.Content.ReadFromJsonAsync<JsonElement[]>();
            Assert.Contains(items!, e => e.GetProperty("name").GetString() == "Crypte v2");
        }

        using (var del = ApiTestAuth.Authed(HttpMethod.Delete, $"/me/dungeons/{id}", token))
        {
            Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(del)).StatusCode);
        }
    }

    [Fact]
    public async Task Friend_can_read_shared_dungeon()
    {
        var (_, ownerToken, ownerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dungown");
        var (_, friendToken, friendId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "dungfri");

        using (var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", ownerToken))
        {
            requestReq.Content = JsonContent.Create(new { userId = friendId });
            (await _client.SendAsync(requestReq)).EnsureSuccessStatusCode();
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", friendToken))
        {
            var pending = await _client.SendAsync(pendingReq);
            pending.EnsureSuccessStatusCode();
            var list = await pending.Content.ReadFromJsonAsync<JsonElement>();
            requestId = list[0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(
                   HttpMethod.Post,
                   $"/me/friends/requests/{requestId}/accept",
                   friendToken))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        Guid dungeonId;
        using (var create = ApiTestAuth.Authed(HttpMethod.Post, "/me/dungeons", ownerToken))
        {
            create.Content = JsonContent.Create(new { name = "Partagé", data = SampleMap("Partagé") });
            var res = await _client.SendAsync(create);
            res.EnsureSuccessStatusCode();
            dungeonId = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var get = ApiTestAuth.Authed(
                   HttpMethod.Get,
                   $"/me/friends/{ownerId}/dungeons/{dungeonId}",
                   friendToken))
        {
            var res = await _client.SendAsync(get);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Partagé", body.GetProperty("name").GetString());
        }
    }

    [Fact]
    public async Task Dungeons_require_auth()
    {
        var res = await _client.GetAsync("/me/dungeons");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
