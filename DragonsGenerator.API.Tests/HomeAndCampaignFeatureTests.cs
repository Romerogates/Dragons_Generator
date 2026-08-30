using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

[Collection("ApiIntegration")]
public class HomeAndCampaignFeatureTests
{
    private readonly HttpClient _client;

    public HomeAndCampaignFeatureTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Home_summary_returns_counts_for_logged_in_user()
    {
        var (_, token, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "homeuser");

        using var req = ApiTestAuth.Authed(HttpMethod.Get, "/me/home-summary", token);
        var res = await _client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("savedCharactersCount").GetInt32() >= 0);
        Assert.True(json.TryGetProperty("unreadChatCount", out _));
    }

    [Fact]
    public async Task Player_campaign_view_hides_synopsis_and_story_cast()
    {
        var (_, ownerToken, ownerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "campowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "campplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Test Secret",
                data = new
                {
                    setting = "Eana",
                    regionId = (string?)null,
                    regionName = "",
                    partyLevel = 3,
                    tone = "classic",
                    adventure = "SECRET SYNOPSIS MJ ONLY",
                    creatures = new object[]
                    {
                        new
                        {
                            creatureId = "secret-npc-1",
                            customName = "Seigneur Ombre SECRET",
                            role = "antagonist",
                            category = "npc",
                            challenge = "5",
                            backstory = "BACKSTORY PNJ SECRET",
                        },
                    },
                    encounters = new object[]
                    {
                        new
                        {
                            id = "enc-1",
                            name = "Embuscade SECRET",
                            creatures = Array.Empty<object>(),
                            xpAwarded = false,
                        },
                    },
                    notes = "Notes MJ secrètes",
                    pregenCharacters = new object[]
                    {
                        new
                        {
                            id = "pregen-1",
                            characterId = "char-1",
                            characterName = "Héros Secret Non Assigné",
                            publicHook = "HOOK SECRET NON ASSIGNÉ",
                            dmBackstory = "DM SECRET",
                            dmSecrets = "SECRETS",
                            assignedUserId = (string?)null,
                            status = "ready",
                        },
                        new
                        {
                            id = "pregen-2",
                            characterId = "char-2",
                            characterName = "Mon Héros Assigné",
                            publicHook = "Hook public assigné",
                            dmBackstory = "DM SECRET ASSIGNÉ",
                            dmSecrets = "SECRETS ASSIGNÉS",
                            assignedUserId = playerId.ToString(),
                            status = "assigned",
                        },
                    },
                    sessions = Array.Empty<object>(),
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            var body = await created.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = body.GetProperty("id").GetGuid();
        }

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

        using (var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();
        }

        Guid inviteId;
        using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken))
        {
            var inv = await _client.SendAsync(listInv);
            inv.EnsureSuccessStatusCode();
            var arr = await inv.Content.ReadFromJsonAsync<JsonElement>();
            inviteId = arr[0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using (var getReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", playerToken))
        {
            var get = await _client.SendAsync(getReq);
            get.EnsureSuccessStatusCode();
            var raw = await get.Content.ReadAsStringAsync();
            Assert.DoesNotContain("SECRET SYNOPSIS MJ ONLY", raw);
            Assert.DoesNotContain("Notes MJ secrètes", raw);
            Assert.DoesNotContain("Seigneur Ombre SECRET", raw);
            Assert.DoesNotContain("BACKSTORY PNJ SECRET", raw);
            Assert.DoesNotContain("Embuscade SECRET", raw);
            Assert.DoesNotContain("Héros Secret Non Assigné", raw);
            Assert.DoesNotContain("HOOK SECRET NON ASSIGNÉ", raw);
            Assert.DoesNotContain("DM SECRET ASSIGNÉ", raw);
            Assert.Contains("Mon Héros Assigné", raw);
            Assert.Contains("Hook public assigné", raw);
            var json = JsonDocument.Parse(raw).RootElement;
            Assert.Empty(json.GetProperty("data").GetProperty("creatures").EnumerateArray());
            Assert.Empty(json.GetProperty("data").GetProperty("encounters").EnumerateArray());
            Assert.Equal(1, json.GetProperty("data").GetProperty("pregenCharacters").GetArrayLength());
        }

        using (var getOwnerReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var get = await _client.SendAsync(getOwnerReq);
            get.EnsureSuccessStatusCode();
            var raw = await get.Content.ReadAsStringAsync();
            Assert.Contains("SECRET SYNOPSIS MJ ONLY", raw);
            Assert.Contains("Seigneur Ombre SECRET", raw);
            Assert.Contains("Embuscade SECRET", raw);
        }
    }

    [Fact]
    public async Task Campaign_activity_lists_after_invite()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "actowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "actplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Activity Camp",
                data = new { setting = "", regionId = (string?)null, regionName = "", partyLevel = 1, tone = "classic", adventure = "", creatures = Array.Empty<object>(), encounters = Array.Empty<object>(), notes = "", pregenCharacters = Array.Empty<object>(), sessions = Array.Empty<object>() },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        using (var friendReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/friends/request", ownerToken))
        {
            friendReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(friendReq)).EnsureSuccessStatusCode();
        }

        Guid reqId;
        using (var pending = ApiTestAuth.Authed(HttpMethod.Get, "/me/friends/requests", playerToken))
        {
            var res = await _client.SendAsync(pending);
            res.EnsureSuccessStatusCode();
            var p = await res.Content.ReadFromJsonAsync<JsonElement>();
            reqId = p![0].GetProperty("id").GetGuid();
        }

        using (var acceptFriend = ApiTestAuth.Authed(HttpMethod.Post, $"/me/friends/requests/{reqId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptFriend)).EnsureSuccessStatusCode();
        }

        using (var inviteReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteReq)).EnsureSuccessStatusCode();
        }

        Guid inviteId;
        using (var listInv = ApiTestAuth.Authed(HttpMethod.Get, "/me/campaign-invites", playerToken))
        {
            var inv = await _client.SendAsync(listInv);
            inv.EnsureSuccessStatusCode();
            var arr = await inv.Content.ReadFromJsonAsync<JsonElement>();
            inviteId = arr[0].GetProperty("id").GetGuid();
        }

        using (var acceptReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaign-invites/{inviteId}/accept", playerToken))
        {
            (await _client.SendAsync(acceptReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            var raw = await act.Content.ReadAsStringAsync();
            Assert.True(
                act.IsSuccessStatusCode,
                $"Activity GET failed: {(int)act.StatusCode} {raw}");
            Assert.Contains("invite_sent", raw);
        }

        using (var actPlayerReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity", playerToken))
        {
            var act = await _client.SendAsync(actPlayerReq);
            var raw = await act.Content.ReadAsStringAsync();
            act.EnsureSuccessStatusCode();
            Assert.DoesNotContain("invite_sent", raw);
            Assert.DoesNotContain(playerId.ToString(), raw);
        }
    }
}
