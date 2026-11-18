using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DragonsGenerator.API.Tests;

public partial class HomeAndCampaignFeatureTests
{

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
            Assert.Contains("invite_accepted", raw);
        }
    }

    [Fact]
    public async Task Player_campaign_view_hides_draft_handouts()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "hoowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "hoplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Handouts Test",
                data = new
                {
                    notes = "",
                    handouts = new object[]
                    {
                        new
                        {
                            id = "ho-draft",
                            title = "Brouillon SECRET",
                            body = "Ne pas montrer DRAFT_BODY",
                            kind = "letter",
                            published = false,
                            createdAt = DateTimeOffset.UtcNow.ToString("O"),
                        },
                        new
                        {
                            id = "ho-pub",
                            title = "Lettre publique",
                            body = "Contenu visible PUB_BODY",
                            kind = "letter",
                            published = true,
                            publishedAt = DateTimeOffset.UtcNow.ToString("O"),
                            createdAt = DateTimeOffset.UtcNow.ToString("O"),
                        },
                    },
                    sessions = Array.Empty<object>(),
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    pregenCharacters = Array.Empty<object>(),
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var getReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", playerToken))
        {
            var get = await _client.SendAsync(getReq);
            get.EnsureSuccessStatusCode();
            var raw = await get.Content.ReadAsStringAsync();
            Assert.DoesNotContain("Brouillon SECRET", raw);
            Assert.DoesNotContain("DRAFT_BODY", raw);
            Assert.Contains("Lettre publique", raw);
            Assert.Contains("PUB_BODY", raw);
        }

        using (var getOwner = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var get = await _client.SendAsync(getOwner);
            get.EnsureSuccessStatusCode();
            var raw = await get.Content.ReadAsStringAsync();
            Assert.Contains("Brouillon SECRET", raw);
            Assert.Contains("Lettre publique", raw);
        }
    }

    [Fact]
    public async Task Player_can_submit_initiative_with_code()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "initowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "initplayer");

        var sessionId = "sess-init-1";
        var combatantId = "cb-player-1";
        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Init Test",
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt = DateTimeOffset.UtcNow.ToString("O"),
                            status = "planned",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Embuscade",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = true,
                                initiativeCode = "AB12",
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = combatantId,
                                        name = "Héros",
                                        kind = "player",
                                        initiativeBonus = 2,
                                        memberUserId = playerId.ToString(),
                                    },
                                    new
                                    {
                                        id = "cb-ally",
                                        name = "Allié SECRET",
                                        kind = "player",
                                        initiativeBonus = 4,
                                        memberUserId = Guid.NewGuid().ToString(),
                                    },
                                    new
                                    {
                                        id = "cb-gob",
                                        name = "Gobelin",
                                        kind = "monster",
                                        initiativeBonus = 0,
                                    },
                                },
                            },
                        },
                    },
                    handouts = Array.Empty<object>(),
                    creatures = Array.Empty<object>(),
                    encounters = Array.Empty<object>(),
                    pregenCharacters = Array.Empty<object>(),
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var boardReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/initiative", playerToken))
        {
            var board = await _client.SendAsync(boardReq);
            board.EnsureSuccessStatusCode();
            var json = await board.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("open").GetBoolean());
            Assert.Equal("AB12", json.GetProperty("code").GetString());
            Assert.Equal(1, json.GetProperty("combatants").GetArrayLength());
            Assert.Equal("Héros", json.GetProperty("combatants")[0].GetProperty("name").GetString());
        }

        using (var submitReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/initiative/submit", playerToken))
        {
            submitReq.Content = JsonContent.Create(new { code = "AB12", combatantId, roll = 17 });
            var submit = await _client.SendAsync(submitReq);
            Assert.Equal(System.Net.HttpStatusCode.NoContent, submit.StatusCode);
        }

        using (var duplicateReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/initiative/submit", playerToken))
        {
            duplicateReq.Content = JsonContent.Create(new { code = "AB12", combatantId, roll = 12 });
            var duplicate = await _client.SendAsync(duplicateReq);
            Assert.Equal(System.Net.HttpStatusCode.Conflict, duplicate.StatusCode);
        }

        using (var boardReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/initiative", playerToken))
        {
            var board = await _client.SendAsync(boardReq);
            board.EnsureSuccessStatusCode();
            var json = await board.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(json.GetProperty("combatants")[0].GetProperty("hasRoll").GetBoolean());
        }

        using (var ownerGet = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var get = await _client.SendAsync(ownerGet);
            get.EnsureSuccessStatusCode();
            var raw = await get.Content.ReadAsStringAsync();
            Assert.Contains("initiativeRoll", raw);
            Assert.Contains("17", raw);
            Assert.Contains("playerSubmitted", raw);
        }
    }

    [Fact]
    public async Task Player_patch_live_table_moves_own_pawn_not_map()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "pawnowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "pawnplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Pawn live",
                data = new
                {
                    activeSessionId = "ses-pawn",
                    sessions = new object[]
                    {
                        new
                        {
                            id = "ses-pawn",
                            title = "Soirée",
                            scheduledAt = "2026-11-18T20:00:00Z",
                            status = "planned",
                            activeMapId = "map-keep",
                            tablePawns = new object[]
                            {
                                new { id = $"pawn-{playerId}", name = "Lyra", mapX = 1, mapY = 1, memberUserId = playerId.ToString() },
                                new { id = "pawn-other", name = "Aria", mapX = 2, mapY = 2, memberUserId = "other" },
                            },
                        },
                    },
                },
            });
            var created = await _client.SendAsync(createReq);
            created.EnsureSuccessStatusCode();
            campaignId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var patchReq = ApiTestAuth.Authed(HttpMethod.Patch, $"/me/campaigns/{campaignId}/live-table", playerToken))
        {
            patchReq.Content = JsonContent.Create(new
            {
                sessionId = "ses-pawn",
                activeMapId = "map-hijack",
                tablePawns = new object[]
                {
                    new { id = $"pawn-{playerId}", name = "Lyra", mapX = 8, mapY = 7, memberUserId = playerId.ToString() },
                    new { id = "pawn-other", name = "Aria", mapX = 9, mapY = 9, memberUserId = "other" },
                },
            });
            var patch = await _client.SendAsync(patchReq);
            patch.EnsureSuccessStatusCode();
        }

        using (var getOwner = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var get = await _client.SendAsync(getOwner);
            get.EnsureSuccessStatusCode();
            var data = (await get.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            var session = data.GetProperty("sessions")[0];
            Assert.Equal("map-keep", session.GetProperty("activeMapId").GetString());
            var ownId = $"pawn-{playerId}";
            int ownX = 0, otherX = 0;
            foreach (var pawn in session.GetProperty("tablePawns").EnumerateArray())
            {
                var id = pawn.GetProperty("id").GetString();
                if (id == ownId) ownX = pawn.GetProperty("mapX").GetInt32();
                if (id == "pawn-other") otherX = pawn.GetProperty("mapX").GetInt32();
            }
            Assert.Equal(8, ownX);
            Assert.Equal(2, otherX);
        }
    }
}
