using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class FriendChatIntegrationTests
{
    private readonly HttpClient _client;

    public FriendChatIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Friend_chat_send_list_and_remove_flow()
    {
        var (_, tokenA, userAId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "chata");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "chatb");

        using (var requestReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", tokenA))
        {
            requestReq.Content = JsonContent.Create(new { userId = userBId });
            (await _client.SendAsync(requestReq)).EnsureSuccessStatusCode();
        }

        Guid requestId;
        using (var pendingReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", tokenB))
        {
            var pending = await _client.SendAsync(pendingReq);
            pending.EnsureSuccessStatusCode();
            var list = await pending.Content.ReadFromJsonAsync<JsonElement>();
            requestId = list[0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(
                   HttpMethod.Post,
                   $"/me/friends/requests/{requestId}/accept",
                   tokenB))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using (var sendReq = ApiTestAuth.Authed(
                   HttpMethod.Post,
                   $"/me/friends/{userBId}/messages",
                   tokenA))
        {
            sendReq.Content = JsonContent.Create(new { body = "Salut l'aventurier !" });
            var sent = await _client.SendAsync(sendReq);
            sent.EnsureSuccessStatusCode();
        }

        using (var listReq = ApiTestAuth.Authed(
                   HttpMethod.Get,
                   $"/me/friends/{userAId}/messages",
                   tokenB))
        {
            var list = await _client.SendAsync(listReq);
            list.EnsureSuccessStatusCode();
            var body = await list.Content.ReadAsStringAsync();
            Assert.Contains("Salut l'aventurier", body);
        }

        using (var removeReq = ApiTestAuth.Authed(HttpMethod.Delete, $"/me/friends/{userBId}", tokenA))
        {
            var removed = await _client.SendAsync(removeReq);
            Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        }

        using (var friendsReq = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends", tokenA))
        {
            var friends = await _client.SendAsync(friendsReq);
            friends.EnsureSuccessStatusCode();
            var body = await friends.Content.ReadFromJsonAsync<JsonElement>();
            Assert.DoesNotContain(
                body.EnumerateArray(),
                u => u.GetProperty("id").GetGuid() == userBId
            );
        }
    }
}
