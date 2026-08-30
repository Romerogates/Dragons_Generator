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
    public async Task Opening_initiative_collection_logs_activity_once()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "initpushowner");
        var sessionId = "sess-push-1";
        var scheduledAt = "2026-09-15T19:00:00.0000000+00:00";
        Guid campaignId;

        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Init Push",
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = false,
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
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

        using (var putReq = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", ownerToken))
        {
            putReq.Content = JsonContent.Create(new
            {
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = true,
                                initiativeCode = "XY99",
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
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
            (await _client.SendAsync(putReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity?limit=20", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var items = await act.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = items.EnumerateArray().Select(i => i.GetProperty("kind").GetString()).ToList();
            Assert.Equal(1, kinds.Count(k => k == "initiative_collection_opened"));
            Assert.DoesNotContain(kinds, k => k == "session_updated");
        }

        using (var putReq = ApiTestAuth.Authed(HttpMethod.Put, $"/me/campaigns/{campaignId}", ownerToken))
        {
            putReq.Content = JsonContent.Create(new
            {
                data = new
                {
                    activeSessionId = sessionId,
                    sessions = new object[]
                    {
                        new
                        {
                            id = sessionId,
                            title = "Soirée",
                            scheduledAt,
                            status = "planned",
                            playNotes = "notes live modifiées",
                            activeCombat = new
                            {
                                id = "combat-1",
                                label = "Grotte",
                                round = 1,
                                turnIndex = 0,
                                collectingInitiative = true,
                                initiativeCode = "XY99",
                                combatants = new object[]
                                {
                                    new
                                    {
                                        id = "cb-1",
                                        name = "Gobelin",
                                        kind = "monster",
                                        initiativeBonus = 0,
                                        initiativeRoll = 14,
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
            (await _client.SendAsync(putReq)).EnsureSuccessStatusCode();
        }

        using (var actReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}/activity?limit=20", ownerToken))
        {
            var act = await _client.SendAsync(actReq);
            act.EnsureSuccessStatusCode();
            var items = await act.Content.ReadFromJsonAsync<JsonElement>();
            var kinds = items.EnumerateArray().Select(i => i.GetProperty("kind").GetString()).ToList();
            Assert.Equal(1, kinds.Count(k => k == "initiative_collection_opened"));
            Assert.DoesNotContain(kinds, k => k == "session_updated");
        }
    }

    [Fact]
    public async Task Dm_can_view_proposed_and_approved_player_character_in_campaign()
    {
        var (_, ownerToken, _) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sheetowner");
        var (_, playerToken, playerId) = await ApiTestAuth.RegisterConfirmAndLoginAsync(_client, "sheetplayer");

        Guid campaignId;
        using (var createReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/campaigns", ownerToken))
        {
            createReq.Content = JsonContent.Create(new
            {
                title = "Campagne fiches joueurs",
                data = JsonDocument.Parse("{}").RootElement,
            });
            var create = await _client.SendAsync(createReq);
            create.EnsureSuccessStatusCode();
            var created = await create.Content.ReadFromJsonAsync<JsonElement>();
            campaignId = created!.GetProperty("id").GetGuid();
        }

        Guid characterId;
        using (var charReq = ApiTestAuth.Authed(HttpMethod.Post, "/me/characters", playerToken))
        {
            charReq.Content = JsonContent.Create(new
            {
                name = "Eldrin",
                data = JsonDocument.Parse("""{"name":"Eldrin","totalLevel":3,"classes":[{"classLabel":"Guerrier","level":3}]}""").RootElement,
            });
            var created = await _client.SendAsync(charReq);
            created.EnsureSuccessStatusCode();
            var body = await created.Content.ReadFromJsonAsync<JsonElement>();
            characterId = body!.GetProperty("id").GetGuid();
        }

        await InvitePlayerToCampaignAsync(ownerToken, playerToken, playerId, campaignId);

        using (var proposeReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/propose-character", playerToken))
        {
            proposeReq.Content = JsonContent.Create(new { characterId });
            (await _client.SendAsync(proposeReq)).EnsureSuccessStatusCode();
        }

        Guid memberId;
        using (var detailReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            memberId = body!.GetProperty("members").EnumerateArray()
                .First(m => m.GetProperty("userId").GetGuid() == playerId)
                .GetProperty("id").GetGuid();
        }

        using (var ownerDirectReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/characters/{characterId}", ownerToken))
        {
            var resp = await _client.SendAsync(ownerDirectReq);
            Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        }

        using (var proposedReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/me/campaigns/{campaignId}/members/{memberId}/character?scope=proposed",
            ownerToken))
        {
            var resp = await _client.SendAsync(proposedReq);
            resp.EnsureSuccessStatusCode();
            var sheet = await resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Eldrin", sheet!.GetProperty("name").GetString());
        }

        using (var approveReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/members/{memberId}/approve", ownerToken))
        {
            (await _client.SendAsync(approveReq)).EnsureSuccessStatusCode();
        }

        using (var approvedReq = ApiTestAuth.Authed(
            HttpMethod.Get,
            $"/me/campaigns/{campaignId}/members/{memberId}/character?scope=approved",
            ownerToken))
        {
            var resp = await _client.SendAsync(approvedReq);
            resp.EnsureSuccessStatusCode();
            var sheet = await resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Eldrin", sheet!.GetProperty("name").GetString());
        }

        using (var removeReq = ApiTestAuth.Authed(
            HttpMethod.Delete,
            $"/me/campaigns/{campaignId}/members/{memberId}",
            ownerToken))
        {
            (await _client.SendAsync(removeReq)).EnsureSuccessStatusCode();
        }

        using (var detailAfterReq = ApiTestAuth.Authed(HttpMethod.Get, $"/me/campaigns/{campaignId}", ownerToken))
        {
            var detail = await _client.SendAsync(detailAfterReq);
            detail.EnsureSuccessStatusCode();
            var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Empty(body!.GetProperty("members").EnumerateArray().Where(m =>
                m.GetProperty("userId").GetGuid() == playerId));
        }

        using (var inviteAgainReq = ApiTestAuth.Authed(HttpMethod.Post, $"/me/campaigns/{campaignId}/invites", ownerToken))
        {
            inviteAgainReq.Content = JsonContent.Create(new { userId = playerId });
            (await _client.SendAsync(inviteAgainReq)).EnsureSuccessStatusCode();
        }
    }

    private async Task InvitePlayerToCampaignAsync(
        string ownerToken,
        string playerToken,
        Guid playerId,
        Guid campaignId)
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
    }
}
