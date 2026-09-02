using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class ProfileIntegrationTests
{
    private readonly HttpClient _client;

    public ProfileIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateTestClient();
    }

    [Fact]
    public async Task Profile_update_and_public_view()
    {
        var uniqueName = $"DragonMaster{Guid.NewGuid():N}"[..16];
        var (_, tokenA, userAId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "profila");
        var (_, tokenB, userBId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "profilb");

        using (var patchReq = ApiTestAuth.Authed(HttpMethod.Patch, "/auth/me", tokenA))
        {
            patchReq.Content = JsonContent.Create(new
            {
                displayName = uniqueName,
                bio = "MJ et forgeron de héros.",
                avatarEmoji = "fluent-emoji:dragon",
                accentColor = "amber",
            });
            var patched = await _client.SendAsync(patchReq);
            var patchBody = await patched.Content.ReadAsStringAsync();
            Assert.True(patched.IsSuccessStatusCode, $"PATCH /auth/me → {(int)patched.StatusCode} {patchBody}");
            Assert.Contains(uniqueName, patchBody);
            Assert.Contains("MJ et forgeron", patchBody);
        }

        using (var meReq = ApiTestAuth.Authed(HttpMethod.Get, $"/users/{userAId}/profile", tokenB))
        {
            var profile = await _client.SendAsync(meReq);
            profile.EnsureSuccessStatusCode();
            var json = await profile.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(uniqueName, json.GetProperty("displayName").GetString());
            Assert.False(json.GetProperty("isFriend").GetBoolean());
        }

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

        using (var friendProfileReq = ApiTestAuth.Authed(HttpMethod.Get, $"/users/{userAId}/profile", tokenB))
        {
            var profile = await _client.SendAsync(friendProfileReq);
            profile.EnsureSuccessStatusCode();
            var json = await profile.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("isFriend").GetBoolean());
        }
    }
}
